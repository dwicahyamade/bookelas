import type { NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { ApiError } from "../errors.ts";

const COOKIE = process.env.AUTH_COOKIE_NAME ?? "bookelas_admin";
const MAX_AGE = Number(process.env.AUTH_MAX_AGE_SECONDS ?? 43200);

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET missing or too short (<16 chars)");
  return s;
}
function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}
function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function signToken(): string {
  const exp = Date.now() + MAX_AGE * 1000;
  const payload = `${exp}.${b64url(crypto.randomUUID())}`;
  return `${b64url(payload)}.${sign(payload)}`;
}

export function verifyToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  let payload: string;
  try {
    payload = Buffer.from(parts[0], "base64url").toString("utf8");
  } catch {
    return false;
  }
  const expected = sign(payload);
  const a = Buffer.from(parts[1]);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  const [exp] = payload.split(".");
  const expMs = Number(exp);
  return (
    Number.isFinite(expMs) &&
    expMs >= Date.now() &&
    expMs - Date.now() <= MAX_AGE * 1000 + 60_000
  );
}

export function isAdmin(req: NextRequest): boolean {
  return verifyToken(req.cookies.get(COOKIE)?.value);
}
export function assertAdmin(req: NextRequest): void {
  if (!isAdmin(req)) throw new ApiError(401, "Tidak terautentikasi", "UNAUTHORIZED");
}
export const ADMIN_COOKIE = COOKIE;
export const COOKIE_MAX_AGE = MAX_AGE;

export function setAdminCookie(res: Response, token: string): void {
  res.headers.append(
    "set-cookie",
    `${COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${MAX_AGE}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`
  );
}
export function clearAdminCookie(res: Response): void {
  res.headers.append(
    "set-cookie",
    `${COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`
  );
}
export function timingSafeEqualString(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
