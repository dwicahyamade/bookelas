# Bookelas Backend Design — 2026-08-11

Status: approved. Scope: Tahap 1–4 (core + notifications). Tahap 5 cron deferred.

## 1. Goal

Make the existing frontend real: replace in-memory fixtures in `lib/api/*` with a
Supabase-backed Next.js Route Handler layer. Public customers book a class via a
magic token and upload a payment proof; the studio admin approves/rejects bookings;
approval triggers an email confirmation (WhatsApp deferred to a stub).

Single tenant, single admin. Indonesian UI (error strings stay Indonesian).

## 2. Non-goals

- Tahap 5 cron reminder job (separate spec later).
- Real WhatsApp provider (module stubs it; swap when credentials ready).
- Multi-tenant / multi-admin / RLS policies.
- Public Storage bucket (proofs are private).

## 3. Source-of-truth for endpoints

The current frontend adapter `lib/api/{public,admin}.ts` is the frozen contract.
`plan-backend.md` lists a subset of endpoints; the **adapter function set** is the
real surface — backend must serve every function the frontend already calls.

### Public (`lib/api/public.ts`)
- `getSessionByToken(token) → PublicSession`
- `createBooking(input: CreateBookingInput) → Booking` (multipart, includes File)

### Admin (`lib/api/admin.ts`)
- `listApprovals(status?)`, `listApprovalsDetailed(status?) → ApprovalRow[]`
- `getApproval(id)`, `patchApproval(id, status)`
- `listSessionsByDate(startISO, endISO) → PublicSession[]`
- `createSession(input) → PublicSession`
- `listClasses()`, `createClass(input)`, `updateClass(id, input)`
- `getStudio()`, `updateStudio(input)`
- `getDashboardMetrics() → DashboardMetrics`

## 4. Architecture (Approach A: Route Handlers + Supabase server client)

```
Browser → lib/api/* (fetch → /api/...) → Route Handler → Supabase (service-role server client)
Route Handler also: Zod validate, auth-cookie check, Storage upload/signed-URL, Resend
```

- `lib/api/*` becomes a thin fetch layer over `/api/...`. Existing signatures stay
  identical so client components and React Query hooks don't change.
- Supabase service-role key is server-only; never shipped to browser.
- No RLS. Admin access is gated by server middleware + cookie auth.
  `# ponytail: no RLS, server-side middleware gates admin; add RLS when exposing a browser Supabase client`
- Middleware protects `/api/admin/*` and the `/(admin)/*` page routes.

## 5. Database

### 5.1 Schema

Use the DDL in `plan-backend.md` §2 verbatim (`studios`, `classes`,
`class_sessions`, `bookings`) plus the two indexes.

### 5.2 Atomic booking RPC (anti-oversell)

```sql
create or replace function approve_booking(p_booking_id uuid)
returns bookings language plpgsql as $$
declare b bookings%rowtype; s class_sessions%rowtype; cap int; approved int;
begin
  select * into b from bookings where id = p_booking_id;
  if not found then raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0002'; end if;
  if b.status <> 'PENDING' then return b; end if;

  -- Lock the SESSION row: serializes concurrent approvals across different
  -- bookings of the same session (locking only the booking row would not).
  select * into s from class_sessions where id = b.session_id for update;

  select c.capacity into cap
    from class_sessions cs join classes c on c.id = cs.class_id
   where cs.id = b.session_id;
  select count(*) into approved from bookings where session_id = b.session_id and status = 'APPROVED';

  if approved >= cap then
    raise exception 'CLASS_FULL' using errcode = 'P0003';
  end if;

  update bookings set status = 'APPROVED' where id = p_booking_id returning * into b;
  return b;
end; $$;
```

The `for update` on `class_sessions` is the real lock: two concurrent
`approve_booking` calls for *different* bookings of the same session serialize on
the session row, so the `approved` count is read consistently. Locking only the
booking row would race across siblings. `patchApproval` calls `approve_booking`;
`CLASS_FULL`/`BOOKING_NOT_FOUND` SQLstates map to the existing `ApiError` codes.
Rejection stays a plain UPDATE.

### 5.3 Capacity check on booking

Public POST still runs the non-atomic `capacity - approved_count` count for a fast
UX reject, but the RPC on approval is the hard ceiling, so a count race cannot
oversell.

### 5.4 Storage

Private bucket `payment-proofs`. Upload via service role on public POST; admin
preview via signed URL (15 min TTL) materialized when building `ApprovalRow`/
`PublicSession` responses.

### 5.5 Seed

1 studio, 2 classes, a few sessions — mirrors `lib/mock/*.json` so the frontend
looks identical after the swap.

## 6. Files

Route Handler files are required Next.js folders; helpers are folded in.

- `lib/server/supabase.ts` — server client factory (url + service key from env).
- `lib/server/auth.ts` — `login(password) → setCookie`, `verify(req)`, `logout`.
  Cookie value = `crypto.randomUUID()` HMAC-signed with `AUTH_SECRET`; httpOnly,
  SameSite=Lax, Secure in prod.
- `lib/server/notify.ts` — `sendBookingConfirmed(...)`: Resend email active,
  WhatsApp no-op/structured-log (provider deferred).
- `middleware.ts` — gate `/api/admin/*` and `/(admin)/*`.
- `app/api/admin/login/route.ts`, `app/api/admin/logout/route.ts`.
- Public routes under `app/api/public/...`, admin under `app/api/admin/...`,
  matching the adapter surface in §3.
- Migration: `supabase/migrations/0001_init.sql` (DDL + RPC + seed).
- Storage policy: `supabase/seed/storage.sql` (private bucket create).

`lib/api/*` rewritten to thin fetchers; existing types and `ApiError` reused.

## 7. Notification behavior

On APPROVED: DB update first, then attempt Resend email. Notification failure is
logged/returned to the client as a soft warning; it must not fail the approval.
WhatsApp path is a no-op log now.

## 8. Env (add to `.env.example`)

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_PASSWORD=
AUTH_SECRET=
RESEND_API_KEY=
EMAIL_FROM=
```

(`NEXT_PUBLIC_APP_URL` already present.)

## 9. Testing

Per ponytail: non-trivial logic leaves one runnable check.

- `lib/server/auth.self-check.ts` — HMAC sign/verify round-trip + tamper reject.
- `lib/server/booking.self-check.ts` — `approve_booking` SQL logic verified via a
  temp test database or, if Supabase CLI present, a one-shot script asserting the
  three outcomes (approved, CLASS_FULL, BOOKING_NOT_FOUND).
- `npm run check` extended to include the new self-check files.

No framework. Trivial fetcher wiring needs no test.

## 10. Deferred

- Tahap 5 cron (24h class reminder).
- Real WhatsApp provider swap.
- RLS + browser Supabase client (if multi-admin/tenant appears).
