# Bookelas Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Bookelas fixture adapters with a Supabase-backed Next.js 16 backend for public bookings, protected single-admin operations, private payment proofs, and Resend approval email.

**Architecture:** Browser components keep importing `lib/api/*`; those functions become thin `fetch` adapters calling Next.js App Router Route Handlers. Route Handlers run on the Node.js runtime, validate trust-boundary input, enforce the signed admin cookie, query Supabase through a server-only service-role client, upload proofs to a private bucket, and trigger Resend after approval. Next 16 `proxy.ts` provides an early optimistic auth redirect; every admin handler still verifies auth server-side.

**Tech Stack:** Next.js 16.3 App Router Route Handlers + `proxy.ts`; TypeScript strict mode; Supabase PostgreSQL/Storage via `@supabase/supabase-js`; Zod 3.23; native `fetch` for Resend HTTP API; existing React Query, `ApiError`, and self-check scripts.

## Global Constraints

- Scope is Tahap 1–4 only; Tahap 5 cron reminder is deferred.
- WhatsApp is a structured-log stub; no real WhatsApp provider installed.
- Admin auth = one `ADMIN_PASSWORD` behind an httpOnly signed cookie; no Supabase Auth/RLS/browser Supabase client.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only; never import it from client code or expose it in a response.
- Storage bucket `payment-proofs` is **private**; proof access uses an authenticated short-lived signed URL.
- Booking upload accepts only image MIME types or `application/pdf`, max 5 MiB (existing `bookingSchema`).
- Slot approval is atomic: `approve_booking` locks the `class_sessions` row and rejects at capacity.
- Indonesian UI strings and `ApiError` codes/messages are preserved verbatim from the fixtures.
- Self-checks run via `node --experimental-strip-types` and must stay framework-free.
- Next.js 16 conventions (per `node_modules/next/dist/docs/`): Route Handlers live in `route.ts` under `app/`; dynamic `params` are a `Promise` and must be awaited; request pre-processing file is **`proxy.ts`**.

## File Structure

**Server helpers (`lib/server/`, server-only):**
- `lib/server/supabase.ts` — `supabaseAdmin()` factory reading `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.
- `lib/server/auth.ts` — `signToken`, `verifyToken`, `isAdmin(req)`, `setAdminCookie`, `clearAdminCookie`, `assertAdmin`.
- `lib/server/auth.self-check.ts` — HMAC round-trip + tamper + expiry.
- `lib/server/data.ts` — typed Supabase query/mapper helpers (`getStudio`, `getSessionByToken`, `computePublicSession`, `buildApprovalRow`, approval/session/class/studio reads, `createBookingRow`, `createSessionRow`, `createClassRow`, `updateClassRow`, `updateStudioRow`, `dashboardMetrics`, `sessionsCountByClass`).
- `lib/server/storage.ts` — `uploadProof`, `proofSignedUrl`.
- `lib/server/notify.ts` — `notifyBookingConfirmed` (Resend + WA log), `BookingNotifyResult`.
- `lib/http.ts` — shared `apiGet`/`apiSend` fetch wrappers plus server `jsonOk`/`handleApiError`; contains no service credentials. Admin routes validate inline (presence/type checks) — that inline check is the trust boundary; no separate Zod module.

**Adapters (rewritten, signatures preserved):**
- `lib/api/public.ts` — `getSessionByToken`, `createBooking` → `apiGet`/`apiSend` to `/api/public/...`.
- `lib/api/admin.ts` — all exported functions/types → `apiGet`/`apiSend` to `/api/admin/...`.

**Route handlers:**
- `app/api/public/session/[magic_token]/route.ts` — GET.
- `app/api/public/booking/route.ts` — POST (multipart).
- `app/api/admin/login/route.ts` — POST.
- `app/api/admin/logout/route.ts` — POST.
- `app/api/admin/approvals/route.ts` — GET.
- `app/api/admin/approvals/[booking_id]/route.ts` — GET, PATCH.
- `app/api/admin/proof/[booking_id]/route.ts` — GET (302 to signed URL).
- `app/api/admin/sessions/route.ts` — GET (range), POST.
- `app/api/admin/classes/route.ts` — GET, POST.
- `app/api/admin/classes/[id]/route.ts` — PATCH.
- `app/api/admin/studio/route.ts` — GET, PATCH.
- `app/api/admin/dashboard/route.ts` — GET.

**Auth UI:**
- `app/login/page.tsx` — server page rendering `LoginForm` (root route, outside `(admin)` so the proxy gate does not self-intercept it).
- `components/admin/login-form.tsx` — client form calling `/api/admin/login`, redirect on success.
- `components/admin/topbar.tsx` — add logout button.
- `proxy.ts` — optimistic gate.

**Migrations/seed:**
- `supabase/migrations/0001_init.sql` — DDL + `approve_booking` RPC + indexes.
- `supabase/seed.sql` — studio, classes, sessions, bookings; private bucket create.

**Config:**
- `.env.example` — new keys.
- `package.json` — `check` script extended; new deps.

---

## Task 1: Dependencies, env, and HTTP helpers

**Files:**
- Modify: `package.json:10` (`check` script), `package.json:12` (`dependencies`).
- Modify: `.env.example`.
- Create: `lib/http.ts`.
- Create: `lib/http.self-check.ts`.

**Interfaces:**
- Produces: `apiGet<T>(path) => Promise<T>`; `apiSend<T>(path, init) => Promise<T>`; `jsonOk(data, init?) => Response`; `handleApiError(e) => Response`; `ApiError` (already in `lib/errors.ts`, reused).

> `apiGet` is the bodyless GET shape; `apiSend` carries mutation request options. Keeping the shapes separate prevents accidental request-body misuse.

- [ ] **Step 1: Install deps**

Run:
```bash
npm install @supabase/supabase-js@^2.45.0
```
`resend` SDK is NOT added — Resend is called via native `fetch` in Task 7. Existing deps cover the rest.

- [ ] **Step 2: Extend `.env.example`**

Append after the existing `NEXT_PUBLIC_APP_URL` line:
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_PASSWORD=
AUTH_SECRET=
AUTH_COOKIE_NAME=bookelas_admin
AUTH_MAX_AGE_SECONDS=43200
RESEND_API_KEY=
EMAIL_FROM=
```

- [ ] **Step 3: Write `lib/http.ts`**

```ts
import { ApiError, isApiError } from "@/lib/errors";

export function jsonOk<T>(data: T, init?: ResponseInit): Response {
  return Response.json(data, init);
}

export function handleApiError(e: unknown): Response {
  if (isApiError(e)) return Response.json({ message: e.message, code: e.code }, { status: e.status });
  return Response.json({ message: "Terjadi kesalahan server", code: "INTERNAL" }, { status: 500 });
}

/**
 * Browser-side fetch helpers used by lib/api/*. Server Components do not import
 * these (they query lib/server/data.ts directly). Runtime-agnostic on the
 * client because `NEXT_PUBLIC_APP_URL` is public.
 * ponytail: two call shapes (GET vs mutation), no per-endpoint client class.
 */
function baseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const url = path.startsWith("http") ? path : `${baseUrl()}${path}`;
  const res = await fetch(url, { ...init, headers: { ...init?.headers } });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message = (body && typeof body === "object" && "message" in body ? String((body as Record<string, unknown>).message) : undefined) ?? "Permintaan gagal";
    const code = (body && typeof body === "object" && "code" in body ? String((body as Record<string, unknown>).code) : undefined) ?? "API_ERROR";
    throw new ApiError(res.status, message, code);
  }
  return body as T;
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path, { method: "GET" });
}

export function apiSend<T>(path: string, init: RequestInit): Promise<T> {
  return request<T>(path, init);
}
```

- [ ] **Step 4: Write `lib/http.self-check.ts`**

