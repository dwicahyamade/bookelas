"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, FileText, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { cancelBookingAction, listSessionParticipants, type ApprovalRow } from "@/lib/api/admin";
import { apiMessage } from "@/lib/errors";
import type { PublicSession } from "@/lib/types";
import { STUDIO_TZ } from "@/lib/calendar";

const dateFmt = new Intl.DateTimeFormat("id-ID", { dateStyle: "full", timeZone: STUDIO_TZ });
const timeFmt = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: STUDIO_TZ });
const bookingDateFmt = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: STUDIO_TZ });

export function SessionDetailDialog({ session, onClose }: { session: PublicSession | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const participantsQuery = useQuery({
    queryKey: ["session-participants", session?.id],
    queryFn: () => listSessionParticipants(session!.id),
    enabled: Boolean(session)
  });
  const cancelMutation = useMutation({
    mutationFn: (bookingId: string) => cancelBookingAction(bookingId),
    onSuccess: () => {
      toast.success("Peserta dibatalkan");
      void queryClient.invalidateQueries({ queryKey: ["session-participants", session?.id] });
      void queryClient.invalidateQueries({ queryKey: ["calendar"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => toast.error(apiMessage(error, "Gagal membatalkan peserta"))
  });

  if (!session) return null;
  const participants = participantsQuery.data ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-0 sm:items-center sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !cancelMutation.isPending) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="session-detail-title" className="max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-t-2xl bg-paper p-5 shadow-2xl sm:rounded-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-[11px] font-bold uppercase tracking-[0.2em] text-cypress">Detail sesi</p><h2 id="session-detail-title" className="mt-1 font-display text-3xl tracking-tight">{session.class.title}</h2><p className="mt-2 text-sm text-ink/55">{session.branch.name} · {dateFmt.format(new Date(session.start_time))} · {timeFmt.format(new Date(session.start_time))}–{timeFmt.format(new Date(session.end_time))} WITA</p>{session.coach && <p className="mt-1 text-sm text-ink/55">Coach: {session.coach}</p>}</div>
          <button type="button" onClick={onClose} aria-label="Tutup detail sesi" className="rounded-lg p-2 text-ink/50 hover:bg-ink/5 hover:text-ink"><X className="size-5" /></button>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Peserta aktif" value={`${session.approved_count}/${session.class.capacity}`} />
          <Metric label="Slot tersedia" value={String(session.remaining_slots)} />
          <Metric label="Status sesi" value={session.status} />
          <Metric label="Total booking" value={String(participants.length)} />
        </dl>

        <div className="mt-6 overflow-hidden rounded-xl border border-ink/10 bg-white/40">
          <div className="border-b border-ink/10 px-4 py-3"><h3 className="font-display text-2xl">Peserta</h3></div>
          {participantsQuery.isLoading ? <div className="flex justify-center p-10"><Loader2 className="size-5 animate-spin text-cypress" aria-label="Memuat peserta" /></div> : participantsQuery.isError ? <p role="alert" className="p-6 text-sm text-ochre">Gagal memuat peserta. Coba tutup lalu buka kembali.</p> : participants.length === 0 ? <p className="p-8 text-center text-sm text-ink/50">Belum ada booking.</p> : <div className="divide-y divide-ink/10">{participants.map((row) => <ParticipantRow key={row.id} row={row} busy={cancelMutation.isPending} onCancel={(id) => { if (window.confirm("Batalkan peserta ini? Data booking tetap disimpan.")) cancelMutation.mutate(id); }} />)}</div>}
        </div>
      </section>
    </div>
  );
}

function ParticipantRow({ row, busy, onCancel }: { row: ApprovalRow; busy: boolean; onCancel: (id: string) => void }) {
  return <article className="grid gap-3 px-4 py-4 md:grid-cols-[1fr_1fr_auto] md:items-center"><div><p className="font-semibold">{row.customer_name}</p><p className="text-sm text-ink/55">{row.customer_wa}</p><p className="break-all text-sm text-ink/55">{row.customer_email}</p></div><div className="text-sm"><Status value={row.status} /><p className="mt-1 text-xs text-ink/45">Booking {bookingDateFmt.format(new Date(row.created_at))}</p></div><div className="flex items-center gap-2 md:justify-end"><a href={row.payment_proof_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-ink/15 px-3 py-2 text-xs font-semibold hover:border-cypress hover:text-cypress"><FileText className="size-3.5" />Bukti <ExternalLink className="size-3" /></a>{row.status !== "CANCELLED" && <button type="button" disabled={busy} onClick={() => onCancel(row.id)} className="inline-flex items-center gap-1 rounded-full border border-ink/15 px-3 py-2 text-xs font-semibold hover:border-ochre hover:text-ochre disabled:opacity-50"><X className="size-3.5" />Batalkan</button>}</div></article>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-ink/10 bg-white/40 p-3"><p className="text-xs text-ink/45">{label}</p><p className="mt-1 text-lg font-bold">{value}</p></div>; }
function Status({ value }: { value: string }) { return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${value === "APPROVED" ? "bg-cypress/10 text-cypress" : value === "REJECTED" || value === "CANCELLED" ? "bg-ochre/10 text-ochre" : "bg-ink/10 text-ink/60"}`}>{value}</span>; }
