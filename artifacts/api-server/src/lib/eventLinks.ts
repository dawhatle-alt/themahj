// Public link for one event: /events/<id>-<slug>.
//
// The id is what resolves the link; the words after it are only for the people
// reading it. So an event can be renamed without breaking a link that is already
// on Facebook or sitting in someone's inbox. No slug column, no uniqueness to
// police, and recurring titles ("Troop Mahjong: ... Social Play") never collide.
//
// Keep in step with eventSlug / eventPath in the frontend's lib/data.ts.

const MAX_SLUG = 60;

export function eventSlug(title: string): string {
  let s = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  // Cut on a word boundary rather than mid-word.
  if (s.length > MAX_SLUG) s = s.slice(0, MAX_SLUG).replace(/-[^-]*$/, "");
  return s;
}

export function eventPath(ev: { id: number; title: string }): string {
  const slug = eventSlug(ev.title);
  return slug ? `/events/${ev.id}-${slug}` : `/events/${ev.id}`;
}

/** The id at the front of an /events/<id>-<words> segment, or null. */
export function eventIdFromSlug(segment: string): number | null {
  const m = /^(\d+)(?:-|$)/.exec(segment);
  if (!m) return null;
  const id = Number(m[1]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
