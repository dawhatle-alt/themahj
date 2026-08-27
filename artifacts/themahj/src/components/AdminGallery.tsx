import { useEffect, useRef, useState } from "react";
import { motion, type Variants } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type {
  AdminDiscountCode, AdminOrder, AdminRedemption, AdminRegistration,
  AdminCategory, ApiEvent, ApiPhoto, EventInput, SquareDiagnostics,
} from "@/lib/api";
import {
  adminCreateDiscountCode, adminCreateEvent, adminDeleteDiscountCode, adminDeleteEvent,
  adminDeletePhoto, adminDeleteRedemption, adminDeleteRegistration, adminDownloadCheckinReport,
  adminListDiscountCodes, adminListEvents, adminListOrders, adminListRedemptions,
  adminListRegistrations, adminLogin, adminSquareDiagnostics, adminUpdateDiscountCode,
  adminUpdateEvent, adminUploadImage, adminUploadPhoto, getAdminToken, listGallery, setAdminToken,
  adminCreateCategory, adminDeleteCategory, adminListCategories, adminUpdateCategory,
  adminGetContent, adminSaveContent,
} from "@/lib/api";
import {
  CATEGORY_COLORS, CATEGORY_COLOR_LABELS, REMINDER_OPTIONS,
  categoryMeta, colorMeta, fmtDate, fmtPrice, formatTimeRange,
} from "@/lib/data";

// The owner's handbook - how to add events, size a cover image, work through a
// private enquiry, and edit page copy. Linked from the admin header so it is
// findable at the moment she needs it rather than buried in an old email.
// It is a private page: it must stay shared from the artifact's share menu, or
// this link gives her an access error.
const HANDBOOK_URL = "https://claude.ai/code/artifact/dfaf4091-2caa-444d-8439-968d6bd12b42";
import { invalidateCategories, useCategories } from "@/lib/categories";
import { CONTENT_DEFAULTS, invalidateContent } from "@/lib/content";
import { PrivateManager } from "@/components/AdminPrivate";
import {
  adminListPrivateLessonPackages, adminCreatePrivateLessonPackage,
  adminUpdatePrivateLessonPackage, adminDeletePrivateLessonPackage,
  adminListPrivateLessonBookings, adminUpdatePrivateLessonBooking,
  adminSendPrivateLessonPaymentLink,
  adminListPrivateEventPackages, adminCreatePrivateEventPackage,
  adminUpdatePrivateEventPackage, adminDeletePrivateEventPackage,
  adminListPrivateEventBookings, adminUpdatePrivateEventBooking,
  adminSendPrivateEventPaymentLink,
} from "@/lib/privateApi";

// Every editable string, in the order it appears on its page. Labels describe
// where the text lands rather than naming the key, so the client never has to
// think about "about.headingAccent".
const CONTENT_FIELDS: { key: string; label: string; hint?: string; rows: number; group: string }[] = [
  { group: "About page", key: "about.eyebrow", label: "Small label above the title", rows: 1 },
  { group: "About page", key: "about.headingTop", label: "Big title - first line", rows: 1 },
  { group: "About page", key: "about.headingAccent", label: "Big title - second line", hint: "Shown in italic rose.", rows: 1 },
  { group: "About page", key: "about.lead", label: "Opening line", hint: "The large italic line above your bio.", rows: 2 },
  {
    group: "About page", key: "about.body", label: "Your bio",
    hint: "Leave a blank line between paragraphs - each one becomes its own paragraph on the page.",
    rows: 16,
  },
  { group: "About page", key: "about.closing", label: "Closing line", hint: "The gold sign-off under your bio.", rows: 3 },
  { group: "About page", key: "about.quote", label: "Pull quote", hint: "The large quote in the band below your photo.", rows: 3 },
  { group: "About page", key: "about.quoteAttribution", label: "Pull quote credit", rows: 1 },

  { group: "Private events page", key: "privateEvents.eyebrow", label: "Small label above the title", rows: 1 },
  { group: "Private events page", key: "privateEvents.headingTop", label: "Big title - first line", rows: 1 },
  { group: "Private events page", key: "privateEvents.headingAccent", label: "Big title - second line", hint: "Shown in italic jade.", rows: 1 },
  { group: "Private events page", key: "privateEvents.intro", label: "Opening paragraph", rows: 5 },
  { group: "Private events page", key: "privateEvents.perfectForLabel", label: "Label above the occasion list", rows: 1 },
  {
    group: "Private events page", key: "privateEvents.perfectFor", label: "Perfect for",
    hint: "One occasion per line. Each becomes its own pill on the page.",
    rows: 9,
  },
  { group: "Private events page", key: "privateEvents.featuresHeading", label: "Heading above the four blocks", rows: 1 },
  {
    group: "Private events page", key: "privateEvents.features", label: "What makes an event special",
    hint: "One block per paragraph, separated by a blank line. The FIRST line of each block is its heading; everything after it is the description. Add or remove blocks freely.",
    rows: 16,
  },
  { group: "Private events page", key: "privateEvents.ctaHeading", label: "Closing panel heading", rows: 1 },
  { group: "Private events page", key: "privateEvents.ctaBody", label: "Closing panel text", rows: 3 },
  { group: "Private events page", key: "privateEvents.ctaButton", label: "Closing panel button", rows: 1 },

  { group: "Private lessons page", key: "privateLessons.eyebrow", label: "Small label above the title", rows: 1 },
  { group: "Private lessons page", key: "privateLessons.headingTop", label: "Big title - first line", rows: 1 },
  { group: "Private lessons page", key: "privateLessons.headingAccent", label: "Big title - second line", hint: "Shown in italic rose.", rows: 1 },
  { group: "Private lessons page", key: "privateLessons.intro", label: "Opening paragraph", rows: 4 },
  { group: "Private lessons page", key: "privateLessons.perfectForLabel", label: "Label above the list", rows: 1 },
  {
    group: "Private lessons page", key: "privateLessons.perfectFor", label: "Perfect for",
    hint: "One item per line. Each becomes its own pill on the page.",
    rows: 9,
  },
  { group: "Private lessons page", key: "privateLessons.featuresHeading", label: "Heading above the blocks", rows: 1 },
  {
    group: "Private lessons page", key: "privateLessons.features", label: "What makes a lesson different",
    hint: "One block per paragraph, separated by a blank line. The FIRST line of each block is its heading; everything after it is the description. Add or remove blocks freely.",
    rows: 16,
  },
  { group: "Private lessons page", key: "privateLessons.ctaHeading", label: "Closing panel heading", rows: 1 },
  { group: "Private lessons page", key: "privateLessons.ctaBody", label: "Closing panel text", rows: 3 },
  { group: "Private lessons page", key: "privateLessons.ctaButton", label: "Closing panel button", rows: 1 },

  {
    group: "Contact", key: "contact.email", label: "Email address shown on the site",
    hint: "Appears in the footer and wherever guests are asked to get in touch. This is only what is displayed - the reply-to on emails you send is OWNER_EMAIL in the hosting settings.",
    rows: 1,
  },
];

const CONTENT_GROUPS = ["About page", "Private events page", "Private lessons page", "Contact"];

const reveal: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: (delay = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.68, delay, ease: [0.22, 1, 0.36, 1] },
  }),
};

