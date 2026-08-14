"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import type { CurrentUser } from "@/lib/server/auth";

const UserContext = createContext<CurrentUser | null>(null);
export function useAdminUser(): CurrentUser { const user = useContext(UserContext); if (!user) throw new Error("Admin user context missing"); return user; }

export function AdminShell({ user, children }: { user: CurrentUser; children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return <UserContext.Provider value={user}><div className="flex min-h-dvh"><Sidebar user={user} open={menuOpen} onClose={() => setMenuOpen(false)} /><div className="flex min-w-0 flex-1 flex-col"><Topbar user={user} onMenu={() => setMenuOpen(true)} /><main className="flex-1 px-4 py-8 lg:px-8">{children}</main></div></div></UserContext.Provider>;
}
