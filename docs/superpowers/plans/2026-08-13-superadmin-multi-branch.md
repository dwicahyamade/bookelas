# Superadmin + Multi-Branch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a two-tier role system (superadmin/admin) and multi-branch isolation to Bookelas booking, so each admin manages one branch and a superadmin manages all branches, users, and settings.

**Architecture:** Branch is derived from the data relation (`studios` → `branches` → `classes` → `class_sessions` → `bookings`). Only `classes` gains a `branch_id` column; sessions and bookings inherit branch by join. Auth moves from a single env password to username+password with superadmin-from-env and admins-from-DB. Authorization is enforced server-side via guards (`assertSuperadmin`, `assertAdmin`, `assertBranchAccess`); client `branch_id` is never trusted.

**Tech Stack:** Next.js 16 (Server Actions), React 19, Supabase (Postgres + service-role), TanStack Query, Zod, Tailwind, ponytail self-checks (node --experimental-strip-types), scrypt for password hashing.

**Spec:** `docs/superpowers/specs/2026-08-13-superadmin-multi-branch-design.md`

## Global Constraints

- Indonesian UI copy (match existing pages: "Masuk Admin", "Kelas baru", etc.).
- Self-checks run via `node --experimental-strip-types`; add new ones to the `check` script in `package.json`.
- No new npm dependencies. Use Node `crypto` scrypt (already in stdlib) for password hashing.
- Auth cookie stays `httpOnly`, `sameSite=lax`, `secure` in production.
- Timezone `Asia/Makassar` (WITA) for date math (existing convention in `lib/calendar.ts`).
- `branch_id` from client is never a source of authority — always re-derived from session or DB.
- Superadmin env vars: `SUPERADMIN_USERNAME`, `SUPERADMIN_PASSWORD`. Remove `ADMIN_PASSWORD` in migration task.
- `class_sessions` and `bookings` get NO `branch_id` column — branch is always derived.
- Migration is single-transaction, big-bang, with maintenance window. No dual-write.

---

## File Structure

**Create:**
- `supabase/migrations/0003_branches_and_admins.sql` — schema: `branches`, `admin_users`, `classes.branch_id`.
- `lib/server/password.ts` — scrypt hash/verify (stdlib only).
- `lib/server/password.self-check.ts` — hash/verify self-check.
- `lib/server/session.ts` — session claims type + `getCurrentUser()` + cookie sign/verify with payload.
- `lib/server/authz.ts` — `assertSuperadmin`, `assertAdmin`, `assertBranchAccess`, `requireBranchFilter`.
- `lib/server/authz.self-check.ts` — branch access self-check.
- `lib/server/branches.ts` — branch CRUD data layer.
- `lib/server/admin-users.ts` — admin user CRUD data layer.
- `lib/api/admin-users.ts` — Server Actions: superadmin manages admins.
- `lib/api/branches.ts` — Server Actions: superadmin manages branches.
- `lib/validation/admin.ts` — zod schemas for admin user + branch input.
- `lib/validation/admin.self-check.ts` — validation self-check.
- `app/(admin)/admins/page.tsx` — admin user management UI.
- `app/(admin)/branches/page.tsx` — branch management UI.
- `components/admin/admin-dialog.tsx` — create/edit admin dialog.
- `components/admin/branch-dialog.tsx` — create/edit branch dialog.
- `components/admin/branch-picker.tsx` — client-side branch filter for superadmin.

**Modify:**
- `lib/server/auth-token.ts` — token carries JSON claims (user_id, username, role, branch_id, exp), signed HMAC.
- `lib/server/auth.ts` — `login(username, password)`, `getCurrentUser()`, deprecate `isAdmin()` boolean in favor of user object.
- `lib/server/auth.self-check.ts` — add role/branch_id claim cases.
- `lib/server/data.ts` — branch-aware queries (filter by branch set), `createClassRow` takes `branch_id`.
- `lib/api/admin.ts` — use new guards + branch filters; `createClass` derives `branch_id` from session admin.
- `lib/api/auth.ts` — `login(username, password)` signature.
- `lib/api/public.ts` — reject bookings when branch inactive.
- `lib/types.ts` — add `Branch`, `AdminUser`, `UserRole`; update `Class`.
- `lib/api/types.ts` — add `Branch`, `AdminUser` related types.
- `app/login/page.tsx` — username + password form copy.
- `components/admin/login-form.tsx` — username field.
- `app/(admin)/layout.tsx` — pass user to shell for role-based nav.
- `components/admin/sidebar.tsx` — show Admins/Branches nav for superadmin only; show branch name for admin.
- `components/admin/admin-shell.tsx` — receive user; render branch context.
- `components/admin/topbar.tsx` — show username/role.
- `package.json` — add new self-checks to `check` script.
- `.env.example` (if present) or README — document new env vars.

---

## Task 1: Password hashing module (scrypt)

**Files:**
- Create: `lib/server/password.ts`
- Create: `lib/server/password.self-check.ts`
- Modify: `package.json:11` (add self-check to `check` script)

**Interfaces:**
- Produces: `hashPassword(plain: string): string` (returns `scrypt$<saltHex>$<hashHex>`), `verifyPassword(plain: string, stored: string): boolean`.

- [ ] **Step 1: Write failing self-check**

`lib/server/password.self-check.ts`:

```ts
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "./password.ts";

function demo() {
  const hash = hashPassword("rahasia123");
  assert.ok(hash.startsWith("scrypt$"), "hash format");
  assert.ok(hash.split("$").length === 3, "hash has salt + hash");
  assert.equal(verifyPassword("rahasia123", hash), true, "correct password verifies");
  assert.equal(verifyPassword("salah", hash), false, "wrong password rejected");
  assert.equal(verifyPassword("rahasia123", "garbage"), false, "malformed stored rejected");
  // Different salts → different hashes for same password
  const hash2 = hashPassword("rahasia123");
  assert.notEqual(hash, hash2, "salt randomizes hash");
  console.log("password.self-check: OK");
}

demo();
```

- [ ] **Step 2: Run to verify failure**

Run: `node --experimental-strip-types lib/server/password.self-check.ts`
Expected: FAIL — module not found / functions undefined.

- [ ] **Step 3: Implement**

`lib/server/password.ts`:

```ts
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LEN = 64;
const SALT_LEN = 16;

export function hashPassword(plain: string): string {
  const salt = randomBytes(SALT_LEN);
  const hash = scryptSync(plain, salt, KEY_LEN);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = Buffer.from(parts[1], "hex");
  const expected = Buffer.from(parts[2], "hex");
  if (salt.length !== SALT_LEN || expected.length !== KEY_LEN) return false;
  const hash = scryptSync(plain, salt, KEY_LEN);
  return timingSafeEqual(hash, expected);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --experimental-strip-types lib/server/password.self-check.ts`
Expected: `password.self-check: OK`

- [ ] **Step 5: Wire into check script**

In `package.json`, update the `check` script (line 11) to prepend the new self-check:

```json
"check": "node --experimental-strip-types lib/booking.self-check.ts && node --experimental-strip-types lib/validation/booking.self-check.ts && node --experimental-strip-types lib/calendar.self-check.ts && node --experimental-strip-types lib/server/auth.self-check.ts && node --experimental-strip-types lib/server/password.self-check.ts"
```

Run: `npm run check`
Expected: all self-checks print OK.

- [ ] **Step 6: Commit**

```bash
git add lib/server/password.ts lib/server/password.self-check.ts package.json
git commit -m "feat(auth): scrypt password hashing with self-check"
```

---

## Task 2: Session token with claims

**Files:**
- Modify: `lib/server/auth-token.ts`
- Modify: `lib/server/auth.self-check.ts`

**Interfaces:**
- Produces: `signToken(claims: SessionClaims): string`, `verifyToken(token): SessionClaims | null`.
- `SessionClaims = { user_id: string; username: string; role: "superadmin" | "admin"; branch_id: string | null; exp: number }`.

- [ ] **Step 1: Write failing self-check additions**

Replace `lib/server/auth.self-check.ts` contents:

```ts
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { signToken, verifyToken, timingSafeEqualString, type SessionClaims } from "./auth-token.ts";

function demo() {
  process.env.AUTH_SECRET = "test-secret-at-least-16-chars!!";
  process.env.AUTH_MAX_AGE_SECONDS = "43200";

  const adminClaims: SessionClaims = {
    user_id: "u1", username: "kasir", role: "admin", branch_id: "b1", exp: Date.now() + 3600_000,
  };
  const superClaims: SessionClaims = {
    user_id: "s1", username: "superadmin", role: "superadmin", branch_id: null, exp: Date.now() + 3600_000,
  };

  const ta = signToken(adminClaims);
  const parsed = verifyToken(ta);
  assert.ok(parsed, "admin token parses");
  assert.equal(parsed!.role, "admin", "role admin");
  assert.equal(parsed!.branch_id, "b1", "branch_id preserved");
  assert.equal(parsed!.username, "kasir", "username preserved");

  const ts = signToken(superClaims);
  const ps = verifyToken(ts);
  assert.equal(ps!.role, "superadmin", "role superadmin");
  assert.equal(ps!.branch_id, null, "superadmin branch null");

  assert.equal(verifyToken(ts + "x"), false, "tampered rejected");
  assert.equal(verifyToken(undefined), false, "missing rejected");
  assert.equal(verifyToken("a.b"), false, "malformed rejected");

  const expired: SessionClaims = { ...adminClaims, exp: Date.now() - 1000 };
  const expiredToken = signToken(expired);
  assert.equal(verifyToken(expiredToken), false, "expired rejected");

  assert.equal(timingSafeEqualString("abc", "abc"), true, "timingSafe equal");
  assert.equal(timingSafeEqualString("abc", "abd"), false, "timingSafe not equal");
  console.log("auth.self-check: OK");
}

demo();
```

- [ ] **Step 2: Run to verify failure**

Run: `node --experimental-strip-types lib/server/auth.self-check.ts`
Expected: FAIL — `signToken` does not accept claims; `verifyToken` returns boolean.

- [ ] **Step 3: Implement**

Replace `lib/server/auth-token.ts` contents:

```ts
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
  const a = Buffer.from(parts[1]);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  let claims: SessionClaims;
  try {
    claims = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!claims || typeof claims.exp !== "number") return null;
  // ponytail: 60s grace window absorbs clock drift between sign/verify
  return claims.exp >= Date.now() && claims.exp - Date.now() <= MAX_AGE * 1000 + 60_000 ? claims : null;
}

export function timingSafeEqualString(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export const COOKIE_MAX_AGE = MAX_AGE;
```

- [ ] **Step 4: Run to verify pass**

Run: `node --experimental-strip-types lib/server/auth.self-check.ts`
Expected: `auth.self-check: OK`

- [ ] **Step 5: Commit**

```bash
git add lib/server/auth-token.ts lib/server/auth.self-check.ts
git commit -m "feat(auth): session token carries role + branch claims"
```

---

## Task 3: Database migration — branches, admin_users, classes.branch_id

**Files:**
- Create: `supabase/migrations/0003_branches_and_admins.sql`

