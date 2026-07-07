import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const discountCodesTable = pgTable("discount_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  discountPercent: integer("discount_percent").notNull(),
  description: text("description"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type DiscountCode = typeof discountCodesTable.$inferSelect;
export type NewDiscountCode = typeof discountCodesTable.$inferInsert;
