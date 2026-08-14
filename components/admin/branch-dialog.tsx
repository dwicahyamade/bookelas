"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { createBranch, editBranch, type BranchInput } from "@/lib/api/branches";
import { slugify } from "@/lib/validation/admin";
import { apiMessage } from "@/lib/errors";
import { Field } from "@/components/ui/field";

const schema = z.object({
  name: z.string().trim().min(2, "Nama cabang minimal 2 karakter").max(120),
  slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9-]+$/, "Slug: huruf kecil, angka, strip"),
  is_active: z.boolean(),
});
type Values = z.infer<typeof schema>;
const EMPTY: Values = { name: "", slug: "", is_active: true };

type Editing = BranchInput & { id: string };

export function BranchDialog({ open, editing, onClose }: { open: boolean; editing: Editing | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: EMPTY });

  useEffect(() => { reset(editing ? { name: editing.name, slug: editing.slug, is_active: editing.is_active } : EMPTY); }, [editing, reset]);

  const mutation = useMutation({
    mutationFn: (v: Values) => editing ? editBranch(editing.id, v) : createBranch(v),
    onSuccess: () => { toast.success(editing ? "Cabang diperbarui" : "Cabang dibuat"); void queryClient.invalidateQueries({ queryKey: ["branches"] }); handleClose(); },
    onError: (e) => toast.error(apiMessage(e, "Gagal menyimpan cabang")),
  });

  function handleClose() { reset(EMPTY); onClose(); }
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-0 sm:items-center sm:p-6" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !isSubmitting) handleClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="branch-dialog-title" className="w-full max-w-lg rounded-t-2xl bg-paper p-6 shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[0.2em] text-cypress">Cabang</p><h2 id="branch-dialog-title" className="mt-1 font-display text-3xl tracking-tight">{editing ? "Edit cabang" : "Cabang baru"}</h2></div><button type="button" onClick={handleClose} disabled={isSubmitting} aria-label="Tutup dialog" className="rounded-lg p-2 text-ink/50 hover:bg-ink/5"><X className="size-5" /></button></div>
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="mt-6 space-y-5" noValidate>
          <Field id="branch-name" label="Nama cabang" error={errors.name?.message} required><input id="branch-name" disabled={isSubmitting} {...register("name")} onBlur={(e) => { if (!editing) setValue("slug", slugify(e.target.value)); }} className="ui-input" /></Field>
          <Field id="branch-slug" label="Slug" error={errors.slug?.message} required><input id="branch-slug" disabled={isSubmitting} {...register("slug")} className="ui-input" /></Field>
          <label className="flex items-center gap-2 text-sm text-ink/80"><input type="checkbox" disabled={isSubmitting} {...register("is_active")} /> Aktif</label>
          <button type="submit" disabled={isSubmitting} className="flex w-full items-center justify-center gap-2 rounded-full bg-cypress px-5 py-3 text-sm font-semibold text-paper hover:bg-cypress/90 disabled:opacity-60">{isSubmitting && <Loader2 className="size-4 animate-spin" />}{editing ? "Simpan perubahan" : "Buat cabang"}</button>
        </form>
      </section>
    </div>
  );
}
