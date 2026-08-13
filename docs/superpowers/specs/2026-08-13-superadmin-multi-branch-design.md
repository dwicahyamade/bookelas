# Superadmin + Multi-Branch Booking — Design

**Tanggal:** 2026-08-13
**Status:** Approved (pre-implementation review)
**Tipe:** Architectural

## Ringkasan

Bookelas saat ini hanya punya satu level user (admin, autentikasi via password tunggal dari env) dan semua data operasional berada di satu tenant studio global. Perubahan ini menambahkan:

1. Hierarki akses dua tingkat: **superadmin** (global) dan **admin** (per-branch).
2. **Multi-branch booking** — data booking, kelas, dan sesi diisolasi per cabang.

Target: fondasi terkecil yang aman untuk multi-branch, tanpa over-engineering.

## Konteks repo yang relevan

- `studios` saat ini adalah singleton: `getStudio()`/`updateStudio()` tanpa parameter ID. Menyimpan profil bisnis global (nomor WhatsApp, info rekening).
- `classes` punya `studio_id` (FK ke `studios`).
- `class_sessions` memiliki `magic_token` (UUID unik) untuk link publik `/b/[magic_token]`.
- `bookings` status: `PENDING|APPROVED|REJECTED|CANCELLED`.
- RPC `approve_booking(p_booking_id)` memakai pessimistic lock (`FOR UPDATE`) pada baris session; error code `P0003` = CLASS_FULL, `P0002` = NOT_FOUND.
- Auth saat ini: password tunggal dari `ADMIN_PASSWORD`, custom HMAC-SHA256 JWT (`lib/server/auth.ts`, `lib/server/auth-token.ts`).
- Server Actions: `lib/api/admin.ts` (14 fungsi, semua guard `assertAdmin()`), `lib/api/public.ts` (2 fungsi: `getSessionByToken`, `createBooking`).
- Penanggalan: `Asia/Makassar` (WITA) via `lib/calendar.ts`.
- Self-check ponytail: `lib/booking.self-check.ts`, `lib/calendar.self-check.ts`, `lib/server/auth.self-check.ts`, `lib/validation/booking.self-check.ts`. Dijalankan via `npm run check`.

## Keputusan inti

| # | Keputusan | Pilihan |
|---|---|---|
| 1 | Akses superadmin | Global: kelola semua branch, user, kelas, sesi, booking; menetapkan admin ke branch |
| 2 | Manajemen user admin | Dikelola via UI superadmin (CRUD, reset password, assign branch) |
| 3 | Login | Username + password |
| 4 | Sumber superadmin | Env (`SUPERADMIN_USERNAME`, `SUPERADMIN_PASSWORD`) |
| 5 | Sumber admin | DB (`admin_users`) |
| 6 | Relasi admin-branch | Satu admin = satu branch |
| 7 | Konsep branch | Tabel `branches` baru, terpisah dari `studios` |
| 8 | Relasi studio-branch | Satu studio global, banyak branch |
| 9 | Kelas antar-branch | Kelas milik satu branch; nama boleh sama antar-branch |
| 10 | Migrasi data lama | Semua masuk branch `Main Branch` |
| 11 | WhatsApp + rekening | Tetap global di `studios`, bukan per-branch |
| 12 | Akun admin lama | Dipetakan ke superadmin baru |
| 13 | Migrasi env password | Salin `ADMIN_PASSWORD` → `SUPERADMIN_PASSWORD`, tambah `SUPERADMIN_USERNAME=superadmin`, hapus `ADMIN_PASSWORD` |

## Arsitektur data (opsi A — branch diturunkan dari relasi)

```text
studios (1 row global)
  └── branches
        └── classes
              └── class_sessions
                    └── bookings
```

Hanya `classes` yang mendapat kolom branch baru (`branch_id`). Session dan booking mengetahui branch melalui relasi induk (join). Tidak ada `branch_id` duplikat di `class_sessions` atau `bookings`. Opsi B (`branch_id` di setiap tabel) ditolak karena memerlukan trigger/sinkronisasi yang tidak diperlukan untuk MVP.

### Tabel baru: `branches`

