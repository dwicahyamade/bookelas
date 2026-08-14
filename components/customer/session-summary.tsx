import { CalendarDays, Clock3, MapPin, Users } from "lucide-react";
import type { PublicSession } from "@/lib/types";

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Makassar"
});
const timeFormatter = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Makassar"
});
const priceFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0
});

export function formatSessionDate(start: string) {
  return dateFormatter.format(new Date(start));
}

export function formatSessionTime(start: string, end: string) {
  return `${timeFormatter.format(new Date(start))}–${timeFormatter.format(new Date(end))} WITA`;
}

export function SessionSummary({ session }: { session: PublicSession }) {
  const isFull = session.remaining_slots === 0;
  return (
    <section aria-labelledby="session-title" className="space-y-7">
      <div className="space-y-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-cypress">
          {session.studio.name}
        </p>
        <h1 id="session-title" className="max-w-[17ch] font-display text-5xl leading-[0.94] tracking-[-0.035em] sm:text-6xl">
          {session.class.title}
        </h1>
        <p className="max-w-prose text-sm leading-6 text-ink/65">{session.class.description}</p>
      </div>

      <div className="grid gap-3 border-y border-ink/15 py-5 text-sm sm:grid-cols-2">
        <p className="flex items-start gap-3"><CalendarDays className="mt-0.5 size-4 text-cypress" aria-hidden="true" /><span>{formatSessionDate(session.start_time)}</span></p>
        <p className="flex items-start gap-3"><Clock3 className="mt-0.5 size-4 text-cypress" aria-hidden="true" /><span>{formatSessionTime(session.start_time, session.end_time)}</span></p>
        <p className="flex items-start gap-3"><MapPin className="mt-0.5 size-4 text-cypress" aria-hidden="true" /><span>{session.branch.name}</span></p>
        <p className="flex items-start gap-3"><span className="mt-0.5 font-semibold text-cypress" aria-hidden="true">Rp</span><span>{priceFormatter.format(session.class.price)}</span></p>
      </div>

      <div className="space-y-3" aria-label={`${session.remaining_slots} dari ${session.class.capacity} slot tersisa`}>
        <div className="flex items-end justify-between gap-4">
          <p className="flex items-center gap-3 text-sm font-semibold"><Users className="size-4 text-cypress" aria-hidden="true" />Slot tersedia</p>
          <p className={`tabular font-display text-3xl ${isFull ? "text-ochre" : "text-cypress"}`}>
            {session.remaining_slots}<span className="font-sans text-xs font-semibold text-ink/45"> / {session.class.capacity}</span>
          </p>
        </div>
        <div className="flex gap-1" aria-hidden="true">
          {Array.from({ length: session.class.capacity }, (_, i) => {
            const occupied = i >= session.remaining_slots;
            return <span key={i} className={`h-1.5 flex-1 ${occupied ? "bg-ink/15" : "bg-cypress"}`} />;
          })}
        </div>
        <p className="text-xs text-ink/50">{isFull ? "Sesi ini sudah penuh." : "Tempat dikonfirmasi setelah bukti pembayaran diverifikasi."}</p>
      </div>
    </section>
  );
}
