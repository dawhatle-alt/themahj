import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const eventsTable = pgTable("events", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  date: text("date").notNull(),
  time: text("time").notNull(),
  location: text("location").notNull(),
  priceCents: integer("price_cents"),
  category: text("category").notNull().default("Class"),
  imagePath: text("image_path"),
  totalSpots: integer("total_spots").notNull().default(16),
  spotsLeft: integer("spots_left").notNull().default(16),
  host: text("host").notNull().default("The Mahj Edit"),
  published: boolean("published").notNull().default(false),
  featured: boolean("featured").notNull().default(false),
  reminderHoursBefore: integer("reminder_hours_before"),
  reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEventSchema = createInsertSchema(eventsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof eventsTable.$inferSelect;
