import { supabaseAdmin } from "./supabase";
import { hashPassword } from "./password";
import { ApiError } from "@/lib/errors";
import type { AdminUser } from "@/lib/types";
import type { AdminUserInput, AdminUserUpdateInput } from "@/lib/api/types";

function isReservedUsername(username: string): boolean {
  const reserved = process.env.SUPERADMIN_USERNAME;
  return !!reserved && reserved.toLowerCase() === username.trim().toLowerCase();
}

export async function listAdminUsers(): Promise<AdminUser[]> {
  const { data, error } = await supabaseAdmin()
    .from("admin_users")
    .select("id, username, branch_id, is_active, created_at, updated_at")
    .order("username", { ascending: true });
  if (error) throw new ApiError(500, "Gagal memuat admin", "QUERY_FAILED");
  return data as AdminUser[];
}

export async function createAdminUser(input: AdminUserInput): Promise<AdminUser> {
  if (isReservedUsername(input.username)) {
    throw new ApiError(409, "Username sudah dipakai", "USERNAME_TAKEN");
  }
  const { data, error } = await supabaseAdmin().from("admin_users").insert({
    username: input.username.trim(),
    password_hash: hashPassword(input.password),
    branch_id: input.branch_id,
    is_active: input.is_active,
  }).select("id, username, branch_id, is_active, created_at, updated_at").single();
  if (error) {
    if (error.code === "23505") throw new ApiError(409, "Username sudah dipakai", "USERNAME_TAKEN");
    throw new ApiError(500, "Gagal membuat admin", "INSERT_FAILED");
  }
  return data as AdminUser;
}

export async function updateAdminUser(id: string, input: AdminUserUpdateInput): Promise<AdminUser> {
  const { data, error } = await supabaseAdmin().from("admin_users").update({
    branch_id: input.branch_id,
    is_active: input.is_active,
  }).eq("id", id).select("id, username, branch_id, is_active, created_at, updated_at").maybeSingle();
  if (error || !data) throw new ApiError(404, "Admin tidak ditemukan", "ADMIN_NOT_FOUND");
  return data as AdminUser;
}

export async function resetAdminPassword(id: string, newPassword: string): Promise<void> {
  if (newPassword.length < 8) throw new ApiError(400, "Kata sandi minimal 8 karakter", "VALIDATION_ERROR");
  const { error } = await supabaseAdmin().from("admin_users").update({ password_hash: hashPassword(newPassword) }).eq("id", id);
  if (error) throw new ApiError(500, "Gagal reset kata sandi", "UPDATE_FAILED");
}
