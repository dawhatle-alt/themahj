import { Resend } from "resend";
import { logger } from "./logger";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.EMAIL_FROM ?? process.env.FROM_EMAIL ?? "noreply@mahjeditco.com";
const CONTACT_EMAIL = process.env.OWNER_EMAIL ?? process.env.CONTACT_EMAIL ?? "hello@mahjeditco.com";

const WEB_ORIGIN = (process.env.PUBLIC_WEB_ORIGIN ?? "https://mahjeditco.com").replace(/\/$/, "");
const LOGO_URL = `${WEB_ORIGIN}/logo-gold.png`;

// Branded header for customer-facing emails. Uses the width attribute (respected
// by most email clients) alongside inline styles, since email CSS support is spotty.
const logoHeader = `
      <div style="text-align:center;padding:8px 0 16px">
        <img src="${LOGO_URL}" alt="The Mahj Edit" width="180" style="width:180px;max-width:60%;height:auto;border:0;outline:none;text-decoration:none" />
      </div>`;

function getClient(): Resend | null {
  if (!RESEND_API_KEY) {
    logger.warn("RESEND_API_KEY is not set — email delivery is disabled");
    return null;
  }
  return new Resend(RESEND_API_KEY);
}

function seatsRow(seats: number): string {
  if (seats <= 1) return "";
  return `<tr><td style="padding:4px 12px 4px 0;color:#666">Seats</td><td style="padding:4px 0"><strong>${seats}</strong></td></tr>`;
}

export async function sendRegistrationConfirmationEmail(opts: {
  registrantName: string;
  registrantEmail: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  eventLocation: string;
  eventHost: string;
  seats?: number;
}): Promise<void> {
  const client = getClient();
  if (!client) return;

  const { registrantName, registrantEmail, eventTitle, eventDate, eventTime, eventLocation, eventHost } = opts;
  const seats = opts.seats ?? 1;

  const { error } = await client.emails.send({
    from: FROM_EMAIL,
    to: [registrantEmail],
    replyTo: CONTACT_EMAIL,
    subject: `You're registered for ${eventTitle}!`,
    html: `${logoHeader}
      <h2>You're in! 🀄</h2>
      <p>Hi ${registrantName},</p>
      <p>Your ${seats > 1 ? `${seats} seats are` : "seat is"} confirmed for <strong>${eventTitle}</strong>.</p>
      <table style="border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:4px 12px 4px 0;color:#666">Date</td><td style="padding:4px 0"><strong>${eventDate}</strong></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666">Time</td><td style="padding:4px 0"><strong>${eventTime}</strong></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666">Location</td><td style="padding:4px 0"><strong>${eventLocation}</strong></td></tr>
        ${seatsRow(seats)}
        <tr><td style="padding:4px 12px 4px 0;color:#666">Host</td><td style="padding:4px 0"><strong>${eventHost}</strong></td></tr>
      </table>
      <p>If you have any questions, reply to this email or reach us at <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>
      <p>See you at the table!<br/>— The Mahj Edit</p>
    `,
    text: `Hi ${registrantName},\n\nYour ${seats > 1 ? `${seats} seats are` : "seat is"} confirmed for ${eventTitle}.\n\nDate: ${eventDate}\nTime: ${eventTime}\nLocation: ${eventLocation}\n${seats > 1 ? `Seats: ${seats}\n` : ""}Host: ${eventHost}\n\nQuestions? Email us at ${CONTACT_EMAIL}.\n\nSee you at the table!\n— The Mahj Edit`,
  });

  if (error) {
    logger.error({ error, to: registrantEmail }, "Failed to send registration confirmation email");
  } else {
    logger.info({ to: registrantEmail, event: eventTitle }, "Registration confirmation email sent");
  }
}