// Client-side resize before upload — keeps storage lean and uploads fast.
function resizeImage(file: File, max: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

// ---------------- GALLERY ----------------
export function Gallery() {
  const [photos, setPhotos] = useState<ApiPhoto[]>([]);
  const [open, setOpen] = useState<ApiPhoto | null>(null);

  useEffect(() => {
    listGallery().then(setPhotos).catch(() => setPhotos([]));
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-6 py-14">
      <motion.p className="eyebrow"
        variants={reveal} custom={0} initial="hidden" animate="visible">
        Around the table
      </motion.p>
      <motion.h1
        className="font-display leading-[0.9] mt-4 tracking-tight"
        style={{ fontSize: "clamp(2.8rem,7vw,5rem)" }}
        variants={reveal} custom={0.08} initial="hidden" animate="visible">
        Event photos.
      </motion.h1>
      <motion.p className="mt-5 max-w-xl text-[17px] leading-relaxed" style={{ color: "var(--ink-soft)" }}
        variants={reveal} custom={0.18} initial="hidden" animate="visible">
        Tablescapes, merit stickers, and the faces behind the mahjs.
      </motion.p>
      {photos.length === 0 ? (
        <motion.div className="tile max-w-md mx-auto mt-12 p-10 text-center"
          variants={reveal} custom={0.28} initial="hidden" animate="visible">
          <p className="font-display italic text-2xl">No photos yet</p>
          <p className="text-sm mt-2" style={{ color: "var(--ink-soft)" }}>Photos from our next event will land here.</p>
        </motion.div>
      ) : (
        <div className="columns-2 md:columns-3 gap-4 mt-10 [&>*]:mb-4">
          {photos.map((p, i) => (
            <motion.button key={p.id} onClick={() => setOpen(p)}
              className="block w-full break-inside-avoid tile-hover text-left"
              variants={reveal} custom={i * 0.07} initial="hidden" whileInView="visible"
              viewport={{ once: true }}>
              <img src={p.url} alt={p.caption ?? ""} className="w-full rounded-lg border" style={{ borderColor: "#E9DFD0" }} loading="lazy" />
              <p className="text-xs mt-1.5 px-0.5" style={{ color: "var(--ink-soft)" }}>{p.eventLabel ?? p.caption ?? ""}</p>
            </motion.button>
          ))}
        </div>
      )}
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="bg-[var(--ivory)] max-w-2xl">
          {open && (
            <>
              <img src={open.url} alt={open.caption ?? ""} className="w-full rounded-lg" />
              <DialogHeader>
                <DialogTitle className="font-display text-2xl font-medium">{open.eventLabel ?? "Event"}</DialogTitle>
              </DialogHeader>
              <p className="text-sm -mt-1" style={{ color: "var(--ink-soft)" }}>{open.caption ?? ""}</p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------- ADMIN ----------------
type EventDraft = {
  title: string;
  category: string;
  date: string;
  startTime: string;   // 24-hour "HH:MM" from <input type="time">
  endTime: string;
  location: string;
  price: string;       // dollars as typed; blank = free
  totalSpots: number;
  description: string;
  published: boolean;
  imagePath: string | null;
  reminderHoursBefore: number | null;
};

const emptyEvent = (defaultCategory = "Open Play"): EventDraft => ({
  title: "", category: defaultCategory, date: "", startTime: "", endTime: "",
  location: "Georgetown, TX", price: "15", totalSpots: 16, description: "",
  published: true, imagePath: null, reminderHoursBefore: 24,
});

function draftToInput(d: EventDraft): EventInput {
  const dollars = parseFloat(d.price);
  return {
    title: d.title.trim(),
    category: d.category,
    date: d.date,
    // The display string is derived so it can never disagree with the start time
    // the reminder cron schedules against.
    time: formatTimeRange(d.startTime, d.endTime),
    startTime: d.startTime || null,
    endTime: d.endTime || null,
    location: d.location.trim(),
    priceCents: Number.isFinite(dollars) && dollars > 0 ? Math.round(dollars * 100) : null,
    totalSpots: d.totalSpots,
    description: d.description.trim(),
    published: d.published,
    imagePath: d.imagePath,
    reminderHoursBefore: d.reminderHoursBefore,
  };
}

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const shortDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—";

type Tab = "events" | "registrations" | "orders" | "discounts" | "categories" | "photos" | "content"
  | "plessons" | "pevents";

export function Admin() {
  const categories = useCategories();
  const [authed, setAuthed] = useState(() => !!getAdminToken());
  const [pass, setPass] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("events");

  const [events, setEvents] = useState<ApiEvent[]>([]);
  const [registrations, setRegistrations] = useState<AdminRegistration[]>([]);
  const [regEventFilter, setRegEventFilter] = useState<number | "all">("all");
  const [photos, setPhotos] = useState<ApiPhoto[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [ordersNote, setOrdersNote] = useState<string | null>(null);
  const [squareDiag, setSquareDiag] = useState<SquareDiagnostics | null>(null);
  const [squareChecking, setSquareChecking] = useState(false);
  const [codes, setCodes] = useState<AdminDiscountCode[]>([]);
  const [redemptions, setRedemptions] = useState<AdminRedemption[]>([]);
  const [adminCategories, setAdminCategories] = useState<AdminCategory[]>([]);
  const [catDraft, setCatDraft] = useState({ name: "", color: "gold" });
  const [catEditing, setCatEditing] = useState<AdminCategory | null>(null);
  // `content` is what's saved on the server; `contentDraft` is what's in the
  // textareas. Keeping both is what makes "unsaved changes" detectable.
  const [content, setContent] = useState<Record<string, string>>({});
  const [contentDraft, setContentDraft] = useState<Record<string, string>>({});
  const [contentSaving, setContentSaving] = useState(false);

  const [editing, setEditing] = useState<ApiEvent | null>(null);
  const [draft, setDraft] = useState<EventDraft>(emptyEvent());
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [coverPreviewBroken, setCoverPreviewBroken] = useState(false);
  const [photoMeta, setPhotoMeta] = useState({ caption: "", eventLabel: "" });
  const [photoUploading, setPhotoUploading] = useState(0);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [codeDraft, setCodeDraft] = useState({ code: "", percent: "10", description: "" });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const inputCls = "w-full rounded-md border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--rose)]";
  const statLabelCls = "text-[11px] uppercase tracking-[0.12em]";
  const statValueCls = "text-3xl font-medium tabular-nums leading-tight mt-1";

  function fail(err: unknown, fallback: string) {
    setNotice(err instanceof Error ? err.message : fallback);
  }

  function refresh() {
    adminListEvents().then(setEvents).catch(err => {
      if (err instanceof Error && "status" in err && (err as { status: number }).status === 401) {
        setAdminToken(null);
        setAuthed(false);
      }
    });
    adminListRegistrations().then(setRegistrations).catch(() => setRegistrations([]));
    listGallery().then(setPhotos).catch(() => setPhotos([]));
    adminListOrders()
      .then(r => { setOrders(r.orders); setOrdersNote(r.note ?? null); })
      .catch(() => { setOrders([]); setOrdersNote("Could not load orders from Square."); });
    adminListCategories().then(setAdminCategories).catch(() => setAdminCategories([]));
    adminListDiscountCodes().then(setCodes).catch(() => setCodes([]));
    adminListRedemptions().then(setRedemptions).catch(() => setRedemptions([]));
    adminGetContent()
      .then(r => {
        // Fill any key the database has no row for with the built-in default,
        // so the textareas always show what the page is actually rendering.
        const merged: Record<string, string> = {};
        for (const f of CONTENT_FIELDS) merged[f.key] = r.content[f.key] ?? CONTENT_DEFAULTS[f.key] ?? "";
        setContent(merged);
        setContentDraft(merged);
      })
      .catch(() => { /* the Page Text tab shows defaults until this succeeds */ });
  }

  const contentDirty = CONTENT_FIELDS.some(f => (contentDraft[f.key] ?? "") !== (content[f.key] ?? ""));

  async function saveContent() {
    // Send only what changed — a full-object save would bump updatedAt on
    // every field and make the audit trail useless.
    const updates: Record<string, string> = {};
    for (const f of CONTENT_FIELDS) {
      if ((contentDraft[f.key] ?? "") !== (content[f.key] ?? "")) updates[f.key] = contentDraft[f.key] ?? "";
    }
    if (Object.keys(updates).length === 0) return;

    setContentSaving(true);
    try {
      const saved = await adminSaveContent(updates);
      const merged: Record<string, string> = {};
      for (const f of CONTENT_FIELDS) merged[f.key] = saved[f.key] ?? CONTENT_DEFAULTS[f.key] ?? "";
      setContent(merged);
      setContentDraft(merged);
      invalidateContent();  // so the live About page picks it up without a reload
      setNotice("Page text saved — your site is updated.");
    } catch (err) {
      fail(err, "Could not save the page text");
    } finally {
      setContentSaving(false);
    }
  }

  useEffect(() => {
    if (authed) refresh();
  }, [authed]);

  async function unlock() {
    if (!pass) return;
    setLoginError(null);
    try {
      await adminLogin(pass);
      setAuthed(true);
      setPass("");
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Login failed");
    }
  }

  if (!authed) {
    return (
      <div className="max-w-sm mx-auto px-6 py-24 text-center">
        <p className="eyebrow">Admin</p>
        <h1 className="font-display text-4xl mt-3">East wind only</h1>
        <p className="text-sm mt-3" style={{ color: "var(--ink-soft)" }}>
          Enter the admin passcode to manage events and photos.
        </p>
        <input type="password" className={inputCls + " mt-6 text-center"} placeholder="Passcode" value={pass}
          onChange={e => setPass(e.target.value)}
          onKeyDown={e => e.key === "Enter" && void unlock()} />
        <button onClick={() => void unlock()}
          className="btn-rose w-full py-3 rounded-full text-sm uppercase tracking-[0.18em] mt-4">
          Unlock
        </button>
        {loginError && <p className="text-xs mt-3" style={{ color: "var(--crak)" }}>{loginError}</p>}
      </div>
    );
  }

  function startEdit(ev: ApiEvent) {
    setEditing(ev);
    setDraft({
      title: ev.title,
      category: ev.category,
      date: ev.date,
      startTime: ev.startTime ?? "",
      endTime: ev.endTime ?? "",
      location: ev.location,
      price: ev.priceCents ? String(ev.priceCents / 100) : "",
      totalSpots: ev.totalSpots,
      description: ev.description,
      published: ev.published,
      imagePath: ev.imagePath,
      reminderHoursBefore: ev.reminderHoursBefore,
    });
  }

  async function saveEvent() {
    if (!draft.title.trim() || !draft.date || busy) return;
    setBusy(true);
    try {
      if (editing) {
        await adminUpdateEvent(editing.id, draftToInput(draft));
      } else {
        await adminCreateEvent(draftToInput(draft));
      }
      setEditing(null);
      setDraft(emptyEvent(categories[0]?.name));
      refresh();
    } catch (err) {
      fail(err, "Could not save the event");
    } finally {
      setBusy(false);
    }
  }

  async function deleteEvent(id: number) {
    if (!window.confirm("Delete this event and all of its signups?")) return;
    try {
      await adminDeleteEvent(id);
      refresh();
    } catch (err) {
      fail(err, "Could not delete the event");
    }
  }

  async function handleCoverFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setCoverError(null);
    setCoverPreviewBroken(false);
    setCoverUploading(true);
    try {
      const blob = await resizeImage(file, 1600);
      if (!blob) {
        // The browser canvas can't decode HEIC, which is what an iPhone hands
        // over unless "Most Compatible" is set — by far the likeliest reason
        // a real photo fails to read.
        throw new Error("That image couldn't be read. iPhone HEIC photos need to be saved as JPEG or PNG first.");
      }
      const objectPath = await adminUploadImage(blob);
      setDraft(d => ({ ...d, imagePath: objectPath }));
    } catch (err) {
      // Shown beside the field, not only in the page-top banner — that banner
      // is off-screen once the form is scrolled down to the cover input, which
      // made a failed upload look like nothing happening at all.
      setCoverError(err instanceof Error ? err.message : "Cover image upload failed");
    } finally {
      setCoverUploading(false);
      if (coverRef.current) coverRef.current.value = "";
    }
  }

  async function checkSquare() {
    setSquareChecking(true);
    try {
      setSquareDiag(await adminSquareDiagnostics());
    } catch (err) {
      fail(err, "Could not run the Square connection check");
    } finally {
      setSquareChecking(false);
    }
  }

  async function removeRegistration(id: number) {
    try {
      await adminDeleteRegistration(id);
      refresh();
    } catch (err) {
      fail(err, "Could not remove the registration");
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const batch = Array.from(files);
    setPhotoError(null);
    setPhotoUploading(batch.length);
    if (fileRef.current) fileRef.current.value = "";

    // allSettled so one bad file doesn't hide the fate of the rest — the old
    // version resolved unreadable files to nothing at all, with no feedback.
    const results = await Promise.allSettled(
      batch.map(async (file) => {
        const blob = await resizeImage(file, 1200);
        if (!blob) throw new Error(`"${file.name}" couldn't be read — save it as JPEG or PNG first.`);
        await adminUploadPhoto(blob, {
          caption: photoMeta.caption || file.name,
          eventLabel: photoMeta.eventLabel || "Event",
        });
      }),
    );
    setPhotoUploading(0);

    const failures = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    if (failures.length > 0) {
      const reason = failures[0].reason;
      const detail = reason instanceof Error ? reason.message : "Upload failed.";
      setPhotoError(
        failures.length === batch.length ? detail : `${failures.length} of ${batch.length} photos failed. ${detail}`,
      );
    }
    listGallery().then(setPhotos).catch(() => undefined);
  }

  async function deletePhoto(id: number) {
    try {
      await adminDeletePhoto(id);
      setPhotos(photos.filter(p => p.id !== id));
    } catch (err) {
      fail(err, "Could not delete the photo");
    }
  }

  async function saveCategory() {
    const name = catDraft.name.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      if (catEditing) {
        await adminUpdateCategory(catEditing.id, { name, color: catDraft.color });
      } else {
        await adminCreateCategory({ name, color: catDraft.color });
      }
      setCatDraft({ name: "", color: "gold" });
      setCatEditing(null);
      invalidateCategories();
      adminListCategories().then(setAdminCategories).catch(() => undefined);
      // A rename cascades to events, so the events list is stale now.
      adminListEvents().then(setEvents).catch(() => undefined);
    } catch (err) {
      fail(err, "Could not save the category");
    } finally {
      setBusy(false);
    }
  }

  async function removeCategory(c: AdminCategory) {
    if (!window.confirm(`Delete the "${c.name}" category?`)) return;
    try {
      await adminDeleteCategory(c.id);
      invalidateCategories();
      adminListCategories().then(setAdminCategories).catch(() => undefined);
    } catch (err) {
      fail(err, "Could not delete the category");
    }
  }

  async function createCode() {
    const percent = parseInt(codeDraft.percent, 10);
    if (!codeDraft.code.trim() || !percent || busy) return;
    setBusy(true);
    try {
      await adminCreateDiscountCode({
        code: codeDraft.code,
        discountPercent: percent,
        description: codeDraft.description.trim() || undefined,
      });
      setCodeDraft({ code: "", percent: "10", description: "" });
      adminListDiscountCodes().then(setCodes).catch(() => undefined);
    } catch (err) {
      fail(err, "Could not create the code");
    } finally {
      setBusy(false);
    }
  }

  async function toggleCode(c: AdminDiscountCode) {
    try {
      await adminUpdateDiscountCode(c.id, { active: !c.active });
      adminListDiscountCodes().then(setCodes).catch(() => undefined);
    } catch (err) {
      fail(err, "Could not update the code");
    }
  }

  async function deleteCode(id: number) {
    if (!window.confirm("Delete this discount code?")) return;
    try {
      await adminDeleteDiscountCode(id);
      setCodes(codes.filter(c => c.id !== id));
    } catch (err) {
      fail(err, "Could not delete the code");
    }
  }

  async function resetRedemption(id: number) {
    try {
      await adminDeleteRedemption(id);
      setRedemptions(redemptions.filter(r => r.id !== id));
    } catch (err) {
      fail(err, "Could not reset the redemption");
    }
  }

  const shownRegistrations = regEventFilter === "all"
    ? registrations
    : registrations.filter(r => r.eventId === regEventFilter);

  // Only events that actually have registrations — a dropdown listing every
  // event ever created would be mostly dead options at a check-in desk.
  const regEventOptions = Array.from(
    new Map(
      registrations.map(r => [r.eventId, { id: r.eventId, title: r.eventTitle, date: r.eventDate }]),
    ).values(),
  ).sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  // Seats and revenue count confirmed registrations only: a pending row is an
  // abandoned checkout that never claimed a seat or took any money.
  const confirmedShown = shownRegistrations.filter(r => r.status === "confirmed");
  const regStats = {
    total: shownRegistrations.length,
    pending: shownRegistrations.length - confirmedShown.length,
    seats: confirmedShown.reduce((n, r) => n + r.seats, 0),
    revenueCents: confirmedShown.reduce((n, r) => n + (r.amountPaidCents ?? 0), 0),
    discounted: confirmedShown.filter(r => r.discountCode).length,
  };
  const filteredEvent = regEventFilter === "all"
    ? null
    : events.find(e => e.id === regEventFilter) ?? null;

  const paidLabel = (s: AdminRegistration) => {
    if (s.amountPaidCents === null) return s.status === "pending" ? "unpaid" : "—";
    return s.amountPaidCents === 0 ? "Free" : money(s.amountPaidCents);
  };

  const tabBtn = (t: Tab, label: string) => (
    <button key={t} onClick={() => setTab(t)}
      className={`px-5 py-2 rounded-full text-xs uppercase tracking-[0.16em] border transition-colors ${tab === t ? "btn-rose border-transparent" : "bg-white/60"}`}
      style={tab !== t ? { borderColor: "#E9DFD0", color: "var(--ink-soft)" } : undefined}>
      {label}
    </button>
  );

  const th = "px-4 py-3 text-left text-[11px] uppercase tracking-[0.14em]";

  return (
    <div className="max-w-6xl mx-auto px-6 py-14">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="eyebrow">Admin</p>
          <h1 className="font-display text-5xl mt-3">Manage The Mahj Edit</h1>
        </div>
        <div className="flex items-center gap-5">
          <a href={HANDBOOK_URL} target="_blank" rel="noopener noreferrer"
            className="text-xs uppercase tracking-[0.14em] underline underline-offset-4"
            style={{ color: "var(--gold)" }}>
            Handbook
          </a>
          <button onClick={() => { setAdminToken(null); setAuthed(false); }}
            className="text-xs uppercase tracking-[0.14em] underline underline-offset-4" style={{ color: "var(--crak)" }}>
            Lock
          </button>
        </div>
      </div>

      {notice && (
        <div className="mt-4 rounded-md border px-4 py-2 text-sm flex justify-between items-center"
          style={{ borderColor: "var(--crak)", color: "var(--crak)", background: "#FDF3F3" }}>
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-xs underline">Dismiss</button>
        </div>
      )}

      <div className="flex gap-3 mt-8 flex-wrap">
        {tabBtn("events", "Events")}
        {tabBtn("registrations", `Registrations (${registrations.length})`)}
        {tabBtn("orders", "Orders")}
        {tabBtn("discounts", "Discount Codes")}
        {tabBtn("categories", "Categories")}
        {tabBtn("photos", "Photos")}
        {tabBtn("plessons", "Private Lessons")}
        {tabBtn("pevents", "Private Events")}
        {tabBtn("content", contentDirty ? "Page Text •" : "Page Text")}
      </div>

      {/* EVENTS TAB */}
      {tab === "events" && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-10 mt-8 items-start">
          <div className="bg-white/70 border rounded-lg p-6" style={{ borderColor: "#E9DFD0" }}>
            <h2 className="font-display text-2xl">{editing ? "Edit event" : "New event"}</h2>
            <div className="space-y-3 mt-4">
              <input className={inputCls} placeholder="Event title *" value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} />
              <div className="flex gap-3">
                <select className={inputCls} value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })}>
                  {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  {draft.category && !categories.some(c => c.name === draft.category) && (
                    <option value={draft.category}>{draft.category} (removed)</option>
                  )}
                </select>
                <input className={inputCls} type="date" value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })} />
              </div>
              {/* Wraps rather than stretching the column: time inputs have a wide
                  intrinsic minimum, which on a phone pushed the whole card
                  past the viewport. */}
              <div className="flex flex-wrap gap-3 items-end">
                <label className="flex-1 basis-[130px] min-w-0 text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--gold)" }}>
                  Starts
                  <input className={inputCls + " mt-1"} type="time" value={draft.startTime}
                    onChange={e => setDraft({ ...draft, startTime: e.target.value })} />
                </label>
                <label className="flex-1 basis-[130px] min-w-0 text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--gold)" }}>
                  Ends
                  <input className={inputCls + " mt-1"} type="time" value={draft.endTime}
                    onChange={e => setDraft({ ...draft, endTime: e.target.value })} />
                </label>
                <label className="w-full sm:w-auto sm:max-w-[140px] text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--gold)" }}>
                  Price ($)
                  <input className={inputCls + " mt-1"} placeholder="Blank = free" value={draft.price}
                    onChange={e => setDraft({ ...draft, price: e.target.value })} />
                </label>
              </div>
              {draft.startTime && (
                <p className="text-[11px] -mt-1" style={{ color: "var(--ink-soft)" }}>
                  Shown on the site as <strong>{formatTimeRange(draft.startTime, draft.endTime)}</strong>
                </p>
              )}
              <div className="flex gap-3 items-end">
                <label className="flex-1 min-w-0 text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--gold)" }}>
                  Location
                  <input className={inputCls + " mt-1"} value={draft.location}
                    onChange={e => setDraft({ ...draft, location: e.target.value })} />
                </label>
                <label className="w-[92px] shrink-0 text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--gold)" }}>
                  Seats
                  <input className={inputCls + " mt-1"} type="number" min={1} value={draft.totalSpots}
                    onChange={e => setDraft({ ...draft, totalSpots: Number(e.target.value) || 1 })} />
                </label>
              </div>
              <textarea className={inputCls} rows={3} placeholder="Description" value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} />

              {/* Cover image */}
              <div className="rounded-md border bg-white p-3"
                style={{ borderColor: coverError ? "var(--crak)" : "#E9DFD0" }}>
                <p className="text-xs uppercase tracking-[0.14em] mb-2" style={{ color: "var(--gold)" }}>Cover image</p>
                {draft.imagePath ? (
                  <div className="flex items-center gap-3">
                    {coverPreviewBroken ? (
                      <div className="w-24 h-16 rounded border grid place-items-center text-center text-[10px] leading-tight px-1"
                        style={{ borderColor: "#E9DFD0", color: "var(--ink-soft)" }}>
                        Preview<br />unavailable
                      </div>
                    ) : (
                      <img src={`/api/storage${draft.imagePath}`} alt="Event cover"
                        onError={() => setCoverPreviewBroken(true)}
                        className="w-24 h-16 object-contain rounded border" style={{ borderColor: "#E9DFD0", background: "var(--ivory)" }} />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs" style={{ color: coverPreviewBroken ? "var(--gold)" : "var(--jade)" }}>
                        {coverPreviewBroken ? "Attached, but it won't display" : "Image attached"}
                      </p>
                      <button
                        onClick={() => { setDraft({ ...draft, imagePath: null }); setCoverPreviewBroken(false); }}
                        className="text-xs underline underline-offset-2 mt-1 min-h-[44px] sm:min-h-0"
                        style={{ color: "var(--crak)" }}>
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <input ref={coverRef} id="cover-file" type="file"
                      accept="image/jpeg,image/png,image/webp" className="sr-only"
                      onChange={e => void handleCoverFile(e.target.files)} disabled={coverUploading} />
                    <label htmlFor="cover-file"
                      className={`inline-flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-full border text-xs uppercase tracking-[0.16em] cursor-pointer transition-opacity ${coverUploading ? "opacity-50 pointer-events-none" : ""}`}
                      style={{ borderColor: "var(--jade)", color: "var(--jade)" }}>
                      {coverUploading && (
                        <span aria-hidden="true"
                          className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin" />
                      )}
                      {coverUploading ? "Uploading…" : "Choose image"}
                    </label>
                    <p className="text-[11px] mt-2" style={{ color: "var(--ink-soft)" }}>
                      JPEG, PNG, or WebP — resized to 1600px automatically.
                    </p>
                  </>
                )}
                {coverError && (
                  <div role="alert" className="mt-2 text-xs" style={{ color: "var(--crak)" }}>
                    <p>{coverError}</p>
                    <button onClick={() => { setCoverError(null); coverRef.current?.click(); }}
                      className="underline underline-offset-2 mt-1">
                      Try again
                    </button>
                  </div>
                )}
              </div>

              <label className="block text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--gold)" }}>
                Reminder email
                <select className={inputCls + " mt-1"} value={draft.reminderHoursBefore ?? ""}
                  onChange={e => setDraft({ ...draft, reminderHoursBefore: e.target.value ? Number(e.target.value) : null })}>
                  {REMINDER_OPTIONS.map(o => (
                    <option key={o.label} value={o.hours ?? ""}>{o.label}</option>
                  ))}
                </select>
              </label>
              {draft.reminderHoursBefore !== null && (
                !draft.startTime ? (
                  <p className="text-[11px] -mt-1" style={{ color: "var(--crak)" }}>
                    Set a start time so the reminder can be scheduled.
                  </p>
                ) : (
                  <p className="text-[11px] -mt-1" style={{ color: "var(--ink-soft)" }}>
                    Reminders are sent in the morning to everyone confirmed for this event.
                  </p>
                )
              )}

              <label className="flex items-center gap-2 text-sm" style={{ color: "var(--ink-soft)" }}>
                <input type="checkbox" checked={draft.published} onChange={e => setDraft({ ...draft, published: e.target.checked })} />
                Published (visible on the site)
              </label>
              <div className="flex gap-3">
                <button onClick={() => void saveEvent()} disabled={!draft.title.trim() || !draft.date || busy || coverUploading}
                  className="btn-jade px-6 py-2.5 rounded-full text-xs uppercase tracking-[0.16em] disabled:opacity-40">
                  {busy ? "Saving…" : editing ? "Save changes" : "Add event"}
                </button>
                {editing && (
                  <button onClick={() => { setEditing(null); setDraft(emptyEvent(categories[0]?.name)); }}
                    className="px-6 py-2.5 rounded-full text-xs uppercase tracking-[0.16em] border" style={{ borderColor: "#E9DFD0" }}>
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="space-y-3">
            {[...events].sort((a, b) => a.date.localeCompare(b.date)).map(ev => (
              <div key={ev.id} className="bg-white/70 border rounded-lg p-4 flex items-center justify-between gap-4 flex-wrap" style={{ borderColor: "#E9DFD0" }}>
                <div className="flex items-center gap-3">
                  {ev.imagePath && (
                    <img src={`/api/storage${ev.imagePath}`} alt=""
                      className="w-16 h-12 object-cover rounded border shrink-0" style={{ borderColor: "#E9DFD0" }} />
                  )}
                  <div>
                    <span className={`inline-block text-[10px] uppercase tracking-[0.12em] px-2 py-0.5 rounded-full ${categoryMeta(ev.category, categories).chip}`}>
                      {categoryMeta(ev.category, categories).label}
                    </span>
                    {!ev.published && (
                      <span className="inline-block text-[10px] uppercase tracking-[0.12em] px-2 py-0.5 rounded-full ml-2 bg-[#EFE7DA]" style={{ color: "var(--ink-soft)" }}>
                        Draft
                      </span>
                    )}
                    <p className="font-display text-lg mt-1">{ev.title}</p>
                    <p className="text-xs" style={{ color: "var(--ink-soft)" }}>
                      {fmtDate(ev.date)} · {ev.time} · {fmtPrice(ev.priceCents)} · {ev.spotsLeft}/{ev.totalSpots} seats left
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => void adminDownloadCheckinReport(ev.id).catch(() => setNotice("Could not download the check-in list"))}
                    className="px-4 py-1.5 rounded-full text-xs border" style={{ borderColor: "var(--gold)", color: "var(--gold)" }}>
                    Check-in CSV
                  </button>
                  <button onClick={() => startEdit(ev)} className="px-4 py-1.5 rounded-full text-xs border" style={{ borderColor: "var(--jade)", color: "var(--jade)" }}>Edit</button>
                  <button onClick={() => void deleteEvent(ev.id)} className="px-4 py-1.5 rounded-full text-xs border" style={{ borderColor: "var(--crak)", color: "var(--crak)" }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* REGISTRATIONS TAB */}
      {tab === "registrations" && registrations.length === 0 && (
        <div className="mt-8 bg-white/70 border rounded-lg" style={{ borderColor: "#E9DFD0" }}>
          <p className="p-8 text-sm text-center" style={{ color: "var(--ink-soft)" }}>No registrations yet — they'll appear here as guests reserve seats.</p>
        </div>
      )}

      {/* Filter + running totals. The numbers describe whatever is on screen,
          so they re-scope the moment an event is picked. */}
      {tab === "registrations" && registrations.length > 0 && (
        <div className="mt-8 bg-white/70 border rounded-lg p-5" style={{ borderColor: "#E9DFD0" }}>
          {/* Label above the control, not beside it: the select is capped at
              max-w-md, which left room for an inline label to sit alongside. */}
          <div className="max-w-md">
            <label htmlFor="reg-event-filter"
              className="block text-[11px] uppercase tracking-[0.12em] mb-2" style={{ color: "var(--gold)" }}>
              Filter by event
            </label>
            <select
              id="reg-event-filter"
              className={inputCls}
              value={regEventFilter === "all" ? "all" : String(regEventFilter)}
              onChange={e => setRegEventFilter(e.target.value === "all" ? "all" : Number(e.target.value))}>
              <option value="all">All events ({registrations.length})</option>
              {regEventOptions.map(o => (
                <option key={o.id} value={o.id}>
                  {o.title}{o.date ? ` — ${fmtDate(o.date)}` : ""}
                  {" "}({registrations.filter(r => r.eventId === o.id).length})
                </option>
              ))}
            </select>
          </div>

          {/* Figures stay in the body sans (Jost) to match the table below.
              font-display is Cormorant Garamond, whose oldstyle numerals render
              "1" as a roman numeral next to lining figures. Hierarchy comes
              from size and weight instead of a second family. */}
          <dl aria-live="polite" className="flex flex-wrap gap-x-10 gap-y-4 mt-6">
            <div>
              <dt className={statLabelCls} style={{ color: "var(--ink-soft)" }}>
                {filteredEvent ? "Registrations for this event" : "Total registrations"}
              </dt>
              <dd className={statValueCls}>{regStats.total}</dd>
            </div>
            <div>
              <dt className={statLabelCls} style={{ color: "var(--ink-soft)" }}>Seats booked</dt>
              <dd className={statValueCls}>
                {regStats.seats}
                {filteredEvent && (
                  <span className="text-base font-normal ml-1.5" style={{ color: "var(--ink-soft)" }}>
                    of {filteredEvent.totalSpots}
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className={statLabelCls} style={{ color: "var(--ink-soft)" }}>Collected</dt>
              <dd className={statValueCls}>{money(regStats.revenueCents)}</dd>
            </div>
            {filteredEvent && (
              <div>
                <dt className={statLabelCls} style={{ color: "var(--ink-soft)" }}>Seats left</dt>
                <dd className={statValueCls}
                  style={{ color: filteredEvent.spotsLeft === 0 ? "var(--crak)" : "var(--jade)" }}>
                  {filteredEvent.spotsLeft}
                </dd>
              </div>
            )}
          </dl>

          <p className="text-xs mt-4" style={{ color: "var(--ink-soft)" }}>
            Seats and money count confirmed registrations only.
            {regStats.pending > 0 && ` ${regStats.pending} pending (unpaid) not counted.`}
            {regStats.discounted > 0 && ` ${regStats.discounted} used a discount code.`}
          </p>
        </div>
      )}

      {tab === "registrations" && registrations.length > 0 && shownRegistrations.length === 0 && (
        <div className="mt-4 bg-white/70 border rounded-lg p-8 text-center" style={{ borderColor: "#E9DFD0" }}>
          <p className="text-sm" style={{ color: "var(--ink-soft)" }}>No registrations for this event yet.</p>
          <button onClick={() => setRegEventFilter("all")}
            className="text-xs underline underline-offset-2 mt-2" style={{ color: "var(--jade)" }}>
            Show all events
          </button>
        </div>
      )}

      {/* Stacked cards on phones — the full table needs ~950px, which is most of
          a phone screen spent sideways-scrolling at a check-in desk. */}
      {tab === "registrations" && shownRegistrations.length > 0 && (
        <div className="mt-4 space-y-3 md:hidden">
          {shownRegistrations.map(s => (
            <div key={s.id} className="bg-white/70 border rounded-lg p-4" style={{ borderColor: "#E9DFD0" }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--ink-soft)" }}>{s.eventTitle}</p>
                </div>
                <span className="text-xs shrink-0 text-right" style={{ color: s.status === "confirmed" ? "var(--jade)" : "var(--gold)" }}>
                  {s.status}{s.paid ? " · paid" : ""}
                </span>
              </div>
              <p className="text-sm mt-2 break-words">
                <a className="underline" href={`mailto:${s.email}`}>{s.email}</a>
                {s.phone && <> · <a className="underline" href={`tel:${s.phone}`}>{s.phone}</a></>}
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--ink-soft)" }}>
                {s.seats} seat{s.seats === 1 ? "" : "s"}
                {s.eventTotalSpots !== null && (
                  <> · {s.eventSpotsLeft} of {s.eventTotalSpots} left</>
                )}
                {s.notes ? ` · ${s.notes}` : ""}
              </p>
              <p className="text-xs mt-1 tabular-nums">
                <span style={{ color: "var(--ink-soft)" }}>Paid </span>
                <strong>{paidLabel(s)}</strong>
                {s.discountCode && (
                  <span className="ml-2 inline-block text-[10px] uppercase tracking-[0.12em] px-2 py-0.5 rounded-full bg-[#EFE7DA]"
                    style={{ color: "var(--gold)" }}>
                    {s.discountCode}
                  </span>
                )}
              </p>
              <button onClick={() => void removeRegistration(s.id)}
                className="text-xs mt-2 underline underline-offset-2" style={{ color: "var(--crak)" }}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === "registrations" && shownRegistrations.length > 0 && (
        <div className="mt-4 overflow-x-auto bg-white/70 border rounded-lg hidden md:block" style={{ borderColor: "#E9DFD0" }}>
          <table className="w-full text-sm">
              <thead>
                <tr style={{ color: "var(--gold)" }}>
                  {["Event", "Name", "Email", "Phone", "Seats", "Event seats", "Paid", "Discount", "Status", "Note", ""]
                    .map(h => <th key={h} className={th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {shownRegistrations.map(s => (
                  <tr key={s.id} className="border-t" style={{ borderColor: "#EFE7DA" }}>
                    <td className="px-4 py-3 font-medium">{s.eventTitle}</td>
                    <td className="px-4 py-3">{s.name}</td>
                    <td className="px-4 py-3">{s.email}</td>
                    <td className="px-4 py-3">{s.phone || "—"}</td>
                    <td className="px-4 py-3 tabular-nums">{s.seats}</td>
                    <td className="px-4 py-3 tabular-nums whitespace-nowrap">
                      {s.eventTotalSpots === null ? "—" : (
                        <>
                          <span style={{ color: s.eventSpotsLeft === 0 ? "var(--crak)" : "var(--jade)" }}>
                            {s.eventSpotsLeft}
                          </span>
                          <span style={{ color: "var(--ink-soft)" }}> of {s.eventTotalSpots} left</span>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums whitespace-nowrap">{paidLabel(s)}</td>
                    <td className="px-4 py-3">
                      {s.discountCode ? (
                        <span className="inline-block text-[10px] uppercase tracking-[0.12em] px-2 py-0.5 rounded-full bg-[#EFE7DA]"
                          style={{ color: "var(--gold)" }}>
                          {s.discountCode}
                        </span>
                      ) : (
                        <span style={{ color: "var(--ink-soft)" }}>—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span style={{ color: s.status === "confirmed" ? "var(--jade)" : "var(--gold)" }}>
                        {s.status}{s.paid ? " · paid" : ""}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-[200px] truncate" title={s.notes ?? undefined}>{s.notes || "—"}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => void removeRegistration(s.id)}
                        className="text-xs" style={{ color: "var(--crak)" }}>Remove</button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ORDERS TAB */}
      {tab === "orders" && (
        <div className="mt-8">
          {/* Payments health — checkout failures are intentionally vague to
              guests, so this is where the real reason surfaces. */}
          <div className="mb-6 rounded-lg border bg-white/70 p-4" style={{ borderColor: "#E9DFD0" }}>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-xs uppercase tracking-[0.14em]" style={{ color: "var(--gold)" }}>Square connection</p>
                <p className="text-xs mt-1" style={{ color: "var(--ink-soft)" }}>
                  Run this if guests report that payment isn't working.
                </p>
              </div>
              <button onClick={() => void checkSquare()} disabled={squareChecking}
                className="inline-flex items-center gap-2 min-h-[44px] px-5 rounded-full border text-xs uppercase tracking-[0.16em] disabled:opacity-40"
                style={{ borderColor: "var(--jade)", color: "var(--jade)" }}>
                {squareChecking && (
                  <span aria-hidden="true"
                    className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin" />
                )}
                {squareChecking ? "Checking…" : "Check connection"}
              </button>
            </div>
            {squareDiag && (
              <div aria-live="polite" className="mt-4 text-sm">
                <p className="font-medium" style={{ color: squareDiag.check.ok ? "var(--jade)" : "var(--crak)" }}>
                  {squareDiag.check.ok ? "Connected" : "Not working"}
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--ink-soft)" }}>{squareDiag.check.reason}</p>
                {squareDiag.check.squareErrors?.map((e, i) => (
                  <p key={i} className="text-xs mt-1" style={{ color: "var(--crak)" }}>
                    {e.category ?? "ERROR"} · {e.code ?? "?"}{e.field ? ` (${e.field})` : ""} — {e.detail ?? squareDiag.check.message}
                  </p>
                ))}
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 mt-3 text-xs" style={{ color: "var(--ink-soft)" }}>
                  <dt>Environment</dt>
                  <dd>{squareDiag.configured.environment} → <strong>{squareDiag.configured.effectiveEnvironment}</strong></dd>
                  <dt>Access token</dt>
                  <dd>{squareDiag.configured.accessTokenSet ? `set (${squareDiag.configured.accessTokenLength} chars)` : "not set"}</dd>
                  <dt>Location ID</dt>
                  <dd className="break-all">{squareDiag.configured.locationId ?? "not set"}</dd>
                  <dt>Webhook</dt>
                  <dd>
                    {squareDiag.configured.webhookUrlSet ? "URL set" : "URL missing"}
                    {" · "}
                    {squareDiag.configured.webhookSignatureKeySet ? "signature key set" : "signature key missing"}
                  </dd>
                </dl>
                {squareDiag.check.locations && squareDiag.check.locations.length > 0 && (
                  <p className="text-xs mt-3" style={{ color: "var(--ink-soft)" }}>
                    Locations on this account:{" "}
                    {squareDiag.check.locations.map(l => `${l.name ?? "—"} (${l.id ?? "?"})`).join(", ")}
                  </p>
                )}
              </div>
            )}
          </div>
          {ordersNote && (
            <p className="text-sm mb-4" style={{ color: "var(--ink-soft)" }}>{ordersNote}</p>
          )}
          {orders.length > 0 && (
            <p className="text-[11px] mb-2 md:hidden" style={{ color: "var(--ink-soft)" }}>
              Swipe the table sideways to see totals and status.
            </p>
          )}
          <div className="overflow-x-auto bg-white/70 border rounded-lg" style={{ borderColor: "#E9DFD0" }}>
            {orders.length === 0 ? (
              <p className="p-8 text-sm text-center" style={{ color: "var(--ink-soft)" }}>
                No orders yet — paid event registrations will appear here.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ color: "var(--gold)" }}>
                    {["Date", "Event", "Guest", "Email", "Seats", "Total", "Status"].map(h => <th key={h} className={th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {orders.map(o => (
                    <tr key={o.id} className="border-t" style={{ borderColor: "#EFE7DA" }}>
                      <td className="px-4 py-3 whitespace-nowrap">{shortDateTime(o.createdAt)}</td>
                      <td className="px-4 py-3 font-medium">{o.eventTitle ?? "—"}</td>
                      <td className="px-4 py-3">{o.buyerName ?? "—"}</td>
                      <td className="px-4 py-3">{o.buyerEmail ?? "—"}</td>
                      <td className="px-4 py-3">{o.seats ?? "—"}</td>
                      <td className="px-4 py-3 font-medium">{money(o.totalCents)}</td>
                      <td className="px-4 py-3">
                        <span style={{ color: o.paid ? "var(--jade)" : "var(--gold)" }}>
                          {o.paid ? "Paid" : o.state === "OPEN" ? "Unpaid" : o.state.toLowerCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* DISCOUNTS TAB */}
      {tab === "discounts" && (
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-10 items-start">
          <div className="space-y-6">
            <div className="bg-white/70 border rounded-lg p-6" style={{ borderColor: "#E9DFD0" }}>
              <h2 className="font-display text-2xl">New code</h2>
              <div className="space-y-3 mt-4">
                <div className="flex gap-3">
                  <input className={inputCls + " uppercase"} placeholder="CODE (e.g. MAHJ10)" value={codeDraft.code}
                    onChange={e => setCodeDraft({ ...codeDraft, code: e.target.value.toUpperCase() })} />
                  <input className={inputCls + " max-w-[110px]"} type="number" min={1} max={100} value={codeDraft.percent}
                    onChange={e => setCodeDraft({ ...codeDraft, percent: e.target.value })} aria-label="Percent off" />
                </div>
                <input className={inputCls} placeholder="Description (optional)" value={codeDraft.description}
                  onChange={e => setCodeDraft({ ...codeDraft, description: e.target.value })} />
                <button onClick={() => void createCode()} disabled={!codeDraft.code.trim() || busy}
                  className="btn-jade px-6 py-2.5 rounded-full text-xs uppercase tracking-[0.16em] disabled:opacity-40">
                  Create code
                </button>
                <p className="text-[11px]" style={{ color: "var(--ink-soft)" }}>
                  Codes are percent-off, apply to paid event checkouts, and are single-use per email address.
                </p>
              </div>
            </div>

            <div className="bg-white/70 border rounded-lg p-6" style={{ borderColor: "#E9DFD0" }}>
              <h2 className="font-display text-2xl">Code usage</h2>
              {redemptions.length === 0 ? (
                <p className="text-sm mt-3" style={{ color: "var(--ink-soft)" }}>No codes have been used yet.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {redemptions.map(r => (
                    <div key={r.id} className="flex items-center justify-between gap-3 text-sm border-t pt-2" style={{ borderColor: "#EFE7DA" }}>
                      {/* min-w-0 lets the flex item shrink; without it the nowrap
                          from `truncate` sets the card's minimum width. */}
                      <span className="min-w-0 flex-1 truncate">
                        <strong>{r.code}</strong> · {r.email}
                        <span className="ml-2 text-xs" style={{ color: r.paid ? "var(--jade)" : "var(--gold)" }}>
                          {r.paid ? "used" : "pending"}
                        </span>
                      </span>
                      <button onClick={() => void resetRedemption(r.id)}
                        className="text-xs shrink-0" style={{ color: "var(--crak)" }}>Reset</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {codes.length === 0 && (
              <div className="bg-white/70 border rounded-lg p-8 text-center" style={{ borderColor: "#E9DFD0" }}>
                <p className="text-sm" style={{ color: "var(--ink-soft)" }}>No discount codes yet — create one on the left.</p>
              </div>
            )}
            {codes.map(c => (
              <div key={c.id} className="bg-white/70 border rounded-lg p-4 flex items-center justify-between gap-4 flex-wrap" style={{ borderColor: "#E9DFD0" }}>
                <div>
                  <p className="font-display text-lg">
                    {c.code}
                    <span className="ml-3 text-sm" style={{ color: "var(--jade)" }}>{c.discountPercent}% off</span>
                    {!c.active && (
                      <span className="inline-block text-[10px] uppercase tracking-[0.12em] px-2 py-0.5 rounded-full ml-2 bg-[#EFE7DA]" style={{ color: "var(--ink-soft)" }}>
                        Inactive
                      </span>
                    )}
                  </p>
                  {c.description && <p className="text-xs mt-0.5" style={{ color: "var(--ink-soft)" }}>{c.description}</p>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => void toggleCode(c)}
                    className="px-4 py-1.5 rounded-full text-xs border"
                    style={c.active ? { borderColor: "#E9DFD0", color: "var(--ink-soft)" } : { borderColor: "var(--jade)", color: "var(--jade)" }}>
                    {c.active ? "Deactivate" : "Activate"}
                  </button>
                  <button onClick={() => void deleteCode(c.id)}
                    className="px-4 py-1.5 rounded-full text-xs border" style={{ borderColor: "var(--crak)", color: "var(--crak)" }}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CATEGORIES TAB */}
      {tab === "categories" && (
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-10 items-start">
          <div className="bg-white/70 border rounded-lg p-6" style={{ borderColor: "#E9DFD0" }}>
            <h2 className="font-display text-2xl">{catEditing ? "Edit category" : "New category"}</h2>
            <div className="space-y-4 mt-4">
              <div>
                <label htmlFor="cat-name" className="block text-[11px] uppercase tracking-[0.12em] mb-2"
                  style={{ color: "var(--gold)" }}>
                  Name
                </label>
                <input id="cat-name" className={inputCls} maxLength={40}
                  placeholder="e.g. Private Party" value={catDraft.name}
                  onChange={e => setCatDraft({ ...catDraft, name: e.target.value })} />
              </div>

              {/* A fixed palette rather than a colour picker — categories added
                  later still have to look like they belong to the site. */}
              <fieldset>
                <legend className="text-[11px] uppercase tracking-[0.12em] mb-2" style={{ color: "var(--gold)" }}>
                  Colour
                </legend>
                <div className="flex flex-wrap gap-2">
                  {CATEGORY_COLORS.map(c => {
                    const selected = catDraft.color === c;
                    return (
                      <button key={c} type="button" aria-pressed={selected}
                        onClick={() => setCatDraft({ ...catDraft, color: c })}
                        className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-full text-xs uppercase tracking-[0.12em]"
                        style={{
                          border: selected ? `2px solid ${colorMeta(c).swatch}` : "1px solid #E9DFD0",
                          color: selected ? colorMeta(c).swatch : "var(--ink-soft)",
                        }}>
                        <span className="w-3 h-3 rounded-full" style={{ background: colorMeta(c).swatch }} />
                        {CATEGORY_COLOR_LABELS[c]}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <div>
                <p className="text-[11px] uppercase tracking-[0.12em] mb-2" style={{ color: "var(--gold)" }}>Preview</p>
                <span className={`inline-block text-[11px] uppercase tracking-[0.14em] px-2.5 py-1 rounded-full ${colorMeta(catDraft.color).chip}`}>
                  {catDraft.name.trim() || "Category name"}
                </span>
              </div>

              <div className="flex gap-3">
                <button onClick={() => void saveCategory()} disabled={!catDraft.name.trim() || busy}
                  className="btn-jade px-6 py-2.5 rounded-full text-xs uppercase tracking-[0.16em] disabled:opacity-40">
                  {busy ? "Saving…" : catEditing ? "Save changes" : "Add category"}
                </button>
                {catEditing && (
                  <button onClick={() => { setCatEditing(null); setCatDraft({ name: "", color: "gold" }); }}
                    className="px-6 py-2.5 rounded-full text-xs uppercase tracking-[0.16em] border"
                    style={{ borderColor: "#E9DFD0" }}>
                    Cancel
                  </button>
                )}
              </div>
              <p className="text-[11px]" style={{ color: "var(--ink-soft)" }}>
                Categories appear in the event form, as the badge on each event, and in the calendar legend.
                Renaming one updates every event using it.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {adminCategories.length === 0 && (
              <div className="bg-white/70 border rounded-lg p-8 text-center" style={{ borderColor: "#E9DFD0" }}>
                <p className="text-sm" style={{ color: "var(--ink-soft)" }}>No categories yet — create one on the left.</p>
              </div>
            )}
            {adminCategories.map(c => (
              <div key={c.id} className="bg-white/70 border rounded-lg p-4 flex items-center justify-between gap-4 flex-wrap"
                style={{ borderColor: "#E9DFD0" }}>
                <div className="min-w-0">
                  <span className={`inline-block text-[11px] uppercase tracking-[0.14em] px-2.5 py-1 rounded-full ${colorMeta(c.color).chip}`}>
                    {c.name}
                  </span>
                  <p className="text-xs mt-1.5" style={{ color: "var(--ink-soft)" }}>
                    {c.eventCount} event{c.eventCount === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setCatEditing(c); setCatDraft({ name: c.name, color: c.color }); }}
                    className="px-4 py-1.5 rounded-full text-xs border"
                    style={{ borderColor: "var(--jade)", color: "var(--jade)" }}>
                    Edit
                  </button>
                  {/* Deleting a category in use would orphan those events, so the
                      control is disabled rather than failing after the click. */}
                  <button onClick={() => void removeCategory(c)} disabled={c.eventCount > 0}
                    title={c.eventCount > 0 ? `Used by ${c.eventCount} event${c.eventCount === 1 ? "" : "s"} — move them to another category first.` : undefined}
                    className="px-4 py-1.5 rounded-full text-xs border disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ borderColor: "var(--crak)", color: "var(--crak)" }}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PHOTOS TAB */}
      {tab === "photos" && (
        <div className="mt-8">
          <div className="bg-white/70 border rounded-lg p-6 max-w-xl" style={{ borderColor: "#E9DFD0" }}>
            <h2 className="font-display text-2xl">Add photos</h2>
            <div className="space-y-3 mt-4">
              <input className={inputCls} placeholder="Event label (e.g. Troop Night · June)" value={photoMeta.eventLabel}
                onChange={e => setPhotoMeta({ ...photoMeta, eventLabel: e.target.value })} />
              <input className={inputCls} placeholder="Caption" value={photoMeta.caption}
                onChange={e => setPhotoMeta({ ...photoMeta, caption: e.target.value })} />
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple
                className={inputCls} disabled={photoUploading > 0}
                onChange={e => void handleFiles(e.target.files)} />
              <p className="text-[11px]" style={{ color: "var(--ink-soft)" }}>
                JPEG, PNG, or WebP — resized to 1200px and uploaded to secure storage.
              </p>
              <div aria-live="polite">
                {photoUploading > 0 && (
                  <p className="text-xs flex items-center gap-2" style={{ color: "var(--ink-soft)" }}>
                    <span aria-hidden="true"
                      className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin" />
                    Uploading {photoUploading} photo{photoUploading === 1 ? "" : "s"}…
                  </p>
                )}
                {photoError && (
                  <p role="alert" className="text-xs" style={{ color: "var(--crak)" }}>{photoError}</p>
                )}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            {photos.map(p => (
              <div key={p.id} className="relative group">
                <img src={p.url} alt={p.caption ?? ""} className="w-full aspect-[4/3] object-cover rounded-lg border" style={{ borderColor: "#E9DFD0" }} loading="lazy" />
                <p className="text-xs mt-1 truncate" style={{ color: "var(--ink-soft)" }}>{p.eventLabel ?? ""}</p>
                <button onClick={() => void deletePhoto(p.id)}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full text-xs bg-white/90 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: "var(--crak)" }} aria-label={`Delete ${p.caption ?? "photo"}`}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PRIVATE LESSONS TAB */}
      {tab === "plessons" && (
        <PrivateManager
          kindLabel="Private lesson"
          packageDefaults={{ durationMinutes: 60, minPeople: 1, maxPeople: 4, requiresApproval: false }}
          listPackages={adminListPrivateLessonPackages}
          createPackage={adminCreatePrivateLessonPackage}
          updatePackage={adminUpdatePrivateLessonPackage}
          deletePackage={adminDeletePrivateLessonPackage}
          listBookings={adminListPrivateLessonBookings}
          updateBooking={adminUpdatePrivateLessonBooking}
          sendPaymentLink={adminSendPrivateLessonPaymentLink}
          bookingExtras={b => [
            { label: "Experience", value: b.skillLevel },
            { label: "Prefers", value: b.preferredTimes },
            { label: "Location", value: b.locationPreference },
          ]}
          onError={setNotice}
          onNotice={setNotice}
        />
      )}

      {/* PRIVATE EVENTS TAB */}
      {tab === "pevents" && (
        <PrivateManager
          kindLabel="Private event"
          packageDefaults={{ durationMinutes: 180, minPeople: 4, maxPeople: 16, requiresApproval: true }}
          listPackages={adminListPrivateEventPackages}
          createPackage={adminCreatePrivateEventPackage}
          updatePackage={adminUpdatePrivateEventPackage}
          deletePackage={adminDeletePrivateEventPackage}
          listBookings={adminListPrivateEventBookings}
          updateBooking={adminUpdatePrivateEventBooking}
          sendPaymentLink={adminSendPrivateEventPaymentLink}
          bookingExtras={b => [
            { label: "Occasion", value: b.occasion },
            { label: "Venue", value: b.venue },
            { label: "Dates", value: b.preferredDates },
          ]}
          onError={setNotice}
          onNotice={setNotice}
        />
      )}

      {/* PAGE TEXT TAB */}
      {tab === "content" && (
        <div className="mt-8 max-w-3xl">
          <div className="bg-white/70 border rounded-lg p-6" style={{ borderColor: "#E9DFD0" }}>
            <h2 className="font-display text-2xl">Page text</h2>
            <p className="text-sm mt-2" style={{ color: "var(--ink-soft)" }}>
              Edit the wording across your site. Changes go live as soon as you save —
              styling and layout stay the same, so you can't break the page.
            </p>

            {CONTENT_GROUPS.map(groupName => (
            <div key={groupName} className="mt-8 first:mt-6">
              <h3 className="font-display text-xl pb-2 border-b" style={{ borderColor: "#E9DFD0" }}>
                {groupName}
              </h3>
            <div className="space-y-5 mt-5">
              {CONTENT_FIELDS.filter(f => f.group === groupName).map(f => {
                const changed = (contentDraft[f.key] ?? "") !== (content[f.key] ?? "");
                return (
                  <div key={f.key}>
                    <label htmlFor={f.key} className="text-[11px] uppercase tracking-[0.12em] flex items-center gap-2"
                      style={{ color: "var(--ink-soft)" }}>
                      {f.label}
                      {changed && <span style={{ color: "var(--crak)" }}>• unsaved</span>}
                    </label>
                    {f.rows === 1 ? (
                      <input id={f.key} className={`${inputCls} mt-1.5`}
                        value={contentDraft[f.key] ?? ""}
                        onChange={e => setContentDraft({ ...contentDraft, [f.key]: e.target.value })} />
                    ) : (
                      <textarea id={f.key} rows={f.rows} className={`${inputCls} mt-1.5 leading-relaxed`}
                        value={contentDraft[f.key] ?? ""}
                        onChange={e => setContentDraft({ ...contentDraft, [f.key]: e.target.value })} />
                    )}
                    {f.hint && (
                      <p className="text-[11px] mt-1" style={{ color: "var(--ink-soft)" }}>{f.hint}</p>
                    )}
                  </div>
                );
              })}
            </div>
            </div>
            ))}

            <div className="flex items-center gap-3 mt-9 flex-wrap">
              <button onClick={() => void saveContent()} disabled={!contentDirty || contentSaving}
                className="btn-rose px-7 py-2.5 rounded-full text-xs uppercase tracking-[0.16em] disabled:opacity-40 disabled:cursor-not-allowed">
                {contentSaving ? "Saving…" : "Save changes"}
              </button>
              <button onClick={() => setContentDraft(content)} disabled={!contentDirty || contentSaving}
                className="px-6 py-2.5 rounded-full text-xs uppercase tracking-[0.16em] border disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ borderColor: "#E9DFD0", color: "var(--ink-soft)" }}>
                Discard changes
              </button>
              {/* Restores the copy the site shipped with — useful if an edit
                  goes wrong and there's no earlier version to go back to. */}
              <button
                onClick={() => {
                  const defaults: Record<string, string> = {};
                  for (const f of CONTENT_FIELDS) defaults[f.key] = CONTENT_DEFAULTS[f.key] ?? "";
                  setContentDraft(defaults);
                }}
                disabled={contentSaving}
                className="text-[11px] uppercase tracking-[0.12em] underline underline-offset-4 disabled:opacity-40"
                style={{ color: "var(--ink-soft)" }}>
                Reset to original wording
              </button>
            </div>
            {contentDirty && (
              <p className="text-[11px] mt-3" style={{ color: "var(--crak)" }}>
                You have unsaved changes.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