The check is unit-only — no network. It verifies `jsonOk`/`handleApiError` shapes. (`apiGet`/`apiSend` are thin fetch wrappers; exercising them needs a running server, so they are covered by the Task 11 smoke test instead.)

```ts
import { ApiError } from "@/lib/errors";
import { jsonOk, handleApiError } from "@/lib/http";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

async function demo() {
  assert(jsonOk({ a: 1 }).status === 200, "jsonOk defaults to 200");
  assert((await handleApiError(new ApiError(404, "x", "NOT_FOUND")).json()).code === "NOT_FOUND", "handleApiError maps code");
  assert((await handleApiError(new Error("boom")).json()).code === "INTERNAL", "handleApiError fallback INTERNAL");
  console.log("http.self-check: OK");
}

demo().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 5: Extend `package.json` check script**

In `package.json`, change the `check` line to:
```
"check": "node --experimental-strip-types lib/booking.self-check.ts && node --experimental-strip-types lib/validation/booking.self-check.ts && node --experimental-strip-types lib/calendar.self-check.ts && node --experimental-strip-types lib/http.self-check.ts"
```

- [ ] **Step 6: Run check**

Run: `npm run check`
Expected: all four self-checks print OK, exit 0.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json .env.example lib/http.ts lib/http.self-check.ts
git commit -m "feat(backend): add deps, env keys, and http helpers"
```

---

## Task 2: Supabase schema, `approve_booking` RPC, and seed

**Files:**
- Create: `supabase/migrations/0001_init.sql`.
- Create: `supabase/seed.sql`.

**Interfaces:**
- Produces (SQL): tables `studios`, `classes`, `class_sessions`, `bookings`; function `approve_booking(uuid) returns bookings`; index `idx_sessions_magic_token`, `idx_bookings_session_status`; private bucket `payment-proofs`; one studio, two classes, two sessions, seven approved bookings + one pending.

- [ ] **Step 1: Write `supabase/migrations/0001_init.sql`**

```sql
-- 0001_init.sql — Bookelas schema + approve_booking RPC.
create extension if not exists "pgcrypto";

create table if not exists studios (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  wa_number text not null,
  bank_info text not null,
  created_at timestamptz default now()
);

create table if not exists classes (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid references studios(id) on delete cascade,
  title text not null,
  description text,
  capacity int not null default 10,
  price numeric(12, 2) not null,
  created_at timestamptz default now()
);

create table if not exists class_sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references classes(id) on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz not null,
  magic_token uuid unique default gen_random_uuid(),
  status text check (status in ('SCHEDULED', 'COMPLETED', 'CANCELLED')) default 'SCHEDULED',
  created_at timestamptz default now()
);

create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references class_sessions(id) on delete cascade,
  customer_name text not null,
  customer_wa text not null,
  customer_email text not null,
  payment_proof_url text not null,
  status text check (status in ('PENDING', 'APPROVED', 'REJECTED')) default 'PENDING',
  created_at timestamptz default now()
);

create index if not exists idx_sessions_magic_token on class_sessions(magic_token);
create index if not exists idx_bookings_session_status on bookings(session_id, status);

create or replace function approve_booking(p_booking_id uuid)
returns bookings language plpgsql as $$
declare
  b bookings%rowtype;
  s class_sessions%rowtype;
  cap int;
  approved int;
begin
  select * into b from bookings where id = p_booking_id;
  if not found then raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0002'; end if;
  if b.status <> 'PENDING' then return b; end if;

  -- Lock the SESSION row so concurrent approvals for the same session serialize.
  select * into s from class_sessions where id = b.session_id for update;

  select c.capacity into cap
    from class_sessions cs join classes c on c.id = cs.class_id
   where cs.id = b.session_id;
  select count(*) into approved
    from bookings
   where session_id = b.session_id and status = 'APPROVED';

  if approved >= cap then
    raise exception 'CLASS_FULL' using errcode = 'P0003';
  end if;

  update bookings set status = 'APPROVED' where id = p_booking_id returning * into b;
  return b;
end; $$;
```

- [ ] **Step 2: Write `supabase/seed.sql`**

`magic_token` is a `uuid`; seed fixes two well-known tokens so the README can link to stable demo sessions. Bookings below seed capacity (7 < 10) so approvals stay within limit.

```sql
-- supabase/seed.sql
insert into studios (id, name, wa_number, bank_info) values
  ('11111111-1111-1111-1111-111111111111', 'Zenith Pilates Studio', '+62 812-3456-7890', 'Bank BCA 123-456-7890 a.n. Zenith Studio')
on conflict (id) do nothing;

insert into classes (id, studio_id, title, description, capacity, price) values
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Mat Pilates — Reformer Intro', 'Sesi perkenalan ramah pemula. Fokus pada inti, pernapasan, dan pergerakan terkontrol di atas reformer.', 10, 150000),
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Power Yoga', 'Aliran dinamis yang membangun kekuatan dan fleksibilitas. Minimal 6 bulan praktik yoga sebelumnya.', 12, 120000)
on conflict (id) do nothing;

insert into class_sessions (id, class_id, start_time, end_time, magic_token, status) values
  ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', '2026-08-15 09:00:00+08', '2026-08-15 10:00:00+08', '11111111-1111-1111-1111-222222222222', 'SCHEDULED'),
  ('55555555-5555-5555-5555-555555555555', '33333333-3333-3333-3333-333333333333', '2026-08-16 16:00:00+08', '2026-08-16 17:00:00+08', '11111111-1111-1111-1111-333333333333', 'SCHEDULED')
on conflict (id) do nothing;

insert into bookings (id, session_id, customer_name, customer_wa, customer_email, payment_proof_url, status, created_at) values
  ('66666666-6666-6666-6666-000000000001', '44444444-4444-4444-4444-444444444444', 'Sarah Aruna', '+628123456789', 'sarah@example.com', 'seed/sarah.png', 'APPROVED', '2026-08-09 09:15:00+08'),
  ('66666666-6666-6666-6666-000000000002', '44444444-4444-4444-4444-444444444444', 'Dimas Putra',  '+628123456790', 'dimas@example.com', 'seed/dimas.png', 'APPROVED', '2026-08-09 10:15:00+08'),
  ('66666666-6666-6666-6666-000000000003', '44444444-4444-4444-4444-444444444444', 'Nadia Kusuma','+628123456791', 'nadia@example.com', 'seed/nadia.png', 'APPROVED', '2026-08-09 11:15:00+08'),
  ('66666666-6666-6666-6666-000000000004', '44444444-4444-4444-4444-444444444444', 'Bima Satria', '+628123456792', 'bima@example.com',  'seed/bima.png',  'APPROVED', '2026-08-09 12:15:00+08'),
  ('66666666-6666-6666-6666-000000000005', '44444444-4444-4444-4444-444444444444', 'Alya Nirmala','+628123456793', 'alya@example.com',  'seed/alya.png',  'APPROVED', '2026-08-09 13:15:00+08'),
  ('66666666-6666-6666-6666-000000000006', '44444444-4444-4444-4444-444444444444', 'Raka Hadi',   '+628123456794', 'raka@example.com',  'seed/raka.png',  'APPROVED', '2026-08-09 14:15:00+08'),
  ('66666666-6666-6666-6666-000000000007', '44444444-4444-4444-4444-444444444444', 'Maya Lestari','+628123456795', 'maya@example.com',  'seed/maya.png',  'APPROVED', '2026-08-09 15:15:00+08'),
  ('66666666-6666-6666-6666-000000000008', '55555555-5555-5555-5555-555555555555', 'Rani Dewi',   '+628123456796', 'rani@example.com',  'seed/rani.png',  'PENDING', '2026-08-10 10:15:00+08')
on conflict (id) do nothing;

-- Private bucket; uploads/reads go through the service role (server) only.
insert into storage.buckets (id, name, public) values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do nothing;
```

