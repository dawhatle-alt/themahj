// Turns the site's own index.html into the page for one event, so that the link
// previews properly when it is pasted into Facebook, iMessage, WhatsApp or an
// email. Those previews are built by crawlers that read the HTML and never run
// the JavaScript - without this, every event link previews as the generic site
// card. The React app still renders the page itself; only <head> changes.
//
// Kept pure (no I/O) so it can be tested against the real built index.html.

export interface EventPageInput {
  title: string;
  dateLabel: string;       // already formatted, e.g. "Wednesday, October 21"
  time: string | null;
  location: string | null;
  description: string | null;
  url: string;             // absolute canonical URL of the event page
  imageUrl: string | null; // absolute URL of the cover, or null to keep the site card
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const at = cut.lastIndexOf(" ");
  return (at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[\s.,;:\-–—]+$/, "") + "…";
}

// A replacer function, not a replacement string: event titles are free text,
// and "$1" or "$&" in one would otherwise be read as a back-reference.
function setAttr(html: string, pattern: RegExp, value: string): string {
  return html.replace(pattern, (_m, before: string, after: string) => before + esc(value) + after);
}

function meta(attr: "property" | "name", key: string): RegExp {
  const k = key.replace(/[.:]/g, "\\$&");
  return new RegExp(`(<meta\\s+${attr}="${k}"\\s+content=")[^"]*(")`);
}

export function renderEventPage(shell: string, ev: EventPageInput): string {
  const title = `${ev.title} — The Mahj Edit`;
  const when = [ev.dateLabel, ev.time, ev.location].filter(Boolean).join(" · ");
  const blurb = (ev.description ?? "").replace(/\s+/g, " ").trim();
  const description = truncate(blurb ? `${when}. ${blurb}` : when, 200);

  let html = shell.replace(/<title>[^<]*<\/title>/, () => `<title>${esc(title)}</title>`);
  html = setAttr(html, /(<link\s+rel="canonical"\s+href=")[^"]*(")/, ev.url);
  html = setAttr(html, meta("name", "description"), description);
  html = setAttr(html, meta("property", "og:url"), ev.url);
  html = setAttr(html, meta("property", "og:title"), title);
  html = setAttr(html, meta("property", "og:description"), description);
  html = setAttr(html, meta("name", "twitter:title"), title);
  html = setAttr(html, meta("name", "twitter:description"), description);

  if (ev.imageUrl) {
    html = setAttr(html, meta("property", "og:image"), ev.imageUrl);
    html = setAttr(html, meta("name", "twitter:image"), ev.imageUrl);
    html = setAttr(html, meta("property", "og:image:alt"), ev.title);
    // The shell declares 1200x630 for the site card. A cover's real size is
    // unknown here, and a wrong declared size is worse than none.
    html = html.replace(/\s*<meta\s+property="og:image:(?:width|height)"[^>]*>/g, "");
  }
  return html;
}
