import { useEffect, useState } from "react";
import type {
  PrivatePackage, PrivatePackageInput, PrivateBookingUpdate,
} from "@/lib/privateApi";

// One manager rendered twice, once per tab. The two features are separate
// systems on the server — separate tables, separate routes — and every call
// below arrives as a prop, so nothing is shared between them at runtime.

const inputCls =
  "w-full rounded-md border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--rose)]";
const labelCls = "text-[11px] uppercase tracking-[0.12em]";
const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/** The subset of booking fields this component reads; kinds add their own. */
export interface ManagedBooking {
  id: number;
  packageTitle: string;
  packagePriceCents: number;
  name: string;
  email: string;
  phone: string | null;
  groupSize: number;
  notes: string | null;
  status: string;
  scheduledDate: string | null;
  scheduledTime: string | null;
  scheduledLocation: string | null;
  adminNotes: string | null;
  paymentLinkUrl: string | null;
  amountPaidCents: number | null;
  createdAt: string;
}

const STATUSES = [
  "requested", "awaiting_payment", "pending", "paid", "scheduled", "completed", "cancelled",
] as const;

const STATUS_LABEL: Record<string, string> = {
  requested: "New request",
  awaiting_payment: "Payment link sent",
  pending: "Payment started",
  paid: "Paid",
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
};

/** Money has arrived for these; the rest have nothing charged against them. */
const PAID = new Set(["paid", "scheduled", "completed"]);

function emptyPackage(defaults: Partial<PrivatePackageInput>): PrivatePackageInput {
  return {
    title: "", description: "", durationMinutes: 60, minPeople: 1, maxPeople: 4,
    priceCents: 0, priceNote: "", requiresApproval: false, sortOrder: 0, published: false,
    ...defaults,
  };
}

