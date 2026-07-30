// Display helpers shared across pages. Event data itself now lives in the
// database and is fetched through lib/api.ts.

export const CATEGORIES = ["Class", "Open Play", "Troop Mahjong"] as const;

export interface CategoryMeta {
  label: string;
  chip: string;      // tailwind classes for the pill badge
  calendar: string;  // css color for calendar blocks / legend
}

const CATEGORY_META: Record<string, CategoryMeta> = {
  "Class": { label: "Class", chip: "bg-[var(--jade-soft)] text-[var(--jade)]", calendar: "var(--jade)" },
  "Open Play": { label: "Open Play", chip: "bg-[var(--blush)] text-[var(--rose-deep)]", calendar: "var(--rose)" },
  "Troop Mahjong": { label: "Troop Mahjong", chip: "bg-[#F3E7D3] text-[var(--gold)]", calendar: "var(--gold)" },
};

export function categoryMeta(category: string): CategoryMeta {
  return CATEGORY_META[category] ?? {
    label: category,
    chip: "bg-[#F3E7D3] text-[var(--gold)]",
    calendar: "var(--gold)",
  };
}

// ---------- Formatting helpers ----------
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

function to12h(hhmm: string): { text: string; meridiem: string } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h24 = Number(m[1]);
  if (h24 > 23 || Number(m[2]) > 59) return null;
  return {
    text: `${h24 % 12 === 0 ? 12 : h24 % 12}:${m[2]}`,
    meridiem: h24 >= 12 ? "PM" : "AM",
  };
}

/** Builds the display string shown on the site from 24-hour start/end values. */
export function formatTimeRange(start: string, end: string): string {
  const s = to12h(start);
  if (!s) return "";
  const e = end ? to12h(end) : null;
  if (!e) return `${s.text} ${s.meridiem}`;
  return s.meridiem === e.meridiem
    ? `${s.text} – ${e.text} ${e.meridiem}`
    : `${s.text} ${s.meridiem} – ${e.text} ${e.meridiem}`;
}

// The reminder job runs once a day (Vercel Hobby allows no more), so a reminder
// goes out on the first morning run at or after "event minus N hours". Labels
// describe when mail actually lands rather than the raw interval — an
// hour-scale option would just arrive the next morning regardless.
export const REMINDER_OPTIONS: { label: string; hours: number | null }[] = [
  { label: "No reminder email", hours: null },
  { label: "Morning of the event", hours: 24 },
  { label: "The day before", hours: 48 },
  { label: "About a week before", hours: 168 },
];

export function fmtPrice(priceCents: number | null): string {
  if (!priceCents) return "Free";
  const dollars = priceCents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}
