import { ApiError } from "../errors.ts";
import type { CurrentUser } from "./auth";

export function canManageAllBranches(user: CurrentUser): boolean {
  return user.role === "superadmin";
}

// Throws 403 if a non-superadmin tries to reach a branch that isn't theirs.
// null/undefined resourceBranchId is only valid for superadmins.
export function assertBranchAccess(user: CurrentUser, resourceBranchId: string | null | undefined): void {
  if (canManageAllBranches(user)) return;
  if (!resourceBranchId || user.branch_id !== resourceBranchId) {
    throw new ApiError(403, "Tidak ada akses ke cabang ini", "FORBIDDEN");
  }
}

// Supabase filter fragment: superadmin → {} (no filter), admin → { branch_id }.
export function branchFilter(user: CurrentUser): { branch_id: string } | Record<string, never> {
  return canManageAllBranches(user) ? {} : { branch_id: user.branch_id as string };
}
