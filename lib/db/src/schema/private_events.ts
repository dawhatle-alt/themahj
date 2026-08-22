import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Deliberately a separate system from private_lessons rather than one table
// with a kind column: the two are sold differently and are expected to diverge
// (events carry an occasion and a venue, lessons carry a skill level).

/** A hosted-event offering, e.g. "Mahjong party for up to 12, 3 hours". */
export const privateEventPackagesTable = pgTable("private_event_packages", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  durationMinutes: integer("duration_minutes").notNull().default(180),
  minPeople: integer("min_people").notNull().default(4),
  maxPeople: integer("max_people").notNull().default(16),
  priceCents: integer("price_cents").notNull().default(0),
  // Cosmetic line under the price ("travel within 20 miles included").
  priceNote: text("price_note"),
  // Most parties need a conversation before money changes hands, so this
  // defaults the other way round from lessons.
  requiresApproval: boolean("requires_approval").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  published: boolean("published").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** One host's request for a private event. */
export const privateEventBookingsTable = pgTable("private_event_bookings", {
  id: serial("id").primaryKey(),
  packageId: integer("package_id"),
  packageTitle: text("package_title").notNull(),
  packagePriceCents: integer("package_price_cents").notNull().default(0),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  groupSize: integer("group_size").notNull().default(4),
  // What the party is for — "50th birthday", "team offsite". Shapes the
  // styling she brings, so it is worth asking up front.
  occasion: text("occasion"),
  // Where they want it held, as free text. Not a structured address: often
  // "my house in Sun City" at enquiry time.
  venue: text("venue"),
  preferredDates: text("preferred_dates"),
  notes: text("notes"),
  // Same two paths as lessons; see private_lessons.ts.
  status: text("status").notNull().default("requested"),
  scheduledDate: text("scheduled_date"),
  scheduledTime: text("scheduled_time"),
  scheduledLocation: text("scheduled_location"),
  adminNotes: text("admin_notes"),
  paymentSessionId: text("payment_session_id"),
  paymentLinkUrl: text("payment_link_url"),
  paymentLinkSentAt: timestamp("payment_link_sent_at", { withTimezone: true }),
  squareOrderId: text("square_order_id"),
  amountPaidCents: integer("amount_paid_cents"),
  scheduledEmailSentAt: timestamp("scheduled_email_sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPrivateEventPackageSchema = createInsertSchema(privateEventPackagesTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export const insertPrivateEventBookingSchema = createInsertSchema(privateEventBookingsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});

export type InsertPrivateEventPackage = z.infer<typeof insertPrivateEventPackageSchema>;
export type PrivateEventPackage = typeof privateEventPackagesTable.$inferSelect;
export type InsertPrivateEventBooking = z.infer<typeof insertPrivateEventBookingSchema>;
export type PrivateEventBooking = typeof privateEventBookingsTable.$inferSelect;
