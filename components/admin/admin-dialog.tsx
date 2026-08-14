"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { createAdmin, editAdmin, type AdminUserInput, type AdminUserUpdateInput } from "@/lib/api/admin-users";
import type { Branch } from "@/lib/types";
import { apiMessage } from "@/lib/errors";
import { Field } from "@/components/ui/field";

const schema = z.object({
  username: z.string().trim().min(3, "Username minimal 3 karakter").max(60).regex(/^[a-zA-Z0-9_.-]+$/, "Username tidak valid"),
  password: z.string().max(200, "Kata sandi terlalu panjang").refine((value) => !value || value.length >= 8, "Kata sandi minimal 8 karakter"),
  branch_id: z.string().min(1, "Cabang wajib"),
});
type Values = z.infer<typeof schema>;
type Editing = { id: string; username: string; branch_id: string; is_active: boolean };

export function AdminDialog({ open, editing, branches, onClose }: { open: boolean; editing: Editing | null; branches: Branch[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const isEdit = !!editing;
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { username: "", password: "", branch_id: "" } });

  useEffect(() => { reset(editing ? { username: editing.username, password: "", branch_id: editing.branch_id } : { username: "", password: "", branch_id: branches.find((b) => b.is_active)?.id ?? "" }); }, [editing, branches, reset]);

  const mutation = useMutation({
    mutationFn: (v: Values) => {
      if (editing) return editAdmin(editing.id, { branch_id: v.branch_id, is_active: editing.is_active, password: v.password || undefined } satisfies AdminUserUpdateInput);
      if (!v.password) throw new Error("Kata sandi wajib diisi");
      return createAdmin({ username: v.username, password: v.password, branch_id: v.branch_id, is_active: true } satisfies AdminUserInput);
    },
    onSuccess: () => { toast.success(isEdit ? "Admin diperbarui" : "Admin dibuat"); void queryClient.invalidateQueries({ queryKey: ["admins"] }); handleClose(); },
    onError: (e) => toast.error(apiMessage(e, "Gagal menyimpan admin")),
  });

  function handleClose() { reset(); onClose(); }
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-0 sm:items-center sm:p-6" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !isSubmitting) handleClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="admin-dialog-title" className="w-full max-w-lg rounded-t-2xl bg-paper p-6 shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[0.2em] text-cypress">User</p><h2 id="admin-dialog-title" className="mt-1 font-display text-3xl tracking-tight">{isEdit ? "Edit admin" : "Admin baru"}</h2></div><button type="button" onClick={handleClose} disabled={isSubmitting} aria-label="Tutup dialog" className="rounded-lg p-2 text-ink/50 hover:bg-ink/5"><X className="size-5" /></button></div>
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="mt-6 space-y-5" noValidate>
          <Field id="admin-username" label="Username" error={errors.username?.message} required><input id="admin-username" disabled={isEdit || isSubmitting} {...register("username")} className="ui-input" /></Field>
          <Field id="admin-password" label={isEdit ? "Kata sandi baru (kosongkan jika tidak diubah)" : "Kata sandi awal"} error={errors.password?.message} required={!isEdit}><input id="admin-password" type="password" disabled={isSubmitting} {...register("password")} className="ui-input" autoComplete="new-password" /></Field>
          <Field id="admin-branch" label="Cabang" error={errors.branch_id?.message} required><select id="admin-branch" disabled={isSubmitting} {...register("branch_id")} className="ui-input"><option value="">Pilih cabang…</option>{branches.filter((b) => b.is_active || editing?.branch_id === b.id).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
          <button type="submit" disabled={isSubmitting} className="flex w-full items-center justify-center gap-2 rounded-full bg-cypress px-5 py-3 text-sm font-semibold text-paper hover:bg-cypress/90 disabled:opacity-60">{isSubmitting && <Loader2 className="size-4 animate-spin" />}{isEdit ? "Simpan perubahan" : "Buat admin"}</button>
        </form>
      </section>
    </div>
  );
}
