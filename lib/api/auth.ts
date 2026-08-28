"use server";

import { login as authenticate, logout as clearSession } from "@/lib/server/auth";
import { apiMessage } from "@/lib/errors";

export type LoginResult = { ok: true } | { ok: false; message: string };

export async function login(username: string, password: string): Promise<LoginResult> {
  try {
    await authenticate(username, password);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: apiMessage(error, "Gagal masuk") };
  }
}

export async function logout(): Promise<void> {
  return clearSession();
}
