"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { createClass, updateClass, type ClassInput } from "@/lib/api/admin";
import { apiMessage } from "@/lib/errors";
import { Field } from "@/components/ui/field";
import type { Branch } from "@/lib/types";

const classSchema = z.object({
  title: z.string().trim().min(3, "Judul minimal 3 karakter").max(120, "Judul terlalu panjang"),
  description: z.string().trim().max(600, "Deskripsi maksimal 600 karakter"),
  capacity: z.coerce.number().int().min(1, "Kapasitas minimal 1").max(100, "Kapasitas maksimal 100"),
  price: z.coerce.number().int().min(0, "Harga tidak boleh negatif")
});
type ClassFormValues = z.infer<typeof classSchema>;

const EMPTY: ClassFormValues = { title: "", description: "", capacity: 10, price: 150000 };

export function ClassDialog({ open, editing, branchId, branchName, branches, isSuperadmin, onClose }: {
  open: boolean;
  editing: ClassInput & { id: string } | null;
  branchId?: string | null;
  branchName?: string;
  branches: Branch[];
  isSuperadmin: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [selectedBranch, setSelectedBranch] = useState(branchId ?? branches[0]?.id ?? "");
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ClassFormValues>({ resolver: zodResolver(classSchema), defaultValues: EMPTY });

  useEffect(() => { setSelectedBranch(branchId ?? branches[0]?.id ?? ""); }, [branchId, branches]);
  useEffect(() => { reset(editing ? { title: editing.title, description: editing.description, capacity: editing.capacity, price: editing.price } : EMPTY); }, [editing, reset]);

  const mutation = useMutation({
    mutationFn: async (values: ClassFormValues) => {
      const input: ClassInput = { title: values.title, description: values.description, capacity: Number(values.capacity), price: Number(values.price) };
      return editing ? updateClass(editing.id, input) : createClass(input, isSuperadmin ? selectedBranch : undefined);
    },
    onSuccess: () => { toast.success(editing ? "Kelas diperbarui" : "Kelas dibuat"); void queryClient.invalidateQueries({ queryKey: ["classes"] }); void queryClient.invalidateQueries({ queryKey: ["calendar"] }); handleClose(); },
    onError: (e) => toast.error(apiMessage(e, "Gagal menyimpan kelas"))
  });

  function handleClose() { reset(EMPTY); onClose(); }
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-0 sm:items-center sm:p-6" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !isSubmitting) handleClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="class-dialog-title" className="w-full max-w-lg rounded-t-2xl bg-paper p-6 shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[0.2em] text-cypress">Master data</p><h2 id="class-dialog-title" className="mt-1 font-display text-3xl tracking-tight">{editing ? "Edit kelas" : "Kelas baru"}</h2></div><button type="button" onClick={handleClose} disabled={isSubmitting} aria-label="Tutup dialog" className="rounded-lg p-2 text-ink/50 hover:bg-ink/5"><X className="size-5" /></button></div>
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="mt-6 space-y-5" noValidate>
          <Field id="title" label="Judul kelas" error={errors.title?.message} required><input id="title" disabled={isSubmitting} {...register("title")} className="ui-input" /></Field>
          <Field id="description" label="Deskripsi" error={errors.description?.message}><textarea id="description" rows={3} disabled={isSubmitting} {...register("description")} className="ui-input resize-none" /></Field>
          <div className="grid grid-cols-2 gap-3"><Field id="capacity" label="Kapasitas" error={errors.capacity?.message} required><input id="capacity" type="number" inputMode="numeric" min={1} max={100} disabled={isSubmitting} {...register("capacity")} className="ui-input" /></Field><Field id="price" label="Harga (Rp)" error={errors.price?.message} required><input id="price" type="number" inputMode="numeric" min={0} step={1000} disabled={isSubmitting} {...register("price")} className="ui-input" /></Field></div>
          {editing ? <Field id="class-branch" label="Cabang"><input id="class-branch" value={branchName ?? "—"} readOnly className="ui-input bg-ink/[0.03]" /></Field> : isSuperadmin ? <Field id="class-branch" label="Cabang" required><select id="class-branch" value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)} disabled={isSubmitting} className="ui-input"><option value="">Pilih cabang…</option>{branches.filter((b) => b.is_active).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field> : <Field id="class-branch" label="Cabang"><input id="class-branch" value={branchName ?? "—"} readOnly className="ui-input bg-ink/[0.03]" /></Field>}
          <button type="submit" disabled={isSubmitting || (isSuperadmin && !editing && !selectedBranch)} className="flex w-full items-center justify-center gap-2 rounded-full bg-cypress px-5 py-3 text-sm font-semibold text-paper hover:bg-cypress/90 disabled:opacity-60">{isSubmitting && <Loader2 className="size-4 animate-spin" />}{editing ? "Simpan perubahan" : "Buat kelas"}</button>
        </form>
      </section>
    </div>
  );
}
