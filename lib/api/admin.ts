import { apiGet, apiSend } from "@/lib/http";
import type { Booking, BookingStatus, Class, PublicSession, SessionStatus, Studio } from "@/lib/types";

export interface ApprovalRow extends Booking { session: PublicSession; }
export interface CreateSessionInput { class_id: string; start_time: string; end_time: string; }
export interface ClassInput { title: string; description: string; capacity: number; price: number; }
export interface DashboardMetrics {
  pendingCount: number; approvedTodayCount: number; sessionsTodayCount: number;
  nextSession: PublicSession | null; totalCapacity: number; totalApproved: number;
}
export interface BookingNotifyResult { email: "sent" | "skipped" | "error"; wa: "stubbed"; warnings: string[]; }
export type ApprovalResult = ApprovalRow & { notify: BookingNotifyResult };
export type ClassWithCount = Class & { session_count: number };

export async function listApprovals(status?: BookingStatus): Promise<Booking[]> {
  return apiGet<ApprovalRow[]>(`/api/admin/approvals${status ? `?status=${status}` : ""}`);
}
export async function listApprovalsDetailed(status?: BookingStatus): Promise<ApprovalRow[]> {
  return apiGet<ApprovalRow[]>(`/api/admin/approvals${status ? `?status=${status}` : ""}`);
}
export async function getBooking(id: string): Promise<ApprovalRow> {
  return apiGet<ApprovalRow>(`/api/admin/approvals/${id}`);
}
export async function patchApproval(id: string, status: Exclude<BookingStatus, "PENDING">): Promise<ApprovalResult> {
  return apiSend<ApprovalResult>(`/api/admin/approvals/${id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status })
  });
}
export async function listSessionsByDate(startISO: string, endISO: string): Promise<PublicSession[]> {
  return apiGet<PublicSession[]>(`/api/admin/sessions?start_date=${encodeURIComponent(startISO)}&end_date=${encodeURIComponent(endISO)}`);
}
export async function createSession(input: CreateSessionInput): Promise<PublicSession> {
  return apiSend<PublicSession>("/api/admin/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
}
export async function listClasses(): Promise<ClassWithCount[]> {
  return apiGet<ClassWithCount[]>("/api/admin/classes");
}
export async function createClass(input: ClassInput): Promise<Class> {
  return apiSend<Class>("/api/admin/classes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
}
export async function updateClass(id: string, input: ClassInput): Promise<Class> {
  return apiSend<Class>(`/api/admin/classes/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
}
export async function getStudio(): Promise<Studio> {
  return apiGet<Studio>("/api/admin/studio");
}
export async function updateStudio(input: Pick<Studio, "name" | "wa_number" | "bank_info">): Promise<Studio> {
  return apiSend<Studio>("/api/admin/studio", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
}
export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  return apiGet<DashboardMetrics>("/api/admin/dashboard");
}
export type { SessionStatus };
