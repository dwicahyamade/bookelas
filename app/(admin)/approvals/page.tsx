"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { listApprovalsDetailed, patchApproval, type ApprovalRow } from "@/lib/api/admin";
import { apiMessage } from "@/lib/errors";
import { ApprovalTable } from "@/components/admin/approval-table";
import { ApprovalDialog } from "@/components/admin/approval-dialog";

export default function ApprovalsPage() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<ApprovalRow | null>(null);
  const { data, isLoading, isError, refetch, isFetching } = useQuery({ queryKey: ["approvals", "PENDING"], queryFn: () => listApprovalsDetailed("PENDING") });
  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "APPROVED" | "REJECTED" }) => patchApproval(id, status),
    onSuccess: (_, variables) => {
      toast.success(variables.status === "APPROVED" ? "Booking disetujui" : "Booking ditolak");
      setSelected(null);
      void queryClient.invalidateQueries({ queryKey: ["approvals"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(apiMessage(e, "Gagal memperbarui booking"))
  });

  function decide(status: "APPROVED" | "REJECTED") {
    if (!selected) return;
    if (status === "REJECTED" && !window.confirm("Tolak booking ini? Customer tidak akan mendapat konfirmasi kehadiran.")) return;
    mutation.mutate({ id: selected.id, status });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2"><p className="text-[11px] font-bold uppercase tracking-[0.22em] text-ochre">Verification queue</p><h2 className="font-display text-4xl tracking-tight lg:text-5xl">Approvals</h2><p className="text-sm text-ink/55">Cek bukti transfer sebelum mengunci slot customer.</p></div>
        <button type="button" onClick={() => void refetch()} disabled={isFetching} className="inline-flex items-center gap-2 rounded-full border border-ink/15 px-4 py-2.5 text-sm font-semibold hover:bg-white/60 disabled:opacity-50"><RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />Refresh</button>
      </header>

      <div className="flex items-center gap-3 rounded-xl bg-ochre/10 px-4 py-3 text-sm text-ochre"><ClipboardCheck className="size-5" aria-hidden="true" /><span><strong>{data?.length ?? 0} booking</strong> menunggu verifikasi.</span></div>

      {isLoading ? <div className="flex justify-center rounded-2xl border border-ink/10 py-20"><Loader2 className="size-6 animate-spin text-cypress" aria-label="Memuat approvals" /></div> : isError ? <div role="alert" className="rounded-2xl bg-ochre/10 p-6 text-sm text-ochre">Tidak bisa memuat antrian. <button className="font-bold underline" onClick={() => void refetch()}>Coba lagi</button></div> : data?.length ? <ApprovalTable rows={data} onSelect={setSelected} selectedId={selected?.id} busyId={mutation.isPending ? mutation.variables?.id : undefined} /> : <div className="rounded-2xl border border-dashed border-ink/20 p-16 text-center"><p className="font-display text-3xl">Semua beres.</p><p className="mt-2 text-sm text-ink/55">Tidak ada booking yang menunggu verifikasi.</p></div>}

      <ApprovalDialog row={selected} onClose={() => { if (!mutation.isPending) setSelected(null); }} onDecision={decide} busy={mutation.isPending} />
    </div>
  );
}
