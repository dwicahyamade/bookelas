"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { listAllBranches, type BranchInput } from "@/lib/api/branches";
import { BranchDialog } from "@/components/admin/branch-dialog";

export default function BranchesPage() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<(BranchInput & { id: string }) | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ["branches"], queryFn: () => listAllBranches(false) });

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4"><div className="space-y-2"><p className="text-[11px] font-bold uppercase tracking-[0.22em] text-cypress">Master data</p><h2 className="font-display text-4xl tracking-tight lg:text-5xl">Cabang</h2><p className="text-sm text-ink/55">Kelola cabang studio dan status booking.</p></div><button onClick={() => { setEditing(null); setOpen(true); }} className="inline-flex items-center gap-2 rounded-full bg-ochre px-5 py-2.5 text-sm font-bold text-paper hover:bg-ochre/90"><Plus className="size-4" />Cabang baru</button></header>
      <div className="overflow-x-auto rounded-2xl border border-ink/10 bg-white/35"><table className="w-full text-sm"><thead className="border-b border-ink/10 bg-ink/[0.03] text-left text-[10px] font-bold uppercase tracking-[0.16em] text-ink/45"><tr><th className="px-5 py-4">Nama</th><th className="px-5 py-4">Slug</th><th className="px-5 py-4">Status</th><th className="px-5 py-4 text-right">Aksi</th></tr></thead><tbody className="divide-y divide-ink/10">{isLoading ? <tr><td className="px-5 py-6 text-ink/50">Memuat…</td></tr> : (data ?? []).map((b) => <tr key={b.id}><td className="px-5 py-4 font-semibold">{b.name}</td><td className="px-5 py-4 text-ink/60">{b.slug}</td><td className="px-5 py-4">{b.is_active ? <span className="rounded-full bg-cypress/10 px-2 py-0.5 text-xs font-semibold text-cypress">Aktif</span> : <span className="rounded-full bg-ink/10 px-2 py-0.5 text-xs font-semibold text-ink/60">Nonaktif</span>}</td><td className="px-5 py-4 text-right"><button onClick={() => { setEditing({ id: b.id, name: b.name, slug: b.slug, is_active: b.is_active }); setOpen(true); }} className="text-cypress hover:underline">Edit</button></td></tr>)}</tbody></table></div>
      <BranchDialog open={open} editing={editing} onClose={() => setOpen(false)} />
    </div>
  );
}
