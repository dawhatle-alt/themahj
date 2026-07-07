// API client for the Express backend (served under /api on the same origin;
// proxied to the local api-server during `vite` dev).

export interface ApiEvent {
  id: number;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  time: string;
  location: string;
  priceCents: number | null;
  category: string;
  imagePath: string | null;
  totalSpots: number;
  spotsLeft: number;
  host: string;
  published: boolean;
  featured: boolean;
  reminderHoursBefore: number | null;
}

export interface ApiPhoto {
  id: number;
  url: string;
  caption: string | null;
  eventLabel: string | null;
  sortOrder: number;
}

export interface RegistrationInput {
  eventId: number;
  name: string;
  email: string;
  phone?: string;
  seats: number;
  notes?: string;
  discountCode?: string;
}

export interface AdminOrder {
  id: string;
  createdAt: string | null;
  state: string;
  paid: boolean;
  totalCents: number;
  currency: string;
  buyerName: string | null;
  buyerEmail: string | null;
  seats: number | null;
  eventTitle: string | null;
  eventDate: string | null;
  registrationId: number | null;
}

export interface AdminDiscountCode {
  id: number;
  code: string;
  discountPercent: number;
  description: string | null;
  active: boolean;
  createdAt: string;
}

export interface AdminRedemption {
  id: number;
  code: string;
  email: string;
  paid: boolean;
  createdAt: string;
}

export interface ApiRegistration {
  id: number;
  eventId: number;
  name: string;
  email: string;
  phone: string | null;
  seats: number;
  notes: string | null;
  status: string;
  createdAt: string;
  event?: {
    id: number;
    title: string;
    date: string;
    time: string;
    location: string;
    host: string;
    priceCents: number;
    imagePath: string | null;
  };
}

export interface AdminRegistration {
  id: number;
  eventId: number;
  eventTitle: string;
  name: string;
  email: string;
  phone: string | null;
  seats: number;
  notes: string | null;
  status: string;
  paid: boolean;
  createdAt: string;
}

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, init);
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function jsonInit(method: string, body: unknown, headers?: Record<string, string>): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  };
}

// ---------- Public ----------

export async function listEvents(): Promise<ApiEvent[]> {
  const data = await request<{ events: ApiEvent[] }>("/events");
  return data.events;
}

export async function registerFree(input: RegistrationInput): Promise<ApiRegistration> {
  const data = await request<{ registration: ApiRegistration }>(
    "/registrations",
    jsonInit("POST", input),
  );
  return data.registration;
}

export async function checkout(input: RegistrationInput): Promise<{ url: string | null; registrationId: number }> {
  return request<{ url: string | null; registrationId: number }>(
    "/registrations/checkout",
    jsonInit("POST", input),
  );
}

export async function getConfirmation(registrationId: number): Promise<ApiRegistration> {
  const data = await request<{ registration: ApiRegistration }>(
    `/registrations/${registrationId}/confirmation`,
  );
  return data.registration;
}

export async function verifyPayment(registrationId: number): Promise<string> {
  const data = await request<{ status: string }>(
    `/registrations/${registrationId}/verify-payment`,
    { method: "POST" },
  );
  return data.status;
}

export async function listGallery(): Promise<ApiPhoto[]> {
  const data = await request<{ photos: ApiPhoto[] }>("/gallery");
  return data.photos;
}

// ---------- Admin ----------
// The passcode is kept in sessionStorage after login and sent as x-admin-token.

const ADMIN_TOKEN_KEY = "themahj:admin-token";

export function getAdminToken(): string | null {
  return sessionStorage.getItem(ADMIN_TOKEN_KEY);
}

export function setAdminToken(token: string | null): void {
  if (token) sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
  else sessionStorage.removeItem(ADMIN_TOKEN_KEY);
}

function adminHeaders(): Record<string, string> {
  const token = getAdminToken();
  return token ? { "x-admin-token": token } : {};
}

export async function adminLogin(password: string): Promise<void> {
  await request<{ ok: boolean }>("/admin/login", jsonInit("POST", { password }));
  setAdminToken(password);
}

export async function adminListEvents(): Promise<ApiEvent[]> {
  const data = await request<{ events: ApiEvent[] }>("/admin/events", { headers: adminHeaders() });
  return data.events;
}

export type EventInput = {
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  priceCents: number | null;
  category: string;
  imagePath?: string | null;
  totalSpots: number;
  spotsLeft?: number;
  host?: string;
  published: boolean;
  featured?: boolean;
  reminderHoursBefore?: number | null;
};

export async function adminCreateEvent(input: EventInput): Promise<ApiEvent> {
  const data = await request<{ event: ApiEvent }>(
    "/admin/events",
    jsonInit("POST", input, adminHeaders()),
  );
  return data.event;
}

