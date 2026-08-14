"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, ClipboardCheck, Clock3, TrendingUp, Users } from "lucide-react";
import { getDashboardMetrics } from "@/lib/api/admin";
import { formatSessionDate, formatSessionTime } from "@/components/customer/session-summary";

const priceFormatter = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

function Stat({ label, value, sublabel, icon: Icon, tone }: { label: string; value: React.ReactNode; sublabel?: string; icon: typeof Users; tone: "cypress" | "ochre" | "ink" }) {
  const toneClass = { cypress: "text-cypress", ochre: "text-ochre", ink: "text-ink" }[tone];
  return (
    <div className="hairline rounded-2xl bg-white/40 p-5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink/45">{label}</p>
        <Icon className={`size-4 ${toneClass}`} aria-hidden="true" />
      </div>
      <p className={`mt-4 font-display text-5xl tabular tracking-tight ${toneClass}`}>{value}</p>
      {sublabel && <p className="mt-1.5 text-xs text-ink/50">{sublabel}</p>}
    </div>
  );
}

function SkeletonStat() {
  return <div className="h-32 animate-pulse rounded-2xl bg-ink/5" />;
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: getDashboardMetrics });

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <header className="space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-cypress">Overview</p>
        <h2 className="font-display text-4xl tracking-tight lg:text-5xl">Halo, Admin</h2>
        <p className="max-w-prose text-sm text-ink/55">Ringkasan studio hari ini. Kelola persetujuan pembayaran dan jadwal kelas dari sini.</p>
      </header>

      <section aria-label="Metrics" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading || !data ? (<>
          <SkeletonStat /><SkeletonStat /><SkeletonStat /><SkeletonStat />
        </>) : (<>
          <Stat label="Perlu persetujuan" value={data.pendingCount} sublabel="Menunggu verifikasi" icon={ClipboardCheck} tone="ochre" />
          <Stat label="Sesi hari ini" value={data.sessionsTodayCount} sublabel="Terjadwal" icon={Clock3} tone="cypress" />
          <Stat label="Booking approved" value={data.totalApproved} sublabel={`dari ${data.totalCapacity} total slot`} icon={Users} tone="cypress" />
          <Stat label="Isi rata-rata" value={`${data.totalCapacity ? Math.round((data.totalApproved / data.totalCapacity) * 100) : 0}%`} sublabel="Kapasitas terisi" icon={TrendingUp} tone="ink" />
        </>)}
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 hairline rounded-2xl bg-white/40 p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-2xl tracking-tight">Sesi berikutnya</h3>
            <Link href="/calendar" className="text-sm font-semibold text-cypress hover:underline">Lihat kalender →</Link>
          </div>
          {isLoading || !data ? (
            <div className="mt-6 h-40 animate-pulse rounded-xl bg-ink/5" />
          ) : data.nextSession ? (
            <div className="mt-6 space-y-4">
              <p className="font-display text-3xl tracking-tight">{data.nextSession.class.title}</p>
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink/70">
                <span><strong className="text-ink">{formatSessionDate(data.nextSession.start_time)}</strong></span>
                <span>{formatSessionTime(data.nextSession.start_time, data.nextSession.end_time)}</span>
                <span className="font-semibold text-cypress">{priceFormatter.format(data.nextSession.class.price)}</span>
              </div>
              <div className="flex items-end justify-between border-t border-ink/10 pt-4">
                <div>
                  <p className="text-xs text-ink/50">Slot terisi</p>
                  <p className="font-display text-2xl tabular">{data.nextSession.approved_count}<span className="text-sm text-ink/40"> / {data.nextSession.class.capacity}</span></p>
                </div>
                <Link href={`/b/${data.nextSession.magic_token}`} className="inline-flex items-center gap-1.5 rounded-full bg-cypress px-4 py-2 text-sm font-semibold text-paper hover:bg-cypress/90">Salin link <ArrowUpRight className="size-3.5" /></Link>
              </div>
            </div>
          ) : (
            <p className="mt-6 text-sm text-ink/50">Tidak ada sesi terjadwal ke depan.</p>
          )}
        </div>

        <div className="space-y-3">
          <h3 className="font-display text-2xl tracking-tight">Aksi cepat</h3>
          <Link href="/approvals" className="flex items-center justify-between rounded-xl bg-ochre px-5 py-4 text-paper transition hover:bg-ochre/90">
            <span><span className="block text-[11px] font-bold uppercase tracking-[0.18em] text-paper/70">Prioritas</span><span className="font-semibold">Tinjau approvals</span></span>
            <ArrowUpRight className="size-5" />
          </Link>
          <Link href="/classes" className="flex items-center justify-between rounded-xl border border-ink/15 bg-white/40 px-5 py-4 transition hover:bg-white/70">
            <span className="font-semibold">Kelola kelas & sesi</span>
            <ArrowUpRight className="size-5 text-ink/50" />
          </Link>
        </div>
      </section>
    </div>
  );
}
