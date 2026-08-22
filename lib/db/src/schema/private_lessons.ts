import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/** An instruction offering the owner sells, e.g. "60-minute lesson for 1–2". */
export const privateLessonPackagesTable = pgTable("private_lesson_packages", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  durationMinutes: integer("duration_minutes").notNull().default(60),
  minPeople: integer("min_people").notNull().default(1),
  maxPeople: integer("max_people").notNull().default(4),
  priceCents: integer("price_cents").notNull().default(0),
  // Cosmetic line under the price ("+$25 per extra guest"). Never arithmetic —
  // the charge is always priceCents.
  priceNote: text("price_note"),
  // The per-package payment toggle. false = guest pays at Square immediately;
  // true = the request arrives unpaid and the owner sends a payment link once a
  // date is agreed. Cheap lessons want the former, bespoke ones the latter.
  requiresApproval: boolean("requires_approval").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  published: boolean("published").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** One guest's request for a private lesson. */
export const privateLessonBookingsTable = pgTable("private_lesson_bookings", {
  id: serial("id").primaryKey(),
  // Nullable so retiring a package never deletes or orphans paid history.
  packageId: integer("package_id"),
  // Snapshot of what was bought. Editing a package later must not rewrite what
  // a guest already agreed to pay.
  packageTitle: text("package_title").notNull(),
  packagePriceCents: integer("package_price_cents").notNull().default(0),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  groupSize: integer("group_size").notNull().default(1),
  skillLevel: text("skill_level"),
  // Free text ("weekday evenings, or Saturday mornings"). Deliberately not a
  // calendar — the owner settles the real time by email.
  preferredTimes: text("preferred_times"),
  locationPreference: text("location_preference"),
  notes: text("notes"),
  // pending → paid → scheduled → completed        (pay-now packages)
  // requested → awaiting_payment → paid → scheduled → completed  (approval)
  // cancelled from any. Only paid/scheduled/completed mean money arrived.
  status: text("status").notNull().default("pending"),
  scheduledDate: text("scheduled_date"),
  scheduledTime: text("scheduled_time"),
  scheduledLocation: text("scheduled_location"),
  adminNotes: text("admin_notes"),
  paymentSessionId: text("payment_session_id"),
  // Square checkout URL mailed to the guest after approval; kept so the owner
  // can re-send it by hand if the mail goes astray.
  paymentLinkUrl: text("payment_link_url"),
  paymentLinkSentAt: timestamp("payment_link_sent_at", { withTimezone: true }),
  squareOrderId: text("square_order_id"),
  amountPaidCents: integer("amount_paid_cents"),
  // Stops a duplicate "your lesson is confirmed" mail when the owner saves
  // twice; cleared when the date changes so a genuine reschedule does resend.
  scheduledEmailSentAt: timestamp("scheduled_email_sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPrivateLessonPackageSchema = createInsertSchema(privateLessonPackagesTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export const insertPrivateLessonBookingSchema = createInsertSchema(privateLessonBookingsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});

export type InsertPrivateLessonPackage = z.infer<typeof insertPrivateLessonPackageSchema>;
export type PrivateLessonPackage = typeof privateLessonPackagesTable.$inferSelect;
export type InsertPrivateLessonBooking = z.infer<typeof insertPrivateLessonBookingSchema>;
export type PrivateLessonBooking = typeof privateLessonBookingsTable.$inferSelect;
