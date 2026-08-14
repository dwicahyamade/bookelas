"use client";

import { useEffect, useState } from "react";
import { Check, ExternalLink, FileText, X } from "lucide-react";
import type { ApprovalRow } from "@/lib/api/admin";

export function ApprovalDialog({ row, onClose, onDecision, busy }: { row: ApprovalRow | null; onClose: () => void; onDecision: (status: "APPROVED" | "REJECTED") => void; busy: boolean }) {
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [row?.id]);
  if (!row) return null;
  const isImage = /\.(jpe?g|png|webp|gif)$/i.test(row.payment_proof_url);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-0 sm:items-center sm:p-6" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="proof-title" className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-paper p-5 shadow-2xl sm:rounded-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-cypress">Bukti transfer</p>
            <h2 id="proof-title" className="mt-1 font-display text-3xl tracking-tight">{row.customer_name}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup dialog" className="rounded-lg p-2 text-ink/50 hover:bg-ink/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cypress"><X className="size-5" /></button>
        </div>

        <div className="mt-6 overflow-hidden rounded-xl border border-ink/10 bg-white/50">
          {isImage && !imageFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={row.payment_proof_url} alt={`Bukti transfer ${row.customer_name}`} onError={() => setImageFailed(true)} className="mx-auto max-h-[42dvh] w-full object-contain" />
          ) : (
            <div className="flex min-h-40 flex-col items-center justify-center gap-3 p-8 text-center">
              <FileText className="size-9 text-cypress" aria-hidden="true" />
              <p className="text-sm text-ink/60">Preview tidak tersedia di fixture lokal.</p>
              <a href={row.payment_proof_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-cypress hover:underline">Buka file <ExternalLink className="size-4" /></a>
            </div>
          )}
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-4 border-y border-ink/10 py-4 text-sm">
          <div><dt className="text-xs text-ink/45">Kelas</dt><dd className="mt-1 font-semibold">{row.session.class.title}</dd></div>
          <div><dt className="text-xs text-ink/45">Cabang</dt><dd className="mt-1 font-semibold">{row.session.branch.name}</dd></div>
          <div><dt className="text-xs text-ink/45">Kontak</dt><dd className="mt-1 font-semibold">{row.customer_wa}</dd></div>
          <div><dt className="text-xs text-ink/45">Email</dt><dd className="mt-1 break-all font-semibold">{row.customer_email}</dd></div>
          <div><dt className="text-xs text-ink/45">File</dt><dd className="mt-1 font-mono text-xs break-words">{row.payment_proof_url.split("/").pop()}</dd></div>
        </dl>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button type="button" disabled={busy} onClick={() => onDecision("REJECTED")} className="inline-flex items-center justify-center gap-2 rounded-full border border-ink/20 px-4 py-3 text-sm font-semibold text-ink transition hover:border-ochre hover:text-ochre disabled:opacity-50"><X className="size-4" />Tolak</button>
          <button type="button" disabled={busy} onClick={() => onDecision("APPROVED")} className="inline-flex items-center justify-center gap-2 rounded-full bg-cypress px-4 py-3 text-sm font-semibold text-paper transition hover:bg-cypress/90 disabled:opacity-50"><Check className="size-4" />Setujui</button>
        </div>
      </section>
    </div>
  );
}