export function PrivateManager<B extends ManagedBooking>(props: {
  kindLabel: string;
  packageDefaults: Partial<PrivatePackageInput>;
  listPackages: () => Promise<PrivatePackage[]>;
  createPackage: (input: PrivatePackageInput) => Promise<PrivatePackage>;
  updatePackage: (id: number, input: Partial<PrivatePackageInput>) => Promise<PrivatePackage>;
  deletePackage: (id: number) => Promise<void>;
  listBookings: () => Promise<B[]>;
  updateBooking: (id: number, input: PrivateBookingUpdate) => Promise<B>;
  sendPaymentLink: (id: number, input: { amountCents?: number; message?: string }) => Promise<string>;
  /** Kind-specific detail lines shown on each booking card. */
  bookingExtras: (b: B) => { label: string; value: string | null }[];
  onError: (message: string) => void;
  onNotice: (message: string) => void;
}) {
  const [packages, setPackages] = useState<PrivatePackage[]>([]);
  const [bookings, setBookings] = useState<B[]>([]);
  const [draft, setDraft] = useState<PrivatePackageInput>(emptyPackage(props.packageDefaults));
  const [editing, setEditing] = useState<PrivatePackage | null>(null);
  const [priceInput, setPriceInput] = useState("0");
  const [busy, setBusy] = useState(false);
  const [openBooking, setOpenBooking] = useState<number | null>(null);
  const [bookingDraft, setBookingDraft] = useState<PrivateBookingUpdate>({});
  const [view, setView] = useState<"bookings" | "packages">("bookings");

  const fail = (err: unknown, fallback: string) =>
    props.onError(err instanceof Error ? err.message : fallback);

  function refresh() {
    props.listPackages().then(setPackages).catch(() => setPackages([]));
    props.listBookings().then(setBookings).catch(() => setBookings([]));
  }

  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  // ---- packages ----

  function startEdit(p: PrivatePackage) {
    setEditing(p);
    setPriceInput((p.priceCents / 100).toFixed(2));
    setDraft({
      title: p.title, description: p.description, durationMinutes: p.durationMinutes,
      minPeople: p.minPeople, maxPeople: p.maxPeople, priceCents: p.priceCents,
      priceNote: p.priceNote ?? "", requiresApproval: p.requiresApproval,
      sortOrder: p.sortOrder, published: p.published,
    });
    setView("packages");
  }

  function resetForm() {
    setEditing(null);
    setPriceInput("0");
    setDraft(emptyPackage(props.packageDefaults));
  }

  async function savePackage() {
    if (!draft.title.trim()) { props.onError("Give the package a title."); return; }
    if (draft.maxPeople < draft.minPeople) {
      props.onError("Maximum people cannot be less than the minimum.");
      return;
    }
    const dollars = parseFloat(priceInput || "0");
    const payload: PrivatePackageInput = {
      ...draft,
      priceCents: Number.isNaN(dollars) ? 0 : Math.round(dollars * 100),
      priceNote: draft.priceNote?.trim() || null,
    };

    setBusy(true);
    try {
      if (editing) await props.updatePackage(editing.id, payload);
      else await props.createPackage(payload);
      resetForm();
      refresh();
      props.onNotice(`${props.kindLabel} package saved.`);
    } catch (err) {
      fail(err, "Could not save the package");
    } finally {
      setBusy(false);
    }
  }

  async function removePackage(p: PrivatePackage) {
    if (!window.confirm(`Delete "${p.title}"? Existing bookings keep their own copy of the title and price.`)) return;
    try {
      await props.deletePackage(p.id);
      if (editing?.id === p.id) resetForm();
      refresh();
    } catch (err) {
      fail(err, "Could not delete the package");
    }
  }

  // ---- bookings ----

  function openFor(b: B) {
    setOpenBooking(openBooking === b.id ? null : b.id);
    setBookingDraft({
      status: b.status,
      scheduledDate: b.scheduledDate ?? "",
      scheduledTime: b.scheduledTime ?? "",
      scheduledLocation: b.scheduledLocation ?? "",
      adminNotes: b.adminNotes ?? "",
    });
  }

  async function saveBooking(b: B) {
    setBusy(true);
    try {
      await props.updateBooking(b.id, bookingDraft);
      refresh();
      props.onNotice(
        bookingDraft.scheduledDate
          ? "Saved — the guest has been emailed their confirmed date."
          : "Booking updated.",
      );
      setOpenBooking(null);
    } catch (err) {
      fail(err, "Could not update the booking");
    } finally {
      setBusy(false);
    }
  }

  async function approveAndSend(b: B) {
    const dollars = window.prompt(
      `Amount to charge for "${b.packageTitle}" (dollars):`,
      (b.packagePriceCents / 100).toFixed(2),
    );
    if (dollars === null) return;
    const amountCents = Math.round(parseFloat(dollars) * 100);
    if (Number.isNaN(amountCents) || amountCents <= 0) {
      props.onError("Enter an amount above zero.");
      return;
    }
    const message = window.prompt("Add a note to the email (optional):", "") ?? "";

    setBusy(true);
    try {
      await props.sendPaymentLink(b.id, { amountCents, message: message || undefined });
      refresh();
      props.onNotice(`Payment link emailed to ${b.email}.`);
    } catch (err) {
      fail(err, "Could not send the payment link");
    } finally {
      setBusy(false);
    }
  }

  const pill = (t: "bookings" | "packages", label: string) => (
    <button onClick={() => setView(t)}
      className={`px-4 py-1.5 rounded-full text-[11px] uppercase tracking-[0.14em] border ${view === t ? "btn-rose border-transparent" : "bg-white/60"}`}
      style={view !== t ? { borderColor: "#E9DFD0", color: "var(--ink-soft)" } : undefined}>
      {label}
    </button>
  );

  return (
    <div className="mt-8">
      <div className="flex gap-2 mb-6">
        {pill("bookings", `Bookings (${bookings.length})`)}
        {pill("packages", `Packages (${packages.length})`)}
      </div>

      {/* ---------------- BOOKINGS ---------------- */}
      {view === "bookings" && bookings.length === 0 && (
        <div className="bg-white/70 border rounded-lg p-8 text-center" style={{ borderColor: "#E9DFD0" }}>
          <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
            No {props.kindLabel.toLowerCase()} enquiries yet — they'll appear here as people book.
          </p>
        </div>
      )}

      {view === "bookings" && bookings.map(b => {
        const open = openBooking === b.id;
        const paid = PAID.has(b.status);
        return (
          <div key={b.id} className="bg-white/70 border rounded-lg p-5 mb-3" style={{ borderColor: "#E9DFD0" }}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="font-display text-xl">{b.name}</h3>
                  <span className="text-[10px] uppercase tracking-[0.14em] px-2.5 py-1 rounded-full"
                    style={{
                      background: paid ? "rgba(90,140,110,0.14)" : "rgba(185,138,74,0.14)",
                      color: paid ? "var(--jade)" : "var(--gold)",
                    }}>
                    {STATUS_LABEL[b.status] ?? b.status}
                  </span>
                </div>
                <p className="text-sm mt-1" style={{ color: "var(--ink-soft)" }}>
                  {b.packageTitle} · {b.groupSize} {b.groupSize === 1 ? "person" : "people"}
                  {" · "}
                  {b.amountPaidCents != null ? `${money(b.amountPaidCents)} paid` : money(b.packagePriceCents)}
                </p>
                <p className="text-sm mt-1">
                  <a className="underline" href={`mailto:${b.email}`}>{b.email}</a>
                  {b.phone && <> · <a className="underline" href={`tel:${b.phone}`}>{b.phone}</a></>}
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                {!paid && (
                  <button onClick={() => void approveAndSend(b)} disabled={busy}
                    className="px-4 py-1.5 rounded-full text-xs border disabled:opacity-40"
                    style={{ borderColor: "var(--jade)", color: "var(--jade)" }}>
                    {b.paymentLinkUrl ? "Resend payment link" : "Approve & send link"}
                  </button>
                )}
                <button onClick={() => openFor(b)}
                  className="px-4 py-1.5 rounded-full text-xs border"
                  style={{ borderColor: "#E9DFD0", color: "var(--ink-soft)" }}>
                  {open ? "Close" : "Manage"}
                </button>
              </div>
            </div>

            {/* Kind-specific details */}
            <div className="mt-3 grid sm:grid-cols-3 gap-x-6 gap-y-1">
              {props.bookingExtras(b).filter(d => d.value).map(d => (
                <p key={d.label} className="text-xs" style={{ color: "var(--ink-soft)" }}>
                  <span className="uppercase tracking-[0.12em]">{d.label}:</span> {d.value}
                </p>
              ))}
            </div>
            {b.notes && (
              <p className="mt-3 text-sm whitespace-pre-wrap" style={{ color: "var(--ink)" }}>{b.notes}</p>
            )}

            {open && (
              <div className="mt-5 pt-5 border-t space-y-3" style={{ borderColor: "#E9DFD0" }}>
                <div className="grid sm:grid-cols-3 gap-3">
                  <div>
                    <label className={labelCls} style={{ color: "var(--ink-soft)" }}>Status</label>
                    <select className={`${inputCls} mt-1`} value={bookingDraft.status ?? b.status}
                      onChange={e => setBookingDraft({ ...bookingDraft, status: e.target.value })}>
                      {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls} style={{ color: "var(--ink-soft)" }}>Agreed date</label>
                    <input type="date" className={`${inputCls} mt-1`} value={bookingDraft.scheduledDate ?? ""}
                      onChange={e => setBookingDraft({ ...bookingDraft, scheduledDate: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelCls} style={{ color: "var(--ink-soft)" }}>Time</label>
                    <input className={`${inputCls} mt-1`} placeholder="6:30 PM"
                      value={bookingDraft.scheduledTime ?? ""}
                      onChange={e => setBookingDraft({ ...bookingDraft, scheduledTime: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className={labelCls} style={{ color: "var(--ink-soft)" }}>Where</label>
                  <input className={`${inputCls} mt-1`} value={bookingDraft.scheduledLocation ?? ""}
                    onChange={e => setBookingDraft({ ...bookingDraft, scheduledLocation: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls} style={{ color: "var(--ink-soft)" }}>Private notes (never emailed)</label>
                  <textarea rows={2} className={`${inputCls} mt-1`} value={bookingDraft.adminNotes ?? ""}
                    onChange={e => setBookingDraft({ ...bookingDraft, adminNotes: e.target.value })} />
                </div>
                <p className="text-[11px]" style={{ color: "var(--ink-soft)" }}>
                  Setting a date emails the guest their confirmation. Changing it later sends an updated one.
                </p>
                <div className="flex gap-2">
                  <button onClick={() => void saveBooking(b)} disabled={busy}
                    className="btn-rose px-6 py-2 rounded-full text-xs uppercase tracking-[0.14em] disabled:opacity-40">
                    Save
                  </button>
                  {b.paymentLinkUrl && (
                    <a href={b.paymentLinkUrl} target="_blank" rel="noreferrer"
                      className="px-6 py-2 rounded-full text-xs uppercase tracking-[0.14em] border inline-flex items-center"
                      style={{ borderColor: "#E9DFD0", color: "var(--ink-soft)" }}>
                      Open payment link
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* ---------------- PACKAGES ---------------- */}
      {view === "packages" && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-10 items-start">
          <div className="bg-white/70 border rounded-lg p-6" style={{ borderColor: "#E9DFD0" }}>
            <h2 className="font-display text-2xl">{editing ? "Edit package" : "New package"}</h2>
            <div className="space-y-3 mt-4">
              <div>
                <label className={labelCls} style={{ color: "var(--ink-soft)" }}>Title</label>
                <input className={`${inputCls} mt-1`} value={draft.title}
                  onChange={e => setDraft({ ...draft, title: e.target.value })} />
              </div>
              <div>
                <label className={labelCls} style={{ color: "var(--ink-soft)" }}>Description</label>
                <textarea rows={3} className={`${inputCls} mt-1`} value={draft.description ?? ""}
                  onChange={e => setDraft({ ...draft, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls} style={{ color: "var(--ink-soft)" }}>Minutes</label>
                  <input type="number" className={`${inputCls} mt-1`} value={draft.durationMinutes}
                    onChange={e => setDraft({ ...draft, durationMinutes: parseInt(e.target.value || "0", 10) })} />
                </div>
                <div>
                  <label className={labelCls} style={{ color: "var(--ink-soft)" }}>Min people</label>
                  <input type="number" className={`${inputCls} mt-1`} value={draft.minPeople}
                    onChange={e => setDraft({ ...draft, minPeople: parseInt(e.target.value || "1", 10) })} />
                </div>
                <div>
                  <label className={labelCls} style={{ color: "var(--ink-soft)" }}>Max people</label>
                  <input type="number" className={`${inputCls} mt-1`} value={draft.maxPeople}
                    onChange={e => setDraft({ ...draft, maxPeople: parseInt(e.target.value || "1", 10) })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls} style={{ color: "var(--ink-soft)" }}>Price ($)</label>
                  <input className={`${inputCls} mt-1`} inputMode="decimal" value={priceInput}
                    onChange={e => setPriceInput(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls} style={{ color: "var(--ink-soft)" }}>Sort order</label>
                  <input type="number" className={`${inputCls} mt-1`} value={draft.sortOrder ?? 0}
                    onChange={e => setDraft({ ...draft, sortOrder: parseInt(e.target.value || "0", 10) })} />
                </div>
              </div>
              <div>
                <label className={labelCls} style={{ color: "var(--ink-soft)" }}>Note under the price</label>
                <input className={`${inputCls} mt-1`} placeholder="+$25 per extra guest"
                  value={draft.priceNote ?? ""}
                  onChange={e => setDraft({ ...draft, priceNote: e.target.value })} />
              </div>

              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <input type="checkbox" className="mt-1" checked={draft.requiresApproval ?? false}
                  onChange={e => setDraft({ ...draft, requiresApproval: e.target.checked })} />
                <span>
                  Enquiry first
                  <span className="block text-[11px]" style={{ color: "var(--ink-soft)" }}>
                    Nothing is charged when they submit. You approve it and send a payment
                    link. Leave this off to take payment immediately at Square.
                  </span>
                </span>
              </label>

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={draft.published ?? false}
                  onChange={e => setDraft({ ...draft, published: e.target.checked })} />
                Published (visible on the site)
              </label>
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={() => void savePackage()} disabled={busy}
                className="btn-rose px-6 py-2.5 rounded-full text-xs uppercase tracking-[0.16em] disabled:opacity-40">
                {editing ? "Save changes" : "Create package"}
              </button>
              {editing && (
                <button onClick={resetForm}
                  className="px-6 py-2.5 rounded-full text-xs uppercase tracking-[0.16em] border"
                  style={{ borderColor: "#E9DFD0", color: "var(--ink-soft)" }}>
                  Cancel
                </button>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {packages.length === 0 && (
              <div className="bg-white/70 border rounded-lg p-8 text-center" style={{ borderColor: "#E9DFD0" }}>
                <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
                  No packages yet. Create one and tick Published to show it on the site.
                </p>
              </div>
            )}
            {packages.map(p => (
              <div key={p.id} className="bg-white/70 border rounded-lg p-5" style={{ borderColor: "#E9DFD0" }}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <h3 className="font-display text-xl">{p.title}</h3>
                    <p className="text-xs mt-1" style={{ color: "var(--ink-soft)" }}>
                      {money(p.priceCents)} · {p.durationMinutes} min · {p.minPeople}–{p.maxPeople} people
                    </p>
                    <p className="text-[11px] mt-1" style={{ color: "var(--ink-soft)" }}>
                      {p.requiresApproval ? "Enquiry first" : "Pays immediately"}
                      {p.published ? "" : " · Draft"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => startEdit(p)}
                      className="px-4 py-1.5 rounded-full text-xs border"
                      style={{ borderColor: "var(--jade)", color: "var(--jade)" }}>Edit</button>
                    <button onClick={() => void removePackage(p)}
                      className="px-4 py-1.5 rounded-full text-xs border"
                      style={{ borderColor: "var(--crak)", color: "var(--crak)" }}>Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

