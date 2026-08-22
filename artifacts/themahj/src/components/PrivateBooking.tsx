import { useEffect, useState, type ReactNode } from "react";
import { motion, type Variants } from "framer-motion";
import type { PrivatePackage, PrivateRequestResult } from "@/lib/privateApi";
import {
  listPrivateLessonPackages, requestPrivateLesson, verifyPrivateLessonPayment,
  listPrivateEventPackages, requestPrivateEvent, verifyPrivateEventPayment,
} from "@/lib/privateApi";

const reveal: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: (delay = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.68, delay, ease: [0.22, 1, 0.36, 1] },
  }),
};

const inputCls =
  "w-full rounded-md border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--rose)]";
const labelCls = "text-[11px] uppercase tracking-[0.12em]";

const money = (cents: number) => `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;

function duration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} hr ${m} min` : `${h} hour${h === 1 ? "" : "s"}`;
}

/** Reads ?booking=<id>, which is where Square sends a payer back to. */
function bookingIdFromUrl(): number | null {
  const raw = new URLSearchParams(window.location.search).get("booking");
  if (!raw) return null;
  const id = parseInt(raw, 10);
  return Number.isNaN(id) ? null : id;
}

/**
 * The shell both pages share: package picker, form, and result panel. Each
 * caller supplies its own fields and its own API calls — the two features have
 * separate tables and routes on the server and never cross here either.
 */
