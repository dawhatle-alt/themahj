# The Mahj Edit — themahjeditco.com

Events site for **The Mahj Edit** (American mahjong classes, open play, and Troop Mahjong nights in Georgetown, TX). Guests browse the calendar and reserve seats — free events confirm instantly, paid events check out through Square. The owner manages everything from the built-in admin panel (footer → Admin).

## Going live

[docs/launch-checklist.md](docs/launch-checklist.md) is the ordered checklist for
taking the site live — Square, DNS, environment variables, and an end-to-end smoke
test. [docs/client-prep.md](docs/client-prep.md) is the client-facing companion,
safe to send as-is.

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
- **Reminder emails**: pick a reminder option on the event; `/api/cron/reminders`
  (Vercel Cron, daily at 14:00 UTC ≈ 9am Central — see `vercel.json`) mails
  everyone confirmed once it comes due. Scheduling uses the event's `start_time`
  interpreted in `EVENT_TIMEZONE` (default `America/Chicago`), never the
  free-text display string. Vercel's Hobby plan permits only one cron run per
  day, so the admin options are day-scale and labelled by when mail actually
  lands; hour-scale lead times need a Pro plan and a more frequent schedule.
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
| `RESEND_API_KEY` | ✅ for emails | Verify the `themahjeditco.com` domain in Resend first |
| `EMAIL_FROM` | optional | Defaults to `noreply@themahjeditco.com` |
| `OWNER_EMAIL` | optional | Reply-to address; defaults to `hello@themahjeditco.com` |
| `PUBLIC_WEB_ORIGIN` | ✅ in prod | `https://themahjeditco.com` |
| `SQUARE_ACCESS_TOKEN` | ✅ for paid events | Square Developer Dashboard → the new production app |
| `SQUARE_LOCATION_ID` | ✅ for paid events | Square Dashboard → Locations |
| `SQUARE_ENVIRONMENT` | ✅ | `production` (anything else = sandbox) |
| `SQUARE_WEBHOOK_SIGNATURE_KEY` | recommended | From the Square webhook subscription |
| `SQUARE_WEBHOOK_URL` | recommended | `https://themahjeditco.com/api/webhooks/square` |
| `CRON_SECRET` | recommended | Protects `/api/cron/reminders`; Vercel sends it automatically |
| `EVENT_TIMEZONE` | optional | IANA zone events are scheduled in; defaults to `America/Chicago` |

## Service ownership

This site is run as managed hosting: the infrastructure accounts stay with the
operator, but anything tied to money or identity belongs to the client.

| Service | Owned by | Why |
|---|---|---|
| Vercel, Supabase, Resend | Operator | Part of the hosting service being provided |
| **Square** | **Client** | Deposits go to the client's bank; revenue is reported under the client's tax ID |
| themahjeditco.com (and mahjeditco.com) | Client | The client should never be locked out of their own domain |

`themahjeditco.com` is the canonical host — it is the address the client has been
promoting, so it is what appears in emails, share previews, and the Square
webhook. `mahjeditco.com` is owned by the client too and forwards to it.

The operator holds only Square **API credentials** (access token, location ID,
webhook signature key) — never the client's bank details, tax ID, or Square
login. The client can rotate or revoke that token from their own dashboard at
any time, which is the intended kill switch.

Do not run this site's payments through a Square account belonging to another
business: Square webhooks are account-wide and registration ids are per-site
serials, deposits and 1099-K reporting would land under the wrong entity, and a
location cannot later be split out into its own account.

## Testing payments without the client's account

Set `SQUARE_ENVIRONMENT=sandbox` with sandbox credentials from any developer
account to exercise the whole paid-registration path (checkout, webhook,
discount codes) using Square's test cards. Going live is then a swap of
`SQUARE_ACCESS_TOKEN`, `SQUARE_LOCATION_ID`, `SQUARE_WEBHOOK_SIGNATURE_KEY`, and
`SQUARE_ENVIRONMENT=production` — no code changes.

## Square webhook setup

In the Square Developer Dashboard create a webhook subscription pointing at
`https://themahjeditco.com/api/webhooks/square` for the events `payment.created` and
`payment.updated`, then copy its signature key into `SQUARE_WEBHOOK_SIGNATURE_KEY`.
(There is no `payment.completed` event — a card payment usually arrives already
`COMPLETED` on `payment.created`, so the handler gates on `payment.status`, not
on the event name.)
(Until the webhook is configured, the confirmation page's polling fallback still
confirms payments — the webhook just makes it immediate and reliable.)

## Database changes

Schema lives in `lib/db/src/schema/`. Apply changes with
`DATABASE_URL=... pnpm --filter @workspace/db run push` (drizzle-kit), or run the
equivalent `ALTER TABLE` in the Supabase SQL editor before deploying code that needs it.
