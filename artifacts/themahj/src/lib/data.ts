// Display helpers shared across pages. Event data itself now lives in the
// database and is fetched through lib/api.ts.

// Categories are admin-managed (see lib/categories.ts). A category stores a
// palette key rather than a colour value, so anything created later still lands
// inside the site's scheme. Keep these keys in sync with routes/categories.ts.
export const CATEGORY_COLORS = ["jade", "rose", "gold", "crak", "ink"] as const;
export type CategoryColor = (typeof CATEGORY_COLORS)[number];

export interface CategoryMeta {
  label: string;
  chip: string;      // tailwind classes for the pill badge
  calendar: string;  // css color for calendar blocks / legend
  swatch: string;    // css color for the admin colour picker
}

const COLOR_META: Record<CategoryColor, Omit<CategoryMeta, "label">> = {
  jade: { chip: "bg-[var(--jade-soft)] text-[var(--jade)]", calendar: "var(--jade)", swatch: "var(--jade)" },
  rose: { chip: "bg-[var(--blush)] text-[var(--rose-deep)]", calendar: "var(--rose)", swatch: "var(--rose)" },
  gold: { chip: "bg-[#F3E7D3] text-[var(--gold)]", calendar: "var(--gold)", swatch: "var(--gold)" },
  crak: { chip: "bg-[#FBECEC] text-[var(--crak)]", calendar: "var(--crak)", swatch: "var(--crak)" },
  ink: { chip: "bg-[var(--ivory-deep)] text-[var(--ink-soft)]", calendar: "var(--ink-soft)", swatch: "var(--ink-soft)" },
};

export const CATEGORY_COLOR_LABELS: Record<CategoryColor, string> = {
  jade: "Jade", rose: "Rose", gold: "Gold", crak: "Red", ink: "Neutral",
};

export function colorMeta(color: string): Omit<CategoryMeta, "label"> {
  return COLOR_META[color as CategoryColor] ?? COLOR_META.gold;
}

/**
 * Resolves an event's category name to its display styling. `categories` comes
 * from useCategories(); an unknown name (a category deleted mid-session, say)
 * falls back to gold rather than rendering unstyled.
 */
export function categoryMeta(
  category: string,
  categories: { name: string; color: string }[] = [],
): CategoryMeta {
  const found = categories.find((c) => c.name === category);
  return { label: category, ...colorMeta(found?.color ?? "gold") };
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
