"use client";

import { Eye, Loader2 } from "lucide-react";
import type { ApprovalRow } from "@/lib/api/admin";

const dateFormatter = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Makassar" });
const timeFormatter = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Makassar" });

export function ApprovalTable({ rows, onSelect, selectedId, busyId }: { rows: ApprovalRow[]; onSelect: (row: ApprovalRow) => void; selectedId?: string; busyId?: string }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-ink/10 bg-white/35">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <thead className="border-b border-ink/10 bg-ink/[0.03] text-[10px] font-bold uppercase tracking-[0.16em] text-ink/45">
          <tr><th className="px-5 py-4">Masuk</th><th className="px-5 py-4">Customer</th><th className="px-5 py-4">Kelas</th><th className="px-5 py-4">Bukti</th><th className="px-5 py-4 text-right">Aksi</th></tr>
        </thead>
        <tbody className="divide-y divide-ink/10">
          {rows.map((row) => {
            const busy = busyId === row.id;
            return <tr key={row.id} className={`transition hover:bg-white/60 ${selectedId === row.id ? "bg-cypress/5" : ""}`}>
              <td className="px-5 py-4 align-top text-xs tabular text-ink/55">{dateFormatter.format(new Date(row.created_at))}</td>
              <td className="px-5 py-4 align-top"><p className="font-semibold">{row.customer_name}</p><p className="mt-1 text-xs text-ink/50">{row.customer_wa}</p></td>
              <td className="px-5 py-4 align-top"><p className="max-w-[180px] font-medium">{row.session.class.title}</p><p className="mt-1 text-xs text-ink/50">{timeFormatter.format(new Date(row.session.start_time))} WITA · {row.session.approved_count}/{row.session.class.capacity}</p></td>
              <td className="px-5 py-4 align-top"><button type="button" onClick={() => onSelect(row)} className="inline-flex items-center gap-1.5 font-semibold text-cypress hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cypress"><Eye className="size-4" />Lihat</button></td>
              <td className="px-5 py-4 text-right align-top">{busy ? <Loader2 className="ml-auto size-4 animate-spin text-cypress" aria-label="Memproses" /> : <button type="button" onClick={() => onSelect(row)} className="rounded-full bg-cypress px-3 py-1.5 text-xs font-semibold text-paper hover:bg-cypress/90">Verifikasi</button>}</td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>
  );
}
