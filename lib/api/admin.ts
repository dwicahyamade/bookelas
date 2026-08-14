"use server";

import { assertAdmin, assertSuperadmin } from "@/lib/server/auth";
import { assertBranchAccess } from "@/lib/server/authz";
import {
  approveBookingRpc, buildApprovalRow, cancelBooking, classBranchId, createClassRow, createSessionRow, dashboardMetrics,
  getApproval, getProofSignedUrl, getSessionById, getStudio as loadStudio, listApprovalsDetailed as loadApprovals,
  listBookingsBySession, listCustomerBookings, listRecentBookings as loadRecentBookings, listClassesWithCount, listSessionsByDate as loadSessions,
  rejectBooking, softDeleteClass, updateClassRow, updateStudioRow,
} from "@/lib/server/data";
import { getBranch } from "@/lib/server/branches";
import { notifyBookingConfirmed } from "@/lib/server/notify";
import { ApiError } from "@/lib/errors";
import type { BookingStatus } from "@/lib/types";
import type {
  ApprovalResult, ApprovalRow, ClassInput, CreateSessionInput, DashboardMetrics,
} from "@/lib/api/types";
import type { Class, PublicSession, Studio } from "@/lib/types";
import type { CurrentUser } from "@/lib/server/auth";

export type {
  ApprovalResult, ApprovalRow, ClassInput, CreateSessionInput, DashboardMetrics
};

function scopeBranch(user: CurrentUser): string | null {
  return user.role === "admin" ? user.branch_id : null;
}

// Reads
export async function listApprovals(status?: BookingStatus): Promise<ApprovalRow[]> {
  const user = await assertAdmin();
  return loadApprovals(status, scopeBranch(user));
}
export async function listApprovalsDetailed(status?: BookingStatus): Promise<ApprovalRow[]> {
  const user = await assertAdmin();
  return loadApprovals(status, scopeBranch(user));
}
export async function getBooking(id: string): Promise<ApprovalRow> {
  const user = await assertAdmin();
  const row = await getApproval(id);
  assertBranchAccess(user, row.session.branch.id);
  return row;
}
export async function getSession(id: string): Promise<PublicSession> {
  const user = await assertAdmin();
  const session = await getSessionById(id);
  assertBranchAccess(user, session.branch.id);
  return session;
}

export async function listSessionParticipants(sessionId: string): Promise<ApprovalRow[]> {
  const user = await assertAdmin();
  const session = await getSessionById(sessionId);
  assertBranchAccess(user, session.branch.id);
  return listBookingsBySession(sessionId);
}
async function historyBranch(user: CurrentUser, requested: string | null | undefined): Promise<string | null> {
  if (user.role === "admin") return user.branch_id;
  if (!requested) return null;
  const branch = await getBranch(requested);
  if (branch.deleted_at) throw new ApiError(404, "Cabang tidak ditemukan", "BRANCH_NOT_FOUND");
  return branch.id;
}

export async function searchCustomerBookings(search: string, branchFilter?: string | null): Promise<ApprovalRow[]> {
  const user = await assertAdmin();
  if (search.trim().length < 3) {
    throw new ApiError(400, "Masukkan minimal 3 karakter", "VALIDATION_ERROR");
  }
  return listCustomerBookings(search, await historyBranch(user, branchFilter));
}
export async function listRecentBookings(limit = 20, branchFilter?: string | null): Promise<ApprovalRow[]> {
  const user = await assertAdmin();
  return loadRecentBookings(limit, await historyBranch(user, branchFilter));
}
export async function listSessionsByDate(startISO: string, endISO: string): Promise<PublicSession[]> {
  const user = await assertAdmin();
  return loadSessions(startISO, endISO, scopeBranch(user));
}
export async function listClasses() {
  const user = await assertAdmin();
  return listClassesWithCount(scopeBranch(user));
}
export async function getStudio(): Promise<Studio> {
  await assertSuperadmin();
  return loadStudio();
}
export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const user = await assertAdmin();
  return dashboardMetrics(scopeBranch(user));
}

// Writes
export async function patchApproval(
  id: string,
  status: Exclude<BookingStatus, "PENDING" | "CANCELLED">
): Promise<ApprovalResult> {
  const user = await assertAdmin();
  const existing = await getApproval(id);
  assertBranchAccess(user, existing.session.branch.id);
  const booking = status === "APPROVED" ? await approveBookingRpc(id) : await rejectBooking(id);
  const row = await buildApprovalRow(booking);
  const notify = status === "APPROVED"
    ? await notifyBookingConfirmed(booking, row.session).catch(() => null)
    : null;
  return { ...row, notify: notify ?? { email: "skipped", wa: "stubbed", warnings: ["notify skipped"] } };
}

export async function cancelBookingAction(id: string): Promise<ApprovalRow> {
  const user = await assertAdmin();
  const existing = await getApproval(id);
  assertBranchAccess(user, existing.session.branch.id);
  const booking = await cancelBooking(id);
  return buildApprovalRow(booking);
}

export async function createSession(input: CreateSessionInput): Promise<PublicSession> {
  const user = await assertAdmin();
  if (!input.class_id || !input.start_time || !input.end_time) {
    throw new ApiError(400, "class_id, start_time, end_time wajib", "VALIDATION_ERROR");
  }
  assertBranchAccess(user, await classBranchId(input.class_id));
  return createSessionRow(input);
}

export async function createClass(input: ClassInput, branchId?: string): Promise<Class> {
  const user = await assertAdmin();
  if (!input.title || typeof input.capacity !== "number" || typeof input.price !== "number") {
    throw new ApiError(400, "title, capacity, price wajib", "VALIDATION_ERROR");
  }
  const targetBranchId = user.role === "admin" ? user.branch_id : branchId;
  if (!targetBranchId) throw new ApiError(400, "branch_id wajib", "VALIDATION_ERROR");
  assertBranchAccess(user, targetBranchId);
  return createClassRow(input, targetBranchId);
}

export async function updateClass(id: string, input: ClassInput): Promise<Class> {
  const user = await assertAdmin();
  assertBranchAccess(user, await classBranchId(id));
  return updateClassRow(id, input);
}

export async function deleteClass(id: string): Promise<void> {
  const user = await assertAdmin();
  assertBranchAccess(user, await classBranchId(id));
  return softDeleteClass(id);
}

export async function updateStudio(input: Pick<Studio, "name" | "wa_number" | "bank_info">): Promise<Studio> {
  await assertSuperadmin();
  return updateStudioRow(input);
}

export async function getProofUrl(bookingId: string): Promise<string> {
  const user = await assertAdmin();
  const row = await getApproval(bookingId);
  assertBranchAccess(user, row.session.branch.id);
  return getProofSignedUrl(bookingId);
}