**Interfaces:**
- Produces: tables `branches(id, name, slug, is_active, created_at, updated_at)`, `admin_users(id, username, password_hash, branch_id, is_active, created_at, updated_at)`; `classes.branch_id` replaces `classes.studio_id`.

- [ ] **Step 1: Write migration**

`supabase/migrations/0003_branches_and_admins.sql`:

```sql
-- 0003_branches_and_admins.sql — multi-branch + admin users.
begin;

create table if not exists branches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists branches_slug_key on branches(slug);

create table if not exists admin_users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  branch_id uuid not null references branches(id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists admin_users_username_key on admin_users(lower(username));

-- Seed Main Branch and backfill classes.branch_id before making NOT NULL.
insert into branches (name, slug)
select 'Main Branch', 'main'
where not exists (select 1 from branches where slug = 'main');

-- Drop old studio_id FK + column, add branch_id.
alter table classes drop constraint if exists classes_studio_id_fkey;

alter table classes add column if not exists branch_id uuid references branches(id) on delete restrict;

update classes
   set branch_id = (select id from branches where slug = 'main')
 where branch_id is null;

alter table classes alter column branch_id set not null;

-- updated_at touch function (idempotent).
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists trg_branches_updated on branches;
create trigger trg_branches_updated before update on branches
  for each row execute function set_updated_at();

drop trigger if exists trg_admin_users_updated on admin_users;
create trigger trg_admin_users_updated before update on admin_users
  for each row execute function set_updated_at();

-- Enforce branch activity on new bookings/sessions via trigger guard.
create or replace function assert_branch_active()
returns trigger language plpgsql as $$
declare
  b_active boolean;
begin
  select br.is_active into b_active
    from classes c join branches br on br.id = c.branch_id
   where c.id = new.class_id;
  if not coalesce(b_active, false) then
    raise exception 'BRANCH_INACTIVE' using errcode = 'P0003';
  end if;
  return new;
end; $$;

drop trigger if exists trg_session_branch_active on class_sessions;
create trigger trg_session_branch_active before insert on class_sessions
  for each row execute function assert_branch_active();

-- updateStudioRow no longer touches studio_id on classes; column dropped at end.
alter table classes drop column if exists studio_id;

commit;
```

- [ ] **Step 2: Apply migration**

Run against dev DB. With Supabase CLI local stack:

```bash
supabase db reset
```

Or via MCP `apply_migration` in execution. Verify no errors.

- [ ] **Step 3: Verify schema**

```bash
supabase status || echo "verify via MCP list_tables instead"
```

Confirm: `branches` row `Main Branch` exists; `classes.branch_id` NOT NULL; `classes.studio_id` gone; `admin_users` table exists.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0003_branches_and_admins.sql
git commit -m "feat(db): branches, admin_users, classes.branch_id migration"
```

---

## Task 4: Types — Branch, AdminUser, UserRole, Class.branch_id

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/api/types.ts`

**Interfaces:**
- Produces: `Branch`, `AdminUser`, `UserRole` in `lib/types.ts`; `Class.branch_id`; `BranchInput`, `AdminUserInput` in `lib/api/types.ts`.

- [ ] **Step 1: Update `lib/types.ts`**

Edit the file to:

```ts
export type BookingStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
export type SessionStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED";
export type UserRole = "superadmin" | "admin";

export interface Studio {
  id: string;
  name: string;
  wa_number: string;
  bank_info: string;
}

export interface Branch {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Class {
  id: string;
  branch_id: string;
  title: string;
  description: string;
  capacity: number;
  price: number;
}

export interface ClassSession {
  id: string;
  class_id: string;
  start_time: string;
  end_time: string;
  magic_token: string;
  status: SessionStatus;
}

export interface Booking {
  id: string;
  session_id: string;
  customer_name: string;
  customer_wa: string;
  customer_email: string;
  payment_proof_url: string;
  status: BookingStatus;
  created_at: string;
}

export interface PublicSession extends ClassSession {
  class: Class;
  studio: Studio;
  branch: Branch;
  approved_count: number;
  remaining_slots: number;
}

export interface CreateBookingInput {
  session_id: string;
  customer_name: string;
  customer_wa: string;
  customer_email: string;
  payment_proof: File;
}

export interface AdminUser {
  id: string;
  username: string;
  branch_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

Key change: `Class.studio_id` → `Class.branch_id`; `PublicSession` gains `branch`.

- [ ] **Step 2: Update `lib/api/types.ts`**

Replace contents:

```ts
import type { AdminUser, Booking, BookingStatus, Branch, Class, PublicSession, SessionStatus, Studio, UserRole } from "@/lib/types";

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
export type { SessionStatus, BookingStatus };
export type { Studio, Branch, AdminUser, UserRole };
export interface BranchInput { name: string; slug: string; is_active: boolean; }
export interface AdminUserInput { username: string; password: string; branch_id: string; is_active: boolean; }
export interface AdminUserUpdateInput { branch_id: string; is_active: boolean; }
export interface AdminUserWithBranch extends AdminUser { branch: Branch; }
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors in `data.ts`, `admin.ts` (expected — fixed in later tasks). Only confirm no syntax errors in the two edited files.

- [ ] **Step 4: Commit**

```bash
git add lib/types.ts lib/api/types.ts
git commit -m "feat(types): Branch, AdminUser, UserRole; Class.branch_id"
```

---

## Task 5: Validation schemas — admin user + branch

**Files:**
- Create: `lib/validation/admin.ts`
- Create: `lib/validation/admin.self-check.ts`
- Modify: `package.json` (add self-check to `check` script)

**Interfaces:**
- Produces: `branchInputSchema`, `adminUserInputSchema`, `adminUserUpdateSchema`, `slugify(str)`.

- [ ] **Step 1: Write failing self-check**

`lib/validation/admin.self-check.ts`:

```ts
import assert from "node:assert/strict";
import { branchInputSchema, adminUserInputSchema, adminUserUpdateSchema, slugify } from "./admin.ts";

function demo() {
  assert.equal(slugify("Main Branch"), "main-branch", "slugify basic");
  assert.equal(slugify("  JakSel!! "), "jaks-el", "slugify strips + lowercases");

  const b = branchInputSchema.safeParse({ name: "Bandung", slug: "bandung", is_active: true });
  assert.equal(b.success, true, "branch valid");

  const bBad = branchInputSchema.safeParse({ name: "", slug: "x", is_active: true });
  assert.equal(bBad.success, false, "branch name empty rejected");

  const a = adminUserInputSchema.safeParse({ username: "kasir1", password: "rahasia123", branch_id: "b1", is_active: true });
  assert.equal(a.success, true, "admin valid");

  const aShort = adminUserInputSchema.safeParse({ username: "ka", password: "rahasia123", branch_id: "b1", is_active: true });
  assert.equal(aShort.success, false, "username too short rejected");

  const aPw = adminUserInputSchema.safeParse({ username: "kasir1", password: "123", branch_id: "b1", is_active: true });
  assert.equal(aPw.success, false, "password too short rejected");

  const u = adminUserUpdateSchema.safeParse({ branch_id: "b1", is_active: false });
  assert.equal(u.success, true, "update valid");

  console.log("validation/admin.self-check: OK");
}

demo();
```

- [ ] **Step 2: Run to verify failure**

Run: `node --experimental-strip-types lib/validation/admin.self-check.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`lib/validation/admin.ts`:

```ts
import { z } from "zod";

export function slugify(input: string): string {
  return input.trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const branchInputSchema = z.object({
  name: z.string().trim().min(2, "Nama cabang minimal 2 karakter").max(120, "Nama cabang terlalu panjang"),
  slug: z.string().trim().min(2, "Slug minimal 2 karakter").max(120).regex(/^[a-z0-9-]+$/, "Slug hanya huruf kecil, angka, strip"),
  is_active: z.boolean(),
});

export const adminUserInputSchema = z.object({
  username: z.string().trim().min(3, "Username minimal 3 karakter").max(60).regex(/^[a-zA-Z0-9_.-]+$/, "Username: huruf, angka, titik, strip, underscore"),
  password: z.string().min(8, "Kata sandi minimal 8 karakter").max(200),
  branch_id: z.string().min(1, "Cabang wajib"),
  is_active: z.boolean(),
});

export const adminUserUpdateSchema = z.object({
  branch_id: z.string().min(1, "Cabang wajib"),
  is_active: z.boolean(),
});
```

- [ ] **Step 4: Run to verify pass**

Run: `node --experimental-strip-types lib/validation/admin.self-check.ts`
Expected: `validation/admin.self-check: OK`

- [ ] **Step 5: Wire into check script**

Update `package.json` `check` to append:

```json
"check": "node --experimental-strip-types lib/booking.self-check.ts && node --experimental-strip-types lib/validation/booking.self-check.ts && node --experimental-strip-types lib/calendar.self-check.ts && node --experimental-strip-types lib/server/auth.self-check.ts && node --experimental-strip-types lib/server/password.self-check.ts && node --experimental-strip-types lib/validation/admin.self-check.ts"
```

Run: `npm run check`
Expected: all OK.

- [ ] **Step 6: Commit**

```bash
git add lib/validation/admin.ts lib/validation/admin.self-check.ts package.json
git commit -m "feat(validation): branch + admin user zod schemas"
```

---

## Task 6: Auth server — login(username, password), getCurrentUser

**Files:**
- Modify: `lib/server/auth.ts`

**Interfaces:**
- Produces: `login(username: string, password: string): Promise<void>`, `getCurrentUser(): Promise<CurrentUser | null>`, `requireUser(): Promise<CurrentUser>`, `assertAdmin()`, `assertSuperadmin()` (thin wrappers; real authz in Task 7).
- `CurrentUser = { id: string; username: string; role: UserRole; branch_id: string | null }`.

- [ ] **Step 1: Implement**

Replace `lib/server/auth.ts`:

```ts
import { cookies } from "next/headers";
import { ApiError } from "@/lib/errors";
import { signToken, verifyToken, timingSafeEqualString, COOKIE_MAX_AGE, type SessionClaims } from "./auth-token";
import { verifyPassword } from "./password";
import { supabaseAdmin } from "./supabase";
import type { AdminUser, UserRole } from "@/lib/types";

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
  // Re-check admin active status from DB so deactivation applies before token expiry.
  if (claims.role === "admin") {
    const { data } = await supabaseAdmin()
      .from("admin_users")
      .select("is_active")
      .eq("id", claims.user_id)
      .maybeSingle();
    if (!data || !data.is_active) return null;
  }
  return { id: claims.user_id, username: claims.username, role: claims.role, branch_id: claims.branch_id };
}

export async function requireUser(): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) throw new ApiError(401, "Tidak terautentikasi", "UNAUTHORIZED");
  return u;
}

export async function assertAdmin(): Promise<CurrentUser> {
  const u = await requireUser();
  if (u.role !== "admin" && u.role !== "superadmin") throw new ApiError(403, "Akses admin saja", "FORBIDDEN");
  return u;
}

export async function assertSuperadmin(): Promise<CurrentUser> {
  const u = await requireUser();
  if (u.role !== "superadmin") throw new ApiError(403, "Akses superadmin saja", "FORBIDDEN");
  return u;
}

