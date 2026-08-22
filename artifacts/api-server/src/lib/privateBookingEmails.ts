import { logger } from "./logger";
import { FROM_EMAIL, CONTACT_EMAIL, WEB_ORIGIN, logoHeader, getClient } from "./email";

// Private lessons and private events keep their own tables and routes, but a
// guest reads "your booking is confirmed" the same way either way — so these
// five templates take a label rather than being duplicated per kind.

/** Guests supply free text that lands in HTML, so escape it. */
function esc(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const money = (cents: number): string => `$${(cents / 100).toFixed(2)}`;

function detailRow(label: string, value: string | null | undefined): string {
  if (!value) return "";
  return `<tr><td style="padding:4px 12px 4px 0;color:#666">${esc(label)}</td>` +
    `<td style="padding:4px 0"><strong>${esc(value)}</strong></td></tr>`;
}

const rows = (details: { label: string; value: string | null | undefined }[] | undefined): string =>
  (details ?? []).map((d) => detailRow(d.label, d.value)).join("");

export interface PrivateBookingEmailBase {
  /** "private lesson" or "private event" — used in subjects and body copy. */
  kindLabel: string;
  bookingId: number;
  name: string;
  email: string;
  packageTitle: string;
  groupSize: number;
  /** Kind-specific extras: skill level for lessons, occasion/venue for events. */
  details?: { label: string; value: string | null | undefined }[];
}

/** Guest receipt, sent once Square confirms payment. */
export async function sendPrivateBookingReceiptEmail(
  opts: PrivateBookingEmailBase & { amountPaidCents: number },
): Promise<void> {
  const client = getClient();
  if (!client) return;

  const { error } = await client.emails.send({
    from: FROM_EMAIL,
    to: [opts.email],
    replyTo: CONTACT_EMAIL,
    subject: `Payment received - your ${opts.kindLabel}`,
    html: `${logoHeader}
      <h2>Thank you!</h2>
      <p>Hi ${esc(opts.name)},</p>
      <p>We have received your payment for <strong>${esc(opts.packageTitle)}</strong>.</p>
      <table style="border-collapse:collapse;margin:16px 0">
        ${detailRow("Booking", `#${opts.bookingId}`)}
        ${detailRow("Group size", String(opts.groupSize))}
        ${rows(opts.details)}
        ${detailRow("Paid", money(opts.amountPaidCents))}
      </table>
      <p><strong>What happens next:</strong> we will be in touch shortly to settle the
      date and time that suits you. Nothing further is needed from you right now.</p>
      <p>Just reply to this email if you would like to add anything.</p>
      <p style="margin-top:24px">See you at the table,<br/>The Mahj Edit</p>`,
  });
  if (error) logger.error({ error }, "Failed to send private booking receipt");
}

/** Guest acknowledgement for a request that needs approval before payment. */
export async function sendPrivateBookingRequestAck(
  opts: PrivateBookingEmailBase,
): Promise<void> {
  const client = getClient();
  if (!client) return;

  const { error } = await client.emails.send({
    from: FROM_EMAIL,
    to: [opts.email],
    replyTo: CONTACT_EMAIL,
    subject: `We have your ${opts.kindLabel} request`,
    html: `${logoHeader}
      <h2>Request received</h2>
      <p>Hi ${esc(opts.name)},</p>
      <p>Thanks for asking about <strong>${esc(opts.packageTitle)}</strong>. Nothing has
      been charged - this is just an enquiry at this stage.</p>
      <table style="border-collapse:collapse;margin:16px 0">
        ${detailRow("Request", `#${opts.bookingId}`)}
        ${detailRow("Group size", String(opts.groupSize))}
        ${rows(opts.details)}
      </table>
      <p><strong>What happens next:</strong> we will reply to confirm availability. Once
      a date works for both of us, you will get a secure payment link to hold it.</p>
      <p style="margin-top:24px">Talk soon,<br/>The Mahj Edit</p>`,
  });
  if (error) logger.error({ error }, "Failed to send private booking acknowledgement");
}

/** Owner alert, sent whenever a booking or request lands. */
export async function sendPrivateBookingOwnerNotification(
  opts: PrivateBookingEmailBase & {
    paid: boolean;
    amountPaidCents?: number | null;
    phone?: string | null;
    notes?: string | null;
  },
): Promise<void> {
  const client = getClient();
  if (!client) return;

  const { error } = await client.emails.send({
    from: FROM_EMAIL,
    to: [CONTACT_EMAIL],
    // Reply goes straight to the guest, so she can answer without copying the
    // address out of the admin panel.
    replyTo: opts.email,
    subject: opts.paid
      ? `PAID - ${opts.kindLabel} #${opts.bookingId} from ${opts.name}`
      : `New ${opts.kindLabel} request #${opts.bookingId} from ${opts.name}`,
    html: `${logoHeader}
      <h2>${opts.paid ? "Paid booking" : "New request"}</h2>
      <table style="border-collapse:collapse;margin:16px 0">
        ${detailRow("Package", opts.packageTitle)}
        ${detailRow("Name", opts.name)}
        ${detailRow("Email", opts.email)}
        ${detailRow("Phone", opts.phone)}
        ${detailRow("Group size", String(opts.groupSize))}
        ${rows(opts.details)}
        ${opts.paid && opts.amountPaidCents != null ? detailRow("Paid", money(opts.amountPaidCents)) : ""}
      </table>
      ${opts.notes ? `<p style="color:#666;margin:0 0 4px">Notes</p><p style="white-space:pre-wrap">${esc(opts.notes)}</p>` : ""}
      <p>${opts.paid
        ? "Money has arrived. Agree a date with them, then set it in the admin panel to send their confirmation."
        : "Nothing charged yet. Approve it in the admin panel to email them a payment link."}</p>
      <p><a href="${WEB_ORIGIN}/admin">Open the admin panel</a></p>`,
  });
  if (error) logger.error({ error }, "Failed to send private booking owner notification");
}

/** Sent when the owner approves a request and wants payment. */
export async function sendPrivateBookingPaymentLinkEmail(
  opts: PrivateBookingEmailBase & {
    paymentUrl: string;
    amountCents: number;
    message?: string | null;
  },
): Promise<void> {
  const client = getClient();
  if (!client) return;

  const { error } = await client.emails.send({
    from: FROM_EMAIL,
    to: [opts.email],
    replyTo: CONTACT_EMAIL,
    subject: `Your ${opts.kindLabel} is available - payment link inside`,
    html: `${logoHeader}
      <h2>Good news</h2>
      <p>Hi ${esc(opts.name)},</p>
      <p>We can host <strong>${esc(opts.packageTitle)}</strong> for you. To hold it,
      complete payment of <strong>${money(opts.amountCents)}</strong> using the secure
      link below.</p>
      ${opts.message ? `<p style="white-space:pre-wrap">${esc(opts.message)}</p>` : ""}
      <p style="margin:24px 0">
        <a href="${opts.paymentUrl}"
           style="background:#B98A4A;color:#ffffff;padding:12px 28px;border-radius:999px;text-decoration:none;display:inline-block">
          Pay securely
        </a>
      </p>
      <p style="color:#666;font-size:13px">If the button does not work, paste this into your browser:<br/>${esc(opts.paymentUrl)}</p>
      <p style="margin-top:24px">The Mahj Edit</p>`,
  });
  if (error) logger.error({ error }, "Failed to send private booking payment link");
}

/**
 * Sent once the owner sets the agreed date.
 *
 * Splits on whether money is still outstanding: an unpaid booking must not be
 * told it is "confirmed", or a guest can believe they have a seat they never
 * paid for. When something is due, this doubles as the payment request so the
 * date and the link arrive together rather than in two emails.
 */
export async function sendPrivateBookingScheduledEmail(
  opts: PrivateBookingEmailBase & {
    scheduledDate: string;
    scheduledTime?: string | null;
    scheduledLocation?: string | null;
    amountDueCents?: number | null;
    paymentUrl?: string | null;
  },
): Promise<void> {
  const client = getClient();
  if (!client) return;

  const due = opts.amountDueCents ?? 0;
  const awaitingPayment = due > 0;

  const whenWhere = `
      <table style="border-collapse:collapse;margin:16px 0">
        ${detailRow("Date", opts.scheduledDate)}
        ${detailRow("Time", opts.scheduledTime)}
        ${detailRow("Where", opts.scheduledLocation)}
        ${detailRow("Group size", String(opts.groupSize))}
      </table>`;

  const paymentBlock = awaitingPayment && opts.paymentUrl
    ? `
      <p>To confirm it, please complete payment of <strong>${money(due)}</strong>
      using the secure link below.</p>
      <p style="margin:24px 0">
        <a href="${opts.paymentUrl}"
           style="background:#B98A4A;color:#ffffff;padding:12px 28px;border-radius:999px;text-decoration:none;display:inline-block">
          Pay ${money(due)} securely
        </a>
      </p>
      <p style="color:#666;font-size:13px">If the button does not work, paste this into your browser:<br/>${esc(opts.paymentUrl)}</p>`
    : awaitingPayment
      ? `<p>There is <strong>${money(due)}</strong> outstanding — we will follow up with a payment link shortly.</p>`
      : "";

  const { error } = await client.emails.send({
    from: FROM_EMAIL,
    to: [opts.email],
    replyTo: CONTACT_EMAIL,
    subject: awaitingPayment
      ? `Your ${opts.kindLabel} on ${opts.scheduledDate} - payment to confirm`
      : `Confirmed: your ${opts.kindLabel} on ${opts.scheduledDate}`,
    html: `${logoHeader}
      <h2>${awaitingPayment ? "We have held your date" : "It is in the diary"}</h2>
      <p>Hi ${esc(opts.name)},</p>
      <p>${awaitingPayment
        ? `We have pencilled in your <strong>${esc(opts.packageTitle)}</strong>.`
        : `Your <strong>${esc(opts.packageTitle)}</strong> is confirmed.`}</p>
      ${whenWhere}
      ${paymentBlock}
      <p>If anything changes, just reply to this email.</p>
      <p style="margin-top:24px">See you at the table,<br/>The Mahj Edit</p>`,
  });
  if (error) logger.error({ error }, "Failed to send private booking scheduled email");
}
