"use server";

import { assertSuperadmin } from "@/lib/server/auth";
import { adminUserInputSchema, adminUserUpdateSchema } from "@/lib/validation/admin";
import {
  createAdminUser, listAdminUsers, resetAdminPassword, setAdminActive, updateAdminUser,
} from "@/lib/server/admin-users";
import { ApiError } from "@/lib/errors";
import type { AdminUser } from "@/lib/types";
import type { AdminUserInput, AdminUserUpdateInput, AdminUserWithBranch } from "@/lib/api/types";

export type { AdminUserInput, AdminUserUpdateInput, AdminUserWithBranch };

export async function listAdmins(): Promise<AdminUserWithBranch[]> {
  await assertSuperadmin();
  return listAdminUsers();
}

export async function createAdmin(input: AdminUserInput): Promise<AdminUser> {
  await assertSuperadmin();
  const parsed = adminUserInputSchema.safeParse(input);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Data admin tidak valid", "VALIDATION_ERROR");
  return createAdminUser(parsed.data);
}

export async function editAdmin(id: string, input: AdminUserUpdateInput): Promise<AdminUser> {
  await assertSuperadmin();
  const parsed = adminUserUpdateSchema.safeParse(input);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Data admin tidak valid", "VALIDATION_ERROR");
  return updateAdminUser(id, parsed.data);
}

export async function resetPassword(id: string, password: string): Promise<void> {
  await assertSuperadmin();
  return resetAdminPassword(id, password);
}

export async function toggleAdmin(id: string, active: boolean): Promise<void> {
  await assertSuperadmin();
  return setAdminActive(id, active);
}
