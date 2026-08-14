"use server";

import { assertAdmin, assertSuperadmin } from "@/lib/server/auth";
import { branchInputSchema } from "@/lib/validation/admin";
import { createBranchRow, listBranches, softDeleteBranch, updateBranchRow } from "@/lib/server/branches";
import { ApiError } from "@/lib/errors";
import type { Branch } from "@/lib/types";
import type { BranchInput } from "@/lib/api/types";

export type { BranchInput };

export async function listAllBranches(activeOnly = false): Promise<Branch[]> {
  const user = await assertAdmin();
  return listBranches(activeOnly, user.role === "admin" ? user.branch_id : null);
}

export async function createBranch(input: BranchInput): Promise<Branch> {
  await assertSuperadmin();
  const parsed = branchInputSchema.safeParse(input);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Data cabang tidak valid", "VALIDATION_ERROR");
  return createBranchRow(parsed.data);
}

export async function editBranch(id: string, input: BranchInput): Promise<Branch> {
  await assertSuperadmin();
  const parsed = branchInputSchema.safeParse(input);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Data cabang tidak valid", "VALIDATION_ERROR");
  return updateBranchRow(id, parsed.data);
}

export async function deleteBranch(id: string): Promise<void> {
  await assertSuperadmin();
  return softDeleteBranch(id);
}
