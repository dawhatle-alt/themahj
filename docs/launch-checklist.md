# Launch checklist — The Mahj Edit

Everything still needed to take the site live, in the order it has to happen.
Work top to bottom: DNS has to exist before Resend and Square can be verified,
and environment variables only take effect on a redeploy.

Send [client-prep.md](client-prep.md) to the client ahead of the meeting so she
arrives with her Square details, event content, and the GoDaddy delegate invite
already sent.

Reference for values and behaviour: [../README.md](../README.md).

---

## Phase 0 — Before the meeting (operator)

- [ ] Accept the **GoDaddy delegate invite** and confirm you can reach the DNS
      records for `mahjeditco.com` from your own login
- [ ] In **Resend → API keys**: delete the `TheMahjEdit` key and recreate it with
      **Sending access** instead of Full access. It lives in Vercel env vars, and
      full access would also reach BougieBams and FortressAI in the same account
- [ ] In **Resend → Domains**: add `mahjeditco.com` and copy the DKIM/SPF records
      it generates (you'll paste them into GoDaddy in Phase 2)
- [ ] In **Vercel → Project → Settings → Domains**: add `mahjeditco.com` and
      `www.mahjeditco.com`, and copy the records Vercel displays
- [ ] Confirm the Vercel **Root Directory** setting is empty (repo root), not
      `artifacts/themahj`
- [ ] Decide whether `hello@mahjeditco.com` will be a real mailbox; if not, get
      the address the client actually reads

---

## Phase 1 — Square account (client drives, at the meeting)

The client types everything here. You should not handle her bank details, tax ID,
or Square password.

- [ ] Client creates the Square account at squareup.com in **her** name, with her
      business info, bank account, and tax ID
- [ ] Client sets up 2FA on **her** phone and saves the recovery codes
- [ ] Confirm the **public business name / statement descriptor** reads as
      "The Mahj Edit" — this is what appears on students' card statements
- [ ] At **developer.squareup.com**, create an application named "The Mahj Edit"
- [ ] From the application's **Production** tab, copy the **access token**
- [ ] Copy the **location ID** (application → Locations, or Square Dashboard →
      Account & Settings → Locations)
- [ ] Create a **webhook subscription**:
      - URL: `https://mahjeditco.com/api/webhooks/square`
      - Events: `payment.created` and `payment.updated`
      - Copy the **signature key**
- [ ] Note whether the account activated immediately or went to review — if under
      review, treat paid events as not yet launchable

> The webhook path is `/api/webhooks/square`. Getting this wrong is silent:
> payments still complete and the confirmation page's polling fallback still
> confirms them, but every webhook 404s. (That is exactly the state the
> bougiebams.com site is in — worth fixing there while you're in Square.)

---

## Phase 2 — Domain and DNS (GoDaddy)

Do the Vercel and Resend records in one sitting so there's a single propagation
wait.

- [ ] In GoDaddy DNS for `mahjeditco.com`, add the **Vercel** records:
      - `A` record for the apex (`@`) → the IP Vercel shows (typically
        `76.76.21.21`)
      - `CNAME` for `www` → `cname.vercel-dns.com`
- [ ] Add the **Resend** records: the DKIM `TXT` record and the SPF `TXT` record
      from Resend → Domains
- [ ] **Decline** Vercel's offer to change the nameservers to Vercel. Keeping
      GoDaddy as the DNS host means every future record (Resend, mailbox, anything
      else) lives in one place the client owns
- [ ] Remove GoDaddy's default parking records if they conflict with the apex `A`
      record
- [ ] Wait for propagation, then confirm:
      - [ ] Vercel shows both domains as **Valid**
      - [ ] Resend shows `mahjeditco.com` as **Verified**
      - [ ] `https://mahjeditco.com` loads the site (not the registrar lander)

---

## Phase 3 — Environment variables (Vercel)

**Settings → Environment Variables**, then **redeploy** — changes do not affect
the running deployment until a new build.

Already set:

- [ ] `DATABASE_URL` — Supabase **Transaction pooler** URI, password
      percent-encoded (`#` → `%23`)
- [ ] `SUPABASE_URL` — `https://bjrmimkbeyvhgyofjmiw.supabase.co`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `RESEND_API_KEY` — the recreated Sending-access key

To add or confirm:

- [ ] `ADMIN_TOKEN` — the client's chosen admin passcode
- [ ] `PUBLIC_WEB_ORIGIN` — `https://mahjeditco.com` (used for the Square return
      redirect and email links; wrong value sends buyers to the wrong host)
- [ ] `EMAIL_FROM` — `noreply@mahjeditco.com`
- [ ] `OWNER_EMAIL` — the reply-to address the client actually reads
- [ ] `SQUARE_ACCESS_TOKEN`
- [ ] `SQUARE_LOCATION_ID`
- [ ] `SQUARE_ENVIRONMENT` — `production` (anything else is treated as sandbox)
- [ ] `SQUARE_WEBHOOK_SIGNATURE_KEY`
- [ ] `SQUARE_WEBHOOK_URL` — `https://mahjeditco.com/api/webhooks/square`
- [ ] `CRON_SECRET` — any long random string; protects `/api/cron/reminders`
- [ ] `EVENT_TIMEZONE` — only if events are ever not in `America/Chicago`
- [ ] **Redeploy** and confirm the deployment goes green

---

## Phase 4 — Smoke test with real credentials

Run these against the live domain before handing over. They validate the whole
chain rather than individual settings.

**Admin access**

- [ ] Footer → **Admin**, sign in with `ADMIN_TOKEN`
- [ ] All five tabs load: Events, Registrations, Orders, Discount Codes, Photos

**Free event — proves database + email**

- [ ] Create a free test event (published, start time set, reminder "Morning of
      the event")
- [ ] Register yourself through the public page
- [ ] Confirmation email arrives at your address — *this is the single best proof
      that the Resend key, domain verification, and from-address are all correct*
- [ ] Seat count decremented, registration shows in the Registrations tab

**Paid event — proves Square end to end**

- [ ] Create a $1 test event and reserve a seat with a real card
- [ ] Square checkout shows "The Mahj Edit" and the correct amount
- [ ] After paying, the return page confirms and the confirmation email arrives
- [ ] Registration flips from `pending` to `confirmed`; seats decrement
- [ ] The order appears in the **Orders** tab as Paid
- [ ] **Refund the $1 in Square**

**Discount codes**

- [ ] Create a test code, apply it at checkout, confirm the discounted total
- [ ] Confirm the same code + email is rejected the second time
- [ ] Confirm an invalid code is rejected before reaching Square

**Reports and gallery**

- [ ] Download a check-in CSV for an event
- [ ] Email a check-in list to the client's address
- [ ] Upload a gallery photo and a cover image; both display on the public site

**Presentation**

- [ ] Open the site on the client's actual phone: home, calendar, reserve a seat
- [ ] Share the URL into a text or Facebook post and confirm the preview card
      shows the gold logo (run it through Facebook's Sharing Debugger and
      LinkedIn's Post Inspector if the preview is stale)

**Cleanup**

- [ ] Delete all test events and registrations
- [ ] Confirm the Registrations and Orders tabs are clear of test data

---

## Phase 5 — Real content

- [ ] Enter the client's real events (start/end times, prices, seats, covers)
- [ ] Upload gallery photos from past events
- [ ] Confirm the About page copy and founder bio read the way she wants
- [ ] Publish: uncheck nothing that should be live, and check that the calendar
      and "Next at the table" cards on the home page look right

---

## Phase 6 — Handover notes for the client

- [ ] Show her the admin panel: creating an event, viewing registrations,
      downloading a check-in list, uploading photos
- [ ] Confirm she has her admin passcode saved in a password manager
- [ ] Explain what she owns (**Square account, domain**) versus what you host
      (Vercel, Supabase, Resend)
- [ ] Explain that revoking the Square token in her dashboard stops the site
      taking payments — her kill switch
- [ ] Set expectations on the known limits below

### Known limits worth stating plainly

- **Reminder emails go out in the morning**, and only at day-scale lead times
  ("morning of", "day before", "about a week"). The hosting plan permits one
  scheduled run per day; hour-scale reminders need a Vercel Pro upgrade.
- **Paid events can very occasionally oversell.** Seats are only claimed when
  payment clears, so two people paying at the same moment for one remaining seat
  will both succeed. The payment is always honoured and the event is flagged in
  the logs so she can add a chair or refund.
- **Guests can't cancel themselves.** Cancellations come to her by email and she
  removes the registration in the admin panel, which returns the seat.
- **Square may hold early deposits** or ask for documentation while a new
  account settles.

---

## Still open / not blocking launch

- [ ] Contact form or a clearer "ask a question" path — currently the footer just
      displays an email address
- [ ] Transfer plan if the arrangement ever ends: Vercel and Supabase projects
      can both be transferred to the client's own accounts without a rebuild
