"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Send } from "lucide-react";
import { bookingSchema, type BookingFormValues } from "@/lib/validation/booking";
import { createBooking } from "@/lib/api/public";
import { apiMessage } from "@/lib/errors";
import type { Booking, PublicSession } from "@/lib/types";
import { FileUpload } from "./file-upload";
import { Field } from "@/components/ui/field";

const priceFormatter = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

export function BookingForm({ session, onSuccess }: { session: PublicSession; onSuccess: (b: Booking) => void }) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<BookingFormValues>({
    resolver: zodResolver(bookingSchema),
    defaultValues: { customer_name: "", customer_wa: "", customer_email: "", payment_proof: undefined as unknown as File }
  });

  const file = watch("payment_proof");

  function onFileChange(f: File | null) {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f && f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
    setValue("payment_proof", (f ?? undefined) as unknown as File, { shouldValidate: true, shouldDirty: true });
  }

  async function onSubmit(values: BookingFormValues) {
    setSubmitError(null);
    try {
      const booking = await createBooking({ session_id: session.id, ...values });
      onSuccess(booking);
    } catch (e) {
      setSubmitError(apiMessage(e, "Gagal mengirim booking. Coba lagi sebentar."));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <div className="space-y-5">
        <Field id="customer_name" label="Nama lengkap" error={errors.customer_name?.message} required>
          <input id="customer_name" autoComplete="name" disabled={isSubmitting} {...register("customer_name")} className="ui-input" />
        </Field>
        <Field id="customer_wa" label="Nomor WhatsApp" error={errors.customer_wa?.message} required hint="Untuk konfirmasi via WhatsApp">
          <input id="customer_wa" type="tel" inputMode="tel" autoComplete="tel" placeholder="0812 3456 7890" disabled={isSubmitting} {...register("customer_wa")} className="ui-input" />
        </Field>
        <Field id="customer_email" label="Email" error={errors.customer_email?.message} required>
          <input id="customer_email" type="email" inputMode="email" autoComplete="email" disabled={isSubmitting} {...register("customer_email")} className="ui-input" />
        </Field>
      </div>

      <div className="hairline space-y-3 rounded-xl bg-cypress/5 p-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-cypress">Instruksi pembayaran</p>
        <p className="font-mono text-sm font-semibold tracking-wide text-ink">{session.studio.bank_info}</p>
        <p className="text-xs text-ink/55">Transfer {priceFormatter.format(session.class.price)} ke rekening di atas, lalu unggah bukti di bawah ini.</p>
      </div>

      <div className="space-y-2">
        <label htmlFor="payment_proof" className="block text-sm font-semibold">Unggah bukti transfer <span className="text-ochre">*</span></label>
        <FileUpload
          value={file}
          onChange={onFileChange}
          error={errors.payment_proof?.message}
          disabled={isSubmitting}
          previewUrl={preview}
        />
      </div>

      {submitError && (
        <p role="alert" className="rounded-lg bg-ochre/10 px-4 py-3 text-sm font-medium text-ochre">{submitError}</p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="group flex w-full items-center justify-center gap-2.5 rounded-full bg-ochre px-6 py-4 text-sm font-bold tracking-wide text-paper shadow-soft-ink transition hover:bg-ochre/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ochre focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSubmitting ? (<><Loader2 className="size-4 animate-spin" aria-hidden="true" />Memproses…</>) : (<>Kirim konfirmasi booking <Send className="size-4 transition group-hover:translate-x-0.5" aria-hidden="true" /></>)}
      </button>
    </form>
  );
}
