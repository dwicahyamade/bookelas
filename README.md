# Bookelas

Class booking for mindful-movement studios (Yoga / Pilates). Mobile-first public magic-link booking flow; desktop admin shell.

## Status

Full-stack MVP. Frontend talks to Supabase (PostgreSQL + Storage) through Next.js 16 Server Actions in `lib/api/*`. Admin routes are gated by a signed httpOnly cookie (`/(admin)/layout.tsx` server-side guard).

## Quick start

```bash
cp .env.example .env.local   # fill in Supabase + ADMIN_PASSWORD + AUTH_SECRET + Resend
npm install
npm run dev
```

Open the demo magic link (requires seeded Supabase): <http://localhost:3000/b/11111111-1111-1111-1111-222222222222>

Admin: <http://localhost:3000/login> with `ADMIN_PASSWORD`.

## Scripts

- `npm run dev` — Next.js dev server
- `npm run build` — production build
- `npm run check` — runnable self-checks for booking logic, validation, calendar, and auth token signing

## Layout

### Customer (public, no chrome, mobile-first)
- `/b/[magic_token]` — class summary, slot meter, booking form, payment instructions, proof upload, pending confirmation

### Admin (sidebar shell, desktop-first, auth-gated)
- `/login` — env-password login
- `/dashboard` — metrics, next session, quick actions
- `/approvals` — verification queue, proof preview dialog, approve/reject
- `/calendar` — weekly grid, copy magic link, create session
- `/classes` — master class CRUD
- `/settings` — studio profile (name, WhatsApp, bank info)

### Data flow
- `lib/api/*` — `"use server"` actions; the only place UI invokes server work.
- `lib/server/*` — Supabase client, auth token, data layer, storage, notify. Server-only.
- No `/api/*` Route Handlers; no browser Supabase client; no RLS.

## Env

See `.env.example`. Key vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD`, `AUTH_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`.

## Notes

Approval is atomic via the `approve_booking(uuid)` RPC (locks the `class_sessions` row, counts approved, refuses on `CLASS_FULL`). WhatsApp is a structured-log stub; swap the provider when credentials are ready. Tahap 5 cron reminder is deferred.