```text
id          uuid PK
name        text NOT NULL
slug        text UNIQUE NOT NULL
is_active   boolean NOT NULL DEFAULT true
created_at  timestamptz NOT NULL DEFAULT now()
updated_at  timestamptz NOT NULL DEFAULT now()
```

### Tabel baru: `admin_users`

```text
id              uuid PK
username        text UNIQUE NOT NULL (case-insensitive)
password_hash   text NOT NULL            -- scrypt hash, bukan plaintext
branch_id       uuid NOT NULL REFERENCES branches(id)
is_active       boolean NOT NULL DEFAULT true
created_at      timestamptz NOT NULL DEFAULT now()
updated_at      timestamptz NOT NULL DEFAULT now()
```

### Perubahan tabel: `classes`

```diff
- studio_id
+ branch_id uuid NOT NULL REFERENCES branches(id)
```

### Aturan data

- Satu branch → banyak kelas.
- Satu kelas → satu branch.
- Satu admin → satu branch.
- Nama kelas boleh sama pada branch berbeda; harga/kapasitas dapat berbeda.
- Branch nonaktif tidak boleh menerima booking baru.
- Branch nonaktif tidak boleh dipilih untuk admin baru.
- Branch dengan kelas existing tidak boleh dihapus; gunakan `is_active = false`.
- `class_sessions` dan `bookings` tidak menyimpan `branch_id`; diturunkan dari class.
- Session dan booking publik menentukan branch dari session → class, bukan dari payload client.

## Autentikasi

### Form login

```text
username
password
```

### Alur verifikasi

1. Cocokkan `username` dengan `SUPERADMIN_USERNAME` (env).
2. Jika cocok, verifikasi `SUPERADMIN_PASSWORD`.
3. Jika tidak, cari `admin_users.username` (case-insensitive).
4. Verifikasi `password_hash` (scrypt).
5. Tolak jika `is_active = false`.
6. Terbitkan session cookie.

Env:

```env
SUPERADMIN_USERNAME=superadmin
SUPERADMIN_PASSWORD=change-this
```

### Session claims

```text
user_id
username
role: superadmin | admin
branch_id: uuid | null       -- null untuk superadmin
exp
```

Cookie tetap `httpOnly`, `sameSite=lax`, `secure` di production. TTL sesuai `AUTH_MAX_AGE_SECONDS` (default 12 jam).

### Mekanisme otorisasi

- `assertAdmin()` ditingkatkan menjadi pemeriksaan role + `branch_id`.
- Dipecah menjadi:
  - `assertSuperadmin()` — hanya superadmin.
  - `assertAdmin()` — admin atau superadmin.
  - `assertBranchAccess(resourceBranchId)` — admin hanya boleh akses branch sendiri; superadmin bebas.
- Resource admin selalu divalidasi terhadap `branch_id` dari session, **bukan** dari payload client.
- `branch_id` dari client hanya untuk tampilan/filter client-side; bukan sumber otorisasi.
- Status user (`is_active`) dicek ulang dari DB pada request terproteksi, agar deactivation berlaku tanpa menunggu token kedaluwarsa.
- Tidak ada RLS kompleks pada MVP; isolasi dilakukan terpusat di server (lapisan guard).

### Lifecycle admin

- Username unik, case-insensitive.
- Username superadmin adalah reserved (tidak boleh dipakai admin).
- Admin baru wajib memilih branch aktif.
- Admin nonaktif tidak dapat login.
- Branch nonaktif tidak dapat dipilih untuk admin baru.
- Admin lama pada branch yang dinonaktifkan tetap tersimpan, tetapi tidak dapat mengelola booking.

## Model akses MVP

| Fitur | Superadmin | Admin |
|---|:---:|:---:|
| Dashboard | Semua branch | Branch sendiri |
| Branch (CRUD, aktivasi) | Ya | Lihat branch sendiri |
| Admin user (CRUD, reset password, assign branch) | Ya | Tidak |
| Studio settings | Ya | Tidak |
| Classes | Semua branch | Branch sendiri |
| Sessions | Semua branch | Branch sendiri |
| Approval / cancel booking | Semua branch | Branch sendiri |
| Booking publik | Tanpa login | Tanpa login |

