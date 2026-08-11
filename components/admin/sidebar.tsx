"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ClipboardCheck, LayoutDashboard, Settings, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/approvals", label: "Approvals", icon: ClipboardCheck },
  { href: "/classes", label: "Classes", icon: Sparkles },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  return (
    <>
      {open && <button aria-label="Tutup menu" onClick={onClose} className="fixed inset-0 z-30 bg-ink/35 lg:hidden" />}
      <aside className={cn("fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-ink/10 bg-ink px-5 py-6 text-paper transition-transform lg:static lg:translate-x-0", open ? "translate-x-0" : "-translate-x-full")}>
        <div className="flex items-start justify-between">
          <div>
            <p className="font-display text-3xl tracking-tight">Bookelas</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.22em] text-paper/45">Studio console</p>
          </div>
          <button onClick={onClose} aria-label="Tutup menu" className="rounded p-1 text-paper/50 hover:bg-paper/10 hover:text-paper lg:hidden"><X className="size-5" /></button>
        </div>
        <nav aria-label="Admin navigation" className="mt-12 space-y-1">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
            return <Link key={href} href={href} onClick={onClose} className={cn("flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition", active ? "bg-paper font-semibold text-ink" : "text-paper/65 hover:bg-paper/10 hover:text-paper")}><Icon className="size-4" aria-hidden="true" />{label}</Link>;
          })}
        </nav>
        <div className="mt-auto border-t border-paper/10 pt-5">
          <p className="text-xs leading-5 text-paper/45">Single studio<br />Zenith Pilates</p>
        </div>
      </aside>
    </>
  );
}
