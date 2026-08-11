import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";

// Event categories are admin-managed rather than hard-coded. `color` holds a
// brand palette key (jade / rose / gold / crak / ink), not a raw hex value, so a
// new category can never drift off the site's colour scheme.
export const eventCategoriesTable = pgTable("event_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  color: text("color").notNull().default("gold"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type EventCategory = typeof eventCategoriesTable.$inferSelect;
