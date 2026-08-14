"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { listSessionsByDate } from "@/lib/api/admin";
import { getDayRange, getMonthRange, getWeekRange, shiftDay, shiftMonth, shiftWeek, STUDIO_TZ } from "@/lib/calendar";
import { CalendarGrid } from "@/components/admin/calendar-grid";
import { SessionDialog } from "@/components/admin/session-dialog";
import { SessionDetailDialog } from "@/components/admin/session-detail-dialog";
import type { PublicSession } from "@/lib/types";

const fmt = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: STUDIO_TZ });
const monthFmt = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: STUDIO_TZ });
const dayFmt = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: STUDIO_TZ });

type View = "week" | "month" | "day";

export default function CalendarPage() {
  const [anchor, setAnchor] = useState(() => new Date().toISOString());
  const [view, setView] = useState<View>("week");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [seedDate, setSeedDate] = useState("");
  const [selectedSession, setSelectedSession] = useState<PublicSession | null>(null);
  const range = useMemo(() => view === "month" ? getMonthRange(anchor) : view === "day" ? getDayRange(anchor) : getWeekRange(anchor), [anchor, view]);
  const shift = view === "month" ? shiftMonth : view === "day" ? shiftDay : shiftWeek;
  const title = view === "month" ? monthFmt.format(range.start) : view === "day" ? dayFmt.format(range.start) : `${fmt.format(range.start)} — ${fmt.format(range.end)}`;
  const { data: sessions, isLoading } = useQuery({ queryKey: ["calendar", anchor, view], queryFn: () => listSessionsByDate(range.start.toISOString(), range.end.toISOString()) });

  function openAdd(dateISO?: string) {
    setSeedDate(dateISO ?? range.start.toISOString().slice(0, 10));
    setDialogOpen(true);
  }

  return <div className="mx-auto max-w-7xl space-y-8">
    <header className="flex flex-wrap items-end justify-between gap-4"><div className="space-y-2"><p className="text-[11px] font-bold uppercase tracking-[0.22em] text-cypress">Schedule</p><h2 className="font-display text-4xl tracking-tight lg:text-5xl">Calendar</h2></div><button type="button" onClick={() => openAdd()} className="inline-flex items-center gap-2 rounded-full bg-ochre px-5 py-2.5 text-sm font-bold text-paper hover:bg-ochre/90"><Plus className="size-4" />Tambah sesi</button></header>
    <div className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-1"><button type="button" onClick={() => setAnchor((a) => shift(a, -1))} aria-label="Sebelumnya" className="rounded-lg p-2 text-ink/60 hover:bg-ink/5 hover:text-ink"><ChevronLeft className="size-5" /></button><button type="button" onClick={() => setAnchor((a) => shift(a, 1))} aria-label="Berikutnya" className="rounded-lg p-2 text-ink/60 hover:bg-ink/5 hover:text-ink"><ChevronRight className="size-5" /></button><button type="button" onClick={() => setAnchor(new Date().toISOString())} className="ml-2 rounded-full border border-ink/15 px-4 py-1.5 text-xs font-semibold hover:bg-white/60">Hari ini</button></div><p className="font-display text-2xl tracking-tight">{title}</p><div className="flex rounded-full border border-ink/15 p-0.5">{([["day", "Hari"], ["week", "Minggu"], ["month", "Bulan"]] as const).map(([key, label]) => <button key={key} type="button" onClick={() => setView(key)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${view === key ? "bg-cypress text-paper" : "text-ink/60 hover:bg-ink/5"}`}>{label}</button>)}</div></div>
    <CalendarGrid anchor={anchor} view={view} sessions={sessions ?? []} isLoading={isLoading} onAdd={openAdd} onSelect={setSelectedSession} />
    <SessionDialog open={dialogOpen} onClose={() => setDialogOpen(false)} initialDate={seedDate} />
    <SessionDetailDialog session={selectedSession} onClose={() => setSelectedSession(null)} />
  </div>;
}
