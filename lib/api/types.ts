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
export type { SessionStatus, BookingStatus };
export type { Studio };
