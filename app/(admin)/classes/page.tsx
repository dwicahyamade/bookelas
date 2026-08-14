"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Pencil, Plus } from "lucide-react";
import { listClasses, type ClassInput } from "@/lib/api/admin";
import { listAllBranches } from "@/lib/api/branches";
import { ClassDialog } from "@/components/admin/class-dialog";
import { useAdminUser } from "@/components/admin/admin-shell";

const priceFormatter = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

export default function ClassesPage() {
  const user = useAdminUser();
  const { data: classes, isLoading } = useQuery({ queryKey: ["classes"], queryFn: listClasses });
  const { data: branches = [] } = useQuery({ queryKey: ["branches"], queryFn: () => listAllBranches(true), enabled: user.role === "superadmin" });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<(ClassInput & { id: string }) | null>(null);

  function startCreate() { setEditing(null); setOpen(true); }
  function startEdit(c: ClassInput & { id: string }) { setEditing(c); setOpen(true); }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2"><p className="text-[11px] font-bold uppercase tracking-[0.22em] text-cypress">Master data</p><h2 className="font-display text-4xl tracking-tight lg:text-5xl">Classes</h2><p className="text-sm text-ink/55">Kelola jenis kelas yang tersedia untuk dijadwalkan.</p></div>
        <button type="button" onClick={startCreate} className="inline-flex items-center gap-2 rounded-full bg-ochre px-5 py-2.5 text-sm font-bold text-paper hover:bg-ochre/90"><Plus className="size-4" />Kelas baru</button>
      </header>

      {isLoading ? <div className="flex justify-center py-20"><Loader2 className="size-6 animate-spin text-cypress" /></div> : classes?.length ? (
        <div className="overflow-x-auto rounded-2xl border border-ink/10 bg-white/35">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-ink/10 bg-ink/[0.03] text-[10px] font-bold uppercase tracking-[0.16em] text-ink/45"><tr><th className="px-5 py-4">Kelas</th><th className="px-5 py-4">Kapasitas</th><th className="px-5 py-4">Harga</th><th className="px-5 py-4">Sesi</th><th className="px-5 py-4 text-right">Aksi</th></tr></thead>
            <tbody className="divide-y divide-ink/10">
              {classes.map((c) => (
                <tr key={c.id} className="hover:bg-white/60">
                  <td className="px-5 py-4"><p className="font-semibold">{c.title}</p><p className="mt-1 max-w-md text-xs text-ink/50">{c.description}</p></td>
                  <td className="px-5 py-4 font-semibold tabular text-cypress">{c.capacity}</td>
                  <td className="px-5 py-4 tabular">{priceFormatter.format(c.price)}</td>
                  <td className="px-5 py-4 font-medium tabular text-ink/60">{c.session_count}</td>
                  <td className="px-5 py-4 text-right"><button type="button" onClick={() => startEdit({ id: c.id, title: c.title, description: c.description, capacity: c.capacity, price: c.price })} className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1.5 text-xs font-semibold hover:bg-white/60"><Pencil className="size-3.5" />Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <div className="rounded-2xl border border-dashed border-ink/20 p-16 text-center"><p className="font-display text-3xl">Belum ada kelas.</p><p className="mt-2 text-sm text-ink/55">Buat kelas pertama untuk mulai menjadwalkan sesi.</p></div>}

      <ClassDialog open={open} editing={editing} branchId={user.branch_id} branches={branches} isSuperadmin={user.role === "superadmin"} onClose={() => setOpen(false)} />
    </div>
  );
}
