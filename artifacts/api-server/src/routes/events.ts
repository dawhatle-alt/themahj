import { Router, type IRouter } from "express";
import { eq, gte, lt, and, type SQL } from "drizzle-orm";
import { db, eventsTable } from "@workspace/db";

const router: IRouter = Router();

export function toApiEvent(row: typeof eventsTable.$inferSelect) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    date: row.date,
    time: row.time,
    location: row.location,
    priceCents: row.priceCents ?? null,
    category: row.category,
    imagePath: row.imagePath ?? null,
    totalSpots: row.totalSpots,
    spotsLeft: row.spotsLeft,
    host: row.host,
    published: row.published,
    featured: row.featured,
    reminderHoursBefore: row.reminderHoursBefore ?? null,
  };
}

router.get("/events", async (req, res): Promise<void> => {
  const { category, upcoming, past, featured } = req.query;
  const conditions: SQL[] = [eq(eventsTable.published, true)];

  if (category && typeof category === "string") {
    conditions.push(eq(eventsTable.category, category));
  }
  if (featured === "true") {
    conditions.push(eq(eventsTable.featured, true));
  }
  if (upcoming === "true") {
    const today = new Date().toISOString().slice(0, 10);
    conditions.push(gte(eventsTable.date, today));
  } else if (past === "true") {
    const today = new Date().toISOString().slice(0, 10);
    conditions.push(lt(eventsTable.date, today));
  }

  const rows = await db
    .select()
    .from(eventsTable)
    .where(and(...conditions))
    .orderBy(eventsTable.date);
  res.json({ events: rows.map(toApiEvent) });
});

router.get("/events/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [row] = await db
    .select()
    .from(eventsTable)
    .where(eq(eventsTable.id, id));

  if (!row || !row.published) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  res.json({ event: toApiEvent(row) });
});

export default router;
