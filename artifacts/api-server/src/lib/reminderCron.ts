import { db, eventsTable, registrationsTable } from "@workspace/db";
import { and, eq, isNull, isNotNull } from "drizzle-orm";
import { sendReminderEmail } from "./email";
import { logger } from "./logger";

const CHECK_INTERVAL_MS = 30 * 60 * 1000;

// Events are scheduled in the venue's local time; the server runs in UTC.
const EVENT_TIMEZONE = process.env.EVENT_TIMEZONE ?? "America/Chicago";

/**
 * Converts a local wall-clock date/time in `timeZone` to the corresponding UTC
 * instant. Works by asking Intl how the naive-UTC reading of those numbers
 * appears in the target zone, then correcting by the difference — so DST is
 * handled by the platform's tz data rather than hardcoded offsets.
 */
export function zonedTimeToUtc(
  dateStr: string,
  timeStr: string,
  timeZone: string,
): Date | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(timeStr.trim());
  if (!dateMatch || !timeMatch) return null;

  const [y, mo, d] = [Number(dateMatch[1]), Number(dateMatch[2]), Number(dateMatch[3])];
  const [hh, mm] = [Number(timeMatch[1]), Number(timeMatch[2])];
  if (hh > 23 || mm > 59) return null;

  const naive = Date.UTC(y, mo - 1, d, hh, mm);

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(naive));

  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asZone = Date.UTC(
    part("year"),
    part("month") - 1,
    part("day"),
    part("hour"),
    part("minute"),
    part("second"),
  );
  if (Number.isNaN(asZone)) return null;

  return new Date(naive + (naive - asZone));
}

export async function runReminderCheck(): Promise<void> {
  try {
    const now = new Date();

    const events = await db
      .select()
      .from(eventsTable)
      .where(
        and(
          isNotNull(eventsTable.reminderHoursBefore),
          isNull(eventsTable.reminderSentAt),
        ),
      );

    for (const event of events) {
      if (!event.reminderHoursBefore) continue;

      if (!event.startTime) {
        logger.warn(
          { eventId: event.id, eventTitle: event.title },
          "Skipping reminder: event has no start time set",
        );
        continue;
      }

      const eventStart = zonedTimeToUtc(event.date, event.startTime, EVENT_TIMEZONE);
      if (!eventStart) {
        logger.warn(
          { eventId: event.id, date: event.date, startTime: event.startTime },
          "Skipping reminder: could not resolve event start time",
        );
        continue;
      }

      // Never send a "see you soon" for something that already happened — an
      // event created or edited close to its date can leave a due-but-unsent
      // reminder behind.
      if (eventStart <= now) {
        await db
          .update(eventsTable)
          .set({ reminderSentAt: now })
          .where(eq(eventsTable.id, event.id));
        logger.info(
          { eventId: event.id, eventTitle: event.title },
          "Event already started — marking reminder skipped",
        );
        continue;
      }

      const sendAt = new Date(eventStart.getTime() - event.reminderHoursBefore * 60 * 60 * 1000);
      if (now < sendAt) continue;

      logger.info(
        { eventId: event.id, eventTitle: event.title, eventStart, sendAt },
        "Sending reminder emails for event",
      );

      const registrations = await db
        .select()
        .from(registrationsTable)
        .where(
          and(
            eq(registrationsTable.eventId, event.id),
            eq(registrationsTable.status, "confirmed"),
          ),
        );

      // Describe the real remaining gap, not the configured interval — a
      // once-daily cron can fire hours after the reminder came due.
      const hoursUntil = Math.max(1, Math.round((eventStart.getTime() - now.getTime()) / 3_600_000));

      let sentCount = 0;
      for (const reg of registrations) {
        await sendReminderEmail({
          registrantName: reg.name,
          registrantEmail: reg.email,
          eventTitle: event.title,
          eventDate: event.date,
          eventTime: event.time,
          eventLocation: event.location,
          eventHost: event.host,
          hoursUntilEvent: hoursUntil,
        });
        sentCount++;
      }

      await db
        .update(eventsTable)
        .set({ reminderSentAt: now })
        .where(eq(eventsTable.id, event.id));

      logger.info({ eventId: event.id, sentCount }, "Reminder emails sent and event marked");
    }
  } catch (err) {
    logger.error({ err }, "Error in reminder cron check");
  }
}

export function startReminderCron(): void {
  logger.info("Reminder cron started (checks every 30 min)");
  void runReminderCheck();
  setInterval(() => void runReminderCheck(), CHECK_INTERVAL_MS);
}
