import { Router, type IRouter } from "express";
import { runReminderCheck } from "../lib/reminderCron";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Vercel Cron (or any external scheduler) hits this to send due reminder emails.
// Vercel sends `Authorization: Bearer ${CRON_SECRET}` automatically when the
// CRON_SECRET env var is set on the project.
router.get("/cron/reminders", async (req, res): Promise<void> => {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    res.status(401).json({ error: "Not authorized" });
    return;
  }
  await runReminderCheck();
  logger.info("Reminder check completed via cron endpoint");
  res.json({ ok: true });
});

export default router;
