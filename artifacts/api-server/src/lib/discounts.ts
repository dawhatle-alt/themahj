import { eq, and, sql, isNotNull, desc } from "drizzle-orm";
import { db, discountCodesTable, discountRedemptionsTable } from "@workspace/db";

export interface ResolvedDiscount {
  code: string;
  percent: number;
}

/**
 * Resolves a guest-entered discount code to a percentage for event checkout.
 * Returns null when the code is unknown or inactive.
 */
export async function resolveDiscount(raw: string): Promise<ResolvedDiscount | null> {
  const code = raw.trim().toUpperCase();
  if (!code) return null;

  const [row] = await db
    .select()
    .from(discountCodesTable)
    .where(eq(discountCodesTable.code, code))
    .limit(1);

  if (!row || !row.active) return null;
  return { code, percent: row.discountPercent };
}

const normalizeEmail = (email: string) => email.trim().toLowerCase();

/** True when this code has already been used on a PAID order by this email. */
export async function hasRedeemed(code: string, email: string): Promise<boolean> {
  const [row] = await db
    .select({ id: discountRedemptionsTable.id })
    .from(discountRedemptionsTable)
    .where(
      and(
        eq(discountRedemptionsTable.code, code.trim().toUpperCase()),
        eq(discountRedemptionsTable.email, normalizeEmail(email)),
        isNotNull(discountRedemptionsTable.paidAt),
      ),
    )
    .limit(1);
  return !!row;
}

/**
 * Records that a checkout was started with this code/email, linked to the Square
 * order so the redemption can be marked paid on capture. Re-running (retry after
 * an abandoned checkout) just points the pair at the newest order.
 */
export async function recordPendingRedemption(code: string, email: string, orderId: string): Promise<void> {
  await db
    .insert(discountRedemptionsTable)
    .values({ code: code.trim().toUpperCase(), email: normalizeEmail(email), orderId })
    .onConflictDoUpdate({
      target: [discountRedemptionsTable.code, discountRedemptionsTable.email],
      set: { orderId },
      // Never re-point a redemption that already consumed the code.
      setWhere: sql`${discountRedemptionsTable.paidAt} IS NULL`,
    });
}

/** All recorded redemptions, newest first — for the admin view. */
export async function listRedemptions() {
  return db.select().from(discountRedemptionsTable).orderBy(desc(discountRedemptionsTable.createdAt));
}

/**
 * Removes a redemption record, reinstating the code for that email (used for
 * customer-service resets). Returns false if not found.
 */
export async function deleteRedemption(id: number): Promise<boolean> {
  const [row] = await db
    .delete(discountRedemptionsTable)
    .where(eq(discountRedemptionsTable.id, id))
    .returning({ id: discountRedemptionsTable.id });
  return !!row;
}

/** Stamps the redemption tied to this order as consumed. Safe no-op otherwise. */
export async function markRedemptionPaid(orderId: string): Promise<void> {
  await db
    .update(discountRedemptionsTable)
    .set({ paidAt: new Date() })
    .where(and(eq(discountRedemptionsTable.orderId, orderId), sql`${discountRedemptionsTable.paidAt} IS NULL`));
}
