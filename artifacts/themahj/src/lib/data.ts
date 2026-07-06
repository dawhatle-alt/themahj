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

export function fmtPrice(priceCents: number | null): string {
  if (!priceCents) return "Free";
  const dollars = priceCents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}
