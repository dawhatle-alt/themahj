// ---------- Types ----------
export type EventType = "class" | "open-play" | "troop";

export interface MahjEvent {
  id: string;
  title: string;
  type: EventType;
  date: string; // YYYY-MM-DD
  time: string;
  location: string;
  seats: number;
  price: string;
  description: string;
}

export interface Signup {
  id: string;
  eventId: string;
  name: string;
  email: string;
  phone: string;
  seats: number;
  note: string;
  createdAt: string;
}

export interface Photo {
  id: string;
  caption: string;
  eventLabel: string;
  // either a stored base64 data URI (admin uploads) or a built-in svg key
  src: string;
}

export interface SiteData {
  events: MahjEvent[];
  signups: Signup[];
  photos: Photo[];
}

export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);

export const EVENT_TYPE_META: Record<EventType, { label: string; chip: string }> = {
  "class": { label: "Class", chip: "bg-[var(--jade-soft)] text-[var(--jade)]" },
  "open-play": { label: "Open Play", chip: "bg-[var(--blush)] text-[var(--rose-deep)]" },
  "troop": { label: "Troop Mahjong", chip: "bg-[#F3E7D3] text-[var(--gold)]" },
};

// ---------- Built-in gallery art (placeholder "photos" until real ones are uploaded) ----------
function svgCard(bg: string, fg: string, glyph: string, label: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600' viewBox='0 0 800 600'>
  <rect width='800' height='600' fill='${bg}'/>
  <rect x='40' y='40' width='720' height='520' fill='none' stroke='${fg}' stroke-opacity='0.35' stroke-width='2'/>
  <text x='400' y='320' font-family='Georgia, serif' font-size='160' fill='${fg}' text-anchor='middle'>${glyph}</text>
  <text x='400' y='430' font-family='Georgia, serif' font-style='italic' font-size='34' fill='${fg}' fill-opacity='0.85' text-anchor='middle'>${label}</text>
</svg>`;
  return "data:image/svg+xml," + encodeURIComponent(svg);
}

export const seedPhotos: Photo[] = [
  { id: "p1", caption: "Tablescape from our spring open play", eventLabel: "Open Play · April", src: svgCard("#F3DEE2", "#A94B61", "🀢", "Spring Open Play") },
  { id: "p2", caption: "Beginner class — first mahj of the night!", eventLabel: "Mahjong 101", src: svgCard("#DCE9E2", "#2E6B5A", "🀐", "Mahjong 101") },
  { id: "p3", caption: "Troop night, merit stickers earned", eventLabel: "Troop Mahjong", src: svgCard("#F4EDE2", "#B98A4A", "🀄", "Troop Night") },
  { id: "p4", caption: "Galentine's tournament winners", eventLabel: "Tournament", src: svgCard("#F8EDE0", "#B33A3A", "🀇", "Galentine's") },
  { id: "p5", caption: "Mimosas & mahj morning", eventLabel: "Mahjmosas", src: svgCard("#F3DEE2", "#C9697E", "🀙", "Mahjmosas") },
  { id: "p6", caption: "New tiles, new friends", eventLabel: "Open Play", src: svgCard("#EFE7F0", "#7A5B7E", "🀅", "Open Play") },
];

// ---------- Seed events (next few weeks from mid-June 2026) ----------
export const seedEvents: MahjEvent[] = [
  { id: "e1", title: "Mahjong 101 — Learn to Play", type: "class", date: "2026-06-16", time: "6:30 – 8:30 PM", location: "Leander, TX", seats: 8, price: "$45", description: "A friendly first lesson in American mahjong: the tiles, the card, the Charleston, and your first hands. No experience needed — everything provided." },
  { id: "e2", title: "Open Play Night", type: "open-play", date: "2026-06-18", time: "6:00 – 9:00 PM", location: "Leander, TX", seats: 16, price: "$15", description: "Relaxed open play for all levels. Tables, tiles, and current NMJL cards provided. Come solo or bring your foursome." },
  { id: "e3", title: "Troop Mahjong Night — Summer Sparkle", type: "troop", date: "2026-06-25", time: "6:30 – 9:00 PM", location: "Leander, TX", seats: 20, price: "$30", description: "A themed Troop Mahjong evening: curated tablescapes, player gifts, raffle prizes, and merit stickers for every mahj. Dress code: a little sparkle." },
  { id: "e4", title: "Mahjong 102 — Strategy & The Card", type: "class", date: "2026-06-30", time: "6:30 – 8:30 PM", location: "Leander, TX", seats: 8, price: "$45", description: "For players who know the basics: reading the card with confidence, defensive play, joker strategy, and when to pivot your hand." },
  { id: "e5", title: "Mahjmosas — Saturday Morning Open Play", type: "open-play", date: "2026-07-11", time: "10:00 AM – 1:00 PM", location: "Leander, TX", seats: 16, price: "$20", description: "Morning mahjong with mimosas and light bites. All levels welcome — a perfect, social way to spend a Saturday." },
];

// ---------- Persistence (window.storage when available, memory fallback) ----------
declare global {
  interface Window {
    storage?: {
      get(key: string, shared?: boolean): Promise<{ key: string; value: string } | null>;
      set(key: string, value: string, shared?: boolean): Promise<unknown>;
      delete(key: string, shared?: boolean): Promise<unknown>;
    };
  }
}

const KEY = "themahj:site-data:v1";
let memory: SiteData | null = null;

export function defaultData(): SiteData {
  return { events: [...seedEvents], signups: [], photos: [...seedPhotos] };
}

export async function loadData(): Promise<SiteData> {
  if (memory) return memory;
  if (window.storage) {
    try {
      const res = await window.storage.get(KEY);
      if (res && res.value) {
        memory = JSON.parse(res.value) as SiteData;
        return memory;
      }
    } catch {
      /* key missing — fall through to defaults */
    }
  }
  memory = defaultData();
  return memory;
}

export async function saveData(data: SiteData): Promise<void> {
  memory = data;
  if (window.storage) {
    try {
      await window.storage.set(KEY, JSON.stringify(data));
    } catch (err) {
      console.error("storage save failed", err);
    }
  }
}

export async function resetData(): Promise<SiteData> {
  memory = defaultData();
  if (window.storage) {
    try { await window.storage.set(KEY, JSON.stringify(memory)); } catch { /* noop */ }
  }
  return memory;
}

// ---------- Date helpers ----------
export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

export function fmtShort(iso: string): { mon: string; day: string } {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return { mon: dt.toLocaleDateString("en-US", { month: "short" }).toUpperCase(), day: String(d) };
}

export function seatsTaken(data: SiteData, eventId: string): number {
  return data.signups.filter(s => s.eventId === eventId).reduce((n, s) => n + s.seats, 0);
}
