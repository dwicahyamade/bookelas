import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_AGE = Number(process.env.AUTH_MAX_AGE_SECONDS ?? 43200);

export interface SessionClaims {
  user_id: string;
  username: string;
  role: "superadmin" | "admin";
  branch_id: string | null;
  exp: number;
}

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

export function signToken(claims: SessionClaims): string {
  const payload = b64url(JSON.stringify(claims));
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token: string | undefined | null): SessionClaims | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const expected = sign(parts[0]);
  const actual = Buffer.from(parts[1]);
  const expectedBuffer = Buffer.from(expected);
  if (actual.length !== expectedBuffer.length || !timingSafeEqual(actual, expectedBuffer)) return null;

  let claims: SessionClaims;
  try {
    claims = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")) as SessionClaims;
  } catch {
    return null;
  }

  if (
    !claims ||
    typeof claims.user_id !== "string" ||
    typeof claims.username !== "string" ||
    (claims.role !== "admin" && claims.role !== "superadmin") ||
    (claims.role === "superadmin" ? claims.branch_id !== null : typeof claims.branch_id !== "string") ||
    typeof claims.exp !== "number" ||
    !Number.isFinite(claims.exp)
  ) return null;

  // ponytail: 60s grace window absorbs clock drift between sign/verify.
  return claims.exp >= Date.now() && claims.exp - Date.now() <= MAX_AGE * 1000 + 60_000 ? claims : null;
}

export function timingSafeEqualString(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export const COOKIE_MAX_AGE = MAX_AGE;