// ponytail: back-compat boolean for existing layout guard; prefer requireUser().
export async function isAdmin(): Promise<boolean> {
  const u = await getCurrentUser();
  return u !== null;
}

export async function login(username: string, password: string): Promise<void> {
  if (typeof username !== "string" || username.length === 0) {
    throw new ApiError(400, "Username wajib diisi", "VALIDATION_ERROR");
  }

  const saUser = process.env.SUPERADMIN_USERNAME;
  const saPw = process.env.SUPERADMIN_PASSWORD;
  if (saUser && timingSafeEqualString(username.toLowerCase(), saUser.toLowerCase())) {
    if (!saPw) throw new ApiError(500, "SUPERADMIN_PASSWORD belum dikonfigurasi", "ADMIN_NOT_CONFIGURED");
    if (!timingSafeEqualString(password, saPw)) {
      throw new ApiError(401, "Username atau kata sandi salah", "INVALID_CREDENTIALS");
    }
    return setSession({ user_id: "superadmin", username: saUser, role: "superadmin", branch_id: null });
  }

  const sb = supabaseAdmin();
  const { data, error } = await sb.from("admin_users")
    .select("id, username, password_hash, branch_id, is_active")
    .ilike("username", username)
    .maybeSingle();
  if (error || !data || !(data as AdminUser & { password_hash: string; is_active: boolean }).is_active) {
    throw new ApiError(401, "Username atau kata sandi salah", "INVALID_CREDENTIALS");
  }
  const row = data as AdminUser & { password_hash: string; is_active: boolean };
  if (!verifyPassword(password, row.password_hash)) {
    throw new ApiError(401, "Username atau kata sandi salah", "INVALID_CREDENTIALS");
  }
  await setSession({ user_id: row.id, username: row.username, role: "admin", branch_id: row.branch_id });
}

