"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { createSession, listClasses, type CreateSessionInput } from "@/lib/api/admin";
import { listAllBranches } from "@/lib/api/branches";
import { apiMessage } from "@/lib/errors";
import { useAdminUser } from "@/components/admin/admin-shell";

const sessionSchema = z.object({
  branch_id: z.string().min(1, "Pilih cabang"),
  class_id: z.string().min(1, "Pilih kelas"),
  date: z.string().min(1, "Pilih tanggal"),
  start: z.string().min(1, "Isi waktu mulai"),
  end: z.string().min(1, "Isi waktu selesai")
}).refine((v) => v.end > v.start, { path: ["end"], message: "Waktu selesai harus setelah waktu mulai" });

export function SessionDialog({ open, onClose, initialDate }: { open: boolean; onClose: () => void; initialDate?: string }) {
  const user = useAdminUser();
  const isSuperadmin = user.role === "superadmin";
  const queryClient = useQueryClient();
  const { data: classes } = useQuery({ queryKey: ["classes"], queryFn: listClasses, enabled: open });
  const { data: branches = [] } = useQuery({ queryKey: ["branches"], queryFn: () => listAllBranches(true), enabled: open });
  const [form, setForm] = useState({ branch_id: user.branch_id ?? "", class_id: "", date: initialDate ?? "", start: "09:00", end: "10:00" });
  const filteredClasses = classes?.filter((item) => item.branch_id === form.branch_id);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (open && initialDate) setForm((current) => ({ ...current, date: initialDate }));
  }, [open, initialDate]);
  const mutation = useMutation({
    mutationFn: (input: CreateSessionInput) => createSession(input),
    onSuccess: (session) => {
      toast.success("Sesi berhasil dibuat");
      void queryClient.invalidateQueries({ queryKey: ["calendar"] });
      onClose();
      setForm({ branch_id: user.branch_id ?? "", class_id: "", date: initialDate ?? "", start: "09:00", end: "10:00" });
      window.setTimeout(() => toast(`Magic link siap: /b/${session.magic_token}`, { duration: 8000 }), 150);
    },
    onError: (e) => toast.error(apiMessage(e, "Gagal membuat sesi"))
  });
  if (!open) return null;
  const selectedClass = classes?.find((item) => item.id === form.class_id);

  function update(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value, ...(key === "branch_id" ? { class_id: "" } : {}) }));
    setErrors((current) => ({ ...current, [key]: "", ...(key === "branch_id" ? { class_id: "" } : {}) }));
  }
  function submit() {
    const parsed = sessionSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    // Local adapter uses +08:00, matching the studio's Asia/Makassar display.
    mutation.mutate({ class_id: form.class_id, start_time: `${form.date}T${form.start}:00+08:00`, end_time: `${form.date}T${form.end}:00+08:00` });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-0 sm:items-center sm:p-6" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !mutation.isPending) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="session-dialog-title" className="w-full max-w-lg rounded-t-2xl bg-paper p-6 shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[0.2em] text-cypress">Calendar</p><h2 id="session-dialog-title" className="mt-1 font-display text-3xl tracking-tight">Tambah sesi</h2></div><button type="button" onClick={onClose} disabled={mutation.isPending} aria-label="Tutup dialog" className="rounded-lg p-2 text-ink/50 hover:bg-ink/5"><X className="size-5" /></button></div>
        <div className="mt-6 space-y-4">
          <label className="block space-y-2 text-sm font-semibold">Cabang{isSuperadmin ? <select value={form.branch_id} onChange={(e) => update("branch_id", e.target.value)} className="ui-input mt-2" disabled={mutation.isPending}><option value="">Pilih cabang…</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select> : <input value={branches.find((b) => b.id === form.branch_id)?.name ?? "—"} readOnly className="ui-input mt-2 bg-ink/[0.03]" />}{errors.branch_id && <span className="block text-xs font-normal text-ochre">{errors.branch_id}</span>}</label>
          <label className="block space-y-2 text-sm font-semibold">Kelas<select value={form.class_id} onChange={(e) => update("class_id", e.target.value)} className="ui-input mt-2" disabled={mutation.isPending || !form.branch_id}><option value="">Pilih kelas…</option>{filteredClasses?.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select>{errors.class_id && <span className="block text-xs font-normal text-ochre">{errors.class_id}</span>}</label>
          <label className="block space-y-2 text-sm font-semibold">Tanggal<input type="date" value={form.date} onChange={(e) => update("date", e.target.value)} className="ui-input mt-2" disabled={mutation.isPending} />{errors.date && <span className="block text-xs font-normal text-ochre">{errors.date}</span>}</label>
          <div className="grid grid-cols-2 gap-3"><label className="block space-y-2 text-sm font-semibold">Mulai<input type="time" value={form.start} onChange={(e) => update("start", e.target.value)} className="ui-input mt-2" disabled={mutation.isPending} />{errors.start && <span className="block text-xs font-normal text-ochre">{errors.start}</span>}</label><label className="block space-y-2 text-sm font-semibold">Selesai<input type="time" value={form.end} onChange={(e) => update("end", e.target.value)} className="ui-input mt-2" disabled={mutation.isPending} />{errors.end && <span className="block text-xs font-normal text-ochre">{errors.end}</span>}</label></div>
        </div>
        <button type="button" onClick={submit} disabled={mutation.isPending} className="mt-7 flex w-full items-center justify-center gap-2 rounded-full bg-cypress px-5 py-3 text-sm font-semibold text-paper hover:bg-cypress/90 disabled:opacity-60">{mutation.isPending && <Loader2 className="size-4 animate-spin" />}Buat sesi</button>
      </section>
    </div>
  );
}
