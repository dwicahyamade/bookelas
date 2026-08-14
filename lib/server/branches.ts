import { supabaseAdmin } from "./supabase";
import { ApiError } from "@/lib/errors";
import type { Branch } from "@/lib/types";
import type { BranchInput } from "@/lib/api/types";

export async function listBranches(activeOnly = false, branchId: string | null = null): Promise<Branch[]> {
  let query = supabaseAdmin().from("branches").select("*").order("name", { ascending: true }).is("deleted_at", null);
  if (branchId) query = query.eq("id", branchId);
  if (activeOnly) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw new ApiError(500, "Gagal memuat cabang", "QUERY_FAILED");
  return data as Branch[];
}

export async function getBranch(id: string): Promise<Branch> {
  const { data, error } = await supabaseAdmin().from("branches").select("*").eq("id", id).maybeSingle();
  if (error || !data) throw new ApiError(404, "Cabang tidak ditemukan", "BRANCH_NOT_FOUND");
  return data as Branch;
}

export async function branchIdBySlug(slug: string): Promise<string | null> {
  const { data } = await supabaseAdmin().from("branches").select("id").eq("slug", slug).is("deleted_at", null).maybeSingle();
  return data?.id ?? null;
}

export async function createBranchRow(input: BranchInput): Promise<Branch> {
  const { data, error } = await supabaseAdmin().from("branches").insert(input).select().single();
  if (error) {
    if (error.code === "23505") throw new ApiError(409, "Slug sudah dipakai", "SLUG_TAKEN");
    throw new ApiError(500, "Gagal membuat cabang", "INSERT_FAILED");
  }
  return data as Branch;
}

export async function updateBranchRow(id: string, input: BranchInput): Promise<Branch> {
  const { data, error } = await supabaseAdmin()
    .from("branches").update(input).eq("id", id).is("deleted_at", null).select().maybeSingle();
  if (error) {
    if (error.code === "23505") throw new ApiError(409, "Slug sudah dipakai", "SLUG_TAKEN");
    throw new ApiError(500, "Gagal menyimpan cabang", "UPDATE_FAILED");
  }
  if (!data) throw new ApiError(404, "Cabang tidak ditemukan", "BRANCH_NOT_FOUND");
  return data as Branch;
}

export async function softDeleteBranch(id: string): Promise<void> {
  const { data, error } = await supabaseAdmin()
    .from("branches").update({ deleted_at: new Date().toISOString() })
    .eq("id", id).is("deleted_at", null).select("id").maybeSingle();
  if (error) throw new ApiError(500, "Gagal menghapus cabang", "UPDATE_FAILED");
  if (!data) throw new ApiError(404, "Cabang tidak ditemukan", "BRANCH_NOT_FOUND");
}
