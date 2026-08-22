import { Router, type IRouter, type Request, type Response } from "express";
import { asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, privateLessonPackagesTable, privateLessonBookingsTable } from "@workspace/db";
import { requireAdmin } from "../middleware/auth";
import { logger } from "../lib/logger";
import { getSquareClient, orderTotalCents, isSquareConfigError } from "../lib/square";
import {
  lessonReference,
  createPrivatePaymentLink,
  PAID_STATUSES,
  confirmPrivateLessonBooking,
} from "../lib/privateBookings";
import {
  sendPrivateBookingRequestAck,
  sendPrivateBookingOwnerNotification,
  sendPrivateBookingPaymentLinkEmail,
  sendPrivateBookingScheduledEmail,
} from "../lib/privateBookingEmails";

const router: IRouter = Router();

const KIND_LABEL = "private lesson";

function getOrigin(req: Request): string {
  if (process.env.PUBLIC_WEB_ORIGIN) return process.env.PUBLIC_WEB_ORIGIN;
  return (req.headers["x-forwarded-proto"] ?? "https") + "://" + req.headers.host;
}

const toPackage = (row: typeof privateLessonPackagesTable.$inferSelect) => ({
  id: row.id,
  title: row.title,
  description: row.description,
  durationMinutes: row.durationMinutes,
  minPeople: row.minPeople,
  maxPeople: row.maxPeople,
  priceCents: row.priceCents,
  priceNote: row.priceNote,
  requiresApproval: row.requiresApproval,
  sortOrder: row.sortOrder,
  published: row.published,
});

const toBooking = (row: typeof privateLessonBookingsTable.$inferSelect) => ({
  id: row.id,
  packageId: row.packageId,
  packageTitle: row.packageTitle,
  packagePriceCents: row.packagePriceCents,
  name: row.name,
  email: row.email,
  phone: row.phone,
  groupSize: row.groupSize,
  skillLevel: row.skillLevel,
  preferredTimes: row.preferredTimes,
  locationPreference: row.locationPreference,
  notes: row.notes,
  status: row.status,
  scheduledDate: row.scheduledDate,
  scheduledTime: row.scheduledTime,
  scheduledLocation: row.scheduledLocation,
  adminNotes: row.adminNotes,
  paymentLinkUrl: row.paymentLinkUrl,
  amountPaidCents: row.amountPaidCents,
  createdAt: row.createdAt,
});

/** Kind-specific rows shown in every email about a lesson. */
const lessonDetails = (b: typeof privateLessonBookingsTable.$inferSelect) => [
  { label: "Skill level", value: b.skillLevel },
  { label: "Preferred times", value: b.preferredTimes },
  { label: "Location", value: b.locationPreference },
];

const emailBase = (b: typeof privateLessonBookingsTable.$inferSelect) => ({
  kindLabel: KIND_LABEL,
  bookingId: b.id,
  name: b.name,
  email: b.email,
  // "General enquiry" is how a package-less booking is stored; it reads
  // badly in a sentence, so customers see the kind instead.
  packageTitle: b.packageTitle === "General enquiry" ? "Private lesson" : b.packageTitle,
  groupSize: b.groupSize,
  details: lessonDetails(b),
});

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

router.get("/private-lessons/packages", async (_req, res): Promise<void> => {
  try {
    const rows = await db
      .select()
      .from(privateLessonPackagesTable)
      .where(eq(privateLessonPackagesTable.published, true))
      .orderBy(asc(privateLessonPackagesTable.sortOrder), asc(privateLessonPackagesTable.id));
    res.json({ packages: rows.map(toPackage) });
  } catch (err) {
    logger.error({ err }, "Failed to list private lesson packages");
    res.json({ packages: [] });
  }
});

