import { logger } from "./logger";

export function getSquareClient() {
  const { SquareClient, SquareEnvironment } = require("square");
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) return null;
  const envVar = process.env.SQUARE_ENVIRONMENT;
  const env = envVar === "production"
    ? SquareEnvironment.Production
    : SquareEnvironment.Sandbox;
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

export function isSandboxMode(): boolean {
  return process.env.SQUARE_ENVIRONMENT !== "production";
}
