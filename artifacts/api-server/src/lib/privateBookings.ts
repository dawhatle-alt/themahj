import { eq } from "drizzle-orm";
import { db, privateLessonBookingsTable, privateEventBookingsTable } from "@workspace/db";
import { logger } from "./logger";
import { getSquareClient, getSquareLocationId } from "./square";
import {
  sendPrivateBookingReceiptEmail,
  sendPrivateBookingOwnerNotification,
} from "./privateBookingEmails";

/**
 * Square's referenceId is ONE namespace for the whole account, and the events
 * webhook reads a bare integer as a registration id. Private bookings must
 * therefore be prefixed, or lesson booking #7 would confirm registration #7.
 */
export const LESSON_REFERENCE_PREFIX = "plesson-";
export const EVENT_REFERENCE_PREFIX = "pevent-";

export type PrivateKind = "lesson" | "event";

export const lessonReference = (id: number): string => `${LESSON_REFERENCE_PREFIX}${id}`;
export const eventReference = (id: number): string => `${EVENT_REFERENCE_PREFIX}${id}`;

/**
 * Resolves a Square referenceId to a private booking, or null when it is not
 * one — which the caller should read as "this is a plain event registration".
 */
export function parsePrivateReference(
  referenceId: string | null | undefined,
): { kind: PrivateKind; id: number } | null {
  if (!referenceId) return null;

  const match = (prefix: string, kind: PrivateKind) => {
    if (!referenceId.startsWith(prefix)) return null;
    const id = parseInt(referenceId.slice(prefix.length), 10);
    return Number.isNaN(id) ? null : { kind, id };
  };

  return match(LESSON_REFERENCE_PREFIX, "lesson") ?? match(EVENT_REFERENCE_PREFIX, "event");
}

/** Statuses that mean money has already been recorded against a booking. */
const PAID_STATUSES = new Set(["paid", "scheduled", "completed"]);

interface ConfirmOpts {
  paymentId?: string | null;
  orderId?: string | null;
  amountPaidCents?: number | null;
}

/**
 * Marks a lesson booking paid and sends the receipt + owner alert exactly once.
 *
 * Reached from the Square webhook and from the confirmation page's polling
 * fallback, so it has to be idempotent: only the first transition into a paid
 * status sends mail, while the payment reference is recorded either way.
 */
export async function confirmPrivateLessonBooking(
  bookingId: number,
  opts: ConfirmOpts = {},
): Promise<void> {
  const [booking] = await db
    .select()
    .from(privateLessonBookingsTable)
    .where(eq(privateLessonBookingsTable.id, bookingId))
    .limit(1);
  if (!booking) {
    logger.warn({ bookingId }, "Square payment referenced an unknown lesson booking");
    return;
  }

  const alreadyPaid = PAID_STATUSES.has(booking.status);

  await db
    .update(privateLessonBookingsTable)
    .set({
      status: alreadyPaid ? booking.status : "paid",
      paymentSessionId: opts.paymentId ?? booking.paymentSessionId,
      squareOrderId: opts.orderId ?? booking.squareOrderId,
      amountPaidCents: opts.amountPaidCents ?? booking.amountPaidCents,
      updatedAt: new Date(),
    })
    .where(eq(privateLessonBookingsTable.id, bookingId));

  if (alreadyPaid) return;

  const base = {
    kindLabel: "private lesson",
    bookingId: booking.id,
    name: booking.name,
    email: booking.email,
    packageTitle: booking.packageTitle,
    groupSize: booking.groupSize,
    details: [
      { label: "Skill level", value: booking.skillLevel },
      { label: "Preferred times", value: booking.preferredTimes },
      { label: "Location", value: booking.locationPreference },
    ],
  };
  const amount = opts.amountPaidCents ?? booking.packagePriceCents;

  await Promise.all([
    sendPrivateBookingReceiptEmail({ ...base, amountPaidCents: amount }),
    sendPrivateBookingOwnerNotification({
      ...base,
      paid: true,
      amountPaidCents: amount,
      phone: booking.phone,
      notes: booking.notes,
    }),
  ]);
}

