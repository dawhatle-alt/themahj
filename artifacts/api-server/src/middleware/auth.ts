import { type Request, type Response, type NextFunction } from "express";
import { timingSafeEqual } from "crypto";
import { logger } from "../lib/logger";

// Admin auth is a single shared secret (ADMIN_TOKEN env var). The admin panel
// sends it as `x-admin-token` (or `Authorization: Bearer <token>`) on every
// admin request after a successful login.
function safeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function extractAdminToken(req: Request): string | null {
  const headerToken = req.headers["x-admin-token"];
  if (typeof headerToken === "string" && headerToken) return headerToken;
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return null;
}

export function isValidAdminToken(token: string | null): boolean {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return false;
  return token !== null && safeEquals(token, expected);
}

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!process.env.ADMIN_TOKEN) {
    logger.error("ADMIN_TOKEN is not set — admin routes are disabled");
    res.status(503).json({ error: "Admin access is not configured. Set the ADMIN_TOKEN environment variable." });
    return;
  }
  if (!isValidAdminToken(extractAdminToken(req))) {
    res.status(401).json({ error: "Not authorized" });
    return;
  }
  next();
}
