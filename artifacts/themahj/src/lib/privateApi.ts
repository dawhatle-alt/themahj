// Client for private lessons and private events.
//
// These are two separate systems on the server — their own tables, their own
// routes — so nothing here is routed in common. They share the type shapes
// because a package is a package either way.

import { request, jsonInit, adminHeaders } from "./api";

export interface PrivatePackage {
  id: number;
  title: string;
  description: string;
  durationMinutes: number;
  minPeople: number;
  maxPeople: number;
  priceCents: number;
  priceNote: string | null;
  /** true = enquiry first, owner sends a payment link. false = pay at Square now. */
  requiresApproval: boolean;
  sortOrder: number;
  published: boolean;
}

interface PrivateBookingCommon {
  id: number;
  packageId: number | null;
  packageTitle: string;
  packagePriceCents: number;
  name: string;
  email: string;
  phone: string | null;
  groupSize: number;
  notes: string | null;
  status: string;
  scheduledDate: string | null;
  scheduledTime: string | null;
  scheduledLocation: string | null;
  adminNotes: string | null;
  paymentLinkUrl: string | null;
  amountPaidCents: number | null;
  createdAt: string;
}

export interface AdminPrivateLessonBooking extends PrivateBookingCommon {
  skillLevel: string | null;
  preferredTimes: string | null;
  locationPreference: string | null;
}

export interface AdminPrivateEventBooking extends PrivateBookingCommon {
  occasion: string | null;
  venue: string | null;
  preferredDates: string | null;
}

export interface PrivateRequestResult {
  bookingId: number;
  /** Square checkout URL for pay-now packages; null when approval is needed. */
  url: string | null;
  status: string;
}

export interface PrivateBookingSummary {
  id: number;
  packageTitle: string;
  status: string;
  groupSize: number;
  name: string;
}

export type PrivateLessonRequest = {
  /** null for a general enquiry — the guest has not picked a package. */
  packageId: number | null;
  name: string;
  email: string;
  phone?: string | null;
  groupSize: number;
  skillLevel?: string | null;
  preferredTimes?: string | null;
  locationPreference?: string | null;
  notes?: string | null;
};

export type PrivateEventRequest = {
  /** null for a general enquiry — the guest has not picked a package. */
  packageId: number | null;
  name: string;
  email: string;
  phone?: string | null;
  groupSize: number;
  occasion?: string | null;
  venue?: string | null;
  preferredDates?: string | null;
  notes?: string | null;
};

export type PrivatePackageInput = {
  title: string;
  description?: string;
  durationMinutes: number;
  minPeople: number;
  maxPeople: number;
  priceCents: number;
  priceNote?: string | null;
  requiresApproval?: boolean;
  sortOrder?: number;
  published?: boolean;
};

export type PrivateBookingUpdate = {
  status?: string;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  scheduledLocation?: string | null;
  adminNotes?: string | null;
};

// ---------- Public: lessons ----------

export async function listPrivateLessonPackages(): Promise<PrivatePackage[]> {
  const d = await request<{ packages: PrivatePackage[] }>("/private-lessons/packages");
  return d.packages;
}

export async function requestPrivateLesson(
  input: PrivateLessonRequest,
): Promise<PrivateRequestResult> {
  return request<PrivateRequestResult>("/private-lessons/request", jsonInit("POST", input));
}

export async function getPrivateLessonBooking(id: number): Promise<PrivateBookingSummary> {
  const d = await request<{ booking: PrivateBookingSummary }>(`/private-lessons/bookings/${id}`);
  return d.booking;
}

export async function verifyPrivateLessonPayment(id: number): Promise<string> {
  const d = await request<{ status: string }>(
    `/private-lessons/bookings/${id}/verify-payment`,
    { method: "POST" },
  );
  return d.status;
}

// ---------- Public: events ----------

export async function listPrivateEventPackages(): Promise<PrivatePackage[]> {
  const d = await request<{ packages: PrivatePackage[] }>("/private-events/packages");
  return d.packages;
}

export async function requestPrivateEvent(
  input: PrivateEventRequest,
): Promise<PrivateRequestResult> {
  return request<PrivateRequestResult>("/private-events/request", jsonInit("POST", input));
}

export async function getPrivateEventBooking(id: number): Promise<PrivateBookingSummary> {
  const d = await request<{ booking: PrivateBookingSummary }>(`/private-events/bookings/${id}`);
  return d.booking;
}