const RequestBody = z.object({
  // Optional: a guest can ask a general question before she has published
  // any packages, or when none of them quite fit.
  packageId: z.number().int().positive().nullable().optional(),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).optional().nullable(),
  groupSize: z.number().int().min(1).max(50),
  skillLevel: z.string().trim().max(60).optional().nullable(),
  preferredTimes: z.string().trim().max(1000).optional().nullable(),
  locationPreference: z.string().trim().max(300).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

router.post("/private-lessons/request", async (req: Request, res: Response): Promise<void> => {
  const parsed = RequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Check the form and try again." });
    return;
  }
  const body = parsed.data;

  // Enquiries without a package are first-class: "tell us about your event"
  // has to work before anything is published, and not every guest knows which
  // option they want. Those arrive unpriced for the owner to quote by hand.
  let pkg: typeof privateLessonPackagesTable.$inferSelect | null = null;
  if (body.packageId) {
    const [found] = await db
      .select()
      .from(privateLessonPackagesTable)
      .where(eq(privateLessonPackagesTable.id, body.packageId))
      .limit(1);

    if (!found || !found.published) {
      res.status(404).json({ error: "That lesson is no longer available." });
      return;
    }
    if (body.groupSize < found.minPeople || body.groupSize > found.maxPeople) {
      res.status(400).json({
        error: `${found.title} is for ${found.minPeople}–${found.maxPeople} people.`,
      });
      return;
    }
    pkg = found;
  }

  // Only a published, priced, non-approval package charges immediately.
  const payNow = !!pkg && !pkg.requiresApproval && pkg.priceCents > 0;

  // Price and title are snapshotted: editing the package later must not
  // rewrite what this guest agreed to.
  const [booking] = await db
    .insert(privateLessonBookingsTable)
    .values({
      packageId: pkg?.id ?? null,
      packageTitle: pkg?.title ?? "General enquiry",
      packagePriceCents: pkg?.priceCents ?? 0,
      name: body.name,
      email: body.email,
      phone: body.phone ?? null,
      groupSize: body.groupSize,
      skillLevel: body.skillLevel ?? null,
      preferredTimes: body.preferredTimes ?? null,
      locationPreference: body.locationPreference ?? null,
      notes: body.notes ?? null,
      status: payNow ? "pending" : "requested",
    })
    .returning();

  // Enquiry, free, or approval-first: nothing is charged now. The `!pkg` arm
  // also narrows the type for the checkout path below.
  if (!payNow || !pkg) {
    await Promise.all([
      sendPrivateBookingRequestAck(emailBase(booking)),
      sendPrivateBookingOwnerNotification({
        ...emailBase(booking),
        paid: false,
        phone: booking.phone,
        notes: booking.notes,
      }),
    ]);
    res.status(201).json({ bookingId: booking.id, url: null, status: booking.status });
    return;
  }

  // Pay-now: straight to Square.
  try {
    const origin = getOrigin(req);
    const { url, paymentLinkId } = await createPrivatePaymentLink({
      reference: lessonReference(booking.id),
      title: pkg.title,
      note: `${pkg.durationMinutes} min · ${body.groupSize} ${body.groupSize === 1 ? "person" : "people"}`,
      amountCents: pkg.priceCents,
      buyerEmail: body.email,
      redirectUrl: `${origin}/private-lessons?booking=${booking.id}`,
    });

    await db
      .update(privateLessonBookingsTable)
      .set({ paymentSessionId: paymentLinkId, paymentLinkUrl: url, updatedAt: new Date() })
      .where(eq(privateLessonBookingsTable.id, booking.id));

    res.status(201).json({ bookingId: booking.id, url, status: "pending" });
  } catch (err) {
    // Leave the row behind as a request rather than losing the enquiry: she can
    // still follow it up by hand if Square is misconfigured.
    await db
      .update(privateLessonBookingsTable)
      .set({ status: "requested", updatedAt: new Date() })
      .where(eq(privateLessonBookingsTable.id, booking.id));
    await sendPrivateBookingOwnerNotification({
      ...emailBase(booking),
      paid: false,
      phone: booking.phone,
      notes: booking.notes,
    });

    logger.error({ err, bookingId: booking.id }, "Private lesson checkout failed");
    res.status(isSquareConfigError(err) ? 503 : 502).json({
      error: "We couldn't start checkout, but your request reached us — we'll be in touch.",
      bookingId: booking.id,
    });
  }
});

router.get("/private-lessons/bookings/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [booking] = await db
    .select()
    .from(privateLessonBookingsTable)
    .where(eq(privateLessonBookingsTable.id, id))
    .limit(1);

  if (!booking) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }

  // Deliberately narrow: this is reachable by guessing an id, so it returns
  // only what the confirmation screen needs to say "you're booked".
  res.json({
    booking: {
      id: booking.id,
      packageTitle: booking.packageTitle,
      status: booking.status,
      groupSize: booking.groupSize,
      name: booking.name,
    },
  });
});