/** The private-event twin of {@link confirmPrivateLessonBooking}. */
export async function confirmPrivateEventBooking(
  bookingId: number,
  opts: ConfirmOpts = {},
): Promise<void> {
  const [booking] = await db
    .select()
    .from(privateEventBookingsTable)
    .where(eq(privateEventBookingsTable.id, bookingId))
    .limit(1);
  if (!booking) {
    logger.warn({ bookingId }, "Square payment referenced an unknown event booking");
    return;
  }

  const alreadyPaid = PAID_STATUSES.has(booking.status);

  await db
    .update(privateEventBookingsTable)
    .set({
      status: alreadyPaid ? booking.status : "paid",
      paymentSessionId: opts.paymentId ?? booking.paymentSessionId,
      squareOrderId: opts.orderId ?? booking.squareOrderId,
      amountPaidCents: opts.amountPaidCents ?? booking.amountPaidCents,
      updatedAt: new Date(),
    })
    .where(eq(privateEventBookingsTable.id, bookingId));

  if (alreadyPaid) return;

  const base = {
    kindLabel: "private event",
    bookingId: booking.id,
    name: booking.name,
    email: booking.email,
    packageTitle: booking.packageTitle,
    groupSize: booking.groupSize,
    details: [
      { label: "Occasion", value: booking.occasion },
      { label: "Venue", value: booking.venue },
      { label: "Preferred dates", value: booking.preferredDates },
    ],
  };
  const amount = opts.amountPaidCents ?? booking.packagePriceCents;

  await Promise.all([
    sendPrivateBookingReceiptEmail({ ...base, amountPaidCents: amount }),
    sendPrivateBookingOwnerNotification({
      ...base,
      paid: true,
      amountPaidCents: amount,
      phone: booking.phone,
      notes: booking.notes,
    }),
  ]);
}

/** Dispatches a Square reference to whichever private booking it belongs to. */
export async function confirmPrivateBooking(
  ref: { kind: PrivateKind; id: number },
  opts: ConfirmOpts = {},
): Promise<void> {
  if (ref.kind === "lesson") await confirmPrivateLessonBooking(ref.id, opts);
  else await confirmPrivateEventBooking(ref.id, opts);
}

/**
 * Creates a Square payment link for a private booking.
 *
 * Used by both flows: pay-now packages call it during the request, and
 * approval packages call it later when the owner approves. The reference is
 * what ties the eventual webhook back to the booking.
 */
export async function createPrivatePaymentLink(opts: {
  reference: string;
  title: string;
  note?: string | null;
  amountCents: number;
  buyerEmail: string;
  redirectUrl: string;
}): Promise<{ url: string; paymentLinkId: string | null }> {
  const client = getSquareClient();
  if (!client) throw new Error("Square is not configured");

  const response = await client.checkout.paymentLinks.create({
    // Time-suffixed so a retry after a failure is a fresh link rather than
    // Square replaying the previous response.
    idempotencyKey: `${opts.reference}-${Date.now()}`,
    order: {
      locationId: getSquareLocationId(),
      lineItems: [
        {
          name: opts.title,
          ...(opts.note ? { note: opts.note } : {}),
          quantity: "1",
          basePriceMoney: { amount: BigInt(opts.amountCents), currency: "USD" },
        },
      ],
      referenceId: opts.reference,
    },
    checkoutOptions: {
      redirectUrl: opts.redirectUrl,
      askForShippingAddress: false,
    },
    prePopulatedData: { buyerEmail: opts.buyerEmail },
  });

  const url = response.paymentLink?.url;
  if (!url) throw new Error("Square did not return a checkout URL");
  // The link id is what the confirmation page's polling fallback resolves the
  // order through, so it has to travel back with the URL.
  return { url, paymentLinkId: response.paymentLink?.id ?? null };
}
