import { useEffect, useRef, useState } from "react";
import { motion, type Variants } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AdminRegistration, ApiEvent, ApiPhoto, EventInput } from "@/lib/api";
import {
  adminCreateEvent, adminDeleteEvent, adminDeletePhoto, adminDeleteRegistration,
  adminDownloadCheckinReport, adminListEvents, adminListRegistrations, adminLogin,
  adminUpdateEvent, adminUploadPhoto, getAdminToken, listGallery, setAdminToken,
} from "@/lib/api";
import { CATEGORIES, categoryMeta, fmtDate, fmtPrice } from "@/lib/data";

const reveal: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: (delay = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.68, delay, ease: [0.22, 1, 0.36, 1] },
  }),
};

// ---------------- GALLERY ----------------
export function Gallery() {
  const [photos, setPhotos] = useState<ApiPhoto[]>([]);
  const [open, setOpen] = useState<ApiPhoto | null>(null);

  useEffect(() => {
    listGallery().then(setPhotos).catch(() => setPhotos([]));
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-6 py-14">
      <motion.p className="eyebrow"
        variants={reveal} custom={0} initial="hidden" animate="visible">
        Around the table
      </motion.p>
      <motion.h1
        className="font-display leading-[0.9] mt-4 tracking-tight"
        style={{ fontSize: "clamp(2.8rem,7vw,5rem)" }}
        variants={reveal} custom={0.08} initial="hidden" animate="visible">
        Event photos.
      </motion.h1>
      <motion.p className="mt-5 max-w-xl text-[17px] leading-relaxed" style={{ color: "var(--ink-soft)" }}
        variants={reveal} custom={0.18} initial="hidden" animate="visible">
        Tablescapes, merit stickers, and the faces behind the mahjs.
      </motion.p>
      {photos.length === 0 ? (
        <motion.div className="tile max-w-md mx-auto mt-12 p-10 text-center"
          variants={reveal} custom={0.28} initial="hidden" animate="visible">
          <p className="font-display italic text-2xl">No photos yet</p>
          <p className="text-sm mt-2" style={{ color: "var(--ink-soft)" }}>Photos from our next event will land here.</p>
        </motion.div>
      ) : (
        <div className="columns-2 md:columns-3 gap-4 mt-10 [&>*]:mb-4">
          {photos.map((p, i) => (
            <motion.button key={p.id} onClick={() => setOpen(p)}
              className="block w-full break-inside-avoid tile-hover text-left"
              variants={reveal} custom={i * 0.07} initial="hidden" whileInView="visible"
              viewport={{ once: true }}>
              <img src={p.url} alt={p.caption ?? ""} className="w-full rounded-lg border" style={{ borderColor: "#E9DFD0" }} loading="lazy" />
              <p className="text-xs mt-1.5 px-0.5" style={{ color: "var(--ink-soft)" }}>{p.eventLabel ?? p.caption ?? ""}</p>
            </motion.button>
          ))}
        </div>
      )}
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="bg-[var(--ivory)] max-w-2xl">
          {open && (
            <>
              <img src={open.url} alt={open.caption ?? ""} className="w-full rounded-lg" />
              <DialogHeader>
                <DialogTitle className="font-display text-2xl font-medium">{open.eventLabel ?? "Event"}</DialogTitle>
              </DialogHeader>
              <p className="text-sm -mt-1" style={{ color: "var(--ink-soft)" }}>{open.caption ?? ""}</p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------- ADMIN ----------------
type EventDraft = {
  title: string;
  category: string;
  date: string;
  time: string;
  location: string;
  price: string;       // dollars as typed; blank = free
  totalSpots: number;
  description: string;
  published: boolean;
};

const emptyEvent = (): EventDraft => ({
  title: "", category: "Open Play", date: "", time: "", location: "Leander, TX",
  price: "15", totalSpots: 16, description: "", published: true,
});

function draftToInput(d: EventDraft): EventInput {
  const dollars = parseFloat(d.price);
  return {
    title: d.title.trim(),
    category: d.category,
    date: d.date,
    time: d.time.trim(),
    location: d.location.trim(),
    priceCents: Number.isFinite(dollars) && dollars > 0 ? Math.round(dollars * 100) : null,
    totalSpots: d.totalSpots,
    description: d.description.trim(),
    published: d.published,
  };
}

export function Admin() {
  const [authed, setAuthed] = useState(() => !!getAdminToken());
  const [pass, setPass] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [tab, setTab] = useState<"events" | "signups" | "photos">("events");

  const [events, setEvents] = useState<ApiEvent[]>([]);
  const [registrations, setRegistrations] = useState<AdminRegistration[]>([]);
  const [photos, setPhotos] = useState<ApiPhoto[]>([]);
  const [editing, setEditing] = useState<ApiEvent | null>(null);
  const [draft, setDraft] = useState<EventDraft>(emptyEvent());
  const [photoMeta, setPhotoMeta] = useState({ caption: "", eventLabel: "" });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputCls = "w-full rounded-md border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--rose)]";

  function refresh() {
    adminListEvents().then(setEvents).catch(err => {
      if (err instanceof Error && "status" in err && (err as { status: number }).status === 401) {
        setAdminToken(null);
        setAuthed(false);
      }
    });
    adminListRegistrations().then(setRegistrations).catch(() => setRegistrations([]));
    listGallery().then(setPhotos).catch(() => setPhotos([]));
  }

  useEffect(() => {
    if (authed) refresh();
  }, [authed]);

  async function unlock() {
    if (!pass) return;
    setLoginError(null);
    try {
      await adminLogin(pass);
      setAuthed(true);
      setPass("");
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Login failed");
    }
  }

  if (!authed) {
    return (
      <div className="max-w-sm mx-auto px-6 py-24 text-center">
        <p className="eyebrow">Admin</p>
        <h1 className="font-display text-4xl mt-3">East wind only</h1>
        <p className="text-sm mt-3" style={{ color: "var(--ink-soft)" }}>
          Enter the admin passcode to manage events and photos.
        </p>
        <input type="password" className={inputCls + " mt-6 text-center"} placeholder="Passcode" value={pass}
          onChange={e => setPass(e.target.value)}
          onKeyDown={e => e.key === "Enter" && void unlock()} />
        <button onClick={() => void unlock()}
          className="btn-rose w-full py-3 rounded-full text-sm uppercase tracking-[0.18em] mt-4">
          Unlock
        </button>
        {loginError && <p className="text-xs mt-3" style={{ color: "var(--crak)" }}>{loginError}</p>}
      </div>
    );
  }

  function startEdit(ev: ApiEvent) {
    setEditing(ev);
    setDraft({
      title: ev.title,
      category: ev.category,
      date: ev.date,
      time: ev.time,
      location: ev.location,
      price: ev.priceCents ? String(ev.priceCents / 100) : "",
      totalSpots: ev.totalSpots,
      description: ev.description,
      published: ev.published,
    });
  }

  async function saveEvent() {
    if (!draft.title.trim() || !draft.date || busy) return;
    setBusy(true);
    try {
      if (editing) {
        await adminUpdateEvent(editing.id, draftToInput(draft));
      } else {
        await adminCreateEvent(draftToInput(draft));
      }
      setEditing(null);
      setDraft(emptyEvent());
      refresh();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not save the event");
    } finally {
      setBusy(false);
    }
  }

  async function deleteEvent(id: number) {
    if (!window.confirm("Delete this event and all of its signups?")) return;
    try {
      await adminDeleteEvent(id);
      refresh();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not delete the event");
    }
  }

  async function removeRegistration(id: number) {
    try {
      await adminDeleteRegistration(id);
      refresh();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not remove the signup");
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files) return;
    Array.from(files).forEach(file => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const max = 1200;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        canvas.toBlob(async (blob) => {
          if (!blob) return;
          try {
            await adminUploadPhoto(blob, {
              caption: photoMeta.caption || file.name,
              eventLabel: photoMeta.eventLabel || "Event",
            });
            listGallery().then(setPhotos).catch(() => undefined);
          } catch (err) {
            setNotice(err instanceof Error ? err.message : "Photo upload failed");
          }
        }, "image/jpeg", 0.82);
      };
      img.src = url;
    });
    if (fileRef.current) fileRef.current.value = "";
  }

  async function deletePhoto(id: number) {
    try {
      await adminDeletePhoto(id);
      setPhotos(photos.filter(p => p.id !== id));
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not delete the photo");
    }
  }

  const tabBtn = (t: typeof tab, label: string) => (
    <button onClick={() => setTab(t)}
      className={`px-5 py-2 rounded-full text-xs uppercase tracking-[0.16em] border transition-colors ${tab === t ? "btn-rose border-transparent" : "bg-white/60"}`}
      style={tab !== t ? { borderColor: "#E9DFD0", color: "var(--ink-soft)" } : undefined}>
      {label}
    </button>
  );

  return (
    <div className="max-w-6xl mx-auto px-6 py-14">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="eyebrow">Admin</p>
          <h1 className="font-display text-5xl mt-3">Manage The Mahj Edit</h1>
        </div>
        <button onClick={() => { setAdminToken(null); setAuthed(false); }}
          className="text-xs uppercase tracking-[0.14em] underline underline-offset-4" style={{ color: "var(--crak)" }}>
          Lock
        </button>
      </div>

      {notice && (
        <div className="mt-4 rounded-md border px-4 py-2 text-sm flex justify-between items-center"
          style={{ borderColor: "var(--crak)", color: "var(--crak)", background: "#FDF3F3" }}>
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-xs underline">Dismiss</button>
        </div>
      )}

      <div className="flex gap-3 mt-8">{tabBtn("events", "Events")}{tabBtn("signups", `Signups (${registrations.length})`)}{tabBtn("photos", "Photos")}</div>

      {/* EVENTS TAB */}
      {tab === "events" && (
        <div className="grid lg:grid-cols-[1fr_1.2fr] gap-10 mt-8 items-start">
          <div className="bg-white/70 border rounded-lg p-6" style={{ borderColor: "#E9DFD0" }}>
            <h2 className="font-display text-2xl">{editing ? "Edit event" : "New event"}</h2>
            <div className="space-y-3 mt-4">
              <input className={inputCls} placeholder="Event title *" value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} />
              <div className="flex gap-3">
                <select className={inputCls} value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input className={inputCls} type="date" value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })} />
              </div>
              <div className="flex gap-3">
                <input className={inputCls} placeholder="Time (e.g. 6:30 – 8:30 PM)" value={draft.time} onChange={e => setDraft({ ...draft, time: e.target.value })} />
                <input className={inputCls + " max-w-[130px]"} placeholder="Price $ (blank = free)" value={draft.price}
                  onChange={e => setDraft({ ...draft, price: e.target.value })} aria-label="Price in dollars" />
              </div>
              <div className="flex gap-3">
                <input className={inputCls} placeholder="Location" value={draft.location} onChange={e => setDraft({ ...draft, location: e.target.value })} />
                <input className={inputCls + " max-w-[110px]"} type="number" min={1} value={draft.totalSpots}
                  onChange={e => setDraft({ ...draft, totalSpots: Number(e.target.value) || 1 })} aria-label="Seats" />
              </div>
              <textarea className={inputCls} rows={3} placeholder="Description" value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} />
              <label className="flex items-center gap-2 text-sm" style={{ color: "var(--ink-soft)" }}>
                <input type="checkbox" checked={draft.published} onChange={e => setDraft({ ...draft, published: e.target.checked })} />
                Published (visible on the site)
              </label>
              <div className="flex gap-3">
                <button onClick={() => void saveEvent()} disabled={!draft.title.trim() || !draft.date || busy}
                  className="btn-jade px-6 py-2.5 rounded-full text-xs uppercase tracking-[0.16em] disabled:opacity-40">
                  {busy ? "Saving…" : editing ? "Save changes" : "Add event"}
                </button>
                {editing && (
                  <button onClick={() => { setEditing(null); setDraft(emptyEvent()); }}
                    className="px-6 py-2.5 rounded-full text-xs uppercase tracking-[0.16em] border" style={{ borderColor: "#E9DFD0" }}>
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="space-y-3">
            {[...events].sort((a, b) => a.date.localeCompare(b.date)).map(ev => (
              <div key={ev.id} className="bg-white/70 border rounded-lg p-4 flex items-center justify-between gap-4 flex-wrap" style={{ borderColor: "#E9DFD0" }}>
                <div>
                  <span className={`inline-block text-[10px] uppercase tracking-[0.12em] px-2 py-0.5 rounded-full ${categoryMeta(ev.category).chip}`}>
                    {categoryMeta(ev.category).label}
                  </span>
                  {!ev.published && (
                    <span className="inline-block text-[10px] uppercase tracking-[0.12em] px-2 py-0.5 rounded-full ml-2 bg-[#EFE7DA]" style={{ color: "var(--ink-soft)" }}>
                      Draft
                    </span>
                  )}
                  <p className="font-display text-lg mt-1">{ev.title}</p>
                  <p className="text-xs" style={{ color: "var(--ink-soft)" }}>
                    {fmtDate(ev.date)} · {ev.time} · {fmtPrice(ev.priceCents)} · {ev.spotsLeft}/{ev.totalSpots} seats left
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => void adminDownloadCheckinReport(ev.id).catch(() => setNotice("Could not download the check-in list"))}
                    className="px-4 py-1.5 rounded-full text-xs border" style={{ borderColor: "var(--gold)", color: "var(--gold)" }}>
                    Check-in CSV
                  </button>
                  <button onClick={() => startEdit(ev)} className="px-4 py-1.5 rounded-full text-xs border" style={{ borderColor: "var(--jade)", color: "var(--jade)" }}>Edit</button>
                  <button onClick={() => void deleteEvent(ev.id)} className="px-4 py-1.5 rounded-full text-xs border" style={{ borderColor: "var(--crak)", color: "var(--crak)" }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SIGNUPS TAB */}
      {tab === "signups" && (
        <div className="mt-8 overflow-x-auto bg-white/70 border rounded-lg" style={{ borderColor: "#E9DFD0" }}>
          {registrations.length === 0 ? (
            <p className="p-8 text-sm text-center" style={{ color: "var(--ink-soft)" }}>No signups yet — they'll appear here as guests reserve seats.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--gold)" }}>
                  {["Event", "Name", "Email", "Phone", "Seats", "Status", "Note", ""].map(h => <th key={h} className="px-4 py-3">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {registrations.map(s => (
                  <tr key={s.id} className="border-t" style={{ borderColor: "#EFE7DA" }}>
                    <td className="px-4 py-3 font-medium">{s.eventTitle}</td>
                    <td className="px-4 py-3">{s.name}</td>
                    <td className="px-4 py-3">{s.email}</td>
                    <td className="px-4 py-3">{s.phone || "—"}</td>
                    <td className="px-4 py-3">{s.seats}</td>
                    <td className="px-4 py-3">
                      <span style={{ color: s.status === "confirmed" ? "var(--jade)" : "var(--gold)" }}>
                        {s.status}{s.paid ? " · paid" : ""}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-[200px] truncate" title={s.notes ?? undefined}>{s.notes || "—"}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => void removeRegistration(s.id)}
                        className="text-xs" style={{ color: "var(--crak)" }}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* PHOTOS TAB */}
      {tab === "photos" && (
        <div className="mt-8">
          <div className="bg-white/70 border rounded-lg p-6 max-w-xl" style={{ borderColor: "#E9DFD0" }}>
            <h2 className="font-display text-2xl">Add photos</h2>
            <div className="space-y-3 mt-4">
              <input className={inputCls} placeholder="Event label (e.g. Troop Night · June)" value={photoMeta.eventLabel}
                onChange={e => setPhotoMeta({ ...photoMeta, eventLabel: e.target.value })} />
              <input className={inputCls} placeholder="Caption" value={photoMeta.caption}
                onChange={e => setPhotoMeta({ ...photoMeta, caption: e.target.value })} />
              <input ref={fileRef} type="file" accept="image/*" multiple className={inputCls}
                onChange={e => handleFiles(e.target.files)} />
              <p className="text-[11px]" style={{ color: "var(--ink-soft)" }}>
                Images are resized to 1200px and uploaded to secure storage.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            {photos.map(p => (
              <div key={p.id} className="relative group">
                <img src={p.url} alt={p.caption ?? ""} className="w-full aspect-[4/3] object-cover rounded-lg border" style={{ borderColor: "#E9DFD0" }} loading="lazy" />
                <p className="text-xs mt-1 truncate" style={{ color: "var(--ink-soft)" }}>{p.eventLabel ?? ""}</p>
                <button onClick={() => void deletePhoto(p.id)}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full text-xs bg-white/90 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: "var(--crak)" }} aria-label={`Delete ${p.caption ?? "photo"}`}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
