import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { MahjEvent, SiteData } from "@/lib/data";
import { EVENT_TYPE_META, fmtDate, seatsTaken, uid } from "@/lib/data";

const reveal = {
  hidden: { opacity: 0, y: 24 },
  visible: (delay = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.68, delay, ease: [0.22, 1, 0.36, 1] },
  }),
};

function monthLabel(y: number, m: number) {
  return new Date(y, m, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function Events({ data, onChange }: { data: SiteData; onChange: (d: SiteData) => void }) {
  const today = new Date();
  const [ym, setYm] = useState<{ y: number; m: number }>({ y: today.getFullYear(), m: today.getMonth() });
  const [selected, setSelected] = useState<MahjEvent | null>(null);
  const [confirmed, setConfirmed] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", seats: 1, note: "" });

  const byDate = useMemo(() => {
    const map: Record<string, MahjEvent[]> = {};
    for (const ev of data.events) (map[ev.date] ||= []).push(ev);
    return map;
  }, [data.events]);

  const grid = useMemo(() => {
    const first = new Date(ym.y, ym.m, 1);
    const startPad = first.getDay();
    const days = new Date(ym.y, ym.m + 1, 0).getDate();
    const cells: ({ day: number; iso: string } | null)[] = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let d = 1; d <= days; d++) {
      cells.push({ day: d, iso: `${ym.y}-${String(ym.m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` });
    }
    return cells;
  }, [ym]);

  const upcoming = useMemo(
    () => [...data.events].sort((a, b) => a.date.localeCompare(b.date)),
    [data.events]
  );

  function submitSignup() {
    if (!selected || !form.name.trim() || !form.email.trim()) return;
    const next: SiteData = {
      ...data,
      signups: [...data.signups, {
        id: uid(), eventId: selected.id, name: form.name.trim(), email: form.email.trim(),
        phone: form.phone.trim(), seats: form.seats, note: form.note.trim(),
        createdAt: new Date().toISOString(),
      }],
    };
    onChange(next);
    setConfirmed(selected.title);
    setSelected(null);
    setForm({ name: "", email: "", phone: "", seats: 1, note: "" });
  }

  const inputCls = "w-full rounded-md border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--rose)]";

  return (
    <div className="max-w-6xl mx-auto px-6 py-14">
      <motion.p className="eyebrow"
        variants={reveal} custom={0} initial="hidden" animate="visible">
        Classes &amp; open play
      </motion.p>
      <motion.h1
        className="font-display leading-[0.9] mt-4 tracking-tight"
        style={{ fontSize: "clamp(2.8rem,7vw,5rem)" }}
        variants={reveal} custom={0.08} initial="hidden" animate="visible">
        The calendar.
      </motion.h1>
      <motion.p className="mt-5 max-w-xl text-[17px] leading-relaxed" style={{ color: "var(--ink-soft)" }}
        variants={reveal} custom={0.18} initial="hidden" animate="visible">
        Reserve a seat at a beginner class, an open play night, or a Troop Mahjong evening.
        Tap any event to sign up.
      </motion.p>

      <div className="grid lg:grid-cols-[1.15fr_1fr] gap-12 mt-10 items-start">
        {/* Calendar */}
        <motion.div className="bg-white/70 border rounded-lg p-5" style={{ borderColor: "#E9DFD0" }}
          initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.28, ease: [0.22, 1, 0.36, 1] }}>
          <div className="flex items-center justify-between mb-4">
            <button aria-label="Previous month" onClick={() => setYm(({ y, m }) => m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 })}
              className="w-9 h-9 rounded-full border flex items-center justify-center hover:bg-[var(--blush)]">‹</button>
            <h2 className="font-display text-2xl">{monthLabel(ym.y, ym.m)}</h2>
            <button aria-label="Next month" onClick={() => setYm(({ y, m }) => m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 })}
              className="w-9 h-9 rounded-full border flex items-center justify-center hover:bg-[var(--blush)]">›</button>
          </div>
          <div className="grid grid-cols-7 text-center text-[11px] uppercase tracking-[0.14em] pb-2" style={{ color: "var(--gold)" }}>
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => <div key={d}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {grid.map((cell, i) => {
              if (!cell) return <div key={i} />;
              const evs = byDate[cell.iso] || [];
              const isToday = cell.iso === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
              return (
                <div key={i} className={`min-h-[64px] rounded-md p-1.5 text-sm ${evs.length ? "bg-[var(--blush)]/60" : ""}`}
                  style={isToday ? { outline: "1.5px solid var(--rose)" } : undefined}>
                  <div className="text-xs" style={{ color: "var(--ink-soft)" }}>{cell.day}</div>
                  {evs.map(ev => (
                    <button key={ev.id} onClick={() => setSelected(ev)}
                      className="block w-full text-left text-[10px] leading-tight mt-1 px-1.5 py-1 rounded font-medium truncate"
                      style={{ background: ev.type === "class" ? "var(--jade)" : ev.type === "troop" ? "var(--gold)" : "var(--rose)", color: "#fff" }}
                      title={ev.title}>
                      {ev.title}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
          <div className="flex gap-4 mt-4 text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--ink-soft)" }}>
            {[["var(--jade)", "Class"], ["var(--rose)", "Open Play"], ["var(--gold)", "Troop"]].map(([c, l]) => (
              <span key={l} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: c }} /> {l}
              </span>
            ))}
          </div>
        </motion.div>

        {/* Upcoming list */}
        <motion.div className="space-y-4"
          initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.36, ease: [0.22, 1, 0.36, 1] }}>
          {upcoming.map(ev => {
            const taken = seatsTaken(data, ev.id);
            const left = Math.max(0, ev.seats - taken);
            return (
              <div key={ev.id} className="bg-white/70 border rounded-lg p-5" style={{ borderColor: "#E9DFD0" }}>
                <div className="flex justify-between items-start gap-3 flex-wrap">
                  <div>
                    <span className={`inline-block text-[11px] uppercase tracking-[0.14em] px-2.5 py-1 rounded-full ${EVENT_TYPE_META[ev.type].chip}`}>
                      {EVENT_TYPE_META[ev.type].label}
                    </span>
                    <h3 className="font-display text-2xl mt-2">{ev.title}</h3>
                    <p className="text-sm mt-1" style={{ color: "var(--ink-soft)" }}>
                      {fmtDate(ev.date)} · {ev.time} · {ev.location}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-2xl">{ev.price}</p>
                    <p className="text-xs mt-0.5" style={{ color: left === 0 ? "var(--crak)" : "var(--jade)" }}>
                      {left === 0 ? "Sold out" : `${left} seats left`}
                    </p>
                  </div>
                </div>
                <p className="text-sm mt-3 leading-relaxed" style={{ color: "var(--ink-soft)" }}>{ev.description}</p>
                <button disabled={left === 0} onClick={() => setSelected(ev)}
                  className="btn-rose px-6 py-2.5 rounded-full text-xs uppercase tracking-[0.18em] mt-4 disabled:opacity-40 disabled:pointer-events-none">
                  Reserve a seat
                </button>
              </div>
            );
          })}
        </motion.div>
      </div>

      {/* Signup dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="bg-[var(--ivory)] max-w-md">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-3xl font-medium">{selected.title}</DialogTitle>
              </DialogHeader>
              <p className="text-sm -mt-1" style={{ color: "var(--ink-soft)" }}>
                {fmtDate(selected.date)} · {selected.time} · {selected.price} per seat
              </p>
              <div className="space-y-3 mt-2">
                <input className={inputCls} placeholder="Your name *" value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })} />
                <input className={inputCls} placeholder="Email *" type="email" value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })} />
                <div className="flex gap-3">
                  <input className={inputCls} placeholder="Phone (optional)" value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })} />
                  <select className={inputCls + " max-w-[110px]"} value={form.seats}
                    onChange={e => setForm({ ...form, seats: Number(e.target.value) })}>
                    {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n} seat{n > 1 ? "s" : ""}</option>)}
                  </select>
                </div>
                <textarea className={inputCls} rows={2} placeholder="Anything we should know? (optional)"
                  value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
                <button onClick={submitSignup} disabled={!form.name.trim() || !form.email.trim()}
                  className="btn-rose w-full py-3 rounded-full text-sm uppercase tracking-[0.18em] disabled:opacity-40">
                  Confirm reservation
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation */}
      <Dialog open={!!confirmed} onOpenChange={(o) => !o && setConfirmed(null)}>
        <DialogContent className="bg-[var(--ivory)] max-w-sm text-center">
          <DialogHeader>
            <DialogTitle className="font-display text-3xl font-medium text-center">You're in! 🀄</DialogTitle>
          </DialogHeader>
          <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
            Your seat for <strong>{confirmed}</strong> is reserved. We can't wait to see you at the table.
          </p>
          <button onClick={() => setConfirmed(null)} className="btn-jade mx-auto px-7 py-2.5 rounded-full text-xs uppercase tracking-[0.18em] mt-2">
            Wonderful
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