Note the demo magic links become `/b/11111111-1111-1111-1111-222222222222` (Reformer Intro) and `/b/11111111-1111-1111-1111-333333333333` (Power Yoga). Task 8 updates the README to match.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0001_init.sql supabase/seed.sql
git commit -m "feat(db): schema, approve_booking RPC, seed, private bucket"
```

---

## Task 3: Supabase admin client

**Files:**
- Create: `lib/server/supabase.ts`.

**Interfaces:**
- Produces: `supabaseAdmin(): SupabaseClient` (service-role, server-only).

- [ ] **Step 1: Write `lib/server/supabase.ts`**

```ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  }
  cached = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return cached;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/server/supabase.ts
git commit -m "feat(server): supabase service-role client factory"
```

---

## Task 4: Signed-cookie admin auth

**Files:**
- Create: `lib/server/auth.ts`.
- Create: `lib/server/auth.self-check.ts`.
- Create: `app/api/admin/login/route.ts`.
- Create: `app/api/admin/logout/route.ts`.

**Interfaces:**
- Consumes: `ApiError` from `lib/errors.ts`.
- Produces: `signToken()`, `verifyToken()`, `isAdmin(req)`, `assertAdmin(req)`, `setAdminCookie(res, token)`, `clearAdminCookie(res)`; POST `/api/admin/login`, POST `/api/admin/logout`.

- [ ] **Step 1: Write `lib/server/auth.ts`**

Token = `base64url(payload).base64url(hmac)`, where `payload = ${expMs}.${nonceBase64url}`. HMAC covers the **unencoded** payload with `AUTH_SECRET`; Node server code uses constant-time compare.

```ts
import type { NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { ApiError } from "@/lib/errors";

const COOKIE = process.env.AUTH_COOKIE_NAME ?? "bookelas_admin";
const MAX_AGE = Number(process.env.AUTH_MAX_AGE_SECONDS ?? 43200);

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET missing or too short (<16 chars)");
  return s;
}
function b64url(input: Buffer | string): string { return Buffer.from(input).toString("base64url"); }
function sign(payload: string): string { return createHmac("sha256", secret()).update(payload).digest("base64url"); }

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
  try { payload = Buffer.from(parts[0], "base64url").toString("utf8"); } catch { return false; }
  const expected = sign(payload);
  const a = Buffer.from(parts[1]);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  const [exp] = payload.split(".");
  const expMs = Number(exp);
  return Number.isFinite(expMs) && expMs >= Date.now() && expMs - Date.now() <= MAX_AGE * 1000 + 60_000;
}

export function isAdmin(req: NextRequest): boolean { return verifyToken(req.cookies.get(COOKIE)?.value); }
export function assertAdmin(req: NextRequest): void {
  if (!isAdmin(req)) throw new ApiError(401, "Tidak terautentikasi", "UNAUTHORIZED");
}
export const ADMIN_COOKIE = COOKIE;
export const COOKIE_MAX_AGE = MAX_AGE;

export function setAdminCookie(res: Response, token: string): void {
  res.headers.append("set-cookie", `${COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${MAX_AGE}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
}
export function clearAdminCookie(res: Response): void {
  res.headers.append("set-cookie", `${COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
}
export function timingSafeEqualString(a: string, b: string): boolean {
  const ab = Buffer.from(a); const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
```

- [ ] **Step 2: Write `lib/server/auth.self-check.ts`**

```ts
import { createHmac } from "node:crypto";
import { signToken, verifyToken, timingSafeEqualString } from "@/lib/server/auth";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

function demo() {
  process.env.AUTH_SECRET = "test-secret-at-least-16-chars!!";
  const t = signToken();
  assert(verifyToken(t), "valid token verifies");
  assert(!verifyToken(t + "x"), "tampered token rejected");
  assert(!verifyToken(undefined), "missing token rejected");
  assert(!verifyToken("a.b"), "malformed token rejected");

  // Expiry test: sign the exact payload format used by auth.ts, but with a past exp.
  const expiredPayload = `${Date.now() - 1000}.abc`;
  const expired = `${Buffer.from(expiredPayload).toString("base64url")}.${createHmac("sha256", process.env.AUTH_SECRET).update(expiredPayload).digest("base64url")}`;
  assert(!verifyToken(expired), "expired token rejected");

  assert(timingSafeEqualString("abc", "abc"), "timingSafeEqualString equal");
  assert(!timingSafeEqualString("abc", "abd"), "timingSafeEqualString not equal");
  console.log("auth.self-check: OK");
}

demo();
```

- [ ] **Step 3: Write `app/api/admin/login/route.ts`**

```ts
import { ApiError } from "@/lib/errors";
import { signToken, setAdminCookie, timingSafeEqualString } from "@/lib/server/auth";
import { handleApiError, jsonOk } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { password } = await req.json().catch(() => ({} as { password?: string }));
    const expected = process.env.ADMIN_PASSWORD;
    if (!expected) throw new ApiError(500, "ADMIN_PASSWORD belum dikonfigurasi", "ADMIN_NOT_CONFIGURED");
    if (typeof password !== "string" || password.length === 0 || !timingSafeEqualString(password, expected)) {
      throw new ApiError(401, "Kata sandi salah", "INVALID_PASSWORD");
    }
    const res = jsonOk({ ok: true });
    setAdminCookie(res, signToken());
    return res;
  } catch (e) {
    return handleApiError(e);
  }
}
```

- [ ] **Step 4: Write `app/api/admin/logout/route.ts`**

```ts
import { clearAdminCookie } from "@/lib/server/auth";
import { jsonOk } from "@/lib/http";

export const runtime = "nodejs";

export async function POST() {
  const res = jsonOk({ ok: true });
  clearAdminCookie(res);
  return res;
}
```

- [ ] **Step 5: Run auth self-check**

Run: `node --experimental-strip-types lib/server/auth.self-check.ts`
Expected: prints `auth.self-check: OK`, exit 0.

- [ ] **Step 6: Commit**

```bash
git add lib/server/auth.ts lib/server/auth.self-check.ts app/api/admin/login/route.ts app/api/admin/logout/route.ts
git commit -m "feat(auth): signed-cookie admin auth + login/logout routes"
```

---

## Task 5: Query + mapper data layer (`lib/server/data.ts`)

**Files:**
- Create: `lib/server/data.ts`.

**Interfaces:**
- Consumes: `supabaseAdmin()`; types from `lib/types.ts`; `remainingSlots` from `lib/booking.ts`; `ApiError`.
- Produces: typed helpers used by every Route Handler. Key signatures:
  - `computePublicSession(row): Promise<PublicSession>`
  - `getStudio(): Promise<Studio>`
  - `getSessionByToken(token: string): Promise<PublicSession>`
  - `getApproval(bookingId: string): Promise<ApprovalRow>`
  - `buildApprovalRow(booking): Promise<ApprovalRow>`
  - `listApprovalsDetailed(status?): Promise<ApprovalRow[]>`
  - `sessionsCountByClass(): Promise<Map<string, number>>`
  - `listClassesWithCount(): Promise<(Class & { session_count: number })[]>`
  - `createBookingRow(input): Promise<Booking>` (input = the four customer fields + `session_id` + already-uploaded `payment_proof_url`)
  - `listSessionsByDate(startISO, endISO): Promise<PublicSession[]>`
  - `createSessionRow(input): Promise<PublicSession>`
  - `createClassRow(input): Promise<Class>` / `updateClassRow(id, input): Promise<Class>`
  - `updateStudioRow(input): Promise<Studio>`
  - `dashboardMetrics(): Promise<DashboardMetrics>`
  - `approveBookingRpc(booking_id): Promise<Booking>` (maps `P0003`→409 CLASS_FULL, `P0002`→404 BOOKING_NOT_FOUND)
  - `rejectBooking(booking_id): Promise<Booking>`
- `ApprovalRow`, `CreateSessionInput`, `ClassInput`, `DashboardMetrics` are imported from `lib/api/admin.ts` (re-exported types stay there).

- [ ] **Step 1: Write `lib/server/data.ts`**

Numeric columns return as strings in some drivers; coerce. `payment_proof_url` default is the stored path (`session_id/filename`); admin preview replaces it with a signed URL.

```ts
import { supabaseAdmin } from "@/lib/server/supabase";
import { remainingSlots } from "@/lib/booking";
import { ApiError } from "@/lib/errors";
import { proofSignedUrl } from "@/lib/server/storage";
import type { Booking, BookingStatus, Class, ClassSession, PublicSession, Studio } from "@/lib/types";
import type { ApprovalRow, CreateSessionInput, ClassInput, DashboardMetrics } from "@/lib/api/admin";

type SessionRow = ClassSession;

export async function getStudio(): Promise<Studio> {
  const sb = supabaseAdmin();
  const { data, error } = await sb.from("studios").select("*").limit(1).single();
  if (error || !data) throw new ApiError(500, "Data studio tidak ditemukan", "STUDIO_NOT_FOUND");
  return data as Studio;
}

async function loadClass(session: SessionRow): Promise<Class> {
  const sb = supabaseAdmin();
  const { data, error } = await sb.from("classes").select("*").eq("id", session.class_id).single();
  if (error || !data) throw new ApiError(500, "Data sesi tidak lengkap", "SESSION_DATA_INCOMPLETE");
  return { ...(data as Class), price: Number((data as Class).price) };
}

async function approvedCount(sessionId: string): Promise<number> {
  const sb = supabaseAdmin();
  const { count, error } = await sb.from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId).eq("status", "APPROVED");
  if (error) throw new ApiError(500, "Gagal menghitung slot", "COUNT_FAILED");
  return count ?? 0;
}

