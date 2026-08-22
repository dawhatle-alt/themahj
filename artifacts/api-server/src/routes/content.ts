import { Router, type IRouter } from "express";
import { db, siteContentTable } from "@workspace/db";
import { requireAdmin } from "../middleware/auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Only these keys can be written. An allow-list rather than free-form keys
// means a typo in the admin panel fails loudly instead of quietly creating a
// row nothing reads, and nobody can grow the table from the outside.
//
// Keep in sync with CONTENT_DEFAULTS in the frontend's lib/content.ts — that
// file holds the fallback copy used when a key has no row yet.
export const EDITABLE_KEYS = [
  "about.eyebrow",
  "about.headingTop",
  "about.headingAccent",
  "about.lead",
  "about.body",
  "about.closing",
  "about.quote",
  "about.quoteAttribution",

  "privateEvents.eyebrow",
  "privateEvents.headingTop",
  "privateEvents.headingAccent",
  "privateEvents.intro",
  "privateEvents.perfectForLabel",
  "privateEvents.perfectFor",
  "privateEvents.featuresHeading",
  "privateEvents.features",
  "privateEvents.ctaHeading",
  "privateEvents.ctaBody",
  "privateEvents.ctaButton",

  "privateLessons.eyebrow",
  "privateLessons.headingTop",
  "privateLessons.headingAccent",
  "privateLessons.intro",
] as const;

const KEY_SET: ReadonlySet<string> = new Set(EDITABLE_KEYS);

// Generous, but bounded — the body field holds several paragraphs.
const MAX_VALUE = 6000;

// Public: the About page reads this on load. Returned as a flat object so the
// client can look up a key without scanning an array.
router.get("/content", async (_req, res): Promise<void> => {
  try {
    const rows = await db.select().from(siteContentTable);
    const content: Record<string, string> = {};
    for (const row of rows) content[row.key] = row.value;
    res.json({ content });
  } catch (err) {
    // Copy is not worth a broken page — the client falls back to its built-in
    // defaults when this comes back empty.
    logger.error({ err }, "Failed to load site content");
    res.json({ content: {} });
  }
});

router.get("/admin/content", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db.select().from(siteContentTable);
  const content: Record<string, string> = {};
  for (const row of rows) content[row.key] = row.value;
  res.json({ content, editableKeys: EDITABLE_KEYS });
});

router.put("/admin/content", requireAdmin, async (req, res): Promise<void> => {
  const body = req.body as { updates?: unknown };
  const updates = body?.updates;

  if (!updates || typeof updates !== "object" || Array.isArray(updates)) {
    res.status(400).json({ error: "Expected an object of key/value updates." });
    return;
  }

  const entries = Object.entries(updates as Record<string, unknown>);
  if (entries.length === 0) {
    res.status(400).json({ error: "No changes to save." });
    return;
  }

  // Validate everything before writing anything, so a single bad field cannot
  // leave the page half-updated.
  const clean: { key: string; value: string }[] = [];
  for (const [key, raw] of entries) {
    if (!KEY_SET.has(key)) {
      res.status(400).json({ error: `"${key}" is not an editable field.` });
      return;
    }
    if (typeof raw !== "string") {
      res.status(400).json({ error: `"${key}" must be text.` });
      return;
    }
    // Trim trailing whitespace per line but keep the blank lines that separate
    // paragraphs in "*.body" fields.
    const value = raw.replace(/[ \t]+$/gm, "").trim();
    if (value.length > MAX_VALUE) {
      res.status(400).json({ error: `"${key}" is too long (max ${MAX_VALUE} characters).` });
      return;
    }
    clean.push({ key, value });
  }

  try {
    for (const row of clean) {
      await db
        .insert(siteContentTable)
        .values({ key: row.key, value: row.value })
        .onConflictDoUpdate({
          target: siteContentTable.key,
          set: { value: row.value, updatedAt: new Date() },
        });
    }
    const rows = await db.select().from(siteContentTable);
    const content: Record<string, string> = {};
    for (const r of rows) content[r.key] = r.value;
    res.json({ content });
  } catch (err) {
    logger.error({ err }, "Failed to save site content");
    res.status(500).json({ error: "Could not save the page text" });
  }
});

export default router;
