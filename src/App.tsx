import { useEffect, useState } from "react";
import { Home, About, Troop } from "@/components/Pages";
import { Events } from "@/components/Events";
import { Gallery, Admin } from "@/components/AdminGallery";
import type { SiteData } from "@/lib/data";
import { defaultData, loadData, saveData } from "@/lib/data";
import logoGold from "@/assets/logo-gold.png";

const PAGES = [
  { id: "home", label: "Home" },
  { id: "about", label: "About" },
  { id: "events", label: "Classes & Events" },
  { id: "troop", label: "Troop Mahjong" },
  { id: "gallery", label: "Photos" },
] as const;

export default function App() {
  const [page, setPage] = useState<string>("home");
  const [data, setData] = useState<SiteData>(defaultData());
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => { loadData().then(setData); }, []);

  function update(next: SiteData) {
    setData(next);
    void saveData(next);
  }

  function go(p: string) {
    setPage(p);
    setMenuOpen(false);
    window.scrollTo({ top: 0 });
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 backdrop-blur border-b" style={{ background: "rgba(251,247,241,0.88)", borderColor: "#EDE3D2" }}>
        <div className="max-w-6xl mx-auto px-6 h-[72px] flex items-center justify-between">
          <button onClick={() => go("home")} className="flex items-center text-left">
            <span className="flex items-center justify-center rounded-lg px-2 py-1" style={{ background: "#1C1510" }}>
              <img
                src={logoGold}
                alt="The Mahj"
                className="h-11 w-auto object-contain"
              />
            </span>
          </button>
          <nav className="hidden md:flex items-center gap-7">
            {PAGES.map(p => (
              <button key={p.id} onClick={() => go(p.id)}
                className="text-[13px] uppercase tracking-[0.16em] pb-1 border-b-2 transition-colors"
                style={{
                  borderColor: page === p.id ? "var(--rose)" : "transparent",
                  color: page === p.id ? "var(--rose-deep)" : "var(--ink)",
                }}>
                {p.label}
              </button>
            ))}
          </nav>
          <button className="md:hidden text-2xl" aria-label="Menu" onClick={() => setMenuOpen(m => !m)}>☰</button>
        </div>
        {menuOpen && (
          <nav className="md:hidden border-t px-6 py-4 flex flex-col gap-3" style={{ borderColor: "#EDE3D2" }}>
            {PAGES.map(p => (
              <button key={p.id} onClick={() => go(p.id)} className="text-left text-sm uppercase tracking-[0.16em]"
                style={{ color: page === p.id ? "var(--rose-deep)" : "var(--ink)" }}>
                {p.label}
              </button>
            ))}
          </nav>
        )}
      </header>

      <main className="flex-1">
        {page === "home" && <Home data={data} go={go} />}
        {page === "about" && <About go={go} />}
        {page === "events" && <Events data={data} onChange={update} />}
        {page === "troop" && <Troop go={go} />}
        {page === "gallery" && <Gallery data={data} />}
        {page === "admin" && <Admin data={data} onChange={update} />}
      </main>

      <footer className="mt-10 border-t" style={{ borderColor: "#EDE3D2", background: "var(--ivory-deep)" }}>
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-wrap items-center justify-between gap-6">
          <div>
            <img src={logoGold} alt="The Mahj" className="h-20 w-auto object-contain" />
            <p className="text-xs mt-2 uppercase tracking-[0.2em]" style={{ color: "var(--gold)" }}>
              Classes · Open Play · Troop Mahjong
            </p>
          </div>
          <div className="text-sm" style={{ color: "var(--ink-soft)" }}>
            <p>Leander, Texas · hello@themahj.com</p>
            <p className="mt-1">© {new Date().getFullYear()} The Mahj. All rights reserved.</p>
          </div>
          <button onClick={() => go("admin")} className="text-[11px] uppercase tracking-[0.2em] underline underline-offset-4"
            style={{ color: "var(--ink-soft)" }}>
            Admin
          </button>
        </div>
      </footer>
    </div>
  );
}
