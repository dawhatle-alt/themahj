import { db, eventsTable, registrationsTable } from "@workspace/db";
import { and, eq, isNull, isNotNull } from "drizzle-orm";
import { sendReminderEmail } from "./email";
import { logger } from "./logger";

const CHECK_INTERVAL_MS = 30 * 60 * 1000;

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

      const eventDateTime = parseDateTimeToUTC(event.date, event.time);
      if (!eventDateTime) continue;

      const sendAt = new Date(eventDateTime.getTime() - event.reminderHoursBefore * 60 * 60 * 1000);

      if (now >= sendAt) {
        logger.info(
          { eventId: event.id, eventTitle: event.title, sendAt },
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
            hoursUntilEvent: event.reminderHoursBefore,
          });
          sentCount++;
        }

        await db
          .update(eventsTable)
          .set({ reminderSentAt: now })
          .where(eq(eventsTable.id, event.id));

        logger.info(
          { eventId: event.id, sentCount },
          "Reminder emails sent and event marked",
        );
      }
    }
  } catch (err) {
    logger.error({ err }, "Error in reminder cron check");
  }
}

function parseDateTimeToUTC(dateStr: string, timeStr: string): Date | null {
  const clean = `${dateStr} ${timeStr}`.replace(/–.*$/, "").trim();
  const d = new Date(clean);
  return isNaN(d.getTime()) ? null : d;
}

export function startReminderCron(): void {
  logger.info("Reminder cron started (checks every 30 min)");
  void runReminderCheck();
  setInterval(() => void runReminderCheck(), CHECK_INTERVAL_MS);
}
