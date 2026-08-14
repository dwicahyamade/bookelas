import { z } from "zod";

export function slugify(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export const branchInputSchema = z.object({
  name: z.string().trim().min(2, "Nama cabang minimal 2 karakter").max(120, "Nama cabang terlalu panjang"),
  slug: z.string().trim().min(2, "Slug minimal 2 karakter").max(120).regex(/^[a-z0-9-]+$/, "Slug hanya huruf kecil, angka, strip"),
  is_active: z.boolean(),
});

export const adminUserInputSchema = z.object({
  username: z.string().trim().min(3, "Username minimal 3 karakter").max(60).regex(/^[a-zA-Z0-9_.-]+$/, "Username: huruf, angka, titik, strip, underscore"),
  password: z.string().min(8, "Kata sandi minimal 8 karakter").max(200),
  branch_id: z.string().min(1, "Cabang wajib"),
  is_active: z.boolean(),
});

export const adminUserUpdateSchema = z.object({
  branch_id: z.string().min(1, "Cabang wajib"),
  is_active: z.boolean(),
  password: z.string().max(200, "Kata sandi terlalu panjang").refine((value) => !value || value.length >= 8, "Kata sandi minimal 8 karakter").optional(),
});
