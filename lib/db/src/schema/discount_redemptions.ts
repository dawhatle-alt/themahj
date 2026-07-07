import { pgTable, text, serial, timestamp, unique } from "drizzle-orm/pg-core";

// One row per (code, email) pair. Created when a checkout starts with the code,
// and stamped with paid_at when the matching order is captured as paid — only
// paid redemptions block reuse, so abandoned checkouts don't burn a code.
export const discountRedemptionsTable = pgTable(
  "discount_redemptions",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull(),
    email: text("email").notNull(),
    orderId: text("order_id"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("discount_redemptions_code_email").on(t.code, t.email)],
);

export type DiscountRedemption = typeof discountRedemptionsTable.$inferSelect;
