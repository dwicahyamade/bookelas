"use server";

import { login as authenticate, logout as clearSession } from "@/lib/server/auth";

export async function login(password: string): Promise<void> {
  return authenticate(password);
}

export async function logout(): Promise<void> {
  return clearSession();
}
