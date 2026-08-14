"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { AdminDialog } from "@/components/admin/admin-dialog";
import { listAdmins, toggleAdmin } from "@/lib/api/admin-users";
import { listAllBranches } from "@/lib/api/branches";
import { apiMessage } from "@/lib/errors";

export default function AdminsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<{ id: string; username: string; branch_id: string; is_active: boolean } | null>(null);
  const { data: admins, isLoading } = useQuery({ queryKey: ["admins"], queryFn: listAdmins });
  const { data: branches = [] } = useQuery({ queryKey: ["branches"], queryFn: () => listAllBranches(false) });
  const toggle = useMutation({ mutationFn: ({ id, active }: { id: string; active: boolean }) => toggleAdmin(id, active), onSuccess: () => { toast.success("Status admin diperbarui"); void queryClient.invalidateQueries({ queryKey: ["admins"] }); }, onError: (e) => toast.error(apiMessage(e, "Gagal mengubah status")) });

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4"><div className="space-y-2"><p className="text-[11px] font-bold uppercase tracking-[0.22em] text-cypress">Access</p><h2 className="font-display text-4xl tracking-tight lg:text-5xl">Admin</h2><p className="text-sm text-ink/55">Satu admin mengelola satu cabang.</p></div><button onClick={() => { setEditing(null); setOpen(true); }} className="inline-flex items-center gap-2 rounded-full bg-ochre px-5 py-2.5 text-sm font-bold text-paper hover:bg-ochre/90"><Plus className="size-4" />Admin baru</button></header>
      <div className="overflow-x-auto rounded-2xl border border-ink/10 bg-white/35"><table className="w-full text-sm"><thead className="border-b border-ink/10 bg-ink/[0.03] text-left text-[10px] font-bold uppercase tracking-[0.16em] text-ink/45"><tr><th className="px-5 py-4">Username</th><th className="px-5 py-4">Cabang</th><th className="px-5 py-4">Status</th><th className="px-5 py-4 text-right">Aksi</th></tr></thead><tbody className="divide-y divide-ink/10">{isLoading ? <tr><td className="px-5 py-6 text-ink/50">Memuat…</td></tr> : (admins ?? []).map((a) => <tr key={a.id}><td className="px-5 py-4 font-semibold">{a.username}</td><td className="px-5 py-4 text-ink/60">{a.branch?.name ?? "—"}</td><td className="px-5 py-4">{a.is_active ? <span className="rounded-full bg-cypress/10 px-2 py-0.5 text-xs font-semibold text-cypress">Aktif</span> : <span className="rounded-full bg-ink/10 px-2 py-0.5 text-xs font-semibold text-ink/60">Nonaktif</span>}</td><td className="space-x-3 px-5 py-4 text-right"><button onClick={() => { setEditing({ id: a.id, username: a.username, branch_id: a.branch_id, is_active: a.is_active }); setOpen(true); }} className="inline-flex items-center gap-1 text-cypress hover:underline"><Pencil className="size-3.5" />Edit</button><button onClick={() => toggle.mutate({ id: a.id, active: !a.is_active })} className="text-ink/55 hover:text-ink">{a.is_active ? "Nonaktifkan" : "Aktifkan"}</button></td></tr>)}</tbody></table></div>
      <AdminDialog open={open} editing={editing} branches={branches} onClose={() => setOpen(false)} />
    </div>
  );
}
