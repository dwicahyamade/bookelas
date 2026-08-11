"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { getStudio, updateStudio } from "@/lib/api/admin";
import { apiMessage } from "@/lib/errors";
import { Field } from "@/components/ui/field";

const studioSchema = z.object({
  name: z.string().trim().min(2, "Nama studio minimal 2 karakter").max(100, "Nama studio maksimal 100 karakter"),
  wa_number: z.string().trim().min(8, "Nomor WhatsApp minimal 8 karakter").max(30, "Nomor WhatsApp terlalu panjang").regex(/^[0-9+\-\s]+$/, "Format nomor tidak valid"),
  bank_info: z.string().trim().min(10, "Info rekening terlalu pendek").max(200, "Info rekening maksimal 200 karakter")
});
type StudioForm = z.infer<typeof studioSchema>;

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { data: studio, isLoading, isError, refetch } = useQuery({ queryKey: ["studio"], queryFn: getStudio });
  const { register, handleSubmit, reset, formState: { errors, isSubmitting, isDirty } } = useForm<StudioForm>({ resolver: zodResolver(studioSchema) });

  useEffect(() => { if (studio) reset({ name: studio.name, wa_number: studio.wa_number, bank_info: studio.bank_info }); }, [studio, reset]);

  const mutation = useMutation({
    mutationFn: updateStudio,
    onSuccess: (updated) => { reset(updated); toast.success("Pengaturan disimpan"); void queryClient.invalidateQueries({ queryKey: ["studio"] }); },
    onError: (e) => toast.error(apiMessage(e, "Gagal menyimpan pengaturan"))
  });

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-2"><p className="text-[11px] font-bold uppercase tracking-[0.22em] text-cypress">Studio profile</p><h2 className="font-display text-4xl tracking-tight lg:text-5xl">Settings</h2><p className="text-sm text-ink/55">Info ini tampil di halaman booking customer.</p></header>
      {isLoading ? <div className="flex justify-center py-20"><Loader2 className="size-6 animate-spin text-cypress" /></div> : isError ? <div role="alert" className="rounded-2xl bg-ochre/10 p-6 text-sm text-ochre">Gagal memuat pengaturan. <button type="button" onClick={() => void refetch()} className="font-bold underline">Coba lagi</button></div> : (
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-6 rounded-2xl border border-ink/10 bg-white/35 p-6 sm:p-8" noValidate>
          <Field id="name" label="Nama studio" error={errors.name?.message} required><input id="name" disabled={isSubmitting} {...register("name")} className="ui-input" /></Field>
          <Field id="wa_number" label="Nomor WhatsApp" error={errors.wa_number?.message} required hint="Nomor yang dipakai customer untuk bertanya"><input id="wa_number" type="tel" inputMode="tel" disabled={isSubmitting} {...register("wa_number")} className="ui-input" /></Field>
          <Field id="bank_info" label="Info rekening pembayaran" error={errors.bank_info?.message} required hint="Contoh: Bank BCA 123-456-7890 a.n. Zenith Studio"><textarea id="bank_info" rows={3} disabled={isSubmitting} {...register("bank_info")} className="ui-input resize-none" /></Field>
          <div className="flex items-center justify-end gap-4 border-t border-ink/10 pt-5"><p className="text-xs text-ink/45">{isDirty ? "Ada perubahan belum disimpan" : "Semua perubahan tersimpan"}</p><button type="submit" disabled={isSubmitting || !isDirty} className="inline-flex items-center gap-2 rounded-full bg-cypress px-5 py-3 text-sm font-semibold text-paper hover:bg-cypress/90 disabled:cursor-not-allowed disabled:opacity-50">{isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}Simpan perubahan</button></div>
        </form>
      )}
    </div>
  );
}
