/**
 * Vercel serverless entry point.
 * Imports the pre-built Express app bundle -- Vercel does not compile this with tsc.
 */

import app from "../artifacts/api-server/dist/app.mjs";

if (!process.env.DATABASE_URL) {
  throw new Error(
    `Required environment variable "DATABASE_URL" is not set. ` +
      "Add it to your Vercel project environment variables and redeploy."
  );
}

const optional = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "RESEND_API_KEY",
  "SQUARE_ACCESS_TOKEN",
  "SQUARE_LOCATION_ID",
  "ADMIN_TOKEN",
];
for (const key of optional) {
  if (!process.env[key]) {
    console.warn(`[warn] Optional env var "${key}" is not set -- related features may be disabled.`);
  }
}

export default app;
