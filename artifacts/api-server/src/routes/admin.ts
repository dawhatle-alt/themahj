import { Router, type IRouter } from "express";
import { eq, sql, asc } from "drizzle-orm";
import { db, eventsTable, registrationsTable } from "@workspace/db";
import { ObjectStorageService } from "../lib/objectStorage";
import { requireAdmin, isValidAdminToken } from "../middleware/auth";
import { logger } from "../lib/logger";
import { sendCheckinReportEmail } from "../lib/email";
import { toApiEvent } from "./events";

const router: IRouter = Router();
const objectStorage = new ObjectStorageService();

// The admin panel posts the passcode here once; on success it keeps sending it
// as the x-admin-token header for subsequent admin requests.
router.post("/admin/login", (req, res): void => {
  if (!process.env.ADMIN_TOKEN) {
    res.status(503).json({ error: "Admin access is not configured. Set the ADMIN_TOKEN environment variable." });
    return;
  }
  const { password } = req.body as { password?: unknown };
  if (typeof password !== "string" || !isValidAdminToken(password)) {
    res.status(401).json({ error: "Incorrect passcode" });
    return;
  }
  res.json({ ok: true });
});

// --- Events ------------------------------------------------------------------

router.get("/admin/events", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db.select().from(eventsTable).orderBy(eventsTable.date);
  res.json({ events: rows.map(toApiEvent) });
});

router.post("/admin/events", requireAdmin, async (req, res): Promise<void> => {
  const b = req.body as Record<string, unknown>;
  if (!b.title || !b.date) {
    res.status(400).json({ error: "title and date are required" });
    return;
  }
  const [row] = await db
    .insert(eventsTable)
    .values({
      title: b.title as string,
      description: (b.description as string) ?? "",
      date: b.date as string,
      time: (b.time as string) ?? "",
      location: (b.location as string) ?? "",
      priceCents: b.priceCents != null ? Number(b.priceCents) : null,
      category: (b.category as string) ?? "Class",
      imagePath: (b.imagePath as string | null) ?? null,
      totalSpots: Number(b.totalSpots) || 0,
      spotsLeft: b.spotsLeft !== undefined ? Number(b.spotsLeft) || 0 : Number(b.totalSpots) || 0,
      host: (b.host as string) ?? "The Mahj Edit",
      published: b.published === true,
      featured: b.featured === true,
      reminderHoursBefore: b.reminderHoursBefore != null ? Number(b.reminderHoursBefore) : null,
    })
    .returning();
  res.status(201).json({ event: toApiEvent(row) });
});

router.put("/admin/events/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const b = req.body as Record<string, unknown>;
  const updateData: Record<string, unknown> = {};
  if (b.title !== undefined) updateData.title = b.title;
  if (b.description !== undefined) updateData.description = b.description;
  if (b.date !== undefined) updateData.date = b.date;
  if (b.time !== undefined) updateData.time = b.time;
  if (b.location !== undefined) updateData.location = b.location;
  if ("priceCents" in b) updateData.priceCents = b.priceCents != null ? Number(b.priceCents) : null;
  if (b.category !== undefined) updateData.category = b.category;
  if (b.imagePath !== undefined) updateData.imagePath = b.imagePath;
  if (b.totalSpots !== undefined) updateData.totalSpots = Number(b.totalSpots);
  if (b.spotsLeft !== undefined) updateData.spotsLeft = Number(b.spotsLeft);
  if (b.host !== undefined) updateData.host = b.host;
  if (b.published !== undefined) updateData.published = b.published;
  if (b.featured !== undefined) updateData.featured = b.featured;
  if ("reminderHoursBefore" in b) updateData.reminderHoursBefore = b.reminderHoursBefore != null ? Number(b.reminderHoursBefore) : null;
  updateData.updatedAt = new Date();
  const [row] = await db
    .update(eventsTable)
    .set(updateData)
    .where(eq(eventsTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Event not found" });
    return;
  }
  res.json({ event: toApiEvent(row) });
});

router.delete("/admin/events/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [row] = await db.delete(eventsTable).where(eq(eventsTable.id, id)).returning();
  if (!row) {
    res.status(404).json({ error: "Event not found" });
    return;
  }
  await db.delete(registrationsTable).where(eq(registrationsTable.eventId, id));
  res.sendStatus(204);
});

// --- Registrations -------------------------------------------------------------