export async function computePublicSession(session: SessionRow): Promise<PublicSession> {
  const [cls, studio, approved] = await Promise.all([loadClass(session), getStudio(), approvedCount(session.id)]);
  return {
    ...session,
    class: cls,
    studio,
    approved_count: approved,
    remaining_slots: remainingSlots(cls.capacity, approved),
  };
}

export async function getSessionByToken(token: string): Promise<PublicSession> {
  const sb = supabaseAdmin();
  const { data, error } = await sb.from("class_sessions").select("*").eq("magic_token", token).maybeSingle();
  if (error || !data) throw new ApiError(404, "Sesi tidak ditemukan", "SESSION_NOT_FOUND");
  return computePublicSession(data as SessionRow);
}

export async function getApproval(bookingId: string): Promise<ApprovalRow> {
  const { data, error } = await supabaseAdmin().from("bookings").select("*").eq("id", bookingId).maybeSingle();
  if (error || !data) throw new ApiError(404, "Booking tidak ditemukan", "BOOKING_NOT_FOUND");
  return buildApprovalRow(data as Booking);
}

export async function buildApprovalRow(booking: Booking): Promise<ApprovalRow> {
  const sb = supabaseAdmin();
  const { data: s, error } = await sb.from("class_sessions").select("*").eq("id", booking.session_id).maybeSingle();
  if (error || !s) throw new ApiError(500, "Sesi booking tidak ditemukan", "SESSION_DATA_INCOMPLETE");
  const session = await computePublicSession(s as SessionRow);
  const proofUrl = await proofSignedUrl(booking.payment_proof_url).catch(() => booking.payment_proof_url);
  return { ...booking, payment_proof_url: proofUrl, session };
}

export async function listApprovalsDetailed(status?: BookingStatus): Promise<ApprovalRow[]> {
  const sb = supabaseAdmin();
  let q = sb.from("bookings").select("*").order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw new ApiError(500, "Gagal memuat approvals", "QUERY_FAILED");
  return Promise.all((data as Booking[]).map(buildApprovalRow));
}

export async function sessionsCountByClass(): Promise<Map<string, number>> {
  const sb = supabaseAdmin();
  const { data, error } = await sb.from("class_sessions").select("class_id");
  if (error) throw new ApiError(500, "Gagal memuat sesi", "QUERY_FAILED");
  const m = new Map<string, number>();
  for (const r of (data ?? []) as { class_id: string }[]) m.set(r.class_id, (m.get(r.class_id) ?? 0) + 1);
  return m;
}

export async function listClassesWithCount(): Promise<(Class & { session_count: number })[]> {
  const sb = supabaseAdmin();
  const [classesRes, counts] = await Promise.all([
    sb.from("classes").select("*").order("title", { ascending: true }),
    sessionsCountByClass(),
  ]);
  if (classesRes.error) throw new ApiError(500, "Gagal memuat kelas", "QUERY_FAILED");
  return (classesRes.data as Class[]).map((c) => ({ ...c, price: Number(c.price), session_count: counts.get(c.id) ?? 0 }));
}

export async function createBookingRow(input: {
  session_id: string; customer_name: string; customer_wa: string; customer_email: string; payment_proof_url: string;
}): Promise<Booking> {
  const sb = supabaseAdmin();
  const { data, error } = await sb.from("bookings").insert({
    session_id: input.session_id, customer_name: input.customer_name, customer_wa: input.customer_wa,
    customer_email: input.customer_email, payment_proof_url: input.payment_proof_url, status: "PENDING",
  }).select().single();
  if (error) throw new ApiError(500, "Gagal membuat booking", "INSERT_FAILED");
  return data as Booking;
}

export async function listSessionsByDate(startISO: string, endISO: string): Promise<PublicSession[]> {
  const sb = supabaseAdmin();
  const { data, error } = await sb.from("class_sessions").select("*")
    .gte("start_time", startISO).lte("start_time", endISO).order("start_time", { ascending: true });
  if (error) throw new ApiError(500, "Gagal memuat kalender", "QUERY_FAILED");
  return Promise.all((data as SessionRow[]).map((s) => computePublicSession(s)));
}

export async function createSessionRow(input: CreateSessionInput): Promise<PublicSession> {
  const sb = supabaseAdmin();
  const { data: cls } = await sb.from("classes").select("id").eq("id", input.class_id).maybeSingle();
  if (!cls) throw new ApiError(404, "Kelas tidak ditemukan", "CLASS_NOT_FOUND");
  const { data, error } = await sb.from("class_sessions").insert({
    class_id: input.class_id, start_time: input.start_time, end_time: input.end_time, status: "SCHEDULED",
  }).select().single();
  if (error) throw new ApiError(500, "Gagal membuat sesi", "INSERT_FAILED");
  return computePublicSession(data as SessionRow);
}

export async function createClassRow(input: ClassInput): Promise<Class> {
  const studio = await getStudio();
  const sb = supabaseAdmin();
  const { data, error } = await sb.from("classes").insert({ ...input, studio_id: studio.id }).select().single();
  if (error) throw new ApiError(500, "Gagal membuat kelas", "INSERT_FAILED");
  return { ...(data as Class), price: Number((data as Class).price) };
}

export async function updateClassRow(id: string, input: ClassInput): Promise<Class> {
  const sb = supabaseAdmin();
  const { data, error } = await sb.from("classes").update(input).eq("id", id).select().maybeSingle();
  if (error || !data) throw new ApiError(404, "Kelas tidak ditemukan", "CLASS_NOT_FOUND");
  return { ...(data as Class), price: Number((data as Class).price) };
}

export async function updateStudioRow(input: Pick<Studio, "name" | "wa_number" | "bank_info">): Promise<Studio> {
  const studio = await getStudio();
  const sb = supabaseAdmin();
  const { data, error } = await sb.from("studios").update(input).eq("id", studio.id).select().single();
  if (error || !data) throw new ApiError(500, "Gagal menyimpan studio", "UPDATE_FAILED");
  return data as Studio;
}

