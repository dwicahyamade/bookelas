"use client";

import { Menu } from "lucide-react";

export function Topbar({ onMenu }: { onMenu: () => void }) {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-ink/10 bg-paper/90 px-4 py-3 backdrop-blur lg:px-8">
      <button onClick={onMenu} aria-label="Buka menu" className="rounded-lg p-2 text-ink/60 hover:bg-ink/5 hover:text-ink lg:hidden"><Menu className="size-5" /></button>
      <h1 className="font-display text-2xl tracking-tight lg:text-3xl">Overview</h1>
      <div className="ml-auto flex items-center gap-3">
        <span className="hidden text-right sm:block">
          <span className="block text-sm font-semibold leading-4">Studio Admin</span>
          <span className="block text-xs text-ink/50">admin@zenith</span>
        </span>
        <span className="flex size-9 items-center justify-center rounded-full bg-cypress text-sm font-bold uppercase text-paper">A</span>
      </div>
    </header>
  );
}
