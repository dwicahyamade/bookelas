import { cookies } from "next/headers";
import { ApiError } from "@/lib/errors";
import { signToken, verifyToken, timingSafeEqualString, COOKIE_MAX_AGE } from "./auth-token";

const COOKIE = process.env.AUTH_COOKIE_NAME ?? "bookelas_admin";

export async function isAdmin(): Promise<boolean> {
  const jar = await cookies();
  return verifyToken(jar.get(COOKIE)?.value);
}

export async function assertAdmin(): Promise<void> {
  if (!(await isAdmin())) throw new ApiError(401, "Tidak terautentikasi", "UNAUTHORIZED");
}

export async function login(password: string): Promise<void> {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) throw new ApiError(500, "ADMIN_PASSWORD belum dikonfigurasi", "ADMIN_NOT_CONFIGURED");
  if (typeof password !== "string" || password.length === 0 || !timingSafeEqualString(password, expected)) {
    throw new ApiError(401, "Kata sandi salah", "INVALID_PASSWORD");
  }
  const jar = await cookies();
  jar.set(COOKIE, signToken(), {
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
