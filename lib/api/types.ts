import type { AdminUser, Booking, BookingStatus, Branch, Class, PublicSession, SessionStatus, Studio, UserRole } from "@/lib/types";

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
export type { SessionStatus, BookingStatus, Studio, Branch, AdminUser, UserRole };

export interface BranchInput { name: string; slug: string; is_active: boolean; }
export interface AdminUserInput { username: string; password: string; branch_id: string; is_active: boolean; }
export interface AdminUserUpdateInput { branch_id: string; is_active: boolean; }
export interface AdminUserWithBranch extends AdminUser { branch: Branch; }
