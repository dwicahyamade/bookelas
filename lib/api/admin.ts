"use server";

import { assertAdmin } from "@/lib/server/auth";
import {
  approveBookingRpc, buildApprovalRow, createClassRow, createSessionRow, dashboardMetrics,
  getApproval, getProofSignedUrl, getStudio as loadStudio, listApprovalsDetailed as loadApprovals,
  listClassesWithCount, listSessionsByDate as loadSessions, rejectBooking, updateClassRow, updateStudioRow,
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
  status: Exclude<BookingStatus, "PENDING">
): Promise<ApprovalResult> {
  await assertAdmin();
  const booking = status === "APPROVED" ? await approveBookingRpc(id) : await rejectBooking(id);
  const row = await buildApprovalRow(booking);
  const notify = status === "APPROVED"
    ? await notifyBookingConfirmed(booking, row.session)
    : { email: "skipped" as const, wa: "stubbed" as const, warnings: [] as string[] };
  return { ...row, notify };
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
