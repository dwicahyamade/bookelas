# Bookelas

Class booking for mindful-movement studios (Yoga / Pilates). Mobile-first public magic-link booking flow; desktop admin shell (planned).

## Status

Frontend MVP. Data is served from local JSON fixtures behind a typed API seam (`lib/api/`). Backend is not built yet — replacing the adapter with `fetch` calls is the only change needed to go live.

## Quick start

```bash
cp .env.example .env.local   # optional, defaults work for dev
npm install
npm run dev
```

Open the demo magic link: <http://localhost:3000/b/demo-token>

## Scripts

- `npm run dev` — Next.js dev server
- `npm run build` — production build
- `npm run check` — runnable self-checks for booking logic and validation

## Layout

### Customer (public, no chrome, mobile-first)
- `/b/[magic_token]` — class summary, slot meter, booking form, payment instructions, proof upload, pending confirmation

### Admin (sidebar shell, desktop-first)
- `/dashboard` — metrics, next session, quick actions
- `/approvals` — verification queue, proof preview dialog, approve/reject
- `/calendar` — weekly grid, copy magic link, create session
- `/classes` — master class CRUD
- `/settings` — studio profile (name, WhatsApp, bank info)

### Data seam
- `lib/api/` — the only place UI reads/writes data. Swap this for backend `fetch` calls to go live.
- `lib/mock/` — fixture data; UI never imports this directly.

## Demo tokens

- `/b/demo-token` — Mat Pilates Reformer Intro (7/10 approved)
- `/b/power-yoga-demo` — Power Yoga (has a pending booking)

## Notes

Customer flow is a single client-rendered page; SSR/server-component migration is deferred until backend auth exists. Auth guard on admin routes is intentionally absent until Supabase Auth exists — both are marked with `ponytail:` comments.
