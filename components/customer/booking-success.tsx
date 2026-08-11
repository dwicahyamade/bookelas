import { Check, MessageCircle } from "lucide-react";
import type { Booking, PublicSession } from "@/lib/types";
import { formatSessionDate, formatSessionTime } from "./session-summary";

export function BookingSuccess({ booking, session }: { booking: Booking; session: PublicSession }) {
  return (
    <section aria-labelledby="booking-success-title" className="animate-in fade-in slide-in-from-bottom-2 space-y-6">
      <div className="flex size-14 items-center justify-center rounded-full bg-cypress text-paper">
        <Check className="size-7" strokeWidth={2.5} aria-hidden="true" />
      </div>
      <div className="space-y-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-cypress">Booking terkirim</p>
        <h1 id="booking-success-title" className="font-display text-5xl leading-[0.94] tracking-[-0.035em]">Satu langkah lagi.</h1>
        <p className="max-w-md text-sm leading-6 text-ink/65">Bukti transfer kamu sudah kami terima. Studio akan memverifikasi pembayaran dan mengirim konfirmasi melalui WhatsApp atau email.</p>
      </div>
      <div className="space-y-4 border-y border-ink/15 py-5 text-sm">
        <div className="flex justify-between gap-4"><span className="text-ink/50">Sesi</span><span className="text-right font-semibold">{session.class.title}</span></div>
        <div className="flex justify-between gap-4"><span className="text-ink/50">Waktu</span><span className="text-right font-semibold">{formatSessionDate(session.start_time)}<br />{formatSessionTime(session.start_time, session.end_time)}</span></div>
        <div className="flex justify-between gap-4"><span className="text-ink/50">Status</span><span className="font-semibold text-ochre">Menunggu verifikasi</span></div>
        <div className="flex justify-between gap-4"><span className="text-ink/50">ID booking</span><span className="font-mono text-xs">{booking.id}</span></div>
      </div>
      <p className="flex items-start gap-3 rounded-xl bg-cypress/10 p-4 text-xs leading-5 text-cypress"><MessageCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />Simpan nomor WhatsApp studio untuk pertanyaan tentang booking ini: <strong>{session.studio.wa_number}</strong></p>
    </section>
  );
}