async function setSession(claims: Omit<SessionClaims, "exp">): Promise<void> {
  const exp = Date.now() + COOKIE_MAX_AGE * 1000;
  const full: SessionClaims = { ...claims, exp };
  const jar = await cookies();
  jar.set(COOKIE, signToken(full), {
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
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors only in callers (`lib/api/admin.ts` from signature change) — acceptable for this task.

- [ ] **Step 3: Commit**

```bash
git add lib/server/auth.ts
git commit -m "feat(auth): username+password login, getCurrentUser with claims"
```

---

## Task 7: Authorization guards + self-check

**Files:**
- Create: `lib/server/authz.ts`
- Create: `lib/server/authz.self-check.ts`
- Modify: `package.json` (add to `check`)

**Interfaces:**
- Produces: `assertBranchAccess(user: CurrentUser, resourceBranchId: string | null | undefined): void`, `branchFilter(user: CurrentUser): { branch_id: string } | {}` (returns a Supabase filter object), `canManageAllBranches(user): boolean`.
- Consumes: `CurrentUser` from `lib/server/auth`.

- [ ] **Step 1: Write failing self-check**

`lib/server/authz.self-check.ts`:

```ts
import assert from "node:assert/strict";
import { assertBranchAccess, branchFilter, canManageAllBranches } from "./authz.ts";
import type { CurrentUser } from "./auth.ts";

const admin: CurrentUser = { id: "u1", username: "kasir", role: "admin", branch_id: "b1" };
const superadmin: CurrentUser = { id: "s1", username: "super", role: "superadmin", branch_id: null };

function demo() {
  assert.doesNotThrow(() => assertBranchAccess(admin, "b1"), "admin own branch ok");
  assert.throws(() => assertBranchAccess(admin, "b2"), "admin other branch 403");
  assert.throws(() => assertBranchAccess(admin, null), "admin null branch 403");
  assert.throws(() => assertBranchAccess(admin, undefined), "admin undefined branch 403");
  assert.doesNotThrow(() => assertBranchAccess(superadmin, "b1"), "superadmin any branch ok");
  assert.doesNotThrow(() => assertBranchAccess(superadmin, null), "superadmin null ok");
  assert.doesNotThrow(() => assertBranchAccess(superadmin, undefined), "superadmin undefined ok");

  assert.deepEqual(branchFilter(admin), { branch_id: "b1" }, "admin filter");
  assert.deepEqual(branchFilter(superadmin), {}, "superadmin no filter");

  assert.equal(canManageAllBranches(admin), false, "admin not all");
  assert.equal(canManageAllBranches(superadmin), true, "superadmin all");

  console.log("authz.self-check: OK");
}

demo();
```

- [ ] **Step 2: Run to verify failure**

Run: `node --experimental-strip-types lib/server/authz.self-check.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`lib/server/authz.ts`:

```ts
import { ApiError } from "@/lib/errors";
import type { CurrentUser } from "./auth";

export function canManageAllBranches(user: CurrentUser): boolean {
  return user.role === "superadmin";
}

// Throws 403 if a non-superadmin user tries to reach a branch that isn't theirs.
// A null/undefined resourceBranchId is only valid for superadmins.
export function assertBranchAccess(user: CurrentUser, resourceBranchId: string | null | undefined): void {
  if (canManageAllBranches(user)) return;
  if (!resourceBranchId || user.branch_id !== resourceBranchId) {
    throw new ApiError(403, "Tidak ada akses ke cabang ini", "FORBIDDEN");
  }
}

// Returns a Supabase filter fragment: superadmin → {} (no filter), admin → { branch_id }.
// ponytail: callers spread this into .match() or .eq() chains by reading branch_id.
export function branchFilter(user: CurrentUser): { branch_id: string } | Record<string, never> {
  return canManageAllBranches(user) ? {} : { branch_id: user.branch_id as string };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --experimental-strip-types lib/server/authz.self-check.ts`
Expected: `authz.self-check: OK`

- [ ] **Step 5: Wire into check script**

Update `package.json` `check` — append `&& node --experimental-strip-types lib/server/authz.self-check.ts`.

Run: `npm run check`
Expected: all OK.

- [ ] **Step 6: Commit**

```bash
git add lib/server/authz.ts lib/server/authz.self-check.ts package.json
git commit -m "feat(authz): branch access guards with self-check"
```

---

## Task 8: Branch data layer + Server Actions

**Files:**
- Create: `lib/server/branches.ts`
- Create: `lib/api/branches.ts`

**Interfaces:**
- Produces (data): `listBranches(activeOnly?: boolean): Promise<Branch[]>`, `getBranch(id): Promise<Branch>`, `createBranchRow(input): Promise<Branch>`, `updateBranchRow(id, input): Promise<Branch>`, `branchIdBySlug(slug): Promise<string | null>`.
- Produces (actions): `listBranchesAction(activeOnly?)`, `createBranchAction(input)`, `updateBranchAction(id, input)`.

- [ ] **Step 1: Data layer**

`lib/server/branches.ts`:

```ts
import { supabaseAdmin } from "./supabase";
import { ApiError } from "@/lib/errors";
import type { Branch } from "@/lib/types";
import type { BranchInput } from "@/lib/api/types";

export async function listBranches(activeOnly = false): Promise<Branch[]> {
  const sb = supabaseAdmin();
  let q = sb.from("branches").select("*").order("name", { ascending: true });
  if (activeOnly) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw new ApiError(500, "Gagal memuat cabang", "QUERY_FAILED");
  return data as Branch[];
}

export async function getBranch(id: string): Promise<Branch> {
  const { data, error } = await supabaseAdmin().from("branches").select("*").eq("id", id).maybeSingle();
  if (error || !data) throw new ApiError(404, "Cabang tidak ditemukan", "BRANCH_NOT_FOUND");
  return data as Branch;
}

export async function branchIdBySlug(slug: string): Promise<string | null> {
  const { data } = await supabaseAdmin().from("branches").select("id").eq("slug", slug).maybeSingle();
  return data?.id ?? null;
}

export async function createBranchRow(input: BranchInput): Promise<Branch> {
  const { data, error } = await supabaseAdmin().from("branches").insert(input).select().single();
  if (error) throw new ApiError(500, "Gagal membuat cabang", "INSERT_FAILED");
  return data as Branch;
}

export async function updateBranchRow(id: string, input: BranchInput): Promise<Branch> {
  const { data, error } = await supabaseAdmin().from("branches").update(input).eq("id", id).select().maybeSingle();
  if (error || !data) throw new ApiError(404, "Cabang tidak ditemukan", "BRANCH_NOT_FOUND");
  return data as Branch;
}

// Branch may only be deactivated (not deleted) when it has classes; deletion blocked by FK on delete restrict.
export async function assertBranchDeleteSafe(id: string): Promise<void> {
  const { count } = await supabaseAdmin().from("classes").select("id", { count: "exact", head: true }).eq("branch_id", id);
  if ((count ?? 0) > 0) throw new ApiError(409, "Cabang masih memiliki kelas; nonaktifkan saja", "BRANCH_NOT_EMPTY");
}
```

- [ ] **Step 2: Server Actions**

`lib/api/branches.ts`:

```ts
"use server";

import { assertSuperadmin } from "@/lib/server/auth";
import { branchInputSchema } from "@/lib/validation/admin";
import { ApiError } from "@/lib/errors";
import {
  listBranches as loadBranches, createBranchRow, updateBranchRow, getBranch,
} from "@/lib/server/branches";
import type { Branch } from "@/lib/types";
import type { BranchInput } from "@/lib/api/types";

export type { BranchInput };

export async function listBranchesAction(activeOnly = false): Promise<Branch[]> {
  await assertSuperadmin();
  return loadBranches(activeOnly);
}

export async function createBranchAction(input: BranchInput): Promise<Branch> {
  await assertSuperadmin();
  const parsed = branchInputSchema.safeParse(input);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Data cabang tidak valid", "VALIDATION_ERROR");
  return createBranchRow(parsed.data);
}

export async function updateBranchAction(id: string, input: BranchInput): Promise<Branch> {
  await assertSuperadmin();
  const parsed = branchInputSchema.safeParse(input);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Data cabang tidak valid", "VALIDATION_ERROR");
  return updateBranchRow(id, parsed.data);
}

export async function getBranchAction(id: string): Promise<Branch> {
  await assertSuperadmin();
  return getBranch(id);
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors in these files.

- [ ] **Step 4: Commit**

```bash
git add lib/server/branches.ts lib/api/branches.ts
git commit -m "feat(branches): data layer + superadmin server actions"
```

---

## Task 9: Admin users data layer + Server Actions

**Files:**
- Create: `lib/server/admin-users.ts`
- Create: `lib/api/admin-users.ts`

**Interfaces:**
- Produces (data): `listAdminUsersWithBranch(): Promise<AdminUserWithBranch[]>`, `createAdminUserRow(input)`, `updateAdminUserRow(id, input)`, `resetAdminPassword(id, password)`, `setAdminActive(id, active)`.
- Produces (actions): `listAdminsAction()`, `createAdminAction(input)`, `updateAdminAction(id, input)`, `resetAdminPasswordAction(id, password)`, `toggleAdminAction(id, active)`.

- [ ] **Step 1: Data layer**

`lib/server/admin-users.ts`:

```ts
import { supabaseAdmin } from "./supabase";
import { ApiError } from "@/lib/errors";
import { hashPassword } from "./password";
import { getBranch } from "./branches";
import type { AdminUser } from "@/lib/types";
import type { AdminUserInput, AdminUserUpdateInput, AdminUserWithBranch } from "@/lib/api/types";

export async function listAdminUsersWithBranch(): Promise<AdminUserWithBranch[]> {
  const { data, error } = await supabaseAdmin()
    .from("admin_users")
    .select("*, branch:branches(*)")
    .order("username", { ascending: true });
  if (error) throw new ApiError(500, "Gagal memuat admin", "QUERY_FAILED");
  return data as AdminUserWithBranch[];
}

export async function createAdminUserRow(input: AdminUserInput): Promise<AdminUser> {
  // Reserved username guard
  const reserved = process.env.SUPERADMIN_USERNAME?.toLowerCase();
  if (reserved && input.username.toLowerCase() === reserved) {
    throw new ApiError(409, "Username reserved untuk superadmin", "USERNAME_RESERVED");
  }
  // Branch must be active for new admins.
  const branch = await getBranch(input.branch_id);
  if (!branch.is_active) throw new ApiError(409, "Cabang nonaktif tidak bisa dipilih", "BRANCH_INACTIVE");

  const { data, error } = await supabaseAdmin().from("admin_users").insert({
    username: input.username,
    password_hash: hashPassword(input.password),
    branch_id: input.branch_id,
    is_active: input.is_active,
  }).select("id, username, branch_id, is_active, created_at, updated_at").single();
  if (error) {
    if (error.code === "23505") throw new ApiError(409, "Username sudah dipakai", "USERNAME_TAKEN");
    throw new ApiError(500, "Gagal membuat admin", "INSERT_FAILED");
  }
  return data as AdminUser;
}

export async function updateAdminUserRow(id: string, input: AdminUserUpdateInput): Promise<AdminUser> {
  const branch = await getBranch(input.branch_id);
  if (!branch.is_active) throw new ApiError(409, "Cabang nonaktif tidak bisa dipilih", "BRANCH_INACTIVE");
  const { data, error } = await supabaseAdmin().from("admin_users").update({
    branch_id: input.branch_id, is_active: input.is_active,
  }).eq("id", id).select("id, username, branch_id, is_active, created_at, updated_at").maybeSingle();
  if (error || !data) throw new ApiError(404, "Admin tidak ditemukan", "ADMIN_NOT_FOUND");
  return data as AdminUser;
}

export async function resetAdminPassword(id: string, password: string): Promise<void> {
  const { error } = await supabaseAdmin().from("admin_users")
    .update({ password_hash: hashPassword(password) }).eq("id", id);
  if (error) throw new ApiError(500, "Gagal reset kata sandi", "UPDATE_FAILED");
}

export async function setAdminActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabaseAdmin().from("admin_users").update({ is_active: active }).eq("id", id);
  if (error) throw new ApiError(500, "Gagal mengubah status admin", "UPDATE_FAILED");
}
```

- [ ] **Step 2: Server Actions**

`lib/api/admin-users.ts`:

```ts
"use server";

import { assertSuperadmin } from "@/lib/server/auth";
import { adminUserInputSchema, adminUserUpdateSchema } from "@/lib/validation/admin";
import { ApiError } from "@/lib/errors";
import {
  listAdminUsersWithBranch, createAdminUserRow, updateAdminUserRow, resetAdminPassword, setAdminActive,
} from "@/lib/server/admin-users";
import type { AdminUser } from "@/lib/types";
import type { AdminUserInput, AdminUserUpdateInput, AdminUserWithBranch } from "@/lib/api/types";

export type { AdminUserInput, AdminUserUpdateInput, AdminUserWithBranch };

export async function listAdminsAction(): Promise<AdminUserWithBranch[]> {
  await assertSuperadmin();
  return listAdminUsersWithBranch();
}

export async function createAdminAction(input: AdminUserInput): Promise<AdminUser> {
  await assertSuperadmin();
  const parsed = adminUserInputSchema.safeParse(input);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Data admin tidak valid", "VALIDATION_ERROR");
  return createAdminUserRow(parsed.data);
}

export async function updateAdminAction(id: string, input: AdminUserUpdateInput): Promise<AdminUser> {
  await assertSuperadmin();
  const parsed = adminUserUpdateSchema.safeParse(input);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Data admin tidak valid", "VALIDATION_ERROR");
  return updateAdminUserRow(id, parsed.data);
}

export async function resetAdminPasswordAction(id: string, password: string): Promise<void> {
  await assertSuperadmin();
  if (typeof password !== "string" || password.length < 8) {
    throw new ApiError(400, "Kata sandi minimal 8 karakter", "VALIDATION_ERROR");
  }
  return resetAdminPassword(id, password);
}

export async function toggleAdminAction(id: string, active: boolean): Promise<void> {
  await assertSuperadmin();
  return setAdminActive(id, active);
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors in these files.

- [ ] **Step 4: Commit**

```bash
git add lib/server/admin-users.ts lib/api/admin-users.ts
git commit -m "feat(admin-users): data layer + superadmin server actions"
```

---

## Task 10: Branch-aware data layer refactor

**Files:**
- Modify: `lib/server/data.ts`

**Interfaces:**
- Produces: all public functions gain optional branch-scoping where relevant; `computePublicSession` returns `branch`; `createClassRow(input, branchId)`; `listApprovalsDetailed(status, branchId?)`, `listClassesWithCount(branchId?)`, `listSessionsByDate(start, end, branchId?)`, `listRecentBookings(limit, branchId?)`, `listCustomerBookings(search, branchId?)`, `dashboardMetrics(branchId?)`.

- [ ] **Step 1: Refactor**

Replace `lib/server/data.ts` contents:

```ts
import { supabaseAdmin } from "@/lib/server/supabase";
import { remainingSlots } from "@/lib/booking";
import { ApiError } from "@/lib/errors";
import { proofSignedUrl } from "@/lib/server/storage";
import { getBranch } from "@/lib/server/branches";
import type { Booking, BookingStatus, Branch, Class, ClassSession, PublicSession, Studio } from "@/lib/types";
import type { ApprovalRow, CreateSessionInput, ClassInput, DashboardMetrics } from "@/lib/api/types";

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

async function loadBranchForClass(classId: string): Promise<Branch> {
  const { data, error } = await supabaseAdmin()
    .from("classes").select("branch:branches(*)").eq("id", classId).single();
  if (error || !data) throw new ApiError(500, "Data cabang tidak lengkap", "SESSION_DATA_INCOMPLETE");
  return data.branch as Branch;
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
  const branch = await loadBranchForClass(session.class_id);
  return {
    ...session,
    class: cls,
    studio,
    branch,
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

export async function getSessionById(sessionId: string): Promise<PublicSession> {
  const { data, error } = await supabaseAdmin().from("class_sessions").select("*").eq("id", sessionId).maybeSingle();
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

// branchId: null = all branches (superadmin). Used as Supabase .in() filter on class_id set.
async function classIdsByBranch(branchId: string | null): Promise<string[] | null> {
  if (branchId === null) return null;
  const { data, error } = await supabaseAdmin().from("classes").select("id").eq("branch_id", branchId);
  if (error) throw new ApiError(500, "Gagal memuat kelas", "QUERY_FAILED");
  return (data ?? []).map((r: { id: string }) => r.id);
}

export async function listApprovalsDetailed(status?: BookingStatus, branchId: string | null = null): Promise<ApprovalRow[]> {
  const sb = supabaseAdmin();
  const classIds = await classIdsByBranch(branchId);
  if (classIds && classIds.length === 0) return [];

  let sessionQ = sb.from("class_sessions").select("id");
  if (classIds) sessionQ = sessionQ.in("class_id", classIds);
  const { data: sessions, error: sErr } = await sessionQ;
  if (sErr) throw new ApiError(500, "Gagal memuat approvals", "QUERY_FAILED");
  const sessionIds = (sessions ?? []).map((s: { id: string }) => s.id);
  if (sessionIds.length === 0) return [];

  let q = sb.from("bookings").select("*").in("session_id", sessionIds).order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw new ApiError(500, "Gagal memuat approvals", "QUERY_FAILED");
  return Promise.all((data as Booking[]).map(buildApprovalRow));
}

export async function listBookingsBySession(sessionId: string): Promise<ApprovalRow[]> {
  const sb = supabaseAdmin();
  const { data, error } = await sb.from("bookings").select("*")
    .eq("session_id", sessionId).order("created_at", { ascending: true });
  if (error) throw new ApiError(500, "Gagal memuat peserta", "QUERY_FAILED");
  return Promise.all((data as Booking[]).map(buildApprovalRow));
}

export async function listRecentBookings(limit = 20, branchId: string | null = null): Promise<ApprovalRow[]> {
  const classIds = await classIdsByBranch(branchId);
  if (classIds && classIds.length === 0) return [];
  const sb = supabaseAdmin();
  let sessionQ = sb.from("class_sessions").select("id");
  if (classIds) sessionQ = sessionQ.in("class_id", classIds);
  const { data: sessions } = await sessionQ;
  const sessionIds = (sessions ?? []).map((s: { id: string }) => s.id);
  if (sessionIds.length === 0) return [];
  const { data, error } = await sb.from("bookings").select("*")
    .in("session_id", sessionIds).order("created_at", { ascending: false }).limit(limit);
  if (error) throw new ApiError(500, "Gagal memuat riwayat booking", "QUERY_FAILED");
  return Promise.all((data as Booking[]).map(buildApprovalRow));
}

export async function listCustomerBookings(search: string, branchId: string | null = null): Promise<ApprovalRow[]> {
  const term = search.trim();
  if (!term) return [];
  const classIds = await classIdsByBranch(branchId);
  if (classIds && classIds.length === 0) return [];
  const sb = supabaseAdmin();
  let sessionQ = sb.from("class_sessions").select("id");
  if (classIds) sessionQ = sessionQ.in("class_id", classIds);
  const { data: sessions } = await sessionQ;
  const sessionIds = (sessions ?? []).map((s: { id: string }) => s.id);
  if (sessionIds.length === 0) return [];

  const [waResult, emailResult] = await Promise.all([
    sb.from("bookings").select("*").in("session_id", sessionIds).ilike("customer_wa", `%${term}%`),
    sb.from("bookings").select("*").in("session_id", sessionIds).ilike("customer_email", `%${term}%`)
  ]);
  if (waResult.error || emailResult.error) {
    throw new ApiError(500, "Gagal memuat riwayat booking", "QUERY_FAILED");
  }
  const bookings = new Map<string, Booking>();
  for (const booking of [...(waResult.data ?? []), ...(emailResult.data ?? [])] as Booking[]) {
    bookings.set(booking.id, booking);
  }
  return Promise.all([...bookings.values()]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map(buildApprovalRow));
}

async function sessionsCountByClass(branchId: string | null): Promise<Map<string, number>> {
  const sb = supabaseAdmin();
  let q = sb.from("class_sessions").select("class_id");
  if (branchId) {
    const { data: cls } = await sb.from("classes").select("id").eq("branch_id", branchId);
    const ids = (cls ?? []).map((c: { id: string }) => c.id);
    if (ids.length === 0) return new Map();
    q = q.in("class_id", ids);
  }
  const { data, error } = await q;
  if (error) throw new ApiError(500, "Gagal memuat sesi", "QUERY_FAILED");
  const m = new Map<string, number>();
  for (const r of (data ?? []) as { class_id: string }[]) m.set(r.class_id, (m.get(r.class_id) ?? 0) + 1);
  return m;
}

export async function listClassesWithCount(branchId: string | null = null): Promise<(Class & { session_count: number })[]> {
  const sb = supabaseAdmin();
  let classQ = sb.from("classes").select("*").order("title", { ascending: true });
  if (branchId) classQ = classQ.eq("branch_id", branchId);
  const [classesRes, counts] = await Promise.all([classQ, sessionsCountByClass(branchId)]);
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

export async function listSessionsByDate(startISO: string, endISO: string, branchId: string | null = null): Promise<PublicSession[]> {
  const sb = supabaseAdmin();
  let q = sb.from("class_sessions").select("*")
    .gte("start_time", startISO).lte("start_time", endISO).order("start_time", { ascending: true });
  if (branchId) {
    const { data: cls } = await sb.from("classes").select("id").eq("branch_id", branchId);
    const ids = (cls ?? []).map((c: { id: string }) => c.id);
    if (ids.length === 0) return [];
    q = q.in("class_id", ids);
  }
  const { data, error } = await q;
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
  if (error) {
    if ((error as { code?: string }).code === "P0003") throw new ApiError(409, "Cabang nonaktif", "BRANCH_INACTIVE");
    throw new ApiError(500, "Gagal membuat sesi", "INSERT_FAILED");
  }
  return computePublicSession(data as SessionRow);
}

export async function createClassRow(input: ClassInput, branchId: string): Promise<Class> {
  const branch = await getBranch(branchId);
  if (!branch.is_active) throw new ApiError(409, "Cabang nonaktif", "BRANCH_INACTIVE");
  const sb = supabaseAdmin();
  const { data, error } = await sb.from("classes").insert({ ...input, branch_id: branchId }).select().single();
  if (error) throw new ApiError(500, "Gagal membuat kelas", "INSERT_FAILED");
  return { ...(data as Class), price: Number((data as Class).price) };
}

export async function updateClassRow(id: string, input: ClassInput): Promise<Class> {
  const sb = supabaseAdmin();
  const { data, error } = await sb.from("classes").update({
    title: input.title, description: input.description, capacity: input.capacity, price: input.price,
  }).eq("id", id).select().maybeSingle();
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

export async function dashboardMetrics(branchId: string | null = null): Promise<DashboardMetrics> {
  const sb = supabaseAdmin();
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Makassar", year: "numeric", month: "2-digit", day: "2-digit" });
  const isSameDay = (iso: string) => fmt.format(new Date(iso)) === fmt.format(now);

  let sessionClassIds: string[] | null = null;
  if (branchId) {
    const { data: cls } = await sb.from("classes").select("id").eq("branch_id", branchId);
    sessionClassIds = (cls ?? []).map((c: { id: string }) => c.id);
  }
  const inClause = sessionClassIds && sessionClassIds.length === 0;

  let sessionsAll: SessionRow[] = [];
  let upcomingRes = { data: [] as SessionRow[], error: null as null | { code?: string } };
  if (!inClause) {
    let sQ = sb.from("class_sessions").select("*");
    let uQ = sb.from("class_sessions").select("*").eq("status", "SCHEDULED").gte("start_time", now.toISOString()).order("start_time", { ascending: true }).limit(1);
    if (sessionClassIds) { sQ = sQ.in("class_id", sessionClassIds); uQ = uQ.in("class_id", sessionClassIds); }
    const [sR, uR] = await Promise.all([sQ, uQ]);
    if (sR.error) throw new ApiError(500, "Gagal memuat sesi", "QUERY_FAILED");
    sessionsAll = (sR.data ?? []) as SessionRow[];
    upcomingRes = uR as { data: SessionRow[]; error: null };
  }

  const sessionIds = sessionsAll.map((s) => s.id);
  let bookings: Booking[] = [];
  let pendingCount = 0;
  if (sessionIds.length) {
    const [bR, pR] = await Promise.all([
      sb.from("bookings").select("*").in("session_id", sessionIds),
      sb.from("bookings").select("id", { count: "exact", head: true }).in("session_id", sessionIds).eq("status", "PENDING"),
    ]);
    if (bR.error) throw new ApiError(500, "Gagal memuat bookings", "QUERY_FAILED");
    bookings = (bR.data ?? []) as Booking[];
    pendingCount = pR.count ?? 0;
  }

  const approvedToday = bookings.filter((b) => b.status === "APPROVED" && isSameDay(b.created_at));
  const sessionsToday = sessionsAll.filter((s) => isSameDay(s.start_time));
  const upcoming = (upcomingRes.data ?? []) as SessionRow[];
  const nextSession = upcoming[0] ? await computePublicSession(upcoming[0]) : null;
  const capacities = await Promise.all(sessionsAll.map((s) => loadClass(s)));
  const totalCapacity = capacities.reduce((sum, c) => sum + c.capacity, 0);
  return {
    pendingCount,
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

export async function cancelBooking(bookingId: string): Promise<Booking> {
  const sb = supabaseAdmin();
  const { data, error } = await sb.from("bookings").update({ status: "CANCELLED" }).eq("id", bookingId).select().maybeSingle();
  if (error || !data) throw new ApiError(404, "Booking tidak ditemukan", "BOOKING_NOT_FOUND");
  return data as Booking;
}

export async function getProofSignedUrl(bookingId: string): Promise<string> {
  const { data, error } = await supabaseAdmin().from("bookings").select("payment_proof_url").eq("id", bookingId).maybeSingle();
  if (error || !data) throw new ApiError(404, "Booking tidak ditemukan", "BOOKING_NOT_FOUND");
  return proofSignedUrl(data.payment_proof_url);
}

// Resolve the branch_id of a booking's session for authorization.
export async function bookingBranchId(bookingId: string): Promise<string | null> {
  const { data } = await supabaseAdmin()
    .from("bookings")
    .select("session:class_sessions(class:classes(branch_id))")
    .eq("id", bookingId)
    .maybeSingle();
  const path = data as unknown as { session?: { class?: { branch_id?: string } } } | null;
  return path?.session?.class?.branch_id ?? null;
}

// Resolve the branch_id of a class for authorization.
export async function classBranchId(classId: string): Promise<string | null> {
  const { data } = await supabaseAdmin().from("classes").select("branch_id").eq("id", classId).maybeSingle();
  return data?.branch_id ?? null;
}

// Resolve the branch_id of a session for authorization.
export async function sessionBranchId(sessionId: string): Promise<string | null> {
  const { data } = await supabaseAdmin()
    .from("class_sessions").select("class:classes(branch_id)").eq("id", sessionId).maybeSingle();
  const path = data as unknown as { class?: { branch_id?: string } } | null;
  return path?.class?.branch_id ?? null;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: remaining errors only in `lib/api/admin.ts` (fixed in Task 11).

- [ ] **Step 3: Commit**

```bash
git add lib/server/data.ts
git commit -m "feat(data): branch-scoped queries, bookingBranchId helpers"
```

---

## Task 11: Admin Server Actions — guards + branch filters

**Files:**
- Modify: `lib/api/admin.ts`

**Interfaces:**
- Produces: all existing actions now take the current user, apply `assertBranchAccess`, and pass `branchId` to data layer. `createClass` ignores client `branch_id`, derives it from session for admin, accepts optional `branchId` for superadmin.

- [ ] **Step 1: Refactor**

Replace `lib/api/admin.ts`:

```ts
"use server";

import { assertAdmin, assertSuperadmin } from "@/lib/server/auth";
import { assertBranchAccess, canManageAllBranches } from "@/lib/server/authz";
import {
  approveBookingRpc, buildApprovalRow, cancelBooking, createClassRow, createSessionRow, dashboardMetrics,
  getApproval, getProofSignedUrl, getSessionById, getStudio as loadStudio, listApprovalsDetailed as loadApprovals,
  listBookingsBySession, listCustomerBookings, listRecentBookings as loadRecentBookings, listClassesWithCount, listSessionsByDate as loadSessions, rejectBooking, updateClassRow, updateStudioRow,
  bookingBranchId, classBranchId, sessionBranchId,
} from "@/lib/server/data";
import { notifyBookingConfirmed } from "@/lib/server/notify";
import { ApiError } from "@/lib/errors";
import type { BookingStatus } from "@/lib/types";
import type {
  ApprovalResult, ApprovalRow, ClassInput, CreateSessionInput, DashboardMetrics,
} from "@/lib/api/types";
import type { Class, PublicSession, Studio } from "@/lib/types";

export type {
  ApprovalResult, ApprovalRow, ClassInput, CreateSessionInput, DashboardMetrics
};

// Effective branch scope for a user: superadmin → null (all), admin → their branch.
function scopeBranch(user: { role: string; branch_id: string | null }): string | null {
  return canManageAllBranches(user as never) ? null : user.branch_id;
}

// Reads
export async function listApprovals(status?: BookingStatus): Promise<ApprovalRow[]> {
  const u = await assertAdmin();
  return loadApprovals(status, scopeBranch(u));
}
export async function listApprovalsDetailed(status?: BookingStatus): Promise<ApprovalRow[]> {
  const u = await assertAdmin();
  return loadApprovals(status, scopeBranch(u));
}
export async function getBooking(id: string): Promise<ApprovalRow> {
  const u = await assertAdmin();
  const row = await getApproval(id);
  assertBranchAccess(u, row.session.branch.id);
  return row;
}
export async function getSession(id: string): Promise<PublicSession> {
  const u = await assertAdmin();
  const s = await getSessionById(id);
  assertBranchAccess(u, s.branch.id);
  return s;
}

export async function listSessionParticipants(sessionId: string): Promise<ApprovalRow[]> {
  const u = await assertAdmin();
  const bid = await sessionBranchId(sessionId);
  assertBranchAccess(u, bid);
  return listBookingsBySession(sessionId);
}
export async function searchCustomerBookings(search: string): Promise<ApprovalRow[]> {
  const u = await assertAdmin();
  if (search.trim().length < 3) {
    throw new ApiError(400, "Masukkan minimal 3 karakter", "VALIDATION_ERROR");
  }
  return listCustomerBookings(search, scopeBranch(u));
}
export async function listRecentBookings(limit = 20): Promise<ApprovalRow[]> {
  const u = await assertAdmin();
  return loadRecentBookings(limit, scopeBranch(u));
}
export async function listSessionsByDate(startISO: string, endISO: string): Promise<PublicSession[]> {
  const u = await assertAdmin();
  return loadSessions(startISO, endISO, scopeBranch(u));
}
export async function listClasses() {
  const u = await assertAdmin();
  return listClassesWithCount(scopeBranch(u));
}
export async function getStudio(): Promise<Studio> {
  await assertSuperadmin();
  return loadStudio();
}
export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const u = await assertAdmin();
  return dashboardMetrics(scopeBranch(u));
}

// Writes
export async function patchApproval(
  id: string,
  status: Exclude<BookingStatus, "PENDING" | "CANCELLED">
): Promise<ApprovalResult> {
  const u = await assertAdmin();
  const bid = await bookingBranchId(id);
  assertBranchAccess(u, bid); // ownership BEFORE rpc/lock
  const booking = status === "APPROVED" ? await approveBookingRpc(id) : await rejectBooking(id);
  const row = await buildApprovalRow(booking);
  const notify = status === "APPROVED"
    ? await notifyBookingConfirmed(booking, row.session).catch(() => null)
    : null;
  return { ...row, notify: notify ?? { email: "skipped", wa: "stubbed", warnings: ["notify skipped"] } };
}

export async function cancelBookingAction(id: string): Promise<ApprovalRow> {
  const u = await assertAdmin();
  const bid = await bookingBranchId(id);
  assertBranchAccess(u, bid);
  const booking = await cancelBooking(id);
  return buildApprovalRow(booking);
}

export async function createSession(input: CreateSessionInput): Promise<PublicSession> {
  const u = await assertAdmin();
  if (!input.class_id || !input.start_time || !input.end_time) {
    throw new ApiError(400, "class_id, start_time, end_time wajib", "VALIDATION_ERROR");
  }
  const bid = await classBranchId(input.class_id);
  assertBranchAccess(u, bid);
  return createSessionRow(input);
}

// branchId: superadmin may pass a branchId; admin's branch is always from session. Client cannot inject for admin.
export async function createClass(input: ClassInput, branchId?: string): Promise<Class> {
  const u = await assertAdmin();
  if (!input.title || typeof input.capacity !== "number" || typeof input.price !== "number") {
    throw new ApiError(400, "title, capacity, price wajib", "VALIDATION_ERROR");
  }
  const effectiveBranch = u.role === "superadmin" ? (branchId ?? null) : u.branch_id;
  if (!effectiveBranch) throw new ApiError(400, "Cabang wajib", "VALIDATION_ERROR");
  if (u.role === "admin") assertBranchAccess(u, effectiveBranch);
  return createClassRow(input, effectiveBranch);
}

export async function updateClass(id: string, input: ClassInput): Promise<Class> {
  const u = await assertAdmin();
  const bid = await classBranchId(id);
  assertBranchAccess(u, bid);
  return updateClassRow(id, input);
}

export async function updateStudio(input: Pick<Studio, "name" | "wa_number" | "bank_info">): Promise<Studio> {
  await assertSuperadmin();
  return updateStudioRow(input);
}

export async function getProofUrl(bookingId: string): Promise<string> {
  const u = await assertAdmin();
  const bid = await bookingBranchId(bookingId);
  assertBranchAccess(u, bid);
  return getProofSignedUrl(bookingId);
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors only in UI callers (createClass signature) and `api/auth.ts` (login signature) — fixed in later tasks.

- [ ] **Step 3: Commit**

```bash
git add lib/api/admin.ts
git commit -m "feat(api): branch-scoped admin actions with resource guards"
```

---

## Task 12: Auth Server Action signature + public booking branch check

**Files:**
- Modify: `lib/api/auth.ts`
- Modify: `lib/api/public.ts`

**Interfaces:**
- Produces: `login(username, password)`, `logout()`. Public `createBooking` rejects when `session.branch.is_active === false`.

- [ ] **Step 1: Update auth action**

Replace `lib/api/auth.ts`:

```ts
"use server";

import { login as authenticate, logout as clearSession } from "@/lib/server/auth";

export async function login(username: string, password: string): Promise<void> {
  return authenticate(username, password);
}

export async function logout(): Promise<void> {
  return clearSession();
}
```

- [ ] **Step 2: Update public booking**

Replace `lib/api/public.ts`:

```ts
"use server";

import { computePublicSession, createBookingRow, getSessionByToken as loadSession } from "@/lib/server/data";
import { supabaseAdmin } from "@/lib/server/supabase";
import { uploadProof } from "@/lib/server/storage";
import { bookingSchema } from "@/lib/validation/booking";
import { ApiError } from "@/lib/errors";
import type { Booking, CreateBookingInput, PublicSession } from "@/lib/types";

export async function getSessionByToken(token: string): Promise<PublicSession> {
  return loadSession(token);
}

export async function createBooking(input: CreateBookingInput): Promise<Booking> {
  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Data tidak valid", "VALIDATION_ERROR");

  const { data: session, error } = await supabaseAdmin().from("class_sessions").select("*").eq("id", input.session_id).maybeSingle();
  if (error || !session) throw new ApiError(404, "Sesi tidak ditemukan", "SESSION_NOT_FOUND");

  const pub = await computePublicSession(session);
  if (!pub.branch.is_active) throw new ApiError(409, "Cabang nonaktif, tidak menerima booking", "BRANCH_INACTIVE");
  if (pub.remaining_slots <= 0) throw new ApiError(409, "Kelas sudah penuh", "CLASS_FULL");

  const proofUrl = await uploadProof(input.session_id, input.payment_proof);
  return createBookingRow({
    session_id: input.session_id,
    customer_name: parsed.data.customer_name,
    customer_wa: parsed.data.customer_wa,
    customer_email: parsed.data.customer_email,
    payment_proof_url: proofUrl,
  });
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors only in login UI (next task).

- [ ] **Step 4: Commit**

```bash
git add lib/api/auth.ts lib/api/public.ts
git commit -m "feat(api): login(username,password); reject bookings on inactive branch"
```

---

## Task 13: Login UI — username + password

**Files:**
- Modify: `app/login/page.tsx`
- Modify: `components/admin/login-form.tsx`

**Interfaces:**
- Consumes: `login(username, password)` from `lib/api/auth`.

- [ ] **Step 1: Update login page copy**

Replace `app/login/page.tsx`:

```tsx
import { LoginForm } from "@/components/admin/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-sand px-4">
      <div className="w-full max-w-sm rounded-2xl bg-paper p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-ink">Masuk</h1>
        <p className="mb-6 text-sm text-ink/60">Gunakan akun admin atau superadmin untuk mengelola booking.</p>
        <LoginForm />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Update form**

Replace `components/admin/login-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { login } from "@/lib/api/auth";
import { apiMessage } from "@/lib/errors";
import { Field } from "@/components/ui/field";

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(username, password);
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setError(apiMessage(err, "Gagal masuk"));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field id="username" label="Username" error={error ?? undefined}>
        <input id="username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="ui-input" autoComplete="username" autoFocus />
      </Field>
      <Field id="password" label="Kata sandi" error={undefined}>
        <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="ui-input" autoComplete="current-password" />
      </Field>
      <button type="submit" disabled={busy || !username || !password} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-cypress px-5 py-3 text-sm font-semibold text-paper hover:bg-cypress/90 disabled:opacity-50">
        {busy ? <Loader2 className="size-4 animate-spin" /> : null}Masuk
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/login/page.tsx components/admin/login-form.tsx
git commit -m "feat(ui): username + password login form"
```

---

## Task 14: Admin layout + sidebar role-aware nav

**Files:**
- Modify: `app/(admin)/layout.tsx`
- Modify: `components/admin/admin-shell.tsx`
- Modify: `components/admin/sidebar.tsx`
- Modify: `components/admin/topbar.tsx`

**Interfaces:**
- Produces: layout passes `user` (username + role + branch_id) to shell; sidebar shows Admins/Branches only for superadmin; topbar shows username + role.

- [ ] **Step 1: Read topbar**

Read `components/admin/topbar.tsx` to match its current structure before editing.

- [ ] **Step 2: Update layout**

Replace `app/(admin)/layout.tsx`:

```tsx
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { getCurrentUser } from "@/lib/server/auth";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <AdminShell user={user}>{children}</AdminShell>;
}
```

- [ ] **Step 3: Update admin-shell**

Replace `components/admin/admin-shell.tsx`:

```tsx
"use client";

import { useState, type ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import type { CurrentUser } from "@/lib/server/auth";

export function AdminShell({ user, children }: { user: CurrentUser; children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="flex min-h-dvh">
      <Sidebar user={user} open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} onMenu={() => setMenuOpen(true)} />
        <main className="flex-1 px-4 py-8 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Update sidebar**

Replace `components/admin/sidebar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, CalendarDays, ClipboardCheck, History, LayoutDashboard, Settings, Sparkles, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CurrentUser } from "@/lib/server/auth";

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; superadminOnly?: boolean };

const links: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/approvals", label: "Approvals", icon: ClipboardCheck },
  { href: "/history", label: "Booking history", icon: History },
  { href: "/classes", label: "Classes", icon: Sparkles },
  { href: "/branches", label: "Branches", icon: Building2, superadminOnly: true },
  { href: "/admins", label: "Admins", icon: Users, superadminOnly: true },
  { href: "/settings", label: "Settings", icon: Settings, superadminOnly: true },
];

export function Sidebar({ user, open, onClose }: { user: CurrentUser; open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const visible = links.filter((l) => !l.superadminOnly || user.role === "superadmin");
  return (
    <>
      {open && <button aria-label="Tutup menu" onClick={onClose} className="fixed inset-0 z-30 bg-ink/35 lg:hidden" />}
      <aside className={cn("fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-ink/10 bg-ink px-5 py-6 text-paper transition-transform lg:static lg:translate-x-0", open ? "translate-x-0" : "-translate-x-full")}>
        <div className="flex items-start justify-between">
          <div>
            <p className="font-display text-3xl tracking-tight">Bookelas</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.22em] text-paper/45">Studio console</p>
          </div>
          <button onClick={onClose} aria-label="Tutup menu" className="rounded p-1 text-paper/50 hover:bg-paper/10 hover:text-paper lg:hidden"><X className="size-5" /></button>
        </div>
        <nav aria-label="Admin navigation" className="mt-12 space-y-1">
          {visible.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
            return <Link key={href} href={href} onClick={onClose} className={cn("flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition", active ? "bg-paper font-semibold text-ink" : "text-paper/65 hover:bg-paper/10 hover:text-paper")}><Icon className="size-4" aria-hidden="true" />{label}</Link>;
          })}
        </nav>
        <div className="mt-auto border-t border-paper/10 pt-5">
          <p className="text-xs leading-5 text-paper/45">{user.role === "superadmin" ? "Superadmin" : "Admin cabang"}<br />{user.username}</p>
        </div>
      </aside>
    </>
  );
}
```

- [ ] **Step 5: Update topbar**

Replace `components/admin/topbar.tsx` (preserve existing structure; add `user` prop). If the existing file has other content (search, etc.), keep it and only add the username/role chip. Minimal version:

```tsx
"use client";

import { Menu } from "lucide-react";
import type { CurrentUser } from "@/lib/server/auth";

export function Topbar({ user, onMenu }: { user: CurrentUser; onMenu: () => void }) {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-ink/10 bg-paper/80 px-4 py-3 backdrop-blur lg:px-8">
      <button onClick={onMenu} aria-label="Buka menu" className="rounded-lg p-2 text-ink/60 hover:bg-ink/5 lg:hidden"><Menu className="size-5" /></button>
      <div className="ml-auto flex items-center gap-3 text-sm">
        <span className="rounded-full bg-cypress/10 px-3 py-1 text-xs font-semibold text-cypress">{user.role === "superadmin" ? "Superadmin" : "Admin"}</span>
        <span className="text-ink/70">{user.username}</span>
      </div>
    </header>
  );
}
```

If the existing topbar renders a search input or other elements, merge this role chip into it rather than dropping features.

- [ ] **Step 6: Typecheck + run**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run dev` — log in as superadmin; confirm sidebar shows Admins/Branches/Settings; log in as admin — those hidden.

- [ ] **Step 7: Commit**

```bash
git add app/(admin)/layout.tsx components/admin/admin-shell.tsx components/admin/sidebar.tsx components/admin/topbar.tsx
git commit -m "feat(ui): role-aware sidebar + topbar user context"
```

---

## Task 15: Branches management page (superadmin)

**Files:**
- Create: `app/(admin)/branches/page.tsx`
- Create: `components/admin/branch-dialog.tsx`

**Interfaces:**
- Consumes: `listBranchesAction`, `createBranchAction`, `updateBranchAction` from `lib/api/branches`.

- [ ] **Step 1: Branch dialog**

`components/admin/branch-dialog.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { createBranchAction, updateBranchAction, type BranchInput } from "@/lib/api/branches";
import { slugify } from "@/lib/validation/admin";
import { apiMessage } from "@/lib/errors";
import { Field } from "@/components/ui/field";

const schema = z.object({
  name: z.string().trim().min(2, "Nama cabang minimal 2 karakter").max(120),
  slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9-]+$/, "Slug: huruf kecil, angka, strip"),
  is_active: z.boolean(),
});
type Values = z.infer<typeof schema>;
const EMPTY: Values = { name: "", slug: "", is_active: true };

export function BranchDialog({ open, editing, onClose }: { open: boolean; editing: (BranchInput & { id: string }) | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: EMPTY });

  useEffect(() => { if (editing) reset({ name: editing.name, slug: editing.slug, is_active: editing.is_active }); }, [editing, reset]);

  const mutation = useMutation({
    mutationFn: async (v: Values) => editing ? updateBranchAction(editing.id, v) : createBranchAction(v),
    onSuccess: () => { toast.success(editing ? "Cabang diperbarui" : "Cabang dibuat"); void queryClient.invalidateQueries({ queryKey: ["branches"] }); handleClose(); },
    onError: (e) => toast.error(apiMessage(e, "Gagal menyimpan cabang")),
  });

  function handleClose() { reset(EMPTY); onClose(); }
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-0 sm:items-center sm:p-6" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !isSubmitting) handleClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="branch-dialog-title" className="w-full max-w-lg rounded-t-2xl bg-paper p-6 shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[0.2em] text-cypress">Cabang</p><h2 id="branch-dialog-title" className="mt-1 font-display text-3xl tracking-tight">{editing ? "Edit cabang" : "Cabang baru"}</h2></div><button type="button" onClick={handleClose} disabled={isSubmitting} aria-label="Tutup dialog" className="rounded-lg p-2 text-ink/50 hover:bg-ink/5"><X className="size-5" /></button></div>
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="mt-6 space-y-5" noValidate>
          <Field id="branch-name" label="Nama cabang" error={errors.name?.message} required><input id="branch-name" disabled={isSubmitting} {...register("name")} onBlur={(e) => { if (!editing) setValue("slug", slugify(e.target.value)); }} className="ui-input" /></Field>
          <Field id="branch-slug" label="Slug" error={errors.slug?.message} required><input id="branch-slug" disabled={isSubmitting} {...register("slug")} className="ui-input" /></Field>
          <label className="flex items-center gap-2 text-sm text-ink/80"><input type="checkbox" disabled={isSubmitting} {...register("is_active")} /> Aktif</label>
          <button type="submit" disabled={isSubmitting} className="flex w-full items-center justify-center gap-2 rounded-full bg-cypress px-5 py-3 text-sm font-semibold text-paper hover:bg-cypress/90 disabled:opacity-60">{isSubmitting && <Loader2 className="size-4 animate-spin" />}{editing ? "Simpan perubahan" : "Buat cabang"}</button>
        </form>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Branches page**

`app/(admin)/branches/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { listBranchesAction, type BranchInput } from "@/lib/api/branches";
import { BranchDialog } from "@/components/admin/branch-dialog";

export default function BranchesPage() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<(BranchInput & { id: string }) | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ["branches"], queryFn: () => listBranchesAction(false) });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-cypress">Master data</p>
          <h1 className="mt-1 font-display text-4xl tracking-tight">Cabang</h1>
        </div>
        <button onClick={() => { setEditing(null); setOpen(true); }} className="inline-flex items-center gap-2 rounded-full bg-cypress px-4 py-2 text-sm font-semibold text-paper hover:bg-cypress/90"><Plus className="size-4" />Cabang baru</button>
      </div>
      <div className="mt-6 overflow-x-auto rounded-2xl border border-ink/10 bg-paper">
        <table className="w-full text-sm">
          <thead className="bg-ink/5 text-left text-xs uppercase tracking-wide text-ink/60">
            <tr><th className="px-4 py-3">Nama</th><th className="px-4 py-3">Slug</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"></th></tr>
          </thead>
          <tbody>
            {isLoading ? <tr><td className="px-4 py-6 text-ink/50">Memuat…</td></tr> :
              (data ?? []).map((b) => (
                <tr key={b.id} className="border-t border-ink/5">
                  <td className="px-4 py-3 font-medium text-ink">{b.name}</td>
                  <td className="px-4 py-3 text-ink/70">{b.slug}</td>
                  <td className="px-4 py-3">{b.is_active ? <span className="rounded-full bg-cypress/10 px-2 py-0.5 text-xs font-semibold text-cypress">Aktif</span> : <span className="rounded-full bg-ink/10 px-2 py-0.5 text-xs font-semibold text-ink/60">Nonaktif</span>}</td>
                  <td className="px-4 py-3 text-right"><button onClick={() => { setEditing({ id: b.id, name: b.name, slug: b.slug, is_active: b.is_active }); setOpen(true); }} className="text-cypress hover:underline">Edit</button></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <BranchDialog open={open} editing={editing} onClose={() => setOpen(false)} />
    </div>
  );
}
```

- [ ] **Step 3: Run + verify**

Run: `npm run dev`. As superadmin, create a branch; confirm it appears; toggle inactive; edit name.

- [ ] **Step 4: Commit**

```bash
git add app/(admin)/branches/page.tsx components/admin/branch-dialog.tsx
git commit -m "feat(ui): superadmin branch management page"
```

---

## Task 16: Admins management page (superadmin)

**Files:**
- Create: `app/(admin)/admins/page.tsx`
- Create: `components/admin/admin-dialog.tsx`

**Interfaces:**
- Consumes: `listAdminsAction`, `createAdminAction`, `updateAdminAction`, `resetAdminPasswordAction`, `toggleAdminAction` from `lib/api/admin-users`; `listBranchesAction` from `lib/api/branches`.

- [ ] **Step 1: Admin dialog**

`components/admin/admin-dialog.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { createAdminAction, updateAdminAction, type AdminUserInput, type AdminUserUpdateInput } from "@/lib/api/admin-users";
import type { Branch } from "@/lib/types";
import { apiMessage } from "@/lib/errors";
import { Field } from "@/components/ui/field";

const createSchema = z.object({
  username: z.string().trim().min(3, "Username minimal 3 karakter").max(60).regex(/^[a-zA-Z0-9_.-]+$/, "Username: huruf, angka, titik, strip, underscore"),
  password: z.string().min(8, "Kata sandi minimal 8 karakter").max(200),
  branch_id: z.string().min(1, "Cabang wajib"),
});
type CreateValues = z.infer<typeof createSchema>;

export function AdminDialog({ open, editing, branches, onClose }: { open: boolean; editing: { id: string; username: string; branch_id: string; is_active: boolean } | null; branches: Branch[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const isEdit = !!editing;
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<CreateValues>({ resolver: zodResolver(createSchema) });

  useEffect(() => { if (editing) reset({ username: editing.username, password: "", branch_id: editing.branch_id }); }, [editing, reset]);

  const mutation = useMutation({
    mutationFn: async (v: CreateValues) => {
      if (editing) {
        const upd: AdminUserUpdateInput = { branch_id: v.branch_id, is_active: editing.is_active };
        return updateAdminAction(editing.id, upd);
      }
      const input: AdminUserInput = { username: v.username, password: v.password, branch_id: v.branch_id, is_active: true };
      return createAdminAction(input);
    },
    onSuccess: () => { toast.success(isEdit ? "Admin diperbarui" : "Admin dibuat"); void queryClient.invalidateQueries({ queryKey: ["admins"] }); handleClose(); },
    onError: (e) => toast.error(apiMessage(e, "Gagal menyimpan admin")),
  });

  function handleClose() { reset(); onClose(); }
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-0 sm:items-center sm:p-6" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !isSubmitting) handleClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="admin-dialog-title" className="w-full max-w-lg rounded-t-2xl bg-paper p-6 shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[0.2em] text-cypress">User</p><h2 id="admin-dialog-title" className="mt-1 font-display text-3xl tracking-tight">{isEdit ? "Edit admin" : "Admin baru"}</h2></div><button type="button" onClick={handleClose} disabled={isSubmitting} aria-label="Tutup dialog" className="rounded-lg p-2 text-ink/50 hover:bg-ink/5"><X className="size-5" /></button></div>
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="mt-6 space-y-5" noValidate>
          <Field id="admin-username" label="Username" error={errors.username?.message} required><input id="admin-username" disabled={isEdit || isSubmitting} {...register("username")} className="ui-input" /></Field>
          {!isEdit && <Field id="admin-password" label="Kata sandi awal" error={errors.password?.message} required><input id="admin-password" type="password" disabled={isSubmitting} {...register("password")} className="ui-input" /></Field>}
          <Field id="admin-branch" label="Cabang" error={errors.branch_id?.message} required>
            <select id="admin-branch" disabled={isSubmitting} {...register("branch_id")} className="ui-input">
              <option value="">Pilih cabang…</option>
              {branches.filter((b) => b.is_active || editing?.branch_id === b.id).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <button type="submit" disabled={isSubmitting} className="flex w-full items-center justify-center gap-2 rounded-full bg-cypress px-5 py-3 text-sm font-semibold text-paper hover:bg-cypress/90 disabled:opacity-60">{isSubmitting && <Loader2 className="size-4 animate-spin" />}{isEdit ? "Simpan perubahan" : "Buat admin"}</button>
        </form>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Admins page**

`app/(admin)/admins/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { listAdminsAction, toggleAdminAction, resetAdminPasswordAction } from "@/lib/api/admin-users";
import { listBranchesAction } from "@/lib/api/branches";
import { apiMessage } from "@/lib/errors";
import { AdminDialog } from "@/components/admin/admin-dialog";

export default function AdminsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<{ id: string; username: string; branch_id: string; is_active: boolean } | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ["admins"], queryFn: listAdminsAction });
  const { data: branches } = useQuery({ queryKey: ["branches"], queryFn: () => listBranchesAction(false) });

  const toggleMut = useMutation({
    mutationFn: (v: { id: string; active: boolean }) => toggleAdminAction(v.id, v.active),
    onSuccess: () => { toast.success("Status admin diperbarui"); void queryClient.invalidateQueries({ queryKey: ["admins"] }); },
    onError: (e) => toast.error(apiMessage(e, "Gagal mengubah status")),
  });

  const resetMut = useMutation({
    mutationFn: (v: { id: string; password: string }) => resetAdminPasswordAction(v.id, v.password),
    onSuccess: () => toast.success("Kata sandi direset"),
    onError: (e) => toast.error(apiMessage(e, "Gagal reset kata sandi")),
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-cypress">User</p>
          <h1 className="mt-1 font-display text-4xl tracking-tight">Admin</h1>
        </div>
        <button onClick={() => { setEditing(null); setOpen(true); }} className="inline-flex items-center gap-2 rounded-full bg-cypress px-4 py-2 text-sm font-semibold text-paper hover:bg-cypress/90"><Plus className="size-4" />Admin baru</button>
      </div>
      <div className="mt-6 overflow-x-auto rounded-2xl border border-ink/10 bg-paper">
        <table className="w-full text-sm">
          <thead className="bg-ink/5 text-left text-xs uppercase tracking-wide text-ink/60">
            <tr><th className="px-4 py-3">Username</th><th className="px-4 py-3">Cabang</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"></th></tr>
          </thead>
          <tbody>
            {isLoading ? <tr><td className="px-4 py-6 text-ink/50">Memuat…</td></tr> :
              (data ?? []).map((a) => (
                <tr key={a.id} className="border-t border-ink/5">
                  <td className="px-4 py-3 font-medium text-ink">{a.username}</td>
                  <td className="px-4 py-3 text-ink/70">{a.branch?.name ?? "—"}</td>
                  <td className="px-4 py-3">{a.is_active ? <span className="rounded-full bg-cypress/10 px-2 py-0.5 text-xs font-semibold text-cypress">Aktif</span> : <span className="rounded-full bg-ink/10 px-2 py-0.5 text-xs font-semibold text-ink/60">Nonaktif</span>}</td>
                  <td className="px-4 py-3 text-right space-x-3">
                    <button onClick={() => { setEditing({ id: a.id, username: a.username, branch_id: a.branch_id, is_active: a.is_active }); setOpen(true); }} className="text-cypress hover:underline">Edit</button>
                    <button onClick={() => { const pw = prompt("Kata sandi baru (min 8 karakter):"); if (pw && pw.length >= 8) resetMut.mutate({ id: a.id, password: pw }); else if (pw) toast.error("Kata sandi minimal 8 karakter"); }} className="text-ink/60 hover:underline">Reset sandi</button>
                    <button onClick={() => toggleMut.mutate({ id: a.id, active: !a.is_active })} className="text-ink/60 hover:underline">{a.is_active ? "Nonaktifkan" : "Aktifkan"}</button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <AdminDialog open={open} editing={editing} branches={branches ?? []} onClose={() => setOpen(false)} />
    </div>
  );
}
```

- [ ] **Step 3: Run + verify**

Run: `npm run dev`. As superadmin, create an admin tied to an active branch; reset password; toggle active; edit branch.

- [ ] **Step 4: Commit**

```bash
git add app/(admin)/admins/page.tsx components/admin/admin-dialog.tsx
git commit -m "feat(ui): superadmin admin user management page"
```

---

## Task 17: Classes dialog — superadmin branch selector

**Files:**
- Modify: `components/admin/class-dialog.tsx`

**Interfaces:**
- Consumes: `createClass(input, branchId?)` — superadmin must pass `branchId`; admin omits it.

- [ ] **Step 1: Add branch selector for superadmin**

In `components/admin/class-dialog.tsx`, the component currently calls `createClass(input)`. Update it to accept an optional `branchId` for superadmin. Add a `branches` prop and a branch `<select>` shown only when the user is superadmin.

Patch the signature and mutation:

```tsx
// new prop type
export function ClassDialog({ open, editing, branchId, branches, isSuperadmin, onClose }: {
  open: boolean;
  editing: (ClassInput & { id: string }) | null;
  branchId?: string | null;
  branches: { id: string; name: string }[];
  isSuperadmin: boolean;
  onClose: () => void;
}) {
  // ... existing useForm ...
  const [selectedBranch, setSelectedBranch] = useState<string>(branchId ?? branches[0]?.id ?? "");

  useEffect(() => { if (branchId) setSelectedBranch(branchId); }, [branchId]);

  const mutation = useMutation({
    mutationFn: async (values: ClassFormValues) => {
      const input: ClassInput = { title: values.title, description: values.description, capacity: Number(values.capacity), price: Number(values.price) };
      return editing ? updateClass(editing.id, input) : createClass(input, isSuperadmin ? selectedBranch : undefined);
    },
    // ... existing onSuccess/onError unchanged ...
  });
  // ... in the form JSX, before the submit button, add (only when isSuperadmin && !editing):
  //   <Field id="class-branch" label="Cabang" required>
  //     <select id="class-branch" value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)} className="ui-input">
  //       {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
  //     </select>
  //   </Field>
}
```

Apply this edit by reading the current file, preserving all existing structure (zod schema, styling, close handler), and inserting the branch select field + the mutation change above.

- [ ] **Step 2: Update classes page caller**

Read `app/(admin)/classes/page.tsx`. The `ClassDialog` is rendered there. Update its props to pass `branches`, `branchId`, and `isSuperadmin`. The page is a client component; it needs to know the role. Easiest: pass role from the server layout via a client context OR fetch a lightweight current-user action. Minimal approach: add a `getCurrentUserAction` or read user server-side and pass into the page.

Since `app/(admin)/classes/page.tsx` is `"use client"`, add a server wrapper. Convert the page to a server component that reads `getCurrentUser()` and `listBranchesAction()` results, then renders a client `<ClassesView>`. If converting is too invasive, add a new client hook that calls a `currentUserAction()`. The implementer should choose the smaller diff but MUST get `role` + `branches` into the dialog.

- [ ] **Step 3: Run + verify**

Run: `npm run dev`.
- As superadmin: open class dialog → branch selector visible → create class in selected branch.
- As admin: open class dialog → no selector → class created in their branch.

- [ ] **Step 4: Commit**

```bash
git add components/admin/class-dialog.tsx app/(admin)/classes/page.tsx
git commit -m "feat(ui): superadmin branch selector in class dialog"
```

---

## Task 18: Env migration + docs

**Files:**
- Modify: `.env.example` (or create if absent)
- Modify: `README.md` (if env section exists)

**Interfaces:**
- None runtime. Documents the env switch from `ADMIN_PASSWORD` to `SUPERADMIN_USERNAME` + `SUPERADMIN_PASSWORD`.

- [ ] **Step 1: Update env example**

Read `.env.example` if present. Replace `ADMIN_PASSWORD=...` with:

```env
SUPERADMIN_USERNAME=superadmin
SUPERADMIN_PASSWORD=change-this
```

Keep `AUTH_SECRET`, `AUTH_MAX_AGE_SECONDS`, `AUTH_COOKIE_NAME`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` as-is. Remove `ADMIN_PASSWORD`.

- [ ] **Step 2: Update README env section**

If README documents env vars, update the same swap. Add one line: "Akun superadmin berasal dari env. Admin cabang dibuat oleh superadmin via UI (/admins)."

- [ ] **Step 3: Commit**

```bash
git add .env.example README.md
git commit -m "docs: SUPERADMIN_USERNAME/PASSWORD env; drop ADMIN_PASSWORD"
```

---

## Task 19: End-to-end verification + self-checks

**Files:**
- None (verification task).

- [ ] **Step 1: Run all self-checks**

Run: `npm run check`
Expected: all six self-checks print OK (booking, validation/booking, calendar, auth, password, authz, validation/admin).

- [ ] **Step 2: Typecheck whole project**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: success.

- [ ] **Step 4: Manual E2E (dev)**

Run: `npm run dev`. With migration applied, perform:

1. **Superadmin login** — username `superadmin` + `SUPERADMIN_PASSWORD`. Lands on dashboard; sidebar shows Admins/Branches/Settings.
2. **Create branch** — `/branches` → "Cabang baru" → name "Bandung", slug auto. Confirm row.
3. **Create admin** — `/admins` → "Admin baru" → username `kasirbd`, password `rahasia123`, branch "Bandung". Confirm row.
4. **Logout, admin login** — `kasirbd` / `rahasia123`. Sidebar hides Admins/Branches/Settings. Dashboard scoped.
5. **Admin creates class** — `/classes` → new class → no branch selector. Confirm class saved to Bandung.
6. **Admin creates session** — `/calendar`. Confirm session appears.
7. **Cross-branch guard** — As admin Bandung, attempt to fetch a Main Branch booking via direct action call (e.g., devtools) → expect 403 FORBIDDEN.
8. **Public booking** — open `/b/[magic_token]` for a Bandung session → submit booking → success.
9. **Inactive branch** — superadmin deactivates Bandung → public link shows error on new booking; existing bookings still listed.
10. **Deactivated admin** — superadmin deactivates `kasirbd` → next request by that admin → redirected to /login (token rejected via DB re-check).

- [ ] **Step 5: Commit any fixups**

If E2E surfaced fixes, commit them with clear messages. Otherwise no commit.

---

## Rollback

- Revert deploy to previous build.
- Restore DB snapshot taken before applying `0003_branches_and_admins.sql`.
- Restore `ADMIN_PASSWORD` env var.
- No dual-write layer exists; data created post-migration under new schema is lost on rollback.

---

## Spec Coverage Self-Check

| Spec requirement | Task |
|---|---|
| `branches` table | Task 3 |
| `admin_users` table (scrypt hash) | Task 3, 1 |
| `classes.branch_id` replaces `studio_id` | Task 3, 4 |
| `studios` stays global singleton | Task 3 (unchanged), 10 (`getStudio` unchanged) |
| Superadmin from env | Task 6 |
| Admin from DB, managed via UI | Task 9, 16 |
| Username + password login | Task 6, 12, 13 |
| Session claims with role + branch_id | Task 2, 6 |
| `assertSuperadmin` / `assertAdmin` / `assertBranchAccess` | Task 6, 7 |
| Server-side ownership check before RPC | Task 11 (`patchApproval`) |
| Branch-scoped dashboard/approvals/calendar/history/classes | Task 10, 11 |
| Public booking rejects inactive branch | Task 12 |
| `class_sessions` / `bookings` no `branch_id` column | Task 3 (not added), 10 (derived) |
| Migration single-transaction, Main Branch seed | Task 3 |
| Old admin account → superadmin | Task 18 (env swap), 6 |
| Big-bang rollout + maintenance window | Rollback section + Task 19 |
| Branch UI (CRUD + activate) | Task 15 |
| Admin UI (CRUD + reset password + assign branch) | Task 16 |
| Self-checks: auth role/branch, authz branch access | Task 2, 7 |
| No granular permissions / audit log / RLS / invite / rate limit | Excluded by design |