router.get("/admin/registrations", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: registrationsTable.id,
      eventId: registrationsTable.eventId,
      eventTitle: eventsTable.title,
      name: registrationsTable.name,
      email: registrationsTable.email,
      phone: registrationsTable.phone,
      seats: registrationsTable.seats,
      notes: registrationsTable.notes,
      status: registrationsTable.status,
      paymentSessionId: registrationsTable.paymentSessionId,
      createdAt: registrationsTable.createdAt,
    })
    .from(registrationsTable)
    .leftJoin(eventsTable, eq(registrationsTable.eventId, eventsTable.id))
    .orderBy(registrationsTable.createdAt);

  res.json({
    registrations: rows.map((r) => ({
      id: r.id,
      eventId: r.eventId,
      eventTitle: r.eventTitle ?? "Unknown Event",
      name: r.name,
      email: r.email,
      phone: r.phone ?? null,
      seats: r.seats,
      notes: r.notes ?? null,
      status: r.status,
      paid: !!r.paymentSessionId,
      createdAt: r.createdAt.toISOString(),
    })),
  });
});

router.delete("/admin/registrations/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [row] = await db
    .delete(registrationsTable)
    .where(eq(registrationsTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Registration not found" });
    return;
  }

  // Seats are consumed only once a registration reaches "confirmed" (paid events
  // after payment clears, free events immediately). Restore them on delete,
  // capped at the event's total capacity so counts never exceed totalSpots.
  if (row.status === "confirmed") {
    await db
      .update(eventsTable)
      .set({ spotsLeft: sql`LEAST(${eventsTable.totalSpots}, ${eventsTable.spotsLeft} + ${row.seats})` })
      .where(eq(eventsTable.id, row.eventId));
  }

  res.sendStatus(204);
});

// --- Event check-in report -----------------------------------------------

async function buildCheckinReport(eventId: number) {
  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId)).limit(1);
  if (!event) return null;

  const regs = await db
    .select()
    .from(registrationsTable)
    .where(eq(registrationsTable.eventId, eventId))
    .orderBy(asc(registrationsTable.name));

  const participants = regs.map((r) => ({
    name: r.name,
    email: r.email,
    phone: r.phone ?? "",
    seats: r.seats,
    status: r.status,
    paid: !!r.paymentSessionId,
    notes: r.notes ?? "",
    registered: r.createdAt.toISOString().slice(0, 10),
  }));

  const csvEscape = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const header = ["#", "Name", "Email", "Phone", "Seats", "Status", "Paid", "Notes", "Registered", "Checked In"];
  const rows = participants.map((p, i) => [
    String(i + 1),
    p.name,
    p.email,
    p.phone,
    String(p.seats),
    p.status,
    p.paid ? "Yes" : "No",
    p.notes,
    p.registered,
    "", // blank column to tick off at the door
  ]);
  const csv = [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");

  const slug = event.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "event";
  const csvFilename = `checkin-${slug}.csv`;

  return { event, participants, csv, csvFilename };
}

router.get("/admin/events/:id/checkin-report", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const report = await buildCheckinReport(id);
  if (!report) {
    res.status(404).json({ error: "Event not found" });
    return;
  }
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${report.csvFilename}"`);
  res.send(report.csv);
});

router.post("/admin/events/:id/checkin-report/email", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const { to } = req.body as { to?: unknown };
  if (typeof to !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim())) {
    res.status(400).json({ error: "A valid recipient email address is required." });
    return;
  }
  const report = await buildCheckinReport(id);
  if (!report) {
    res.status(404).json({ error: "Event not found" });
    return;
  }
  try {
    await sendCheckinReportEmail({
      to: to.trim(),
      eventTitle: report.event.title,
      eventDate: report.event.date,
      eventTime: report.event.time,
      eventLocation: report.event.location,
      participants: report.participants,
      csv: report.csv,
      csvFilename: report.csvFilename,
    });
    res.json({ sent: true, to: to.trim(), count: report.participants.length });
  } catch (err) {
    logger.error({ err, eventId: id }, "Failed to email check-in report");
    res.status(500).json({ error: "Could not send the report email." });
  }
});

// --- Image uploads ------------------------------------------------------------

router.post("/admin/storage/upload-url", requireAdmin, async (_req, res): Promise<void> => {
  try {
    const uploadURL = await objectStorage.getObjectEntityUploadURL();
    const objectPath = objectStorage.normalizeObjectEntityPath(uploadURL);
    res.json({ uploadURL, objectPath });
  } catch (err) {
    logger.error({ err }, "Failed to generate upload URL");
    res.status(500).json({ error: "Could not generate upload URL" });
  }
});

export default router;
