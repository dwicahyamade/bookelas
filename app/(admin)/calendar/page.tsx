"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { listSessionsByDate } from "@/lib/api/admin";
import { getWeekRange, shiftWeek, STUDIO_TZ } from "@/lib/calendar";
import { CalendarGrid } from "@/components/admin/calendar-grid";
import { SessionDialog } from "@/components/admin/session-dialog";

const weekFmt = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: STUDIO_TZ });

export default function CalendarPage() {
  const [anchor, setAnchor] = useState(() => new Date().toISOString());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [seedDate, setSeedDate] = useState<string>("");

  const { start, end } = useMemo(() => getWeekRange(anchor), [anchor]);
  const { data: sessions, isLoading } = useQuery({ queryKey: ["calendar", anchor], queryFn: () => listSessionsByDate(start.toISOString(), end.toISOString()) });

  function openAdd(dateISO?: string) {
    setSeedDate(dateISO ?? start.toISOString().slice(0, 10));
    setDialogOpen(true);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2"><p className="text-[11px] font-bold uppercase tracking-[0.22em] text-cypress">Schedule</p><h2 className="font-display text-4xl tracking-tight lg:text-5xl">Calendar</h2></div>
        <button type="button" onClick={() => openAdd()} className="inline-flex items-center gap-2 rounded-full bg-ochre px-5 py-2.5 text-sm font-bold text-paper hover:bg-ochre/90"><Plus className="size-4" />Tambah sesi</button>
      </header>

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setAnchor((a) => shiftWeek(a, -1))} aria-label="Minggu sebelumnya" className="rounded-lg p-2 text-ink/60 hover:bg-ink/5 hover:text-ink"><ChevronLeft className="size-5" /></button>
          <button type="button" onClick={() => setAnchor((a) => shiftWeek(a, 1))} aria-label="Minggu berikutnya" className="rounded-lg p-2 text-ink/60 hover:bg-ink/5 hover:text-ink"><ChevronRight className="size-5" /></button>
          <button type="button" onClick={() => setAnchor(new Date().toISOString())} className="ml-2 rounded-full border border-ink/15 px-4 py-1.5 text-xs font-semibold hover:bg-white/60">Hari ini</button>
        </div>
        <p className="font-display text-2xl tracking-tight">{weekFmt.format(start)} — {weekFmt.format(end)}</p>
      </div>

      <CalendarGrid anchor={anchor} sessions={sessions ?? []} isLoading={isLoading} onAdd={openAdd} />

      <SessionDialog open={dialogOpen} onClose={() => setDialogOpen(false)} initialDate={seedDate} />
    </div>
  );
}
