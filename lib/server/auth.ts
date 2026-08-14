import { cookies } from "next/headers";
import { ApiError } from "@/lib/errors";
import { signToken, verifyToken, timingSafeEqualString, COOKIE_MAX_AGE, type SessionClaims } from "./auth-token";
import { verifyPassword } from "./password";
import { supabaseAdmin } from "./supabase";
import type { UserRole } from "@/lib/types";

const COOKIE = process.env.AUTH_COOKIE_NAME ?? "bookelas_admin";

export interface CurrentUser {
  id: string;
  username: string;
  role: UserRole;
  branch_id: string | null;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const jar = await cookies();
  const claims = verifyToken(jar.get(COOKIE)?.value);
  if (!claims) return null;
  if (claims.role === "admin") {
    const { data } = await supabaseAdmin().from("admin_users").select("is_active").eq("id", claims.user_id).maybeSingle();
    if (!data?.is_active) return null;
  }
  return { id: claims.user_id, username: claims.username, role: claims.role, branch_id: claims.branch_id };
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new ApiError(401, "Tidak terautentikasi", "UNAUTHORIZED");
  return user;
}

export async function assertAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "admin" && user.role !== "superadmin") throw new ApiError(403, "Akses admin saja", "FORBIDDEN");
  return user;
}

export async function assertSuperadmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "superadmin") throw new ApiError(403, "Akses superadmin saja", "FORBIDDEN");
  return user;
}

export async function isAdmin(): Promise<boolean> {
  return (await getCurrentUser()) !== null;
}

export async function login(username: string, password: string): Promise<void> {
  if (typeof username !== "string" || username.trim().length === 0 || typeof password !== "string" || password.length === 0) {
    throw new ApiError(400, "Username dan kata sandi wajib diisi", "VALIDATION_ERROR");
  }

  const saUsername = process.env.SUPERADMIN_USERNAME;
  const saPassword = process.env.SUPERADMIN_PASSWORD;
  if (saUsername && timingSafeEqualString(username.trim().toLowerCase(), saUsername.toLowerCase())) {
    if (!saPassword) throw new ApiError(500, "SUPERADMIN_PASSWORD belum dikonfigurasi", "ADMIN_NOT_CONFIGURED");
    if (!timingSafeEqualString(password, saPassword)) throw new ApiError(401, "Username atau kata sandi salah", "INVALID_CREDENTIALS");
    return setSession({ user_id: "superadmin", username: saUsername, role: "superadmin", branch_id: null });
  }

  const { data, error } = await supabaseAdmin()
    .from("admin_users")
    .select("id, username, password_hash, branch_id, is_active")
    .ilike("username", username.trim())
    .maybeSingle();
  if (error || !data?.is_active || !verifyPassword(password, data.password_hash)) {
    throw new ApiError(401, "Username atau kata sandi salah", "INVALID_CREDENTIALS");
  }
  return setSession({ user_id: data.id, username: data.username, role: "admin", branch_id: data.branch_id });
}

async function setSession(claims: Omit<SessionClaims, "exp">): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, signToken({ ...claims, exp: Date.now() + COOKIE_MAX_AGE * 1000 }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function logout(): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
}

export const ADMIN_COOKIE = COOKIE;
export { signToken, verifyToken, timingSafeEqualString, COOKIE_MAX_AGE };