export async function adminUpdateEvent(id: number, input: Partial<EventInput>): Promise<ApiEvent> {
  const data = await request<{ event: ApiEvent }>(
    `/admin/events/${id}`,
    jsonInit("PUT", input, adminHeaders()),
  );
  return data.event;
}

export async function adminDeleteEvent(id: number): Promise<void> {
  await request<void>(`/admin/events/${id}`, { method: "DELETE", headers: adminHeaders() });
}

export async function adminListRegistrations(): Promise<AdminRegistration[]> {
  const data = await request<{ registrations: AdminRegistration[] }>(
    "/admin/registrations",
    { headers: adminHeaders() },
  );
  return data.registrations;
}

export async function adminDeleteRegistration(id: number): Promise<void> {
  await request<void>(`/admin/registrations/${id}`, { method: "DELETE", headers: adminHeaders() });
}

export async function adminEmailCheckinReport(eventId: number, to: string): Promise<void> {
  await request<{ sent: boolean }>(
    `/admin/events/${eventId}/checkin-report/email`,
    jsonInit("POST", { to }, adminHeaders()),
  );
}

export async function adminDownloadCheckinReport(eventId: number): Promise<void> {
  const res = await fetch(`/api/admin/events/${eventId}/checkin-report`, { headers: adminHeaders() });
  if (!res.ok) throw new ApiError(res.status, "Could not download the check-in report");
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? "checkin.csv";
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// Upload flow: get a signed URL, PUT the file bytes straight to Supabase
// Storage, then return the object path to store wherever it's needed.
export async function adminUploadImage(blob: Blob): Promise<string> {
  const { uploadURL, objectPath } = await request<{ uploadURL: string; objectPath: string }>(
    "/admin/storage/upload-url",
    { method: "POST", headers: adminHeaders() },
  );
  const put = await fetch(uploadURL, {
    method: "PUT",
    body: blob,
    headers: { "Content-Type": blob.type || "image/jpeg" },
  });
  if (!put.ok) throw new ApiError(put.status, "Image upload failed");
  return objectPath;
}

export async function adminUploadPhoto(
  blob: Blob,
  meta: { caption: string; eventLabel: string },
): Promise<ApiPhoto> {
  const objectPath = await adminUploadImage(blob);
  const data = await request<{ photo: ApiPhoto }>(
    "/admin/gallery",
    jsonInit("POST", { objectPath, caption: meta.caption, eventLabel: meta.eventLabel }, adminHeaders()),
  );
  return data.photo;
}

// ---------- Admin: orders ----------

export async function adminListOrders(): Promise<{ orders: AdminOrder[]; note?: string }> {
  return request<{ orders: AdminOrder[]; note?: string }>("/admin/orders", { headers: adminHeaders() });
}

// ---------- Admin: discount codes ----------

export async function adminListDiscountCodes(): Promise<AdminDiscountCode[]> {
  const data = await request<{ codes: AdminDiscountCode[] }>("/admin/discount-codes", { headers: adminHeaders() });
  return data.codes;
}

export async function adminCreateDiscountCode(input: {
  code: string;
  discountPercent: number;
  description?: string;
  active?: boolean;
}): Promise<AdminDiscountCode> {
  const data = await request<{ code: AdminDiscountCode }>(
    "/admin/discount-codes",
    jsonInit("POST", input, adminHeaders()),
  );
  return data.code;
}

export async function adminUpdateDiscountCode(
  id: number,
  input: { discountPercent?: number; description?: string; active?: boolean },
): Promise<AdminDiscountCode> {
  const data = await request<{ code: AdminDiscountCode }>(
    `/admin/discount-codes/${id}`,
    jsonInit("PUT", input, adminHeaders()),
  );
  return data.code;
}

export async function adminDeleteDiscountCode(id: number): Promise<void> {
  await request<void>(`/admin/discount-codes/${id}`, { method: "DELETE", headers: adminHeaders() });
}

export async function adminListRedemptions(): Promise<AdminRedemption[]> {
  const data = await request<{ redemptions: AdminRedemption[] }>(
    "/admin/discount-redemptions",
    { headers: adminHeaders() },
  );
  return data.redemptions;
}

export async function adminDeleteRedemption(id: number): Promise<void> {
  await request<void>(`/admin/discount-redemptions/${id}`, { method: "DELETE", headers: adminHeaders() });
}

export async function adminDeletePhoto(id: number): Promise<void> {
  await request<{ success: boolean }>(`/admin/gallery/${id}`, {
    method: "DELETE",
    headers: adminHeaders(),
  });
}
