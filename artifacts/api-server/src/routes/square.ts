import { Router, type IRouter, type Request, type Response } from "express";
import { sql, eq } from "drizzle-orm";
import { db, eventsTable, registrationsTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { sendRegistrationConfirmationEmail } from "../lib/email";
import { getSquareClient, getSquareLocationId, isSquareLocationConfigured, isSandboxMode } from "../lib/square";
import { RegistrationBody } from "./registrations";

const router: IRouter = Router();

const CONTACT_EMAIL = process.env.OWNER_EMAIL ?? process.env.CONTACT_EMAIL ?? "hello@mahjeditco.com";

function getOrigin(req: Request): string {
  if (process.env.PUBLIC_WEB_ORIGIN) return process.env.PUBLIC_WEB_ORIGIN;
  return (
    (req.headers["x-forwarded-proto"] ?? "https") +
    "://" +
    (req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost")
  );
}

const RegistrationCheckoutBody = RegistrationBody.extend({});

// Guest checkout for PAID events — creates a pending registration and returns a
// Square-hosted payment link. Payment confirmation arrives via webhook or the
// confirmation page's polling fallback.
router.post(
  "/registrations/checkout",
  async (req: Request, res: Response): Promise<void> => {
    const client = getSquareClient();
    if (!client) {
      res.status(503).json({
        error: `Payment processing is not yet available. Contact ${CONTACT_EMAIL} to register.`,
      });
      return;
    }

    if (!isSquareLocationConfigured()) {
      logger.error(
        {
          SQUARE_LOCATION_ID: JSON.stringify(process.env.SQUARE_LOCATION_ID ?? null),
          SQUARE_ENVIRONMENT: process.env.SQUARE_ENVIRONMENT ?? "(unset → sandbox)",
        },
        "Registration checkout blocked: SQUARE_LOCATION_ID is missing or still set to the placeholder value",
      );
      res.status(503).json({
        error: `Payment processing is not fully configured yet. Contact ${CONTACT_EMAIL} to register.`,
      });
      return;
    }

    const parsed = RegistrationCheckoutBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
      return;
    }

    const { eventId, name, email, phone, seats, notes } = parsed.data;

    const [event] = await db
      .select()
      .from(eventsTable)
      .where(eq(eventsTable.id, eventId))
      .limit(1);

    if (!event || !event.published) {
      res.status(404).json({ error: "Event not found" });
      return;
    }
    if (event.spotsLeft < seats) {
      res.status(409).json({
        error: event.spotsLeft <= 0
          ? "This event is sold out"
          : `Only ${event.spotsLeft} seat${event.spotsLeft === 1 ? "" : "s"} left`,
      });
      return;
    }

    const priceInCents = event.priceCents ?? 0;
    const origin = getOrigin(req);

    try {
      const [registration] = await db
        .insert(registrationsTable)
        .values({
          eventId,
          name,
          email,
          phone: phone ?? null,
          seats,
          notes: notes ?? null,
          status: priceInCents > 0 ? "pending" : "confirmed",
        })
        .returning();

      if (priceInCents > 0) {
        const idempotencyKey = `reg-${registration.id}-${Date.now()}`;
        const locationId = getSquareLocationId();

        const response = await client.checkout.paymentLinks.create({
          idempotencyKey,
          order: {
            locationId,
            lineItems: [
              {
                name: event.title,
                note: `${event.date} · ${event.location}`,
                quantity: String(seats),
                basePriceMoney: {
                  amount: BigInt(priceInCents),
                  currency: "USD",
                },
              },
            ],
            referenceId: String(registration.id),
          },
          checkoutOptions: {
            // Embed the registration id ourselves so the confirmation page can
            // always resolve the order — Square does not reliably append
            // referenceId/checkoutId (e.g. sandbox tests, Square Pay wallet).
            redirectUrl: `${origin}/?confirmation=${registration.id}`,
            askForShippingAddress: false,
          },
          prePopulatedData: {
            buyerEmail: email,
          },
        });

        const url = response.paymentLink?.url;
        if (!url) {
          throw new Error("Square did not return a checkout URL");
        }

        await db
          .update(registrationsTable)
          .set({ paymentSessionId: response.paymentLink?.id ?? null })
          .where(eq(registrationsTable.id, registration.id));

        res.json({ url, registrationId: registration.id });
      } else {
        await db
          .update(eventsTable)
          .set({ spotsLeft: sql`GREATEST(0, ${eventsTable.spotsLeft} - ${seats})` })
          .where(eq(eventsTable.id, eventId));

        await sendRegistrationConfirmationEmail({
          registrantName: name,
          registrantEmail: email,
          eventTitle: event.title,
          eventDate: event.date,
          eventTime: event.time,
          eventLocation: event.location,
          eventHost: event.host,
          seats,
        });

        res.json({ url: null, registrationId: registration.id });
      }
    } catch (err) {
      logger.error({ err }, "Registration checkout error");
      res.status(500).json({ error: "Could not process registration. Please try again." });
    }
  },
);

async function confirmRegistration(registrationId: number, paymentId: string | null) {
  const [reg] = await db
    .select()
    .from(registrationsTable)
    .where(eq(registrationsTable.id, registrationId))
    .limit(1);

  if (!reg || reg.status !== "pending") return;

  await db
    .update(registrationsTable)
    .set({ status: "confirmed", paymentSessionId: paymentId ?? reg.paymentSessionId })
    .where(eq(registrationsTable.id, registrationId));

  const [evt] = await db
    .select()
    .from(eventsTable)
    .where(eq(eventsTable.id, reg.eventId))
    .limit(1);

  await db
    .update(eventsTable)
    .set({ spotsLeft: sql`GREATEST(0, ${eventsTable.spotsLeft} - ${reg.seats})` })
    .where(eq(eventsTable.id, reg.eventId));

  if (evt) {
    await sendRegistrationConfirmationEmail({
      registrantName: reg.name,
      registrantEmail: reg.email,
      eventTitle: evt.title,
      eventDate: evt.date,
      eventTime: evt.time,
      eventLocation: evt.location,
      eventHost: evt.host,
      seats: reg.seats,
    });
  }

  logger.info({ registrationId, paymentId }, "Registration confirmed via Square webhook");
}

router.post(
  "/webhooks/square",
  async (req: Request & { rawBody?: Buffer }, res: Response): Promise<void> => {
    const sigKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
    const notificationUrl = process.env.SQUARE_WEBHOOK_URL;

    // Signature verification policy:
    // - If SQUARE_WEBHOOK_SIGNATURE_KEY is set, verification is always attempted.
    //   Any missing prerequisite (URL, raw body) is a hard reject in production,
    //   or a logged warning in sandbox mode (allows local testing without a URL).
    // - If the key is not set at all, warn and proceed (key hasn't been configured yet).
    const sandbox = isSandboxMode();

    if (sigKey) {
      if (!notificationUrl) {
        if (sandbox) {
          logger.warn("SQUARE_WEBHOOK_URL not set — skipping signature check (sandbox mode)");
        } else {
          logger.error("SQUARE_WEBHOOK_URL not set — rejecting webhook (set this env var after deploy)");
          res.status(503).json({ error: "Webhook not fully configured" });
          return;
        }
      } else if (!req.rawBody) {
        logger.error("Square webhook: raw body unavailable — rejecting");
        res.status(400).json({ error: "Webhook body unavailable" });
        return;
      } else {
        try {
          const { WebhooksHelper } = require("square");
          const body = req.rawBody.toString("utf8");
          const signature = req.headers["x-square-hmacsha256-signature"] as string;
          const isValid = WebhooksHelper.isValidWebhookEventSignature(
            body,
            signature,
            sigKey,
            notificationUrl,
          );
          if (!isValid) {
            logger.warn("Square webhook signature verification failed — rejecting");
            res.status(400).json({ error: "Invalid webhook signature" });
            return;
          }
        } catch (err) {
          logger.warn({ err }, "Square webhook signature check threw — rejecting");
          res.status(400).json({ error: "Webhook verification error" });
          return;
        }
      }
    } else {
      logger.warn("SQUARE_WEBHOOK_SIGNATURE_KEY not set — skipping signature verification");
    }

    const event = req.body as {
      type?: string;
      data?: {
        object?: {
          payment?: {
            id?: string;
            order_id?: string;
            status?: string;
          };
        };
      };
    };

    const eventType = event.type;
    const payment = event.data?.object?.payment;

    // Handle both payment.completed and payment.updated (status=COMPLETED)
    const isPaymentCompleted =
      eventType === "payment.completed" ||
      (eventType === "payment.updated" && payment?.status === "COMPLETED");

    if (isPaymentCompleted && payment?.order_id) {
      try {
        const client = getSquareClient();
        if (!client) {
          res.json({ received: true });
          return;
        }

        const orderRes = await client.orders.get({ orderId: payment.order_id });
        const referenceId = orderRes.order?.referenceId;

        if (referenceId) {
          const registrationId = parseInt(referenceId, 10);
          if (!Number.isNaN(registrationId)) {
            await confirmRegistration(registrationId, payment.id ?? null);
          }
        }
      } catch (err) {
        logger.error({ err }, "Error processing Square payment webhook");
      }
    }

    res.json({ received: true });
  },
);

export default router;