export async function dashboardMetrics(): Promise<DashboardMetrics> {
  const sb = supabaseAdmin();
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Makassar", year: "numeric", month: "2-digit", day: "2-digit" });
  const isSameDay = (iso: string) => fmt.format(new Date(iso)) === fmt.format(now);

  const [pending, bookingsAll, sessionsAll, upcomingRes] = await Promise.all([
    sb.from("bookings").select("id,status,created_at", { count: "exact", head: true }).eq("status", "PENDING"),
    sb.from("bookings").select("*"),
    sb.from("class_sessions").select("*"),
    sb.from("class_sessions").select("*").eq("status", "SCHEDULED").gte("start_time", now.toISOString()).order("start_time", { ascending: true, foreignTable: undefined }).limit(1),
  ]);

  const bookings = (bookingsAll.data ?? []) as Booking[];
  const sessions = (sessionsAll.data ?? []) as SessionRow[];
  const approvedToday = bookings.filter((b) => b.status === "APPROVED" && isSameDay(b.created_at));
  const sessionsToday = sessions.filter((s) => isSameDay(s.start_time));
  const upcoming = (upcomingRes.data ?? []) as SessionRow[];
  const nextSession = upcoming[0] ? await computePublicSession(upcoming[0]) : null;
  const capacities = await Promise.all(sessions.map((s) => loadClass(s)));
  const totalCapacity = capacities.reduce((sum, c) => sum + c.capacity, 0);
  return {
    pendingCount: pending.count ?? 0,
    approvedTodayCount: approvedToday.length,
    sessionsTodayCount: sessionsToday.length,
    nextSession,
    totalCapacity,
    totalApproved: bookings.filter((b) => b.status === "APPROVED").length,
  };
}

export async function approveBookingRpc(bookingId: string): Promise<Booking> {
  const sb = supabaseAdmin();
  const { data, error } = await sb.rpc("approve_booking", { p_booking_id: bookingId });
  if (error) {
    const code = (error as { code?: string }).code;
    if (code === "P0003") throw new ApiError(409, "Kelas sudah penuh", "CLASS_FULL");
    if (code === "P0002") throw new ApiError(404, "Booking tidak ditemukan", "BOOKING_NOT_FOUND");
    throw new ApiError(500, "Gagal menyetujui booking", "APPROVE_FAILED");
  }
  return data as Booking;
}

export async function rejectBooking(bookingId: string): Promise<Booking> {
  const sb = supabaseAdmin();
  const { data, error } = await sb.from("bookings").update({ status: "REJECTED" }).eq("id", bookingId).select().maybeSingle();
  if (error || !data) throw new ApiError(404, "Booking tidak ditemukan", "BOOKING_NOT_FOUND");
  return data as Booking;
}
```

> `loadClass` is the same class-capacity lookup `computePublicSession` uses (Task 5 defines it); `totalCapacity` sums each session's class capacity.

- [ ] **Step 2: Commit**

```bash
git add lib/server/data.ts
git commit -m "feat(server): supabase query + mapper data layer"
```

---

## Task 6: Storage helpers

**Files:**
- Create: `lib/server/storage.ts`.

**Interfaces:**
- Produces: `uploadProof(sessionId, file): Promise<string>` (returns stored path `sessionId/filename`); `proofSignedUrl(path, expiresIn=900): Promise<string>`.

- [ ] **Step 1: Write `lib/server/storage.ts`**

```ts
import { ApiError } from "@/lib/errors";
import { supabaseAdmin } from "@/lib/server/supabase";

const BUCKET = "payment-proofs";

export async function uploadProof(sessionId: string, file: File): Promise<string> {
  const arrayBuf = await file.arrayBuffer();
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const path = `${sessionId}/${crypto.randomUUID()}.${ext}`;
  const contentType = file.type || "application/octet-stream";
  const sb = supabaseAdmin();
  const { error } = await sb.storage.from(BUCKET).upload(path, arrayBuf, { contentType, upsert: false });
  if (error) throw new ApiError(500, "Gagal mengunggah bukti bayar", "UPLOAD_FAILED");
  return path;
}

export async function proofSignedUrl(path: string, expiresIn = 900): Promise<string> {
  const sb = supabaseAdmin();
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) throw new ApiError(500, "Gagal membuat URL bukti bayar", "SIGNED_URL_FAILED");
  return data.signedUrl;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/server/storage.ts
git commit -m "feat(server): private proof upload + signed url helpers"
```

---

## Task 7: Notification module (Resend + WA stub)

**Files:**
- Create: `lib/server/notify.ts`.

**Interfaces:**
- Consumes: `Booking`, `PublicSession`, `Studio`.
- Produces: `notifyBookingConfirmed(booking, session): Promise<BookingNotifyResult>` where `BookingNotifyResult = { email: "sent" | "skipped" | "error"; wa: "stubbed"; warnings: string[] }`.

- [ ] **Step 1: Write `lib/server/notify.ts`**

Email via Resend HTTP API (native `fetch`, no SDK). WA logs only.

```ts
import type { Booking, PublicSession } from "@/lib/types";

export interface BookingNotifyResult {
  email: "sent" | "skipped" | "error";
  wa: "stubbed";
  warnings: string[];
}

