"use server";

import { login as authenticate, logout as clearSession } from "@/lib/server/auth";

export async function login(username: string, password: string): Promise<void> {
  return authenticate(username, password);
}

export async function logout(): Promise<void> {
  return clearSession();
}
