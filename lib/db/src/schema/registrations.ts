import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const registrationsTable = pgTable("registrations", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  seats: integer("seats").notNull().default(1),
  notes: text("notes"),
  status: text("status").notNull().default("confirmed"),
  paymentSessionId: text("payment_session_id"),
  // Recorded at checkout. discount_redemptions keys on (code, email) and links
  // to a Square order id, which can't be joined back to a registration — the
  // registration only knows its payment *link* id.
  discountCode: text("discount_code"),
  // The amount Square actually captured, read off the order at confirmation.
  // Null while pending; 0 for free events.
  amountPaidCents: integer("amount_paid_cents"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRegistrationSchema = createInsertSchema(registrationsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertRegistration = z.infer<typeof insertRegistrationSchema>;
export type Registration = typeof registrationsTable.$inferSelect;