export async function notifyBookingConfirmed(
  booking: Booking,
  session: PublicSession
): Promise<BookingNotifyResult> {
  const warnings: string[] = [];

  // WhatsApp: stubbed (provider deferred).
  console.info("[notify:wa] booking confirmed", { bookingId: booking.id, to: booking.customer_wa });

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    warnings.push("RESEND_API_KEY/EMAIL_FROM missing; email skipped");
    return { email: "skipped", wa: "stubbed", warnings };
  }

  const subject = `Konfirmasi booking — ${session.class.title}`;
  const text = `Halo ${booking.customer_name},\n\nBooking kamu untuk ${session.class.title} telah disetujui.\nWaktu: ${new Date(session.start_time).toLocaleString("id-ID", { timeZone: "Asia/Makassar" })} WITA.\n\nTerima kasih,\n${session.studio.name}`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: booking.customer_email, subject, text }),
    });
    if (!res.ok) {
      warnings.push(`Resend HTTP ${res.status}`);
      return { email: "error", wa: "stubbed", warnings };
    }
    return { email: "sent", wa: "stubbed", warnings };
  } catch (e) {
    warnings.push(e instanceof Error ? e.message : "email send failed");
    return { email: "error", wa: "stubbed", warnings };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/server/notify.ts
git commit -m "feat(notify): Resend email + WhatsApp stub"
```

---

## Task 8: Public routes + public adapter

**Files:**
- Create: `app/api/public/session/[magic_token]/route.ts`.
- Create: `app/api/public/booking/route.ts`.
- Modify (rewrite): `lib/api/public.ts`.

**Interfaces:**
- Consumes: `getSessionByToken`, `computePublicSession`, `createBookingRow` from `lib/server/data.ts`; `uploadProof` from `lib/server/storage.ts`; `bookingSchema`, `MAX_FILE_BYTES` from `lib/validation/booking.ts`; `apiGet`, `apiSend` from `lib/http.ts`.
- Produces: GET `/api/public/session/[magic_token]` → `PublicSession`; POST `/api/public/booking` (multipart) → `Booking`.

- [ ] **Step 1: Write `app/api/public/session/[magic_token]/route.ts`**

```ts
import type { NextRequest } from "next/server";
import { getSessionByToken } from "@/lib/server/data";
import { handleApiError, jsonOk } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ magic_token: string }> }) {
  try {
    const { magic_token } = await ctx.params;
    return jsonOk(await getSessionByToken(magic_token));
  } catch (e) {
    return handleApiError(e);
  }
}
```

- [ ] **Step 2: Write `app/api/public/booking/route.ts`**

Parse multipart, reuse the existing Zod schema on the four fields + `File`. Non-atomic capacity check is a UX fast-reject; the hard ceiling is `approve_booking` at approval time.

```ts
import { ApiError } from "@/lib/errors";
import { bookingSchema } from "@/lib/validation/booking";
import { computePublicSession, createBookingRow } from "@/lib/server/data";
import { uploadProof } from "@/lib/server/storage";
import { handleApiError, jsonOk } from "@/lib/http";
import { supabaseAdmin } from "@/lib/server/supabase";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const session_id = String(form.get("session_id") ?? "");
    const parsed = bookingSchema.safeParse({
      customer_name: form.get("customer_name"),
      customer_wa: form.get("customer_wa"),
      customer_email: form.get("customer_email"),
      payment_proof: form.get("payment_proof"),
    });
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Data tidak valid";
      throw new ApiError(400, msg, "VALIDATION_ERROR");
    }

    const sb = supabaseAdmin();
    const { data: session, error } = await sb.from("class_sessions").select("*").eq("id", session_id).maybeSingle();
    if (error || !session) throw new ApiError(404, "Sesi tidak ditemukan", "SESSION_NOT_FOUND");

    const pub = await computePublicSession(session);
    if (pub.remaining_slots <= 0) throw new ApiError(409, "Kelas sudah penuh", "CLASS_FULL");

    const proofUrl = await uploadProof(session_id, parsed.data.payment_proof);
    const booking = await createBookingRow({
      session_id,
      customer_name: parsed.data.customer_name,
      customer_wa: parsed.data.customer_wa,
      customer_email: parsed.data.customer_email,
      payment_proof_url: proofUrl,
    });
    return jsonOk(booking, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
```

- [ ] **Step 3: Rewrite `lib/api/public.ts`**

Signatures stay identical; only the body becomes thin `apiGet`/`apiSend` calls. `createBooking` sends multipart.

```ts
import { apiGet, apiSend } from "@/lib/http";
import type { Booking, CreateBookingInput, PublicSession } from "@/lib/types";

export async function getSessionByToken(token: string): Promise<PublicSession> {
  return apiGet<PublicSession>(`/api/public/session/${encodeURIComponent(token)}`);
}

export async function createBooking(input: CreateBookingInput): Promise<Booking> {
  const fd = new FormData();
  fd.set("session_id", input.session_id);
  fd.set("customer_name", input.customer_name);
  fd.set("customer_wa", input.customer_wa);
  fd.set("customer_email", input.customer_email);
  fd.set("payment_proof", input.payment_proof);
  return apiSend<Booking>("/api/public/booking", { method: "POST", body: fd });
}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/public/session/[magic_token]/route.ts app/api/public/booking/route.ts lib/api/public.ts
git commit -m "feat(api): public session + booking routes and adapter"
```

---

## Task 9: Admin read/write routes + admin adapter

**Files:**
- Create: `app/api/admin/approvals/route.ts`, `app/api/admin/approvals/[booking_id]/route.ts`.
- Create: `app/api/admin/proof/[booking_id]/route.ts`.
- Create: `app/api/admin/sessions/route.ts`, `app/api/admin/classes/route.ts`, `app/api/admin/classes/[id]/route.ts`.
- Create: `app/api/admin/studio/route.ts`, `app/api/admin/dashboard/route.ts`.
- Modify (rewrite): `lib/api/admin.ts`.

**Interfaces:**
- Consumes: `assertAdmin` from `lib/server/auth.ts`; data helpers from `lib/server/data.ts`; `notifyBookingConfirmed` from `lib/server/notify.ts`; `proofSignedUrl` from `lib/server/storage.ts`.
- Produces: all admin endpoints enumerated in File Structure; GET `/api/admin/approvals/[booking_id]` returns one `ApprovalRow`; `ApprovalResult = ApprovalRow & { notify: BookingNotifyResult }` returned by PATCH approvals, with the notify result also mirrored in an `x-notify-warning` response header when non-empty.

- [ ] **Step 1: Write `app/api/admin/approvals/route.ts`**

```ts
import type { NextRequest } from "next/server";
import { assertAdmin } from "@/lib/server/auth";
import { listApprovalsDetailed } from "@/lib/server/data";
import { handleApiError, jsonOk } from "@/lib/http";
import type { BookingStatus } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    assertAdmin(req);
    const status = req.nextUrl.searchParams.get("status") as BookingStatus | null;
    return jsonOk(await listApprovalsDetailed(status ?? undefined));
  } catch (e) {
    return handleApiError(e);
  }
}
```

- [ ] **Step 2: Write `app/api/admin/approvals/[booking_id]/route.ts`**

```ts
import type { NextRequest } from "next/server";
import { ApiError } from "@/lib/errors";
import { assertAdmin } from "@/lib/server/auth";
import { approveBookingRpc, buildApprovalRow, getApproval, rejectBooking } from "@/lib/server/data";
import { notifyBookingConfirmed } from "@/lib/server/notify";
import { handleApiError, jsonOk } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(req: NextRequest, ctx: { params: Promise<{ booking_id: string }> }) {
  try {
    assertAdmin(req);
    const { booking_id } = await ctx.params;
    return jsonOk(await getApproval(booking_id));
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ booking_id: string }> }) {
  try {
    assertAdmin(req);
    const { booking_id } = await ctx.params;
    const { status } = await req.json().catch(() => ({} as { status?: string }));

    let booking;
    if (status === "APPROVED") {
      booking = await approveBookingRpc(booking_id);
    } else if (status === "REJECTED") {
      booking = await rejectBooking(booking_id);
    } else {
      throw new ApiError(400, "Status tidak valid", "VALIDATION_ERROR");
    }

    const row = await buildApprovalRow(booking);
    const notify = status === "APPROVED" ? await notifyBookingConfirmed(booking, row.session) : { email: "skipped" as const, wa: "stubbed" as const, warnings: [] as string[] };
    const res = jsonOk({ ...row, notify });
    const warning = notify.warnings.join("; ");
    if (warning) res.headers.set("x-notify-warning", warning);
    return res;
  } catch (e) {
    return handleApiError(e);
  }
}
```

- [ ] **Step 3: Write `app/api/admin/proof/[booking_id]/route.ts`**

Admin-only signed-URL redirect. Reads the booking, signs its proof path, 302s.

```ts
import type { NextRequest } from "next/server";
import { ApiError } from "@/lib/errors";
import { assertAdmin } from "@/lib/server/auth";
import { proofSignedUrl } from "@/lib/server/storage";
import { handleApiError } from "@/lib/http";
import { supabaseAdmin } from "@/lib/server/supabase";

export const runtime = "nodejs";

