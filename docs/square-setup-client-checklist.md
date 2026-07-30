# Square setup — what to bring

We'll create your Square account together so the website can take payments for
classes and events. **You will create and own the account**, and you'll be the
one typing in your bank and tax details — they aren't shared with anyone else.
All the website needs afterward is a set of API keys, which you can revoke or
regenerate yourself at any time.

Please have the following ready before we meet.

## 1. Business details

- **Legal business name** — exactly as it's registered (with the IRS / state)
- **Public business name** — what customers should see. This becomes the
  description on their credit card statement, so "The Mahj Edit" is likely what
  you want rather than a longer legal name.
- **Business structure** — sole proprietor, LLC, partnership, or corporation
- **Business address** — a physical street address (Square generally won't take
  a PO box for the primary business address)
- **Business phone number**
- **Business email address** — this becomes the account login. Use one you'll
  keep long-term and control yourself, not a shared or temporary address.

## 2. Tax identification

Square is required to report your earnings to the IRS, so this has to match
IRS records exactly.

- **If you're a sole proprietor:** your Social Security number (or an EIN if you
  have one)
- **If you're an LLC or corporation:** your EIN, plus the legal entity name as
  filed with the IRS

## 3. Personal identity verification

Financial regulations require Square to verify the person who owns the account.
Have ready:

- Your full legal name, date of birth, and home address
- Your Social Security number (Square may ask for the last 4 or the full number)
- A government-issued photo ID (driver's license or passport) — usually not
  needed, but occasionally requested if automatic verification doesn't clear

## 4. Bank account for deposits

This is where your class and event revenue will be deposited.

- **Routing number** and **account number**
- It should be a **checking** account in the business's name. Savings accounts
  are often rejected for deposits, and a name mismatch between the bank account
  and the business can delay verification.

## 5. Your phone

Square uses two-factor authentication. You'll need your phone to receive a
verification code, and we'll set up 2FA on **your** device. Save the recovery
codes somewhere only you can get to.

## Decisions we'll make together

- **Statement descriptor** — confirm what customers see on their card statement
- **Deposit schedule** — standard deposits (typically 1–2 business days, free)
  or instant deposits (Square charges a fee)
- **Processing rate** — we'll confirm Square's current online rate during
  signup. Online/card-not-present transactions carry a per-transaction
  percentage plus a flat fee, deducted before deposit; worth knowing so class
  pricing accounts for it.

## What I'll take away

Once the account is active, you'll generate three values from Square's developer
dashboard and hand them to me:

1. A production **access token**
2. Your **location ID**
3. A **webhook signature key**

These let the website create checkouts and confirm payments. They do **not**
expose your bank account, your tax ID, or your Square password. You can revoke
them from your dashboard whenever you want, and doing so simply stops the site
from taking payments.

## A note on timing

Most Square accounts activate immediately, but some go to manual review — and
new businesses selling *in advance* (classes and events paid for before they
happen) are a category Square sometimes looks at more closely. If that happens,
activation can take a few business days and Square may ask for extra
documentation, or briefly hold early deposits.

Because of that, let's not schedule the first paid class registration for the
same day we set up the account. Free events can go live immediately either way —
they don't depend on Square at all.