export async function verifyPrivateEventPayment(id: number): Promise<string> {
  const d = await request<{ status: string }>(
    `/private-events/bookings/${id}/verify-payment`,
    { method: "POST" },
  );
  return d.status;
}

// ---------- Admin: lessons ----------

export async function adminListPrivateLessonPackages(): Promise<PrivatePackage[]> {
  const d = await request<{ packages: PrivatePackage[] }>(
    "/admin/private-lessons/packages", { headers: adminHeaders() });
  return d.packages;
}

export async function adminCreatePrivateLessonPackage(
  input: PrivatePackageInput,
): Promise<PrivatePackage> {
  const d = await request<{ package: PrivatePackage }>(
    "/admin/private-lessons/packages", jsonInit("POST", input, adminHeaders()));
  return d.package;
}

export async function adminUpdatePrivateLessonPackage(
  id: number, input: Partial<PrivatePackageInput>,
): Promise<PrivatePackage> {
  const d = await request<{ package: PrivatePackage }>(
    `/admin/private-lessons/packages/${id}`, jsonInit("PUT", input, adminHeaders()));
  return d.package;
}

export async function adminDeletePrivateLessonPackage(id: number): Promise<void> {
  await request<void>(`/admin/private-lessons/packages/${id}`,
    { method: "DELETE", headers: adminHeaders() });
}

export async function adminListPrivateLessonBookings(): Promise<AdminPrivateLessonBooking[]> {
  const d = await request<{ bookings: AdminPrivateLessonBooking[] }>(
    "/admin/private-lessons/bookings", { headers: adminHeaders() });
  return d.bookings;
}

export async function adminUpdatePrivateLessonBooking(
  id: number, input: PrivateBookingUpdate,
): Promise<AdminPrivateLessonBooking> {
  const d = await request<{ booking: AdminPrivateLessonBooking }>(
    `/admin/private-lessons/bookings/${id}`, jsonInit("PUT", input, adminHeaders()));
  return d.booking;
}

export async function adminSendPrivateLessonPaymentLink(
  id: number, input: { amountCents?: number; message?: string },
): Promise<string> {
  const d = await request<{ url: string }>(
    `/admin/private-lessons/bookings/${id}/send-payment-link`,
    jsonInit("POST", input, adminHeaders()));
  return d.url;
}

// ---------- Admin: events ----------

export async function adminListPrivateEventPackages(): Promise<PrivatePackage[]> {
  const d = await request<{ packages: PrivatePackage[] }>(
    "/admin/private-events/packages", { headers: adminHeaders() });
  return d.packages;
}

export async function adminCreatePrivateEventPackage(
  input: PrivatePackageInput,
): Promise<PrivatePackage> {
  const d = await request<{ package: PrivatePackage }>(
    "/admin/private-events/packages", jsonInit("POST", input, adminHeaders()));
  return d.package;
}

export async function adminUpdatePrivateEventPackage(
  id: number, input: Partial<PrivatePackageInput>,
): Promise<PrivatePackage> {
  const d = await request<{ package: PrivatePackage }>(
    `/admin/private-events/packages/${id}`, jsonInit("PUT", input, adminHeaders()));
  return d.package;
}

export async function adminDeletePrivateEventPackage(id: number): Promise<void> {
  await request<void>(`/admin/private-events/packages/${id}`,
    { method: "DELETE", headers: adminHeaders() });
}

export async function adminListPrivateEventBookings(): Promise<AdminPrivateEventBooking[]> {
  const d = await request<{ bookings: AdminPrivateEventBooking[] }>(
    "/admin/private-events/bookings", { headers: adminHeaders() });
  return d.bookings;
}

export async function adminUpdatePrivateEventBooking(
  id: number, input: PrivateBookingUpdate,
): Promise<AdminPrivateEventBooking> {
  const d = await request<{ booking: AdminPrivateEventBooking }>(
    `/admin/private-events/bookings/${id}`, jsonInit("PUT", input, adminHeaders()));
  return d.booking;
}

export async function adminSendPrivateEventPaymentLink(
  id: number, input: { amountCents?: number; message?: string },
): Promise<string> {
  const d = await request<{ url: string }>(
    `/admin/private-events/bookings/${id}/send-payment-link`,
    jsonInit("POST", input, adminHeaders()));
  return d.url;
}
