import app from "./app";
import { logger } from "./lib/logger";
import { startReminderCron } from "./lib/reminderCron";

// Warn on secrets needed for specific features (server still starts without them)
const warnIfMissing = [
  "DATABASE_URL",       // required for everything that touches the database
  "SUPABASE_URL",       // required for image storage
  "SUPABASE_SERVICE_ROLE_KEY",
  "RESEND_API_KEY",     // required for email delivery
  "SQUARE_ACCESS_TOKEN", // required for paid event checkout
  "SQUARE_LOCATION_ID",
  "ADMIN_TOKEN",        // required for the admin panel
  "PUBLIC_WEB_ORIGIN",  // required for Square redirect URLs in production
] as const;
for (const key of warnIfMissing) {
  if (!process.env[key]) {
    process.stderr.write(`[WARN] ${key} is not set — related features will be disabled\n`);
  }
}

const port = Number(process.env.PORT ?? 3001);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${process.env.PORT}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  startReminderCron();
});