/** Polling fallback for the confirmation screen when the webhook is slow. */
router.post("/private-lessons/bookings/:id/verify-payment", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [booking] = await db
    .select()
    .from(privateLessonBookingsTable)
    .where(eq(privateLessonBookingsTable.id, id))
    .limit(1);
  if (!booking) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }
  if (booking.status !== "pending" && booking.status !== "awaiting_payment") {
    res.json({ status: booking.status });
    return;
  }
  if (!booking.paymentSessionId) {
    res.json({ status: booking.status });
    return;
  }

  try {
    const client = getSquareClient();
    if (!client) {
      res.json({ status: booking.status });
      return;
    }

    const linkRes = await client.checkout.paymentLinks.get({ id: booking.paymentSessionId });
    const orderId = linkRes.paymentLink?.orderId;
    if (!orderId) {
      res.json({ status: booking.status });
      return;
    }

    const orderRes = await client.orders.get({ orderId });
    const order = orderRes.order;
    const tenders = (order as { tenders?: Array<{ id?: string }> })?.tenders;
    const isPaid = Array.isArray(tenders) && tenders.length > 0;

    if (!isPaid) {
      res.json({ status: booking.status });
      return;
    }

    await confirmPrivateLessonBooking(id, {
      orderId,
      amountPaidCents: orderTotalCents(order),
    });
    logger.info({ bookingId: id, orderId }, "Private lesson confirmed via payment verification");
    res.json({ status: "paid" });
  } catch (err) {
    logger.error({ err, bookingId: id }, "Private lesson payment verification failed");
    res.json({ status: booking.status });
  }
});

// ---------------------------------------------------------------------------
// Admin — packages
// ---------------------------------------------------------------------------

const PackageBody = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(4000).optional().default(""),
  durationMinutes: z.number().int().min(15).max(1440),
  minPeople: z.number().int().min(1).max(50),
  maxPeople: z.number().int().min(1).max(50),
  priceCents: z.number().int().min(0),
  priceNote: z.string().trim().max(200).optional().nullable(),
  requiresApproval: z.boolean().optional().default(false),
  sortOrder: z.number().int().optional().default(0),
  published: z.boolean().optional().default(false),
});

router.get("/admin/private-lessons/packages", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(privateLessonPackagesTable)
    .orderBy(asc(privateLessonPackagesTable.sortOrder), asc(privateLessonPackagesTable.id));
  res.json({ packages: rows.map(toPackage) });
});

router.post("/admin/private-lessons/packages", requireAdmin, async (req, res): Promise<void> => {
  const parsed = PackageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Check the fields." });
    return;
  }
  if (parsed.data.maxPeople < parsed.data.minPeople) {
    res.status(400).json({ error: "Maximum people cannot be less than the minimum." });
    return;
  }
  const [row] = await db.insert(privateLessonPackagesTable).values(parsed.data).returning();
  res.status(201).json({ package: toPackage(row) });
});

router.put("/admin/private-lessons/packages/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = PackageBody.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Check the fields." });
    return;
  }
  const [row] = await db
    .update(privateLessonPackagesTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(privateLessonPackagesTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Package not found" });
    return;
  }
  res.json({ package: toPackage(row) });
});

router.delete("/admin/private-lessons/packages/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  // Bookings keep their own title/price snapshot and a nullable packageId, so
  // deleting an offering never destroys paid history.
  await db
    .update(privateLessonBookingsTable)
    .set({ packageId: null })
    .where(eq(privateLessonBookingsTable.packageId, id));
  await db.delete(privateLessonPackagesTable).where(eq(privateLessonPackagesTable.id, id));
  res.sendStatus(204);
});

// ---------------------------------------------------------------------------
// Admin — bookings
// ---------------------------------------------------------------------------

router.get("/admin/private-lessons/bookings", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(privateLessonBookingsTable)
    .orderBy(desc(privateLessonBookingsTable.createdAt));
  res.json({ bookings: rows.map(toBooking) });
});

const BookingUpdate = z.object({
  status: z.enum([
    "requested", "awaiting_payment", "pending", "paid", "scheduled", "completed", "cancelled",
  ]).optional(),
  // The agreed price for THIS booking. Seeded from the package when there
  // was one, but a general enquiry arrives at zero for the owner to quote,
  // so it has to be editable rather than a frozen snapshot.
  packagePriceCents: z.number().int().min(0).optional(),
  scheduledDate: z.string().trim().max(40).optional().nullable(),
  scheduledTime: z.string().trim().max(60).optional().nullable(),
  scheduledLocation: z.string().trim().max(300).optional().nullable(),
  adminNotes: z.string().trim().max(4000).optional().nullable(),
});

