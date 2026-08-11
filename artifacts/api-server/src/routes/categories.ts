import { Router, type IRouter } from "express";
import { asc, eq, sql } from "drizzle-orm";
import { db, eventCategoriesTable, eventsTable } from "@workspace/db";
import { requireAdmin } from "../middleware/auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Categories carry a palette key rather than a hex value so a new category can
// never land off-brand. Keep in sync with COLOR_META in the frontend's data.ts.
const COLORS = ["jade", "rose", "gold", "crak", "ink"] as const;
type CategoryColor = (typeof COLORS)[number];

const isColor = (v: unknown): v is CategoryColor =>
  typeof v === "string" && (COLORS as readonly string[]).includes(v);

const MAX_NAME = 40;

function cleanName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name || name.length > MAX_NAME) return null;
  return name;
}

const toApi = (row: typeof eventCategoriesTable.$inferSelect) => ({
  id: row.id,
  name: row.name,
  color: row.color,
});

// Public: the guest-facing site needs names and colours to render chips and the
// calendar legend.
router.get("/categories", async (_req, res): Promise<void> => {
  const rows = await db.select().from(eventCategoriesTable).orderBy(asc(eventCategoriesTable.id));
  res.json({ categories: rows.map(toApi) });
});

/** How many events currently use this category name. */
async function usageCount(name: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(eventsTable)
    .where(eq(eventsTable.category, name));
  return row?.n ?? 0;
}

router.get("/admin/categories", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db.select().from(eventCategoriesTable).orderBy(asc(eventCategoriesTable.id));
  const counts = await db
    .select({ name: eventsTable.category, n: sql<number>`count(*)::int` })
    .from(eventsTable)
    .groupBy(eventsTable.category);
  const byName = new Map(counts.map((c) => [c.name, c.n]));
  res.json({
    categories: rows.map((r) => ({ ...toApi(r), eventCount: byName.get(r.name) ?? 0 })),
  });
});

router.post("/admin/categories", requireAdmin, async (req, res): Promise<void> => {
  const b = req.body as Record<string, unknown>;
  const name = cleanName(b.name);
  if (!name) {
    res.status(400).json({ error: `Enter a category name of 1–${MAX_NAME} characters.` });
    return;
  }
  const color = isColor(b.color) ? b.color : "gold";

  try {
    const [row] = await db.insert(eventCategoriesTable).values({ name, color }).returning();
    res.status(201).json({ category: toApi(row) });
  } catch (err) {
    // The unique index is the authority — a check-then-insert could still race.
    if ((err as { code?: string })?.code === "23505") {
      res.status(409).json({ error: `"${name}" already exists.` });
      return;
    }
    logger.error({ err }, "Failed to create category");
    res.status(500).json({ error: "Could not create the category" });
  }
});

router.put("/admin/categories/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const b = req.body as Record<string, unknown>;

  const [existing] = await db
    .select()
    .from(eventCategoriesTable)
    .where(eq(eventCategoriesTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Category not found" });
    return;
  }

  const name = b.name === undefined ? existing.name : cleanName(b.name);
  if (!name) {
    res.status(400).json({ error: `Enter a category name of 1–${MAX_NAME} characters.` });
    return;
  }
  if (b.color !== undefined && !isColor(b.color)) {
    res.status(400).json({ error: "Unknown colour" });
    return;
  }
  const color = isColor(b.color) ? b.color : existing.color;

  try {
    const [row] = await db
      .update(eventCategoriesTable)
      .set({ name, color, updatedAt: new Date() })
      .where(eq(eventCategoriesTable.id, id))
      .returning();

    // Events store the category name, so a rename has to carry across or every
    // event using the old name silently loses its category.
    if (name !== existing.name) {
      await db
        .update(eventsTable)
        .set({ category: name })
        .where(eq(eventsTable.category, existing.name));
    }

    res.json({ category: toApi(row) });
  } catch (err) {
    if ((err as { code?: string })?.code === "23505") {
      res.status(409).json({ error: `"${name}" already exists.` });
      return;
    }
    logger.error({ err }, "Failed to update category");
    res.status(500).json({ error: "Could not update the category" });
  }
});

router.delete("/admin/categories/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [existing] = await db
    .select()
    .from(eventCategoriesTable)
    .where(eq(eventCategoriesTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Category not found" });
    return;
  }

  // Refuse rather than orphan: events reference the category by name, so
  // deleting one in use would leave those events pointing at nothing.
  const inUse = await usageCount(existing.name);
  if (inUse > 0) {
    res.status(409).json({
      error: `"${existing.name}" is used by ${inUse} event${inUse === 1 ? "" : "s"}. Move those events to another category first.`,
    });
    return;
  }

  await db.delete(eventCategoriesTable).where(eq(eventCategoriesTable.id, id));
  res.sendStatus(204);
});

export default router;
