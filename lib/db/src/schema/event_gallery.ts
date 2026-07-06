import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const eventGalleryTable = pgTable("event_gallery", {
  id: serial("id").primaryKey(),
  objectPath: text("object_path").notNull(),
  caption: text("caption"),
  eventLabel: text("event_label"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type EventGalleryPhoto = typeof eventGalleryTable.$inferSelect;
