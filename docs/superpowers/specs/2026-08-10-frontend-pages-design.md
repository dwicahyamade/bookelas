# Frontend Pages Design — Bookelas MVP

Tanggal: 2026-08-10. Sumber: `plan-frontend.md` (repo greenfield, hanya dua file plan).

## Tujuan

Bangun seluruh halaman frontend Bookelas. Backend belum ada → frontend pakai mock/fixture lokal di balik seam `lib/api/`. Tujuan akhir: ganti isi fungsi `lib/api/` = sambung backend, UI tak berubah.

## Stack

Next.js 14+ (App Router, TS) · Tailwind · shadcn/ui (Button, Input, Card, Dialog, Table, Badge, Select, Sonner) · lucide-react · TanStack Query v5 · React Hook Form + Zod. Package manager: **npm**.

## Halaman (8, 2 grup)

### Customer — mobile-first, tanpa navbar

| Route | Tujuan |
|---|---|
| `/b/[magic_token]` | Detail kelas + form booking + info bank + upload bukti transfer |

### Admin — desktop high-density, shell sidebar+topbar

| Route | Tujuan |
|---|---|
| `(admin)/layout.tsx` | Shell: Sidebar nav + Topbar (user menu) |
| `/dashboard` | Metrik (sisa slot, pending approvals, sesi hari ini) + quick actions |
| `/approvals` | Tabel antrian + modal preview bukti + approve/reject |
| `/calendar` | Grid mingguan sesi, copy magic link, tambah/edit sesi |
| `/classes` | Master kelas (CRUD) + daftar sesi per kelas |
| `/settings` | Konfigurasi studio (nama, no. WA, bank info) |

### Root

`app/page.tsx` → redirect `/dashboard`.

## Data layer

- `lib/types.ts` — tipe resource cocok skema backend (`studios`, `classes`, `class_sessions`, `bookings`).
- `lib/mock/*.json` — fixture statis.
- `lib/api/*.ts` — fungsi tiper per-resource (`getSessionByToken`, `createBooking`, `listApprovals`, `patchApproval`, `listSessions`, `createClass`, …). Versi 1 baca/tulis fixture; versi 2 ganti ke `fetch` backend.

Komponen UI hanya import dari `lib/api/` + TanStack Query hooks — tak ada akses langsung ke mock. Seam tunggal.

## Validasi & state

- Form customer: RHF + Zod (`name`, `wa`, `email`, `file_bukti`). Upload preview + validasi tipe/ukuran.
- Mutasi admin (approve/reject, CRUD): TanStack Query `useMutation` + invalidasi query terkait. Toast via Sonner.
- Status booking: `PENDING → APPROVED | REJECTED`. UI customer menampilkan status real-time-ish (poll/manual refresh di MVP; realtime hook jika backend nanti).

## Error handling

- API seam melempar `ApiError` terstruktur. UI tangkap di `onError` mutation/query → toast.
- Validasi trust boundary: Zod di sisi form; backend wajib re-validasi (dokumen catatan, bukan frontend).

## Urutan eksekusi

1. **Setup** — init Next.js, deps, shadcn/ui init, QueryClientProvider di root layout, `page.tsx` redirect.
2. **Types + mock + API seam** — `lib/types.ts`, `lib/mock/`, `lib/api/`.
3. **Customer booking page** `/b/[magic_token]` — halaman pertama dibangun penuh.
4. **Admin shell + dashboard**.
5. **Approvals** (tabel + modal).
6. **Calendar** (grid mingguan + copy link + tambah sesi).
7. **Classes** (master CRUD).
8. **Settings**.

## Yang sengaja dilewati (YAGNI)

- SSR/server components otomatis — semua client component dulu; tambah saat backend auth ada. Upgrade: pindahkan fetch ke server component.
- i18n, dark mode toggle, analytics — MVP single-mode.
- Realtime subscription — poll/manual refresh; upgrade saat Supabase realtime aktif.
- Testing framework — cek self-run di logic non-trivial (validasi Zod, hitung sisa slot). `ponytail:` ceiling.
