# The Mahj Edit — mahjeditco.com

Events site for **The Mahj Edit** (American mahjong classes, open play, and Troop Mahjong nights in Leander, TX). Guests browse the calendar and reserve seats — free events confirm instantly, paid events check out through Square. The owner manages everything from the built-in admin panel (footer → Admin).

## Structure

pnpm monorepo, deployed on Vercel:

| Path | What it is |
|---|---|
| `artifacts/themahj` | React 19 + Vite frontend (the site) |
| `artifacts/api-server` | Express API, bundled with esbuild, served as a Vercel function under `/api` |
| `lib/db` | Drizzle schema for Supabase Postgres (`events`, `registrations`, `event_gallery`) |
| `api/index.js` | Vercel serverless entry that wraps the built Express app |

## How registration works

- **Free events**: guest fills name/email/seats → registration saved as `confirmed`, seats decremented, confirmation email sent via Resend.
- **Paid events**: a `pending` registration is created and the guest is redirected to a Square-hosted payment link. Square redirects back to `/?confirmation=<id>`; the Square webhook (`/api/webhooks/square`) — with a polling fallback on the confirmation dialog — flips the registration to `confirmed`, decrements seats, and sends the email.
- **Reminder emails**: set "reminder hours before" on an event; `/api/cron/reminders` (Vercel Cron, daily at 14:00 UTC — see `vercel.json`) sends reminders to confirmed guests once due.
- **Admin**: passcode login (checked against `ADMIN_TOKEN`), event CRUD, signups table, per-event check-in CSV, photo gallery uploads to Supabase Storage.

## Local development

```sh
pnpm install
pnpm run dev:api   # Express on :3001 (needs env vars below)
pnpm run dev:web   # Vite on :5000, proxies /api → :3001
```

## Environment variables (Vercel → Project → Settings → Environment Variables)

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | ✅ | Supabase Postgres connection string (Dashboard → Connect → use the **pooler** URI with the db password) |
| `SUPABASE_URL` | ✅ | `https://bjrmimkbeyvhgyofjmiw.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Dashboard → Settings → API keys (needed for photo uploads) |
| `ADMIN_TOKEN` | ✅ | The admin panel passcode — pick a strong one |
| `RESEND_API_KEY` | ✅ for emails | Verify the `mahjeditco.com` domain in Resend first |
| `EMAIL_FROM` | optional | Defaults to `noreply@mahjeditco.com` |
| `OWNER_EMAIL` | optional | Reply-to address; defaults to `hello@mahjeditco.com` |
| `PUBLIC_WEB_ORIGIN` | ✅ in prod | `https://mahjeditco.com` |
| `SQUARE_ACCESS_TOKEN` | ✅ for paid events | Square Developer Dashboard → the new production app |
| `SQUARE_LOCATION_ID` | ✅ for paid events | Square Dashboard → Locations |
| `SQUARE_ENVIRONMENT` | ✅ | `production` (anything else = sandbox) |
| `SQUARE_WEBHOOK_SIGNATURE_KEY` | recommended | From the Square webhook subscription |
| `SQUARE_WEBHOOK_URL` | recommended | `https://mahjeditco.com/api/webhooks/square` |
| `CRON_SECRET` | recommended | Protects `/api/cron/reminders`; Vercel sends it automatically |

## Square webhook setup

In the Square Developer Dashboard create a webhook subscription pointing at
`https://mahjeditco.com/api/webhooks/square` for the events `payment.completed` and
`payment.updated`, then copy its signature key into `SQUARE_WEBHOOK_SIGNATURE_KEY`.
(Until the webhook is configured, the confirmation page's polling fallback still
confirms payments — the webhook just makes it immediate and reliable.)

## Database changes

Schema lives in `lib/db/src/schema/`. Apply changes with
`DATABASE_URL=... pnpm --filter @workspace/db run push` (drizzle-kit), or run the
equivalent `ALTER TABLE` in the Supabase SQL editor before deploying code that needs it.