export async function sendCheckinReportEmail(opts: {
  to: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  eventLocation: string;
  participants: { name: string; email: string; status: string; paid: boolean; seats: number }[];
  csv: string;
  csvFilename: string;
}): Promise<void> {
  const client = getClient();
  if (!client) throw new Error("Email delivery is not configured (RESEND_API_KEY missing)");

  const { to, eventTitle, eventDate, eventTime, eventLocation, participants, csv, csvFilename } = opts;
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const totalSeats = participants.reduce((n, p) => n + p.seats, 0);

  const rowsHtml = participants
    .map(
      (p, i) =>
        `<tr>
          <td style="padding:4px 10px;border-bottom:1px solid #eee">${i + 1}</td>
          <td style="padding:4px 10px;border-bottom:1px solid #eee"><strong>${esc(p.name)}</strong></td>
          <td style="padding:4px 10px;border-bottom:1px solid #eee">${esc(p.email)}</td>
          <td style="padding:4px 10px;border-bottom:1px solid #eee">${p.seats}</td>
          <td style="padding:4px 10px;border-bottom:1px solid #eee">${esc(p.status)}</td>
          <td style="padding:4px 10px;border-bottom:1px solid #eee">${p.paid ? "Paid" : "Free"}</td>
        </tr>`,
    )
    .join("");

  const { error } = await client.emails.send({
    from: FROM_EMAIL,
    to: [to],
    replyTo: CONTACT_EMAIL,
    subject: `Check-in list: ${eventTitle} (${totalSeats} seat${totalSeats === 1 ? "" : "s"})`,
    html: `${logoHeader}
      <h2>Check-in list — ${esc(eventTitle)}</h2>
      <p style="margin:4px 0;color:#555">${esc(eventDate)} · ${esc(eventTime)}<br/>${esc(eventLocation)}</p>
      <p><strong>${participants.length}</strong> registration${participants.length === 1 ? "" : "s"} · <strong>${totalSeats}</strong> seat${totalSeats === 1 ? "" : "s"}. A CSV with a check-in column is attached.</p>
      <table style="border-collapse:collapse;margin:16px 0;font-size:14px">
        <tr>
          <th style="padding:4px 10px;text-align:left;border-bottom:2px solid #33272B">#</th>
          <th style="padding:4px 10px;text-align:left;border-bottom:2px solid #33272B">Name</th>
          <th style="padding:4px 10px;text-align:left;border-bottom:2px solid #33272B">Email</th>
          <th style="padding:4px 10px;text-align:left;border-bottom:2px solid #33272B">Seats</th>
          <th style="padding:4px 10px;text-align:left;border-bottom:2px solid #33272B">Status</th>
          <th style="padding:4px 10px;text-align:left;border-bottom:2px solid #33272B">Paid</th>
        </tr>
        ${rowsHtml}
      </table>
    `,
    text: `Check-in list — ${eventTitle}\n${eventDate} · ${eventTime}\n${eventLocation}\n\n${participants.length} registrations, ${totalSeats} seats.\n\n${participants.map((p, i) => `${i + 1}. ${p.name} <${p.email}> — ${p.seats} seat(s), ${p.status}${p.paid ? " (paid)" : ""}`).join("\n")}`,
    attachments: [
      {
        filename: csvFilename,
        content: Buffer.from(csv, "utf8"),
        contentType: "text/csv",
      },
    ],
  });

  if (error) {
    logger.error({ error, to, eventTitle }, "Failed to send check-in report email");
    throw new Error("Check-in report email failed");
  }
  logger.info({ to, eventTitle, count: participants.length }, "Check-in report email sent");
}

export async function sendReminderEmail(opts: {
  registrantName: string;
  registrantEmail: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  eventLocation: string;
  eventHost: string;
  hoursUntilEvent: number;
}): Promise<void> {
  const client = getClient();
  if (!client) return;

  const { registrantName, registrantEmail, eventTitle, eventDate, eventTime, eventLocation, eventHost, hoursUntilEvent } = opts;

  const timeLabel =
    hoursUntilEvent >= 168 ? `${Math.round(hoursUntilEvent / 168)} week` :
    hoursUntilEvent >= 48 ? `${Math.round(hoursUntilEvent / 24)} days` :
    hoursUntilEvent >= 24 ? "1 day" :
    hoursUntilEvent >= 2 ? `${hoursUntilEvent} hours` : "1 hour";

  const { error } = await client.emails.send({
    from: FROM_EMAIL,
    to: [registrantEmail],
    replyTo: CONTACT_EMAIL,
    subject: `Reminder: ${eventTitle} is ${timeLabel} away!`,
    html: `${logoHeader}
      <h2>See you soon! 🀄</h2>
      <p>Hi ${registrantName},</p>
      <p>Just a reminder — <strong>${eventTitle}</strong> is coming up in <strong>${timeLabel}</strong>.</p>
      <table style="border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:4px 12px 4px 0;color:#666">Date</td><td style="padding:4px 0"><strong>${eventDate}</strong></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666">Time</td><td style="padding:4px 0"><strong>${eventTime}</strong></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666">Location</td><td style="padding:4px 0"><strong>${eventLocation}</strong></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666">Host</td><td style="padding:4px 0"><strong>${eventHost}</strong></td></tr>
      </table>
      <p>If you have any questions, reply to this email or reach us at <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>
      <p>Can't wait to see you!<br/>— The Mahj Edit</p>
    `,
    text: `Hi ${registrantName},\n\nJust a reminder — ${eventTitle} is coming up in ${timeLabel}.\n\nDate: ${eventDate}\nTime: ${eventTime}\nLocation: ${eventLocation}\nHost: ${eventHost}\n\nQuestions? Email us at ${CONTACT_EMAIL}.\n\nCan't wait to see you!\n— The Mahj Edit`,
  });

  if (error) {
    logger.error({ error, to: registrantEmail }, "Failed to send reminder email");
  } else {
    logger.info({ to: registrantEmail, event: eventTitle }, "Reminder email sent");
  }
}
