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
      records for `themahjeditco.com` from your own login
- [ ] In **Resend → API keys**: delete the `TheMahjEdit` key and recreate it with
      **Sending access** instead of Full access. It lives in Vercel env vars, and
      full access would also reach BougieBams and FortressAI in the same account
- [ ] In **Resend → Domains**: add `themahjeditco.com` and copy the DKIM/SPF records
      it generates (you'll paste them into GoDaddy in Phase 2)
- [ ] In **Vercel → Project → Settings → Domains**: add `themahjeditco.com` and
      `www.themahjeditco.com`, and copy the records Vercel displays
- [ ] Confirm the Vercel **Root Directory** setting is empty (repo root), not
      `artifacts/themahj`
- [ ] Confirm the address the client actually reads. There is no MX on the apex,
      so `hello@themahjeditco.com` is NOT a mailbox — mail to it bounces. As of
      2026-08-22 the client uses `themahjeditco@gmail.com`

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
      - URL: `https://themahjeditco.com/api/webhooks/square`
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

The client owns several similar domains. **`themahjeditco.com` is canonical** —
it is the address she has been promoting. Every other domain she owns forwards
to it and carries no records of its own.

Do the Vercel and Resend records in one sitting so there's a single propagation
wait.

**Clear the way first** — GoDaddy locks records that something else already owns:

- [ ] `themahjeditco.com` → **Websites + Marketing**: disconnect the
      "launching soon" Website Builder site from the domain. Until this is done
      GoDaddy holds the apex and refuses an `A` record. Export any email signups
      the coming-soon page collected before disconnecting
- [ ] Confirm nothing else claims the apex — no forwarding rule on
      `themahjeditco.com` itself (Domain → **Products** tab → Connect Domain)

**Then add the records on `themahjeditco.com`:**

- [ ] `A` record for the apex (`@`) → the IP Vercel shows (typically
      `76.76.21.21`)
- [ ] `CNAME` for `www` → `cname.vercel-dns.com`
- [ ] The **Resend** records for this domain: DKIM `TXT`, SPF `TXT`, and the
      `send` `MX` record. Resend verification is **per-domain** — a verified
      `mahjeditco.com` does nothing for mail sent from `themahjeditco.com`
- [ ] **Decline** Vercel's offer to change the nameservers to Vercel. Keeping
      GoDaddy as the DNS host means every future record (Resend, mailbox, anything
      else) lives in one place the client owns
- [ ] Remove GoDaddy's default parking records if they conflict with the apex `A`
      record

**Then the secondary domains:**

The client owns at least five domains, spread across **three separate GoDaddy
accounts**. Known as of 2026-08-10:

| Domain | Role |
|---|---|
| `themahjeditco.com` | **canonical** — the live site |
| `mahjeditco.com` | redirect ✅ done |
| `themahjeditofficial.com` | had a Website Builder site attached |
| `mahjeditofficial.com` | parked lander |
| `themahjedit.net` | had a Website Builder site attached |

- [ ] **Consolidate the three GoDaddy accounts into one.** Moving a domain
      between GoDaddy accounts is an internal account change — free, immediate,
      and *not* a registrar transfer, so no 60-day lock. Do this before the DNS
      work: one login, one delegate invite, one renewal calendar
- [ ] Check whether the Website Builder sites are on **paid** plans — the client
      may be paying monthly for placeholder pages. Export any email signups
      before disconnecting them
- [ ] Decide which domains are worth renewing at all (~$20–25/year each) rather
      than renewing all five by default
- [ ] For each non-canonical domain: clear whatever owns the apex (builder site
      or forwarding rule), set `A` `@` → `216.150.1.1` and `CNAME` `www` →
      `cname.vercel-dns.com`, then add both hosts in Vercel as **308 redirects**
      to `themahjeditco.com`
      - GoDaddy forwarding is the lower-effort alternative but cannot serve a
        valid certificate — `https://` on those domains would warn. Prefer the
        Vercel redirect, and do not mix the two approaches
- [ ] The Resend DKIM/SPF/MX records left on `mahjeditco.com` are now dead
      weight — harmless, but remove them so the zone doesn't imply mail is sent
      from there

**Renewal — the largest ongoing risk in the whole setup:**

- [ ] Turn on **auto-renew for `themahjeditco.com`** and confirm the payment
      method on file is current. DNS, SSL, Resend verification, and the Square
      webhook URL are all anchored to that one registration; if it lapses the
      site goes dark and the domain becomes available to anyone
- [ ] Confirm the client — not the operator — is the registrant of record

**Then confirm (after propagation):**

- [ ] Vercel shows `themahjeditco.com` and `www.themahjeditco.com` as **Valid**
- [ ] Resend shows `themahjeditco.com` as **Verified**
- [ ] `https://themahjeditco.com` loads the site (not the registrar lander)
- [ ] `https://mahjeditco.com` lands on `themahjeditco.com` with the URL bar
      showing the canonical domain

---

## Phase 3 — Environment variables (Vercel)

**Settings → Environment Variables**, then **redeploy** — changes do not affect
the running deployment until a new build.

Already set:

- [ ] `DATABASE_URL` — Supabase **Transaction pooler** URI, password
      percent-encoded (`#` → `%23`)
- [ ] `RESEND_API_KEY` — the recreated Sending-access key

**Missing in Production as of 2026-08-10** — without these, every admin image
upload fails with "Image storage isn't configured on the server", and existing
cover images render as broken:

- [ ] `SUPABASE_URL` — `https://bjrmimkbeyvhgyofjmiw.supabase.co`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` — Supabase → Settings → API → `service_role`

Quick way to verify without logging in: `curl -sI https://themahjeditco.com/api/storage/objects/x`
should return a `Location:` starting with `https://bjrmimkbeyvhgyofjmiw.supabase.co`.
A bare `/storage/v1/...` means `SUPABASE_URL` is unset.

To add or confirm:

- [ ] `ADMIN_TOKEN` — the client's chosen admin passcode
- [ ] `PUBLIC_WEB_ORIGIN` — `https://themahjeditco.com` (used for the Square return
      redirect and email links; wrong value sends buyers to the wrong host)
- [ ] `EMAIL_FROM` — `noreply@themahjeditco.com`
- [ ] `OWNER_EMAIL` — `themahjeditco@gmail.com`. Reply-to on guest mail and the
      destination for booking alerts. **Never set `EMAIL_FROM` to a gmail address**:
      Resend can only sign for the verified domain, so it would fail DMARC
- [ ] `SQUARE_ACCESS_TOKEN`
- [ ] `SQUARE_LOCATION_ID`
- [ ] `SQUARE_ENVIRONMENT` — `production` (anything else is treated as sandbox)
- [ ] `SQUARE_WEBHOOK_SIGNATURE_KEY`
- [ ] `SQUARE_WEBHOOK_URL` — `https://themahjeditco.com/api/webhooks/square`
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

## Hosting decisions the operator has to make

- [ ] **Supabase plan.** The project is on the free tier, which **auto-pauses
      after ~7 days of idle** and takes several minutes to restore. This already
      caused a live `500` on `/api/events` during setup. The dangerous window is
      exactly post-launch: promoted, but low traffic. Pro is $25/month and
      removes auto-pause. A keep-warm cron is not a real fix — Vercel Hobby caps
      cron at one run per day, which cannot cover a 7-day idle window
- [ ] Decide whether these hosting costs are absorbed into the monthly support
      fee or billed through to the client

---

## Still open / not blocking launch

- [ ] **Drop `public.events_old`** once the client has confirmed the site works.
      It is the pre-migration copy of the `events` table, kept as a safety net
      when the table was rebuilt to match the Drizzle schema
- [ ] Check whether the legacy `photos` and `signups` tables are still used by
      any code — they are scaffold leftovers with one row each
- [ ] Contact form or a clearer "ask a question" path — currently the footer just
      displays an email address
- [ ] Transfer plan if the arrangement ever ends: Vercel and Supabase projects
      can both be transferred to the client's own accounts without a rebuild
