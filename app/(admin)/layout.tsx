import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { isAdmin } from "@/lib/server/auth";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  if (!(await isAdmin())) redirect("/login");
  return <AdminShell>{children}</AdminShell>;
}
