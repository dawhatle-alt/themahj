import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { MahjEvent, Photo, SiteData } from "@/lib/data";
import { EVENT_TYPE_META, fmtDate, resetData, uid } from "@/lib/data";

// ---------------- GALLERY ----------------
export function Gallery({ data }: { data: SiteData }) {
  const [open, setOpen] = useState<Photo | null>(null);
  return (
    <div className="max-w-6xl mx-auto px-6 py-14">
      <p className="eyebrow">Around the table</p>
      <h1 className="font-display text-5xl mt-3">Event photos</h1>
      <p className="mt-4 max-w-xl" style={{ color: "var(--ink-soft)" }}>
        Tablescapes, merit stickers, and the faces behind the mahjs.
      </p>
      {data.photos.length === 0 ? (
        <div className="tile max-w-md mx-auto mt-12 p-10 text-center">
          <p className="font-display italic text-2xl">No photos yet</p>
          <p className="text-sm mt-2" style={{ color: "var(--ink-soft)" }}>Photos from our next event will land here.</p>
        </div>
      ) : (
        <div className="columns-2 md:columns-3 gap-4 mt-10 [&>*]:mb-4">
          {data.photos.map(p => (
            <button key={p.id} onClick={() => setOpen(p)} className="block w-full break-inside-avoid tile-hover text-left">
              <img src={p.src} alt={p.caption} className="w-full rounded-lg border" style={{ borderColor: "#E9DFD0" }} />
              <p className="text-xs mt-1.5 px-0.5" style={{ color: "var(--ink-soft)" }}>{p.eventLabel}</p>
            </button>
          ))}
        </div>
      )}
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="bg-[var(--ivory)] max-w-2xl">
          {open && (
            <>
              <img src={open.src} alt={open.caption} className="w-full rounded-lg" />
              <DialogHeader>
                <DialogTitle className="font-display text-2xl font-medium">{open.eventLabel}</DialogTitle>
              </DialogHeader>
              <p className="text-sm -mt-1" style={{ color: "var(--ink-soft)" }}>{open.caption}</p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------- ADMIN ----------------
const DEMO_PASS = "mahj2026";
const emptyEvent = (): Omit<MahjEvent, "id"> => ({
  title: "", type: "open-play", date: "", time: "", location: "Leander, TX", seats: 16, price: "$15", description: "",
});

export function Admin({ data, onChange }: { data: SiteData; onChange: (d: SiteData) => void }) {
  const [authed, setAuthed] = useState(false);
  const [pass, setPass] = useState("");
  const [tab, setTab] = useState<"events" | "signups" | "photos">("events");
  const [editing, setEditing] = useState<MahjEvent | null>(null);
  const [draft, setDraft] = useState<Omit<MahjEvent, "id">>(emptyEvent());
  const [photoMeta, setPhotoMeta] = useState({ caption: "", eventLabel: "" });
  const fileRef = useRef<HTMLInputElement>(null);
  const inputCls = "w-full rounded-md border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--rose)]";

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
          onKeyDown={e => e.key === "Enter" && pass === DEMO_PASS && setAuthed(true)} />
        <button onClick={() => pass === DEMO_PASS && setAuthed(true)}
          className="btn-rose w-full py-3 rounded-full text-sm uppercase tracking-[0.18em] mt-4">
          Unlock
        </button>
        {pass && pass !== DEMO_PASS && <p className="text-xs mt-3" style={{ color: "var(--crak)" }}>That's not it — try again.</p>}
        <p className="text-[11px] mt-6" style={{ color: "var(--ink-soft)" }}>
          Demo passcode: <code>mahj2026</code> · In production this becomes real authentication.
        </p>
      </div>
    );
  }

  function startEdit(ev: MahjEvent) {
    setEditing(ev);
    const { id, ...rest } = ev;
    setDraft(rest);
  }

  function saveEvent() {
    if (!draft.title.trim() || !draft.date) return;
    if (editing) {
      onChange({ ...data, events: data.events.map(e => e.id === editing.id ? { ...editing, ...draft } : e) });
    } else {
      onChange({ ...data, events: [...data.events, { id: uid(), ...draft }] });
    }
    setEditing(null);
    setDraft(emptyEvent());
  }

  function deleteEvent(id: string) {
    onChange({ ...data, events: data.events.filter(e => e.id !== id), signups: data.signups.filter(s => s.eventId !== id) });
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
        const src = canvas.toDataURL("image/jpeg", 0.82);
        URL.revokeObjectURL(url);
        onChange({
          ...data,
          photos: [{ id: uid(), src, caption: photoMeta.caption || file.name, eventLabel: photoMeta.eventLabel || "Event" }, ...data.photos],
        });
      };
      img.src = url;
    });
    if (fileRef.current) fileRef.current.value = "";
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
          <h1 className="font-display text-5xl mt-3">Manage The Mahj</h1>
        </div>
        <div className="flex gap-3">
          <button onClick={async () => onChange(await resetData())}
            className="text-xs uppercase tracking-[0.14em] underline underline-offset-4" style={{ color: "var(--ink-soft)" }}>
            Reset demo data
          </button>
          <button onClick={() => setAuthed(false)}
            className="text-xs uppercase tracking-[0.14em] underline underline-offset-4" style={{ color: "var(--crak)" }}>
            Lock
          </button>
        </div>
      </div>

      <div className="flex gap-3 mt-8">{tabBtn("events", "Events")}{tabBtn("signups", `Signups (${data.signups.length})`)}{tabBtn("photos", "Photos")}</div>

      {/* EVENTS TAB */}
      {tab === "events" && (
        <div className="grid lg:grid-cols-[1fr_1.2fr] gap-10 mt-8 items-start">
          <div className="bg-white/70 border rounded-lg p-6" style={{ borderColor: "#E9DFD0" }}>
            <h2 className="font-display text-2xl">{editing ? "Edit event" : "New event"}</h2>
            <div className="space-y-3 mt-4">
              <input className={inputCls} placeholder="Event title *" value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} />
              <div className="flex gap-3">
                <select className={inputCls} value={draft.type} onChange={e => setDraft({ ...draft, type: e.target.value as MahjEvent["type"] })}>
                  <option value="class">Class</option>
                  <option value="open-play">Open Play</option>
                  <option value="troop">Troop Mahjong</option>
                </select>
                <input className={inputCls} type="date" value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })} />
              </div>
              <div className="flex gap-3">
                <input className={inputCls} placeholder="Time (e.g. 6:30 – 8:30 PM)" value={draft.time} onChange={e => setDraft({ ...draft, time: e.target.value })} />
                <input className={inputCls} placeholder="Price" value={draft.price} onChange={e => setDraft({ ...draft, price: e.target.value })} />
              </div>
              <div className="flex gap-3">
                <input className={inputCls} placeholder="Location" value={draft.location} onChange={e => setDraft({ ...draft, location: e.target.value })} />
                <input className={inputCls + " max-w-[110px]"} type="number" min={1} value={draft.seats}
                  onChange={e => setDraft({ ...draft, seats: Number(e.target.value) || 1 })} aria-label="Seats" />
              </div>
              <textarea className={inputCls} rows={3} placeholder="Description" value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} />
              <div className="flex gap-3">
                <button onClick={saveEvent} disabled={!draft.title.trim() || !draft.date}
                  className="btn-jade px-6 py-2.5 rounded-full text-xs uppercase tracking-[0.16em] disabled:opacity-40">
                  {editing ? "Save changes" : "Add event"}
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
            {[...data.events].sort((a, b) => a.date.localeCompare(b.date)).map(ev => (
              <div key={ev.id} className="bg-white/70 border rounded-lg p-4 flex items-center justify-between gap-4 flex-wrap" style={{ borderColor: "#E9DFD0" }}>
                <div>
                  <span className={`inline-block text-[10px] uppercase tracking-[0.12em] px-2 py-0.5 rounded-full ${EVENT_TYPE_META[ev.type].chip}`}>
                    {EVENT_TYPE_META[ev.type].label}
                  </span>
                  <p className="font-display text-lg mt-1">{ev.title}</p>
                  <p className="text-xs" style={{ color: "var(--ink-soft)" }}>{fmtDate(ev.date)} · {ev.time} · {ev.seats} seats</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => startEdit(ev)} className="px-4 py-1.5 rounded-full text-xs border" style={{ borderColor: "var(--jade)", color: "var(--jade)" }}>Edit</button>
                  <button onClick={() => deleteEvent(ev.id)} className="px-4 py-1.5 rounded-full text-xs border" style={{ borderColor: "var(--crak)", color: "var(--crak)" }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SIGNUPS TAB */}
      {tab === "signups" && (
        <div className="mt-8 overflow-x-auto bg-white/70 border rounded-lg" style={{ borderColor: "#E9DFD0" }}>
          {data.signups.length === 0 ? (
            <p className="p-8 text-sm text-center" style={{ color: "var(--ink-soft)" }}>No signups yet — they'll appear here as guests reserve seats.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--gold)" }}>
                  {["Event", "Name", "Email", "Phone", "Seats", "Note", ""].map(h => <th key={h} className="px-4 py-3">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {data.signups.map(s => {
                  const ev = data.events.find(e => e.id === s.eventId);
                  return (
                    <tr key={s.id} className="border-t" style={{ borderColor: "#EFE7DA" }}>
                      <td className="px-4 py-3 font-medium">{ev?.title || "—"}</td>
                      <td className="px-4 py-3">{s.name}</td>
                      <td className="px-4 py-3">{s.email}</td>
                      <td className="px-4 py-3">{s.phone || "—"}</td>
                      <td className="px-4 py-3">{s.seats}</td>
                      <td className="px-4 py-3 max-w-[200px] truncate" title={s.note}>{s.note || "—"}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => onChange({ ...data, signups: data.signups.filter(x => x.id !== s.id) })}
                          className="text-xs" style={{ color: "var(--crak)" }}>Remove</button>
                      </td>
                    </tr>
                  );
                })}
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
                Images are resized to 1200px and saved with the site data.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            {data.photos.map(p => (
              <div key={p.id} className="relative group">
                <img src={p.src} alt={p.caption} className="w-full aspect-[4/3] object-cover rounded-lg border" style={{ borderColor: "#E9DFD0" }} />
                <p className="text-xs mt-1 truncate" style={{ color: "var(--ink-soft)" }}>{p.eventLabel}</p>
                <button onClick={() => onChange({ ...data, photos: data.photos.filter(x => x.id !== p.id) })}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full text-xs bg-white/90 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: "var(--crak)" }} aria-label={`Delete ${p.caption}`}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