router.put("/admin/private-lessons/bookings/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = BookingUpdate.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Check the fields." });
    return;
  }

  const [existing] = await db
    .select()
    .from(privateLessonBookingsTable)
    .where(eq(privateLessonBookingsTable.id, id))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }

  const dateChanged =
    parsed.data.scheduledDate !== undefined && parsed.data.scheduledDate !== existing.scheduledDate;

  const [row] = await db
    .update(privateLessonBookingsTable)
    .set({
      ...parsed.data,
      // A genuine reschedule should re-notify; saving the same date twice
      // should not.
      ...(dateChanged ? { scheduledEmailSentAt: null } : {}),
      updatedAt: new Date(),
    })
    .where(eq(privateLessonBookingsTable.id, id))
    .returning();

  // Setting a date is what tells the guest it is really happening — but an
  // unpaid booking must not be told it is "confirmed", or someone believes they
  // hold a place they never paid for. When money is still due the date and the
  // payment link go out together rather than as two separate emails.
  if (row.scheduledDate && !row.scheduledEmailSentAt && row.status !== "cancelled") {
    const alreadyPaid = PAID_STATUSES.has(row.status);
    const amountDue = alreadyPaid ? 0 : row.packagePriceCents;
    let paymentUrl = row.paymentLinkUrl;

    if (amountDue > 0 && !paymentUrl) {
      try {
        const origin = getOrigin(req);
        const created = await createPrivatePaymentLink({
          reference: lessonReference(row.id),
          title: row.packageTitle,
          amountCents: amountDue,
          buyerEmail: row.email,
          redirectUrl: `${origin}/private-lessons?booking=${row.id}`,
        });
        paymentUrl = created.url;
        await db
          .update(privateLessonBookingsTable)
          .set({
            paymentSessionId: created.paymentLinkId,
            paymentLinkUrl: created.url,
            paymentLinkSentAt: new Date(),
          })
          .where(eq(privateLessonBookingsTable.id, id));
      } catch (err) {
        // Still send the date — the email says a link will follow rather than
        // pretending nothing is owed.
        logger.error({ err, bookingId: id }, "Could not create a payment link for the scheduled email");
      }
    }

    await sendPrivateBookingScheduledEmail({
      ...emailBase(row),
      scheduledDate: row.scheduledDate,
      scheduledTime: row.scheduledTime,
      scheduledLocation: row.scheduledLocation,
      amountDueCents: amountDue,
      paymentUrl,
    });

    await db
      .update(privateLessonBookingsTable)
      .set({
        scheduledEmailSentAt: new Date(),
        status: alreadyPaid ? "scheduled" : amountDue > 0 ? "awaiting_payment" : row.status,
      })
      .where(eq(privateLessonBookingsTable.id, id));
  }

  const [fresh] = await db
    .select()
    .from(privateLessonBookingsTable)
    .where(eq(privateLessonBookingsTable.id, id))
    .limit(1);
  res.json({ booking: toBooking(fresh) });
});

/** Approves a request: creates the Square link and emails it to the guest. */
router.post(
  "/admin/private-lessons/bookings/:id/send-payment-link",
  requireAdmin,
  async (req, res): Promise<void> => {
    const id = parseInt(req.params.id as string, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const message = typeof req.body?.message === "string" ? req.body.message.slice(0, 2000) : null;
    const amountOverride = Number.isInteger(req.body?.amountCents) ? (req.body.amountCents as number) : null;

    const [booking] = await db
      .select()
      .from(privateLessonBookingsTable)
      .where(eq(privateLessonBookingsTable.id, id))
      .limit(1);
    if (!booking) {
      res.status(404).json({ error: "Booking not found" });
      return;
    }

    const amount = amountOverride ?? booking.packagePriceCents;
    if (amount <= 0) {
      res.status(400).json({ error: "Set an amount above zero before sending a payment link." });
      return;
    }

    try {
      const origin = getOrigin(req);
      const { url, paymentLinkId } = await createPrivatePaymentLink({
        reference: lessonReference(booking.id),
        title: booking.packageTitle,
        note: `${booking.groupSize} ${booking.groupSize === 1 ? "person" : "people"}`,
        amountCents: amount,
        buyerEmail: booking.email,
        redirectUrl: `${origin}/private-lessons?booking=${booking.id}`,
      });

      await db
        .update(privateLessonBookingsTable)
        .set({
          status: "awaiting_payment",
          paymentSessionId: paymentLinkId,
          paymentLinkUrl: url,
          paymentLinkSentAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(privateLessonBookingsTable.id, id));

      await sendPrivateBookingPaymentLinkEmail({
        ...emailBase(booking),
        paymentUrl: url,
        amountCents: amount,
        message,
      });

      res.json({ url });
    } catch (err) {
      logger.error({ err, bookingId: id }, "Failed to send private lesson payment link");
      res.status(502).json({ error: "Could not create the payment link. Check Square settings." });
    }
  },
);

export default router;
