import { logger } from "./logger";

export function getSquareClient() {
  const { SquareClient, SquareEnvironment } = require("square");
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) return null;
  const envVar = process.env.SQUARE_ENVIRONMENT;
  const env = isSandboxMode() ? SquareEnvironment.Sandbox : SquareEnvironment.Production;
  if (!envVar) {
    logger.warn("SQUARE_ENVIRONMENT not set — defaulting to Sandbox");
  }
  return new SquareClient({ token, environment: env });
}

export function getSquareLocationId(): string {
  return (process.env.SQUARE_LOCATION_ID ?? "").trim();
}

// True only when a real location ID is configured — i.e. not empty and not left
// as the literal placeholder name (a common env-setup mistake that Square rejects
// with "Invalid location id: SQUARE_LOCATION_ID").
export function isSquareLocationConfigured(): boolean {
  const id = getSquareLocationId();
  return id.length > 0 && id !== "SQUARE_LOCATION_ID";
}

// Case- and whitespace-insensitive: an exact-match check silently sent
// "Production" (and " production") to the sandbox, which fails in the most
// confusing way possible — real credentials, real location, no such location.
export function isSandboxMode(): boolean {
  return (process.env.SQUARE_ENVIRONMENT ?? "").trim().toLowerCase() !== "production";
}

// Square returns money as bigint in this SDK version. This is the total after
// any order-level discount — i.e. what the guest was actually charged.
export function orderTotalCents(order: unknown): number | null {
  const amount = (order as { totalMoney?: { amount?: bigint | number | string } })?.totalMoney?.amount;
  if (amount === undefined || amount === null) return null;
  const cents = Number(amount);
  return Number.isFinite(cents) ? cents : null;
}

export interface SquareApiError {
  category?: string;
  code?: string;
  detail?: string;
  field?: string;
}

// The SDK puts its structured errors in a different place depending on how the
// call failed, so check each shape rather than guessing one.
export function squareErrorDetails(err: unknown): SquareApiError[] {
  const candidates = [
    (err as { errors?: unknown })?.errors,
    (err as { body?: { errors?: unknown } })?.body?.errors,
    (err as { result?: { errors?: unknown } })?.result?.errors,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length > 0) return candidate as SquareApiError[];
  }
  return [];
}

// Distinguishes "the credentials or location are wrong" — which retrying will
// never fix — from a genuinely transient failure.
export function isSquareConfigError(err: unknown): boolean {
  const status = (err as { statusCode?: number })?.statusCode;
  if (status === 401 || status === 403) return true;
  return squareErrorDetails(err).some(
    (e) =>
      e.category === "AUTHENTICATION_ERROR" ||
      e.code === "UNAUTHORIZED" ||
      e.code === "FORBIDDEN" ||
      e.code === "INVALID_LOCATION" ||
      (e.code === "NOT_FOUND" && (e.field ?? "").includes("location_id")),
  );
}