export async function GET(req: NextRequest, ctx: { params: Promise<{ booking_id: string }> }) {
  try {
    assertAdmin(req);
    const { booking_id } = await ctx.params;
    const { data, error } = await supabaseAdmin().from("bookings").select("payment_proof_url").eq("id", booking_id).maybeSingle();
    if (error || !data) throw new ApiError(404, "Booking tidak ditemukan", "BOOKING_NOT_FOUND");
    const url = await proofSignedUrl(data.payment_proof_url);
    return Response.redirect(url, 302);
  } catch (e) {
    return handleApiError(e);
  }
}
```

- [ ] **Step 4: Write `app/api/admin/sessions/route.ts`**

```ts
import type { NextRequest } from "next/server";
import { ApiError } from "@/lib/errors";
import { assertAdmin } from "@/lib/server/auth";
import { createSessionRow, listSessionsByDate } from "@/lib/server/data";
import { handleApiError, jsonOk } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    assertAdmin(req);
    const start = req.nextUrl.searchParams.get("start_date");
    const end = req.nextUrl.searchParams.get("end_date");
    if (!start || !end) throw new ApiError(400, "start_date dan end_date wajib", "VALIDATION_ERROR");
    return jsonOk(await listSessionsByDate(start, end));
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    assertAdmin(req);
    const body = await req.json().catch(() => ({}));
    if (!body?.class_id || !body?.start_time || !body?.end_time) {
      throw new ApiError(400, "class_id, start_time, end_time wajib", "VALIDATION_ERROR");
    }
    return jsonOk(await createSessionRow(body), { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
```

- [ ] **Step 5: Write `app/api/admin/classes/route.ts`**

```ts
import type { NextRequest } from "next/server";
import { ApiError } from "@/lib/errors";
import { assertAdmin } from "@/lib/server/auth";
import { createClassRow, listClassesWithCount } from "@/lib/server/data";
import { handleApiError, jsonOk } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    assertAdmin(req);
    return jsonOk(await listClassesWithCount());
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    assertAdmin(req);
    const body = await req.json().catch(() => ({}));
    if (!body?.title || typeof body?.capacity !== "number" || typeof body?.price !== "number") {
      throw new ApiError(400, "title, capacity, price wajib", "VALIDATION_ERROR");
    }
    return jsonOk(await createClassRow(body), { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
```

- [ ] **Step 6: Write `app/api/admin/classes/[id]/route.ts`**

```ts
import type { NextRequest } from "next/server";
import { ApiError } from "@/lib/errors";
import { assertAdmin } from "@/lib/server/auth";
import { updateClassRow } from "@/lib/server/data";
import { handleApiError, jsonOk } from "@/lib/http";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    assertAdmin(req);
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    return jsonOk(await updateClassRow(id, body));
  } catch (e) {
    return handleApiError(e);
  }
}
```

- [ ] **Step 7: Write `app/api/admin/studio/route.ts`**

```ts
import type { NextRequest } from "next/server";
import { assertAdmin } from "@/lib/server/auth";
import { getStudio, updateStudioRow } from "@/lib/server/data";
import { handleApiError, jsonOk } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    assertAdmin(req);
    return jsonOk(await getStudio());
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    assertAdmin(req);
    const body = await req.json().catch(() => ({}));
    return jsonOk(await updateStudioRow(body));
  } catch (e) {
    return handleApiError(e);
  }
}
```

- [ ] **Step 8: Write `app/api/admin/dashboard/route.ts`**

```ts
import type { NextRequest } from "next/server";
import { assertAdmin } from "@/lib/server/auth";
import { dashboardMetrics } from "@/lib/server/data";
import { handleApiError, jsonOk } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    assertAdmin(req);
    return jsonOk(await dashboardMetrics());
  } catch (e) {
    return handleApiError(e);
  }
}
```

- [ ] **Step 9: Rewrite `lib/api/admin.ts`**

Keep ALL exported names/types. `listClasses` returns `Class & { session_count: number }`; callers reading `session_count` (Task 10 fix) keep working. `sessionCountForClass` becomes a property read on a class row already in the list.

```ts
import { apiGet, apiSend } from "@/lib/http";
import type { Booking, BookingStatus, Class, ClassSession, PublicSession, SessionStatus, Studio } from "@/lib/types";

export interface ApprovalRow extends Booking { session: PublicSession; }
export interface CreateSessionInput { class_id: string; start_time: string; end_time: string; }
export interface ClassInput { title: string; description: string; capacity: number; price: number; }
export interface DashboardMetrics {
  pendingCount: number; approvedTodayCount: number; sessionsTodayCount: number;
  nextSession: PublicSession | null; totalCapacity: number; totalApproved: number;
}
export interface BookingNotifyResult { email: "sent" | "skipped" | "error"; wa: "stubbed"; warnings: string[]; }
export type ApprovalResult = ApprovalRow & { notify: BookingNotifyResult };

export type ClassWithCount = Class & { session_count: number };

export async function listApprovals(status?: BookingStatus): Promise<Booking[]> {
  return apiGet<ApprovalRow[]>(`/api/admin/approvals${status ? `?status=${status}` : ""}`);
}
export async function listApprovalsDetailed(status?: BookingStatus): Promise<ApprovalRow[]> {
  return apiGet<ApprovalRow[]>(`/api/admin/approvals${status ? `?status=${status}` : ""}`);
}
export async function getBooking(id: string): Promise<ApprovalRow> {
  return apiGet<ApprovalRow>(`/api/admin/approvals/${id}`);
}
export async function patchApproval(id: string, status: Exclude<BookingStatus, "PENDING">): Promise<ApprovalResult> {
  return apiSend<ApprovalResult>(`/api/admin/approvals/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
}
export async function listSessionsByDate(startISO: string, endISO: string): Promise<PublicSession[]> {
  return apiGet<PublicSession[]>(`/api/admin/sessions?start_date=${encodeURIComponent(startISO)}&end_date=${encodeURIComponent(endISO)}`);
}
export async function createSession(input: CreateSessionInput): Promise<PublicSession> {
  return apiSend<PublicSession>("/api/admin/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
}
export async function listClasses(): Promise<ClassWithCount[]> {
  return apiGet<ClassWithCount[]>("/api/admin/classes");
}
export async function createClass(input: ClassInput): Promise<Class> {
  return apiSend<Class>("/api/admin/classes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
}
export async function updateClass(id: string, input: ClassInput): Promise<Class> {
  return apiSend<Class>(`/api/admin/classes/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
}
export async function getStudio(): Promise<Studio> {
  return apiGet<Studio>("/api/admin/studio");
}
export async function updateStudio(input: Pick<Studio, "name" | "wa_number" | "bank_info">): Promise<Studio> {
  return apiSend<Studio>("/api/admin/studio", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
}
export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  return apiGet<DashboardMetrics>("/api/admin/dashboard");
}
export type { SessionStatus };
```

Note: `sessionCountForClass` is intentionally removed (Task 10 replaces its only caller). `listApprovals`/`getBooking` are retained for API completeness but unused by current pages.

- [ ] **Step 10: Commit**

```bash
git add app/api/admin lib/api/admin.ts
git commit -m "feat(api): admin routes + adapter (approvals, proof, sessions, classes, studio, dashboard)"
```

---

## Task 10: Proxy gate + admin login UI + topbar logout + classes page fix

**Files:**
- Create: `proxy.ts`.
- Create: `app/login/page.tsx`, `components/admin/login-form.tsx`.
- Modify: `components/admin/topbar.tsx` (add logout button).
- Modify: `app/(admin)/classes/page.tsx` (use `c.session_count`, drop `sessionCountForClass`).

**Interfaces:**
- Consumes: the shared cookie name, secret, max-age, and two-part token contract defined in `lib/server/auth.ts`; the Edge-safe HMAC verifier is duplicated locally because `node:crypto` cannot run in `proxy.ts`.

- [ ] **Step 1: Write `proxy.ts`**

Matcher entries cover only the admin API and the five existing admin page paths; public `/`, `/b/...`, `/api/public/...`, and `/login` never enter the proxy. The `/api/admin/:path*` matcher also sees login/logout, so the function explicitly lets those two public auth endpoints through. Proxy runs on the **Edge runtime**, which has no `node:crypto` — so the verifier is rewritten against the Web Crypto `SubtleCrypto` API and the cookie token format is changed to make the HMAC payload a fixed-length byte string:

- **Token format change:** the cookie stores `payloadBase64url.hmacBase64url` (exactly two parts), where the decoded payload is the UTF-8 string `${expMs}.${nonceBase64url}`. The Proxy and `lib/server/auth.ts` MUST use this exact format.

Because `crypto.subtle` is async, `proxy` becomes `async`. Edge-safe base64url helpers use `atob`/`btoa`, not Node `Buffer`.

```ts
import { NextResponse, type NextRequest } from "next/server";

const COOKIE = process.env.AUTH_COOKIE_NAME ?? "bookelas_admin";
const MAX_AGE = Number(process.env.AUTH_MAX_AGE_SECONDS ?? 43200);

function toB64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s: string): Uint8Array {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - s.length % 4) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}
async function hmac(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(process.env.AUTH_SECRET ?? ""),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  return toB64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload))));
}

