"use client";

import { useState } from "react";
import { Check, Copy, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import type { PublicSession } from "@/lib/types";
import { getWeekDays, isToday, STUDIO_TZ } from "@/lib/calendar";

const dayFmt = new Intl.DateTimeFormat("id-ID", { weekday: "short", day: "numeric", timeZone: STUDIO_TZ });
const timeFmt = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: STUDIO_TZ });

export function CalendarGrid({ anchor, sessions, isLoading, onAdd, onSelect }: { anchor: string; sessions: PublicSession[]; isLoading: boolean; onAdd: (dateISO: string) => void; onSelect: (session: PublicSession) => void }) {
  const [copied, setCopied] = useState<string | null>(null);
  const days = getWeekDays(anchor);

  async function copyLink(s: PublicSession) {
    const url = `${window.location.origin}/b/${s.magic_token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(s.id);
      toast.success("Magic link disalin", { description: url });
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      toast.error("Gagal menyalin. Salin manual: " + url);
    }
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
      {days.map((day) => {
        const daySessions = sessions.filter((s) => sameDay(day, new Date(s.start_time)));
        return <div key={day.toISOString()} className={`flex min-h-[180px] flex-col rounded-xl border p-3 ${isToday(day) ? "border-cypress bg-cypress/5" : "border-ink/10 bg-white/30"}`}>
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-bold uppercase tracking-wide ${isToday(day) ? "text-cypress" : "text-ink/45"}`}>{dayFmt.format(day)}</span>
            <button type="button" onClick={() => onAdd(day.toISOString().slice(0, 10))} aria-label="Tambah sesi" className="rounded-md p-1 text-ink/40 hover:bg-ink/10 hover:text-cypress"><Plus className="size-3.5" /></button>
          </div>
          <div className="mt-2 flex-1 space-y-2">
            {isLoading ? <div className="h-12 animate-pulse rounded-lg bg-ink/5" /> : daySessions.length === 0 ? <p className="pt-2 text-center text-[11px] text-ink/30">—</p> : daySessions.map((s) => {
              const full = s.remaining_slots === 0;
              return <div role="button" tabIndex={0} onClick={() => onSelect(s)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(s); } }} key={s.id} className="block w-full rounded-lg bg-paper p-2 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cypress">
                <p className="tabular text-[11px] font-semibold text-ink/55">{timeFmt.format(new Date(s.start_time))}</p>
                <p className="mt-0.5 line-clamp-2 text-xs font-semibold leading-tight">{s.class.title}</p>
                <div className="mt-1.5 flex items-center justify-between">
                  <span className={`text-[10px] font-bold ${full ? "text-ochre" : "text-cypress"}`}>{s.approved_count}/{s.class.capacity}{full ? " · PENUH" : ""}</span>
                  <button type="button" onClick={(e) => { e.stopPropagation(); void copyLink(s); }} aria-label="Salin magic link" className="rounded p-1 text-cypress hover:bg-cypress/10">{copied === s.id ? <Check className="size-3" /> : <Copy className="size-3" />}</button>
                </div>
              </div>;
            })}
          </div>
        </div>;
      })}
    </div>
  );
}

function sameDay(a: Date, b: Date) {
  return new Intl.DateTimeFormat("en-US", { timeZone: STUDIO_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(a) === new Intl.DateTimeFormat("en-US", { timeZone: STUDIO_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(b);
}

export function CalendarLoading() {
  return <Loader2 className="size-6 animate-spin text-cypress" aria-label="Memuat kalender" />;
}