function PrivateBookingPage(props: {
  eyebrow: string;
  headingTop: string;
  headingAccent: string;
  intro: string;
  emptyMessage: string;
  accent: string;
  loadPackages: () => Promise<PrivatePackage[]>;
  submit: (pkg: PrivatePackage, common: CommonFields, extra: Record<string, string>) => Promise<PrivateRequestResult>;
  verify: (id: number) => Promise<string>;
  extraFields: (values: Record<string, string>, set: (k: string, v: string) => void) => ReactNode;
}) {
  const [packages, setPackages] = useState<PrivatePackage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<PrivatePackage | null>(null);
  const [common, setCommon] = useState<CommonFields>({
    name: "", email: "", phone: "", groupSize: "", notes: "",
  });
  const [extra, setExtra] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PrivateRequestResult | null>(null);
  // Set once at mount from ?booking=<id>, which is where Square bounces the
  // payer back to. Never reassigned — the query string is stripped below.
  const [returned] = useState<number | null>(() => bookingIdFromUrl());
  const [paidStatus, setPaidStatus] = useState<string | null>(null);

  useEffect(() => {
    props.loadPackages()
      .then(setPackages)
      .catch(() => setPackages([]))
      .finally(() => setLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The webhook usually lands first, but poll as a fallback so the payer is
  // never left staring at "pending" after a successful payment.
  useEffect(() => {
    if (returned === null) return;
    let cancelled = false;
    let tries = 0;

    const tick = async () => {
      tries += 1;
      try {
        const status = await props.verify(returned);
        if (cancelled) return;
        setPaidStatus(status);
        if (status === "paid" || status === "scheduled" || status === "completed") return;
      } catch {
        /* keep trying — a transient failure is not an answer */
      }
      if (!cancelled && tries < 6) setTimeout(() => void tick(), 2000);
    };
    void tick();

    // Clear the query string so a refresh doesn't replay the confirmation.
    window.history.replaceState(null, "", window.location.pathname);
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returned]);

  const setExtraField = (k: string, v: string) => setExtra(prev => ({ ...prev, [k]: v }));

  async function onSubmit() {
    if (!selected) return;
    setError(null);

    if (!common.name.trim() || !common.email.trim()) {
      setError("Please add your name and email.");
      return;
    }
    const size = parseInt(common.groupSize || String(selected.minPeople), 10);
    if (Number.isNaN(size) || size < selected.minPeople || size > selected.maxPeople) {
      setError(`This is for ${selected.minPeople}–${selected.maxPeople} people.`);
      return;
    }

    setBusy(true);
    try {
      const res = await props.submit(selected, { ...common, groupSize: String(size) }, extra);
      if (res.url) {
        window.location.href = res.url;   // pay-now: straight to Square
        return;
      }
      setResult(res);                      // approval-first: acknowledge here
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  // ---- Returned from Square ----
  if (returned !== null) {
    const done = paidStatus === "paid" || paidStatus === "scheduled" || paidStatus === "completed";
    return (
      <Shell {...props}>
        <div className="bg-white/70 border rounded-lg p-8 max-w-xl" style={{ borderColor: "#E9DFD0" }}>
          <h2 className="font-display text-3xl">{done ? "Payment received" : "Finishing up…"}</h2>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--ink-soft)" }}>
            {done
              ? "Thank you! A receipt is on its way to your inbox. We'll be in touch shortly to settle the date and time that suits you."
              : "We're confirming your payment with Square. This usually takes a few seconds."}
          </p>
          <p className="mt-4 text-xs" style={{ color: "var(--ink-soft)" }}>
            Reference #{returned}
          </p>
        </div>
      </Shell>
    );
  }

  // ---- Request submitted, nothing charged ----
  if (result) {
    return (
      <Shell {...props}>
        <div className="bg-white/70 border rounded-lg p-8 max-w-xl" style={{ borderColor: "#E9DFD0" }}>
          <h2 className="font-display text-3xl">Request received</h2>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--ink-soft)" }}>
            Thank you! Nothing has been charged — we'll reply to confirm availability, and
            once a date works for both of us you'll get a secure payment link to hold it.
          </p>
          <p className="mt-4 text-xs" style={{ color: "var(--ink-soft)" }}>
            Reference #{result.bookingId}
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell {...props}>
      {!loaded && (
        <p className="text-sm" style={{ color: "var(--ink-soft)" }}>Loading…</p>
      )}

      {loaded && packages.length === 0 && (
        <div className="bg-white/70 border rounded-lg p-8 max-w-xl" style={{ borderColor: "#E9DFD0" }}>
          <p className="text-sm" style={{ color: "var(--ink-soft)" }}>{props.emptyMessage}</p>
        </div>
      )}

      {loaded && packages.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-10 items-start">
          {/* Packages */}
          <div className="space-y-4">
            {packages.map((p, i) => {
              const active = selected?.id === p.id;
              return (
                <motion.button
                  key={p.id}
                  onClick={() => { setSelected(p); setError(null); }}
                  className="w-full text-left bg-white/70 border rounded-lg p-6 tile-hover"
                  style={{ borderColor: active ? props.accent : "#E9DFD0", borderWidth: active ? 2 : 1 }}
                  aria-pressed={active}
                  variants={reveal} custom={i * 0.08}
                  initial="hidden" whileInView="visible" viewport={{ once: true }}
                >
                  <div className="flex items-baseline justify-between gap-4 flex-wrap">
                    <h3 className="font-display text-2xl">{p.title}</h3>
                    <span className="text-lg" style={{ color: props.accent }}>
                      {p.priceCents > 0 ? money(p.priceCents) : "Enquire"}
                    </span>
                  </div>
                  <p className="text-xs uppercase tracking-[0.14em] mt-1" style={{ color: "var(--ink-soft)" }}>
                    {duration(p.durationMinutes)} · {p.minPeople}–{p.maxPeople} people
                  </p>
                  {p.description && (
                    <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                      {p.description}
                    </p>
                  )}
                  {p.priceNote && (
                    <p className="mt-2 text-xs" style={{ color: "var(--ink-soft)" }}>{p.priceNote}</p>
                  )}
                  <p className="mt-3 text-[11px] uppercase tracking-[0.12em]" style={{ color: props.accent }}>
                    {p.requiresApproval || p.priceCents <= 0
                      ? "Enquire first — nothing charged today"
                      : "Book and pay now"}
                  </p>
                </motion.button>
              );
            })}
          </div>

          {/* Form */}
          <div className="bg-white/70 border rounded-lg p-6 lg:sticky lg:top-28" style={{ borderColor: "#E9DFD0" }}>
            {!selected && (
              <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
                Choose an option to get started.
              </p>
            )}

            {selected && (
              <>
                <h2 className="font-display text-2xl">{selected.title}</h2>
                <p className="text-xs uppercase tracking-[0.14em] mt-1" style={{ color: "var(--ink-soft)" }}>
                  {selected.priceCents > 0 ? money(selected.priceCents) : "Price on enquiry"}
                  {" · "}{duration(selected.durationMinutes)}
                </p>

                <div className="space-y-3 mt-5">
                  <div>
                    <label className={labelCls} htmlFor="pb-name" style={{ color: "var(--ink-soft)" }}>Your name</label>
                    <input id="pb-name" className={`${inputCls} mt-1`} value={common.name}
                      onChange={e => setCommon({ ...common, name: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="pb-email" style={{ color: "var(--ink-soft)" }}>Email</label>
                    <input id="pb-email" type="email" className={`${inputCls} mt-1`} value={common.email}
                      onChange={e => setCommon({ ...common, email: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="pb-phone" style={{ color: "var(--ink-soft)" }}>Phone (optional)</label>
                    <input id="pb-phone" type="tel" className={`${inputCls} mt-1`} value={common.phone}
                      onChange={e => setCommon({ ...common, phone: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="pb-size" style={{ color: "var(--ink-soft)" }}>
                      How many people ({selected.minPeople}–{selected.maxPeople})
                    </label>
                    <input id="pb-size" type="number" inputMode="numeric"
                      min={selected.minPeople} max={selected.maxPeople}
                      className={`${inputCls} mt-1`}
                      placeholder={String(selected.minPeople)}
                      value={common.groupSize}
                      onChange={e => setCommon({ ...common, groupSize: e.target.value })} />
                  </div>

                  {props.extraFields(extra, setExtraField)}

                  <div>
                    <label className={labelCls} htmlFor="pb-notes" style={{ color: "var(--ink-soft)" }}>Anything else?</label>
                    <textarea id="pb-notes" rows={3} className={`${inputCls} mt-1`} value={common.notes}
                      onChange={e => setCommon({ ...common, notes: e.target.value })} />
                  </div>
                </div>

                {error && (
                  <p role="alert" className="mt-4 text-sm" style={{ color: "var(--crak)" }}>{error}</p>
                )}

                <button onClick={() => void onSubmit()} disabled={busy}
                  className="btn-rose w-full mt-5 px-7 py-3 rounded-full text-sm uppercase tracking-[0.18em] disabled:opacity-50">
                  {busy
                    ? "Sending…"
                    : selected.requiresApproval || selected.priceCents <= 0
                      ? "Send request"
                      : `Book and pay ${money(selected.priceCents)}`}
                </button>

                <p className="mt-3 text-[11px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                  {selected.requiresApproval || selected.priceCents <= 0
                    ? "This is an enquiry — nothing is charged now. We'll confirm availability by email first."
                    : "You'll be taken to Square to pay securely. We'll then agree a date by email."}
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </Shell>
  );
}

interface CommonFields {
  name: string;
  email: string;
  phone: string;
  groupSize: string;
  notes: string;
}

function Shell(props: {
  eyebrow: string; headingTop: string; headingAccent: string; intro: string; accent: string;
  children?: ReactNode;
}) {
  return (
    <div className="max-w-6xl mx-auto px-6 pt-16 pb-24">
      <motion.p className="eyebrow" variants={reveal} custom={0} initial="hidden" animate="visible">
        {props.eyebrow}
      </motion.p>
      <motion.h1 className="font-display leading-[0.92] mt-4 tracking-tight"
        style={{ fontSize: "clamp(2.8rem,7vw,5rem)" }}
        variants={reveal} custom={0.08} initial="hidden" animate="visible">
        {props.headingTop}<br />
        <span className="italic" style={{ color: props.accent }}>{props.headingAccent}</span>
      </motion.h1>
      <motion.p className="mt-6 max-w-2xl text-lg leading-relaxed" style={{ color: "var(--ink-soft)" }}
        variants={reveal} custom={0.16} initial="hidden" animate="visible">
        {props.intro}
      </motion.p>
      <div className="hairline my-10" />
      {props.children}
    </div>
  );
}

// ---------------- PRIVATE LESSONS ----------------

export function PrivateLessons() {
  return (
    <PrivateBookingPage
      eyebrow="Learn at your own table"
      headingTop="Private"
      headingAccent="lessons."
      intro="One-to-one or a small group, at your pace. Perfect for absolute beginners, or for players who want to sharpen up before joining open play."
      emptyMessage="Private lessons aren't bookable online just yet — get in touch and we'll sort something out."
      accent="var(--rose-deep)"
      loadPackages={listPrivateLessonPackages}
      verify={verifyPrivateLessonPayment}
      submit={(pkg, common, extra) => requestPrivateLesson({
        packageId: pkg.id,
        name: common.name.trim(),
        email: common.email.trim(),
        phone: common.phone.trim() || null,
        groupSize: parseInt(common.groupSize, 10),
        skillLevel: extra.skillLevel || null,
        preferredTimes: extra.preferredTimes || null,
        locationPreference: extra.locationPreference || null,
        notes: common.notes.trim() || null,
      })}
      extraFields={(values, set) => (
        <>
          <div>
            <label className={labelCls} htmlFor="pb-skill" style={{ color: "var(--ink-soft)" }}>Experience</label>
            <select id="pb-skill" className={`${inputCls} mt-1`} value={values.skillLevel ?? ""}
              onChange={e => set("skillLevel", e.target.value)}>
              <option value="">Choose one…</option>
              <option>Complete beginner</option>
              <option>Played a little</option>
              <option>Play regularly</option>
              <option>Mixed group</option>
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="pb-times" style={{ color: "var(--ink-soft)" }}>When suits you?</label>
            <input id="pb-times" className={`${inputCls} mt-1`}
              placeholder="Weekday evenings, or Saturday mornings"
              value={values.preferredTimes ?? ""} onChange={e => set("preferredTimes", e.target.value)} />
          </div>
          <div>
            <label className={labelCls} htmlFor="pb-loc" style={{ color: "var(--ink-soft)" }}>Where?</label>
            <input id="pb-loc" className={`${inputCls} mt-1`} placeholder="My home in Georgetown"
              value={values.locationPreference ?? ""} onChange={e => set("locationPreference", e.target.value)} />
          </div>
        </>
      )}
    />
  );
}

// ---------------- PRIVATE EVENTS ----------------

export function PrivateEvents() {
  return (
    <PrivateBookingPage
      eyebrow="Bring the table to you"
      headingTop="Private"
      headingAccent="events."
      intro="Birthdays, showers, team gatherings, or a night in with friends. We bring the tiles, the tables, and the teaching — you bring the people."
      emptyMessage="Private events aren't bookable online just yet — get in touch and we'll put something together."
      accent="var(--jade)"
      loadPackages={listPrivateEventPackages}
      verify={verifyPrivateEventPayment}
      submit={(pkg, common, extra) => requestPrivateEvent({
        packageId: pkg.id,
        name: common.name.trim(),
        email: common.email.trim(),
        phone: common.phone.trim() || null,
        groupSize: parseInt(common.groupSize, 10),
        occasion: extra.occasion || null,
        venue: extra.venue || null,
        preferredDates: extra.preferredDates || null,
        notes: common.notes.trim() || null,
      })}
      extraFields={(values, set) => (
        <>
          <div>
            <label className={labelCls} htmlFor="pb-occasion" style={{ color: "var(--ink-soft)" }}>What's the occasion?</label>
            <input id="pb-occasion" className={`${inputCls} mt-1`} placeholder="50th birthday, team offsite…"
              value={values.occasion ?? ""} onChange={e => set("occasion", e.target.value)} />
          </div>
          <div>
            <label className={labelCls} htmlFor="pb-venue" style={{ color: "var(--ink-soft)" }}>Where would you like it?</label>
            <input id="pb-venue" className={`${inputCls} mt-1`} placeholder="My house in Sun City"
              value={values.venue ?? ""} onChange={e => set("venue", e.target.value)} />
          </div>
          <div>
            <label className={labelCls} htmlFor="pb-dates" style={{ color: "var(--ink-soft)" }}>Dates you have in mind</label>
            <input id="pb-dates" className={`${inputCls} mt-1`} placeholder="A Saturday in March"
              value={values.preferredDates ?? ""} onChange={e => set("preferredDates", e.target.value)} />
          </div>
        </>
      )}
    />
  );
}