export async function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  if (pathname === "/api/admin/login" || pathname === "/api/admin/logout") return NextResponse.next();

  const token = req.cookies.get(COOKIE)?.value;
  if (!token) return redirectToLogin(req);
  const [payload64, mac] = token.split(".");
  if (!payload64 || !mac) return redirectToLogin(req);
  let payload: string;
  try { payload = new TextDecoder().decode(fromB64url(payload64)); } catch { return redirectToLogin(req); }
  const [expStr] = payload.split(".");
  const expMs = Number(expStr);
  if (!Number.isFinite(expMs) || expMs < Date.now() || expMs - Date.now() > MAX_AGE * 1000 + 60_000) return redirectToLogin(req);
  if (await hmac(payload) !== mac) return redirectToLogin(req);
  return NextResponse.next();
}

function redirectToLogin(req: NextRequest) {
  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/approvals/:path*",
    "/calendar/:path*",
    "/classes/:path*",
    "/settings/:path*",
    "/api/admin/:path*",
  ],
};
``` 

Only the listed admin page paths and `/api/admin/:path*` are matched. Public customer pages and the root route remain outside the proxy by construction.

- [ ] **Step 2: Write `app/login/page.tsx`**

```tsx
import { LoginForm } from "@/components/admin/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <header className="space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-cypress">Studio Admin</p>
          <h1 className="font-display text-4xl tracking-tight">Masuk</h1>
        </header>
        <LoginForm />
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Write `components/admin/login-form.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiMessage } from "@/lib/errors";
import { Field } from "@/components/ui/field";

export function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw Object.assign(new Error(body?.message ?? "Gagal masuk"), { status: res.status, code: body?.code });
      }
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      toast.error(apiMessage(err, "Gagal masuk"));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field id="password" label="Kata sandi">
        <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="ui-input" autoFocus />
      </Field>
      <button type="submit" disabled={busy || !password} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-cypress px-5 py-3 text-sm font-semibold text-paper hover:bg-cypress/90 disabled:opacity-50">
        {busy ? <Loader2 className="size-4 animate-spin" /> : null}Masuk
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Modify `components/admin/topbar.tsx`** — add a logout button

Add a server logout call. Replace the avatar block (`<span className="flex size-9 ...">A</span>`) with the avatar plus a small logout button:

```tsx
import { LogOut } from "lucide-react";

// inside the component, after the avatar <span>:
<button
  type="button"
  aria-label="Keluar"
  onClick={async () => { await fetch("/api/admin/logout", { method: "POST" }); window.location.href = "/login"; }}
  className="rounded-lg p-2 text-ink/60 hover:bg-ink/5 hover:text-ink"
>
  <LogOut className="size-5" />
</button>
```

Keep the existing markup; only insert the button after the avatar span. Make the component read `"use client";` if not already (it currently is not — add `"use client";` as the first line).

- [ ] **Step 5: Modify `app/(admin)/classes/page.tsx`**

Change the import to drop `sessionCountForClass` and read the count off the class row:

Replace:
```tsx
import { listClasses, sessionCountForClass, type ClassInput } from "@/lib/api/admin";
```
with:
```tsx
import { listClasses, type ClassInput } from "@/lib/api/admin";
```
Replace:
```tsx
<td className="px-5 py-4 font-medium tabular text-ink/60">{sessionCountForClass(c.id)}</td>
```
with:
```tsx
<td className="px-5 py-4 font-medium tabular text-ink/60">{c.session_count}</td>
```

- [ ] **Step 6: Run lint + check**

Run: `npm run lint`
Expected: no errors. Run: `npm run check`
Expected: all self-checks pass.

- [ ] **Step 7: Commit**

```bash
git add proxy.ts app/login components/admin/login-form.tsx components/admin/topbar.tsx app/(admin)/classes/page.tsx
git commit -m "feat(auth): proxy gate, login UI, logout, classes session_count"
```

---

## Task 11: Apply migration, seed, and end-to-end verification

**Files:**
- Modify: `README.md` (update demo magic links to the new UUID tokens).

This task is a manual verification gate; it produces no new source files except the README edit. Use the Supabase MCP / Dashboard or `psql` against the project DB.

- [ ] **Step 1: Apply migration + seed to Supabase**

Run the SQL in `supabase/migrations/0001_init.sql` then `supabase/seed.sql` against the project database (Supabase Dashboard → SQL Editor, or `psql "$DATABASE_URL" -f ...`). Confirm no errors.

- [ ] **Step 2: Configure local `.env`**

Copy `.env.example` to `.env` and fill: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (from Supabase Dashboard → Project Settings → API), `ADMIN_PASSWORD`, `AUTH_SECRET` (≥16 random chars), `RESEND_API_KEY`, `EMAIL_FROM`. Set `NEXT_PUBLIC_APP_URL=http://localhost:3000`.

- [ ] **Step 3: Start dev server**

Run: `npm run dev`
Open `http://localhost:3000/dashboard` → should redirect to `/login`.

- [ ] **Step 4: Smoke public booking**

Open `http://localhost:3000/b/11111111-1111-1111-1111-222222222222` (Reformer Intro). Verify: session summary shows, remaining slots = `10 - 7 = 3`, bank info shown. Submit a booking with a small image. Verify: success screen, pending booking appears in admin Approvals, proof thumbnail loads in the approval dialog via signed URL.

- [ ] **Step 5: Smoke approval + email**

In `/approvals`, approve the new booking. Verify: toast "Booking disetujui", row leaves the pending list, dashboard counts update. If `RESEND_API_KEY` set, confirm Resend API returns 200 (check the `x-notify-warning` header is absent). If unset, confirm approval still succeeds and `x-notify-warning` carries the skip message.

- [ ] **Step 6: Smoke oversell guard**

Temporarily set the demo Reformer class capacity to 7 in the DB (matching 7 approved seed bookings), then create + approve an 8th booking via the API — expect HTTP 409 `CLASS_FULL`. Restore capacity to 10 afterward.

- [ ] **Step 7: Update README demo links**

In `README.md:43-44`, replace:
```
- `/b/demo-token` — Mat Pilates Reformer Intro (7/10 approved)
- `/b/power-yoga-demo` — Power Yoga (has a pending booking)
```
with:
```
- `/b/11111111-1111-1111-1111-222222222222` — Mat Pilates Reformer Intro (7/10 approved)
- `/b/11111111-1111-1111-1111-333333333333` — Power Yoga (has a pending booking)
```
Also update `README.md:17` demo link accordingly.

- [ ] **Step 8: Final lint + check + build**

Run: `npm run lint && npm run check && npm run build`
Expected: all green.

- [ ] **Step 9: Commit**

```bash
git add README.md
git commit -m "docs: update demo magic links for seeded UUID tokens"
```

---

## Self-Review Notes (resolved during authoring)

- **Spec coverage:** schema+RPC (T2), server client (T3), admin auth cookie (T4), data layer (T5), storage (T6), notify (T7), public endpoints (T8), admin endpoints (T9), proxy+login UI (T10), verify (T11). Every adapter function in `lib/api/{public,admin}.ts` has a backing route. Tahap 4 notifications covered (Resend active, WA stub). Tahap 5 cron intentionally absent.
- **`sessionCountForClass` (sync):** removed; only caller (`classes/page.tsx`) reads `session_count` from the list response.
- **Next 16 conventions:** `proxy.ts`; Route Handler `params` awaited; `runtime = "nodejs"` on every handler.
- **Auth security:** constant-time HMAC compare; cookie httpOnly + SameSite=Lax + Secure in prod; login uses `timingSafeEqualString` to avoid password-comparison timing leaks.
- **RPC lock correctness:** `approve_booking` locks the session row (not the booking row) so sibling approvals serialize.

### Deferred (do NOT add now)

- Tahap 5 cron reminder; real WhatsApp provider; RLS + browser Supabase client; payment-proof virus scanning; rate limiting on `/api/public/booking`.
