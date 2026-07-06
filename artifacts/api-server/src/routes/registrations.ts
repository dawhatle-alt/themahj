import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, eventsTable, registrationsTable } from "@workspace/db";
import { sendRegistrationConfirmationEmail } from "../lib/email";
import { getSquareClient } from "../lib/square";
import { logger } from "../lib/logger";

const router: IRouter = Router();

export const MAX_SEATS_PER_REGISTRATION = 4;

export const RegistrationBody = z.object({
  eventId: z.number().int().positive(),
  name: z.string().min(1).max(200),
  email: z.string().email(),
  phone: z.string().max(40).optional(),
  seats: z.number().int().min(1).max(MAX_SEATS_PER_REGISTRATION).default(1),
  notes: z.string().max(2000).optional(),
});

function toRegResponse(reg: typeof registrationsTable.$inferSelect) {
  return {
    id: reg.id,
    eventId: reg.eventId,
    name: reg.name,
    email: reg.email,
    phone: reg.phone ?? null,
    seats: reg.seats,
    notes: reg.notes ?? null,
    status: reg.status,
    createdAt: reg.createdAt.toISOString(),
  };
}

// Guest registration for FREE events — no account needed, just name + email.
router.post("/registrations", async (req, res): Promise<void> => {
  const parsed = RegistrationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
    return;
  }

  const { eventId, name, email, phone, seats, notes } = parsed.data;

  const [event] = await db
    .select()
    .from(eventsTable)
    .where(eq(eventsTable.id, eventId));

  if (!event || !event.published) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  if (event.spotsLeft < seats) {
    res.status(409).json({
      error: event.spotsLeft <= 0
        ? "This event is sold out"
        : `Only ${event.spotsLeft} seat${event.spotsLeft === 1 ? "" : "s"} left`,
    });
    return;
  }

  if (event.priceCents !== null && event.priceCents > 0) {
    res.status(400).json({
      error: "This is a paid event. Use POST /registrations/checkout to register.",
    });
    return;
  }

  const [reg] = await db
    .insert(registrationsTable)
    .values({
      eventId,
      name,
      email,
      phone: phone ?? null,
      seats,
      notes: notes ?? null,
      status: "confirmed",
    })
    .returning();

  await db
    .update(eventsTable)
    .set({ spotsLeft: sql`GREATEST(0, ${eventsTable.spotsLeft} - ${seats})` })
    .where(eq(eventsTable.id, eventId));

  await sendRegistrationConfirmationEmail({
    registrantName: name,
    registrantEmail: email,
    eventTitle: event.title,
    eventDate: event.date,
    eventTime: event.time,
    eventLocation: event.location,
    eventHost: event.host,
    seats,
  });

  res.status(201).json({ registration: toRegResponse(reg) });
});

function confirmationPayload(r: {
  reg: typeof registrationsTable.$inferSelect;
  evt: typeof eventsTable.$inferSelect;
}) {
  return {
    registration: {
      ...toRegResponse(r.reg),
      event: {
        id: r.evt.id,
        title: r.evt.title,
        date: r.evt.date,
        time: r.evt.time,
        location: r.evt.location,
        host: r.evt.host,
        priceCents: r.evt.priceCents ?? 0,
        imagePath: r.evt.imagePath ?? null,
      },
    },
  };
}

// Public confirmation lookup — used by the confirmation page after Square redirect.
router.get("/registrations/:id/confirmation", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const rows = await db
    .select({ reg: registrationsTable, evt: eventsTable })
    .from(registrationsTable)
    .innerJoin(eventsTable, eq(registrationsTable.eventId, eventsTable.id))
    .where(eq(registrationsTable.id, id))
    .limit(1);

  if (!rows[0]) {
    res.status(404).json({ error: "Registration not found" });
    return;
  }

  res.json(confirmationPayload(rows[0]));
});

// Polling fallback in case the Square webhook is delayed or not configured.
router.post("/registrations/:id/verify-payment", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const rows = await db
    .select({ reg: registrationsTable, evt: eventsTable })
    .from(registrationsTable)
    .innerJoin(eventsTable, eq(registrationsTable.eventId, eventsTable.id))
    .where(eq(registrationsTable.id, id))
    .limit(1);

  if (!rows[0]) {
    res.status(404).json({ error: "Registration not found" });
    return;
  }

  const { reg, evt } = rows[0];

  if (reg.status === "confirmed") {
    res.json({ status: "confirmed" });
    return;
  }

  if (!reg.paymentSessionId) {
    res.json({ status: reg.status });
    return;
  }

  try {
    const client = getSquareClient();
    if (!client) {
      res.json({ status: reg.status });
      return;
    }

    const linkRes = await client.checkout.paymentLinks.get({ id: reg.paymentSessionId });
    const orderId = linkRes.paymentLink?.orderId;

    if (!orderId) {
      res.json({ status: reg.status });
      return;
    }

    const orderRes = await client.orders.get({ orderId });
    const order = orderRes.order;
    const tenders = (order as { tenders?: Array<{ id?: string }> })?.tenders;
    const isPaid = Array.isArray(tenders) && tenders.length > 0;

    if (isPaid) {
      await db
        .update(registrationsTable)
        .set({ status: "confirmed" })
        .where(eq(registrationsTable.id, id));

      await db
        .update(eventsTable)
        .set({ spotsLeft: sql`GREATEST(0, ${eventsTable.spotsLeft} - ${reg.seats})` })
        .where(eq(eventsTable.id, reg.eventId));

      await sendRegistrationConfirmationEmail({
        registrantName: reg.name,
        registrantEmail: reg.email,
        eventTitle: evt.title,
        eventDate: evt.date,
        eventTime: evt.time,
        eventLocation: evt.location,
        eventHost: evt.host,
        seats: reg.seats,
      });

      logger.info({ registrationId: id, orderId }, "Registration confirmed via payment verification");
      res.json({ status: "confirmed" });
    } else {
      res.json({ status: reg.status });
    }
  } catch (err) {
    logger.error({ err }, "Error verifying payment with Square");
    res.json({ status: reg.status });
  }
});

export default router;