## Alur booking dan isolasi branch

### Alur admin

1. Superadmin membuat branch.
2. Superadmin membuat admin, memilih tepat satu branch aktif.
3. Admin login dengan username + password.
4. Admin membuat kelas tanpa mengirim `branch_id`; server mengambil branch dari session admin.
5. Superadmin memilih branch saat membuat kelas.
6. Session otomatis mengikuti branch dari kelas.
7. Booking otomatis mengikuti branch dari session → class.
8. Semua daftar, approval, cancellation, dashboard admin terfilter server-side.

### Alur publik

```text
magic_token
  → class_session
  → class
  → branch
  → validasi branch aktif
  → create booking (status PENDING)
```

Tidak ada dropdown branch pada booking publik. Link sesi (`magic_token`) menentukan branch.

### Aturan branch nonaktif

- Tidak boleh membuat kelas/session baru.
- Tidak menerima booking baru.
- Link publik lama menampilkan sesi tidak tersedia.
- Booking existing tetap tersimpan.
- Approval/cancellation existing tetap dapat dilakukan superadmin.
- Admin branch nonaktif tidak dapat mengelola booking.

### Perubahan server

- Tambah `getCurrentUser()` → `{ role, branch_id, username, user_id }`.
- Guard baru: `assertSuperadmin()`, `assertAdmin()`, `assertBranchAccess(resourceBranchId)`.
- Semua Server Action admin memakai guard resource.
- RPC approval tetap memakai lock existing; ownership diverifikasi **sebelum** RPC.
- `createBooking()` mengambil branch dari session; bukan dari payload.

## Migrasi data

Satu transaksi:

1. Buat tabel `branches`, insert `Main Branch` (slug `main`).
2. Buat tabel `admin_users`.
3. `ALTER TABLE classes`: drop `studio_id`, add `branch_id uuid NOT NULL DEFAULT 'main-branch-id'`, lalu hapus default.
4. `class_sessions` dan `bookings` tidak diubah.
5. Env: `ADMIN_PASSWORD` → `SUPERADMIN_PASSWORD`; tambah `SUPERADMIN_USERNAME=superadmin`; hapus `ADMIN_PASSWORD`.

Akun admin lama (password tunggal dari env) dipetakan ke superadmin baru.

## Rollout

- **Big bang + maintenance window** — paling minimal untuk skala studio.
- Jalankan migrasi saat jendela maintenance → deploy kode baru → validasi login superadmin.
- Rollback: revert deploy + restore DB snapshot. Tidak ada dual-write, tidak ada backward-compat layer.

## UI surface

### Route baru (superadmin)

```text
/admin/branches    — CRUD branch, aktivasi
/admin/admins      — CRUD admin, reset password, assign branch
```

### Route existing (branch-aware)

```text
/approvals    — filter branch sendiri (implisit)
/calendar     — filter branch sendiri
/classes      — filter branch sendiri
/history      — filter branch sendiri
/dashboard    — metrik branch sendiri
/settings     — superadmin only
```

- Admin tidak punya pemilih branch.
- Superadmin lihat semua; ada filter branch opsional (client-side; otoritas tetap server-side).

## Testing (ponytail: self-check, no framework)

- `auth.self-check`: tambah kasus role superadmin vs admin, `branch_id` null vs uuid, token tampered.
- `authz.self-check` baru: `assertBranchAccess()` — admin akses branch sendiri (ok), branch lain (403), superadmin (ok semua), resource tanpa branch (403).
- Booking flow: branch nonaktif menolak booking baru; session di branch nonaktif tampil tidak tersedia.
- RPC approval: ownership dicek sebelum lock; admin akses booking branch lain → 403 (bukan CLASS_FULL).
- Tetap dijalankan via `npm run check`.

## Yang tidak masuk MVP

- Permission granular.
- Audit log.
- RLS kompleks.
- Soft-delete branch (cukup `is_active`).
- Multi-branch per admin.
- Invite link.
- Rate limiting login.
- `branch_id` duplikat di `class_sessions` / `bookings`.
- Dropdown branch pada booking publik.
