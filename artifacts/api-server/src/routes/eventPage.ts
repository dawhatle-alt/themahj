import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, eventsTable } from "@workspace/db";
import { ObjectStorageService } from "../lib/objectStorage";
import { logger } from "../lib/logger";
import { formatEventDate, WEB_ORIGIN } from "../lib/email";
import { eventIdFromSlug, eventPath } from "../lib/eventLinks";
import { renderEventPage } from "../lib/eventPage";

// Serves /events/<id>-<words> (routed here by vercel.json). Everyone gets the
// normal app; the only difference from the static index.html is a <head>
// describing this event, which is what link previews are built from.

const router: IRouter = Router();
const objectStorage = new ObjectStorageService();

// The shell is this deployment's own index.html, fetched rather than bundled so
// its asset hashes always match what is actually deployed.
let shell: { origin: string; html: string; at: number } | null = null;
const SHELL_TTL_MS = 5 * 60 * 1000;

async function loadShell(origin: string): Promise<string> {
  if (shell && shell.origin === origin && Date.now() - shell.at < SHELL_TTL_MS) return shell.html;
  const res = await fetch(`${origin}/index.html`);
  if (!res.ok) throw new Error(`index.html returned ${res.status}`);
  const html = await res.text();
  shell = { origin, html, at: Date.now() };
  return html;
}

router.get("/events/:slug", async (req, res): Promise<void> => {
  const proto = (req.get("x-forwarded-proto") ?? req.protocol ?? "https").split(",")[0].trim();
  const origin = `${proto}://${req.get("host")}`;

  let html: string;
  try {
    html = await loadShell(origin);
  } catch (err) {
    // Without the shell there is nothing to render; the calendar is the next
    // best place to land.
    logger.error({ err }, "Event page: could not load index.html");
    res.redirect(302, "/events");
    return;
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  const id = eventIdFromSlug(String(req.params.slug));

  let row: typeof eventsTable.$inferSelect | undefined;
  if (id !== null) {
    try {
      [row] = await db.select().from(eventsTable).where(eq(eventsTable.id, id)).limit(1);
    } catch (err) {
      // The app can still fetch the event itself - serve the plain shell rather
      // than turn a database hiccup into a dead link.
      logger.error({ err, id }, "Event page: lookup failed");
      res.setHeader("Cache-Control", "no-store");
      res.status(200).send(html);
      return;
    }
  }

  if (!row || !row.published) {
    // The app shows "this event isn't available"; the status tells crawlers.
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=60");
    res.status(404).send(html);
    return;
  }

  let imageUrl: string | null = null;
  if (row.imagePath) {
    try {
      imageUrl = (await objectStorage.getObjectEntityFile(row.imagePath)).publicUrl;
    } catch (err) {
      logger.warn({ err, id }, "Event page: cover not resolvable, using the site card");
    }
  }

  const page = renderEventPage(html, {
    title: row.title,
    dateLabel: formatEventDate(row.date),
    time: row.time ?? null,
    location: row.location ?? null,
    description: row.description ?? null,
    url: `${WEB_ORIGIN}${eventPath(row)}`,
    imageUrl,
  });

  // Edits show up in previews within five minutes; the CDN absorbs the rest.
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=86400");
  res.status(200).send(page);
});

export default router;
