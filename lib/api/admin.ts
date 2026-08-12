"use server";

import { assertAdmin } from "@/lib/server/auth";
import {
  approveBookingRpc, buildApprovalRow, cancelBooking, createClassRow, createSessionRow, dashboardMetrics,
  getApproval, getProofSignedUrl, getSessionById, getStudio as loadStudio, listApprovalsDetailed as loadApprovals,
  listBookingsBySession, listCustomerBookings, listRecentBookings as loadRecentBookings, listClassesWithCount, listSessionsByDate as loadSessions, rejectBooking, updateClassRow, updateStudioRow,
} from "@/lib/server/data";
import { notifyBookingConfirmed } from "@/lib/server/notify";
import { ApiError } from "@/lib/errors";
import type { BookingStatus } from "@/lib/types";
import type {
  ApprovalResult, ApprovalRow, ClassInput, CreateSessionInput, DashboardMetrics,
} from "@/lib/api/types";
import type { Class, PublicSession, Studio } from "@/lib/types";

export type {
  ApprovalResult, ApprovalRow, ClassInput, CreateSessionInput, DashboardMetrics
};

// Reads
export async function listApprovals(status?: BookingStatus): Promise<ApprovalRow[]> {
  await assertAdmin();
  return loadApprovals(status);
}
export async function listApprovalsDetailed(status?: BookingStatus): Promise<ApprovalRow[]> {
  await assertAdmin();
  return loadApprovals(status);
}
export async function getBooking(id: string): Promise<ApprovalRow> {
  await assertAdmin();
  return getApproval(id);
}
export async function getSession(id: string): Promise<PublicSession> {
  await assertAdmin();
  return getSessionById(id);
}

export async function listSessionParticipants(sessionId: string): Promise<ApprovalRow[]> {
  await assertAdmin();
  return listBookingsBySession(sessionId);
}
export async function searchCustomerBookings(search: string): Promise<ApprovalRow[]> {
  await assertAdmin();
  if (search.trim().length < 3) {
    throw new ApiError(400, "Masukkan minimal 3 karakter", "VALIDATION_ERROR");
  }
  return listCustomerBookings(search);
}
export async function listRecentBookings(limit = 20): Promise<ApprovalRow[]> {
  await assertAdmin();
  return loadRecentBookings(limit);
}
export async function listSessionsByDate(startISO: string, endISO: string): Promise<PublicSession[]> {
  await assertAdmin();
  return loadSessions(startISO, endISO);
}
export async function listClasses() {
  await assertAdmin();
  return listClassesWithCount();
}
export async function getStudio(): Promise<Studio> {
  await assertAdmin();
  return loadStudio();
}
export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  await assertAdmin();
  return dashboardMetrics();
}

// Writes
export async function patchApproval(
  id: string,
  status: Exclude<BookingStatus, "PENDING" | "CANCELLED">
): Promise<ApprovalResult> {
  await assertAdmin();
  const booking = status === "APPROVED" ? await approveBookingRpc(id) : await rejectBooking(id);
  const row = await buildApprovalRow(booking);
  const notify = status === "APPROVED"
    ? await notifyBookingConfirmed(booking, row.session).catch(() => null)
    : null;
  return { ...row, notify: notify ?? { email: "skipped", wa: "stubbed", warnings: ["notify skipped"] } };
}

export async function cancelBookingAction(id: string): Promise<ApprovalRow> {
  await assertAdmin();
  const booking = await cancelBooking(id);
  return buildApprovalRow(booking);
}

export async function createSession(input: CreateSessionInput): Promise<PublicSession> {
  await assertAdmin();
  if (!input.class_id || !input.start_time || !input.end_time) {
    throw new ApiError(400, "class_id, start_time, end_time wajib", "VALIDATION_ERROR");
  }
  return createSessionRow(input);
}

export async function createClass(input: ClassInput): Promise<Class> {
  await assertAdmin();
  if (!input.title || typeof input.capacity !== "number" || typeof input.price !== "number") {
    throw new ApiError(400, "title, capacity, price wajib", "VALIDATION_ERROR");
  }
  return createClassRow(input);
}

export async function updateClass(id: string, input: ClassInput): Promise<Class> {
  await assertAdmin();
  return updateClassRow(id, input);
}

export async function updateStudio(input: Pick<Studio, "name" | "wa_number" | "bank_info">): Promise<Studio> {
  await assertAdmin();
  return updateStudioRow(input);
}

export async function getProofUrl(bookingId: string): Promise<string> {
  await assertAdmin();
  return getProofSignedUrl(bookingId);
}
