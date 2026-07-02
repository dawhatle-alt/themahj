import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
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

const ESPRESSO = "#1A0F0A";
const NAV_BASE = "#D9C9B8";
const NAV_ACTIVE = "#B98A4A";

function MenuIcon() {
  return (
    <svg width="22" height="16" viewBox="0 0 22 16" fill="none" aria-hidden="true">
      <rect y="0" width="22" height="2" rx="1" fill={NAV_BASE} />
      <rect y="7" width="16" height="2" rx="1" fill={NAV_BASE} />
      <rect y="14" width="22" height="2" rx="1" fill={NAV_BASE} />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <line x1="1" y1="1" x2="17" y2="17" stroke={NAV_BASE} strokeWidth="2" strokeLinecap="round" />
      <line x1="17" y1="1" x2="1" y2="17" stroke={NAV_BASE} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

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

      {/* ── Header ── */}
      <header className="sticky top-0 z-40" style={{ background: ESPRESSO }}>
        <div className="max-w-6xl mx-auto px-6 h-[88px] flex items-center justify-between">

          {/* Logo — mark + wordmark */}
          <button
            onClick={() => go("home")}
            className="shrink-0 flex items-center gap-3 leading-none"
            aria-label="Go home"
          >
            <img
              src={logoGold}
              alt=""
              className="w-auto object-contain block"
              style={{
                height: "clamp(52px, 6vw, 64px)",
                filter:
                  "drop-shadow(0 0 10px rgba(185,138,74,0.65)) drop-shadow(0 0 3px rgba(185,138,74,0.45))",
              }}
            />
            <span className="hidden sm:flex flex-col items-start" style={{ gap: "1px" }}>
              <span
                className="font-display italic leading-none"
                style={{
                  fontSize: "clamp(1.25rem, 2.2vw, 1.65rem)",
                  background: "linear-gradient(135deg, #D4AA58 0%, #B98A4A 45%, #E8CA78 70%, #B98A4A 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                The Mahj Edit
              </span>
              <span
                className="uppercase tracking-[0.3em] leading-none"
                style={{ fontSize: "0.57rem", color: "#7A6040", letterSpacing: "0.3em" }}
              >
                Leander, Texas
              </span>
            </span>
          </button>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8" aria-label="Main navigation">
            {PAGES.map(p => {
              const active = page === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => go(p.id)}
                  className="relative text-[12px] uppercase tracking-[0.2em] font-medium transition-colors duration-200 py-1 cursor-pointer"
                  style={{ color: active ? NAV_ACTIVE : NAV_BASE }}
                  aria-current={active ? "page" : undefined}
                >
                  {p.label}
                  {active && (
                    <span
                      className="absolute left-0 -bottom-0.5 w-full h-px"
                      style={{ background: NAV_ACTIVE }}
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden flex items-center justify-center w-10 h-10 cursor-pointer"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen(m => !m)}
          >
            {menuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>

        {/* Mobile nav drawer */}
        {menuOpen && (
          <nav
            className="md:hidden border-t px-6 py-5 flex flex-col gap-4"
            style={{ borderColor: "rgba(255,255,255,0.08)", background: ESPRESSO }}
            aria-label="Mobile navigation"
          >
            {PAGES.map(p => {
              const active = page === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => go(p.id)}
                  className="text-left text-sm uppercase tracking-[0.18em] font-medium transition-colors duration-150 py-1"
                  style={{ color: active ? NAV_ACTIVE : NAV_BASE }}
                  aria-current={active ? "page" : undefined}
                >
                  {p.label}
                </button>
              );
            })}
          </nav>
        )}
      </header>

      <main className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={page}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
          >
            {page === "home"    && <Home data={data} go={go} />}
            {page === "about"   && <About go={go} />}
            {page === "events"  && <Events data={data} onChange={update} />}
            {page === "troop"   && <Troop go={go} />}
            {page === "gallery" && <Gallery data={data} />}
            {page === "admin"   && <Admin data={data} onChange={update} />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ── Footer ── */}
      <footer style={{ background: ESPRESSO }}>
        <div className="max-w-6xl mx-auto px-6 py-12 flex flex-wrap items-end justify-between gap-8">

          <div>
            <img src={logoGold} alt="The Mahj Edit" className="h-16 w-auto object-contain" />
            <p className="text-xs mt-3 uppercase tracking-[0.22em]" style={{ color: "#8A7260" }}>
              Classes · Open Play · Troop Mahjong
            </p>
          </div>

          <div className="text-sm leading-relaxed" style={{ color: "#8A7260" }}>
            <p>Leander, Texas</p>
            <p>hello@themahj.com</p>
            <p className="mt-2 text-xs" style={{ color: "#5C4A3A" }}>
              © {new Date().getFullYear()} The Mahj Edit. All rights reserved.
            </p>
          </div>

          <button
            onClick={() => go("admin")}
            className="text-[11px] uppercase tracking-[0.2em] transition-colors duration-150"
            style={{ color: "#5C4A3A" }}
            onMouseOver={e => (e.currentTarget.style.color = "#8A7260")}
            onMouseOut={e => (e.currentTarget.style.color = "#5C4A3A")}
          >
            Admin
          </button>
        </div>
      </footer>

    </div>
  );
}
