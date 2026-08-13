import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Editable page copy, keyed by a dotted name ("about.lead"). Deliberately a
// key/value table rather than a column per field: the admin panel only ever
// reads and writes whole keys, and adding a new editable string then costs a
// seed row instead of a migration.
//
// Each key holds plain text, never markup — the page supplies the styling, so
// the client cannot break the layout by editing copy. The one structural
// convention is that "*.body" keys split into paragraphs on blank lines.
export const siteContentTable = pgTable("site_content", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SiteContent = typeof siteContentTable.$inferSelect;
