# Bookelas Frontend Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Bookelas MVP frontend: a mobile-first public magic-link booking flow plus a desktop admin shell and management pages, with a mock-backed API seam ready for the future backend.

**Architecture:** Next.js App Router routes public booking under `app/(customer)/b/[magic_token]/` and admin pages under `app/(admin)/`. UI reads and mutates data only through typed functions in `lib/api/`; local JSON fixtures implement the first adapter. TanStack Query owns client cache/mutations. Replacing the adapter with backend `fetch` calls must not require page changes.

**Tech Stack:** Next.js 16.3.0 (App Router + Turbopack) · React 19.2.8 · TypeScript 5.6.3 · Tailwind CSS 3.4.15 · local Tailwind primitives (no shadcn/ui dependency currently) · lucide-react · TanStack Query v5 · React Hook Form · Zod · Sonner · `next/font/google` (Lora + Manrope) · npm.

## Global Constraints

- Mobile-first public customer UI; desktop-first high-density admin UI.
- Customer route has no navigation chrome and requires no login.
- Admin routes use one shared protected-layout seam; no real auth until backend Auth exists.
- UI must not import mock fixtures directly; only `lib/api/` may do so.
- Form fields: `name`, `wa`, `email`, `file_bukti`; validate with Zod and React Hook Form.
- File validation: image/PDF only, maximum 5 MB; reject invalid files before submission.
- Booking statuses are exactly `PENDING`, `APPROVED`, `REJECTED`.
- API failures use a structured `ApiError`; mutations show a toast and preserve user input.
- Backend must revalidate all inputs; frontend validation is not a security boundary.
- MVP skips i18n, analytics, dark-mode toggle, realtime subscriptions, and a test framework.
- Every non-trivial logic path leaves one runnable self-check; mark deliberate ceilings with a `ponytail:` comment.

---

## File Map

### Setup and shared infrastructure

- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `postcss.config.mjs`, `tailwind.config.ts`
- Create: `app/globals.css`, `app/layout.tsx`, `app/page.tsx`
- Create: `components/providers.tsx`, `components/ui/*` (only shadcn primitives used by current phase)
- Create: `.env.example`, `README.md`

### Types, fixtures, and API seam

- Create: `lib/types.ts`
- Create: `lib/errors.ts`
- Create: `lib/validation/booking.ts`
- Create: `lib/mock/studios.json`, `lib/mock/classes.json`, `lib/mock/sessions.json`, `lib/mock/bookings.json`
- Create: `lib/api/public.ts`, `lib/api/admin.ts`
- Create: `lib/booking.ts` (remaining-slot calculation)

### Customer page

- Create: `app/(customer)/b/[magic_token]/page.tsx`
- Create: `app/(customer)/b/[magic_token]/loading.tsx`
- Create: `app/(customer)/b/[magic_token]/not-found.tsx`
- Create: `components/customer/session-summary.tsx`
- Create: `components/customer/booking-form.tsx`
- Create: `components/customer/booking-success.tsx`
- Create: `components/customer/file-upload.tsx`

### Future admin pages

- Create: `app/(admin)/layout.tsx`, `components/admin/admin-shell.tsx`, `components/admin/sidebar.tsx`, `components/admin/topbar.tsx`
- Create: `app/(admin)/dashboard/page.tsx`
- Create: `app/(admin)/approvals/page.tsx`, `components/admin/approval-table.tsx`, `components/admin/approval-dialog.tsx`
- Create: `app/(admin)/calendar/page.tsx`, `components/admin/calendar-grid.tsx`, `components/admin/session-dialog.tsx`
- Create: `app/(admin)/classes/page.tsx`, `components/admin/class-table.tsx`, `components/admin/class-dialog.tsx`
- Create: `app/(admin)/settings/page.tsx`

### Self-checks

- Create: `lib/booking.self-check.ts`
- Create: `lib/validation/booking.self-check.ts`

---

## Task 1: Initialize the Next.js application

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `postcss.config.mjs`, `tailwind.config.ts`
- Create: `app/globals.css`, `app/layout.tsx`, `app/page.tsx`
- Create: `components/providers.tsx`
- Create: `.env.example`, `README.md`

**Interfaces:**
- Produces a runnable Next.js app at `/` and `/dashboard` redirect.
- `components/providers.tsx` exports `Providers({ children }: { children: React.ReactNode }): JSX.Element`.

- [ ] **Step 1: Create the npm manifest with only required dependencies**

```json
{
  "scripts": { "dev": "next dev", "build": "next build", "start": "next start", "lint": "next lint" },
  "dependencies": {
    "@hookform/resolvers": "latest",
    "@tanstack/react-query": "^5.0.0",
    "class-variance-authority": "latest",
    "clsx": "latest",
    "lucide-react": "latest",
    "next": "^14.2.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-hook-form": "latest",
    "tailwind-merge": "latest",
    "zod": "latest"
  },
  "devDependencies": {
    "@types/node": "latest",
    "@types/react": "latest",
    "@types/react-dom": "latest",
    "autoprefixer": "latest",
    "eslint": "latest",
    "eslint-config-next": "^14.2.0",
    "postcss": "latest",
    "tailwindcss": "latest",
    "typescript": "latest"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`
Expected: exit code 0 and `node_modules/` created.

- [ ] **Step 3: Add Tailwind and root layout**

Use a neutral, accessible palette; set `lang="id"`; import `app/globals.css`; wrap children with `Providers`.

- [ ] **Step 4: Add the QueryClient provider**

Create a browser-only provider that constructs one `QueryClient` per component lifetime, then renders `QueryClientProvider`.

- [ ] **Step 5: Redirect the root route**

```tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/dashboard");
}
```

- [ ] **Step 6: Add environment documentation**

`.env.example` contains `NEXT_PUBLIC_APP_URL=http://localhost:3000`. README documents `npm install`, `npm run dev`, and the mock-only state.

- [ ] **Step 7: Verify the setup**

Run: `npm run build`
Expected: PASS; `/` resolves through the redirect even though admin pages are not implemented yet.

---

## Task 2: Add domain types, fixtures, validation, and mock API seam

**Files:**
- Create: `lib/types.ts`, `lib/errors.ts`, `lib/validation/booking.ts`, `lib/booking.ts`
- Create: `lib/mock/studios.json`, `lib/mock/classes.json`, `lib/mock/sessions.json`, `lib/mock/bookings.json`
- Create: `lib/api/public.ts`, `lib/api/admin.ts`
- Create: `lib/booking.self-check.ts`, `lib/validation/booking.self-check.ts`

**Interfaces:**

```ts
export type BookingStatus = "PENDING" | "APPROVED" | "REJECTED";
export type SessionStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED";

export interface Studio { id: string; name: string; wa_number: string; bank_info: string; }
export interface Class { id: string; studio_id: string; title: string; description: string; capacity: number; price: number; }
export interface ClassSession { id: string; class_id: string; start_time: string; end_time: string; magic_token: string; status: SessionStatus; }
export interface Booking { id: string; session_id: string; customer_name: string; customer_wa: string; customer_email: string; payment_proof_url: string; status: BookingStatus; created_at: string; }
export interface PublicSession extends ClassSession { class: Class; studio: Studio; approved_count: number; remaining_slots: number; }
export interface CreateBookingInput { session_id: string; customer_name: string; customer_wa: string; customer_email: string; payment_proof: File; }
```

```ts
export async function getSessionByToken(token: string): Promise<PublicSession>
export async function createBooking(input: CreateBookingInput): Promise<Booking>
export async function listApprovals(status?: BookingStatus): Promise<Booking[]>
export async function patchApproval(id: string, status: Exclude<BookingStatus, "PENDING">): Promise<Booking>
export function remainingSlots(capacity: number, approvedCount: number): number
```

- [ ] **Step 1: Write the self-checks first**

`lib/booking.self-check.ts` asserts `remainingSlots(10, 7) === 3`, clamps negative results to `0`, and treats a full class as `0`.

`lib/validation/booking.self-check.ts` asserts a valid payload passes and invalid email / missing file / oversized file fail.

- [ ] **Step 2: Run the checks to verify they fail**

Run: `node --experimental-strip-types lib/booking.self-check.ts`
Expected: FAIL because implementation files do not exist yet.

- [ ] **Step 3: Implement types and remaining-slot calculation**

```ts
export function remainingSlots(capacity: number, approvedCount: number) {
  return Math.max(0, capacity - approvedCount);
}
```

Add `// ponytail: fixture adapter is in-memory; replace with transactional DB query when backend exists.` above mock mutation functions.

- [ ] **Step 4: Implement Zod booking schema**

The schema validates trimmed name length `2..100`, WhatsApp string length `8..20`, a valid email, and a `File` that is `image/*` or `application/pdf` and no larger than `5 * 1024 * 1024` bytes. Export `bookingSchema` and `BookingFormValues`.

- [ ] **Step 5: Add fixtures**

Use one studio (`Zenith Pilates Studio`), two classes, one future `SCHEDULED` session with magic token `demo-token`, and one approved booking. Keep all IDs stable strings so the fixture is deterministic.

- [ ] **Step 6: Implement `ApiError`**

```ts
export class ApiError extends Error {
  constructor(public status: number, message: string, public code = "API_ERROR") {
    super(message);
    this.name = "ApiError";
  }
}
```

- [ ] **Step 7: Implement public adapter**

`getSessionByToken` joins the session, class, studio fixtures, counts approved bookings, calculates remaining slots, and throws `ApiError(404, "Sesi tidak ditemukan", "SESSION_NOT_FOUND")` for an unknown token.

`createBooking` rejects a full session with `ApiError(409, "Kelas sudah penuh", "SESSION_FULL")`, validates the input, creates an in-memory pending booking with a deterministic browser-safe ID, and returns it. File storage is represented by `file.name` in the fixture adapter; the future backend replaces this with multipart upload.

- [ ] **Step 8: Implement admin adapter surface needed later**

`listApprovals` filters fixture bookings by status. `patchApproval` updates an existing booking or throws `ApiError(404, "Booking tidak ditemukan", "BOOKING_NOT_FOUND")`; it accepts only `APPROVED` or `REJECTED`.

- [ ] **Step 9: Run self-checks**

Run: `node --experimental-strip-types lib/booking.self-check.ts; node --experimental-strip-types lib/validation/booking.self-check.ts`
Expected: PASS for both. If the installed Node version lacks `--experimental-strip-types`, run the equivalent through the project TypeScript tool after adding it; do not add a test framework.

---

## Task 3: Build the public magic-link booking page

**Files:**
- Create: `app/(customer)/b/[magic_token]/page.tsx`
- Create: `app/(customer)/b/[magic_token]/loading.tsx`
- Create: `app/(customer)/b/[magic_token]/not-found.tsx`
- Create: `components/customer/session-summary.tsx`
- Create: `components/customer/booking-form.tsx`
- Create: `components/customer/booking-success.tsx`
- Create: `components/customer/file-upload.tsx`

**Interfaces:**

```tsx
export default function BookingPage({ params }: { params: { magic_token: string } }): JSX.Element
export function SessionSummary({ session }: { session: PublicSession }): JSX.Element
export function BookingForm({ session, onSuccess }: { session: PublicSession; onSuccess: (booking: Booking) => void }): JSX.Element
export function BookingSuccess({ booking, session }: { booking: Booking; session: PublicSession }): JSX.Element
```

- [ ] **Step 1: Add the not-found and loading states**

`loading.tsx` renders a centered skeleton card. `not-found.tsx` renders “Sesi tidak ditemukan” and a short instruction to request a new WhatsApp link.

- [ ] **Step 2: Build the session summary**

Show studio name, class title, description, localized date/time (`id-ID`, `Asia/Makassar`), price in `IDR`, and `remaining_slots / capacity`. Use semantic headings and visible text labels; no emoji-only meaning.

- [ ] **Step 3: Build the file upload control**

Use a native `<input type="file" accept="image/*,application/pdf">`, a label styled as a dropzone, selected filename, and a local image preview when the selected file is an image. Forward the selected `File` through React Hook Form. Do not add a drag-and-drop library.

- [ ] **Step 4: Build the booking form**

Mark the component `"use client"`. Register `customer_name`, `customer_wa`, `customer_email`, and `payment_proof` through RHF + `zodResolver(bookingSchema)`. On submit call `createBooking({ session_id: session.id, ...values })`. Disable the submit button while pending, show inline field errors, and show an error message from `ApiError` without clearing fields.

- [ ] **Step 5: Build the success state**

After a successful mutation replace the form with a confirmation card showing `PENDING`, class/session details, and instruction that studio verification will be sent via WhatsApp/email. Keep the booking ID available in the rendered confirmation for support.

- [ ] **Step 6: Compose the route page**

The page loads `getSessionByToken(params.magic_token)` on the server boundary for the fixture adapter, calls `notFound()` on `SESSION_NOT_FOUND`, and renders a compact mobile-first card with Bookelas branding, summary, payment instructions, form, and footer. If remaining slots are `0`, render a full-state message and do not allow submission.

- [ ] **Step 7: Verify the customer flow**

Run: `npm run build`
Expected: PASS. Start with `npm run dev`, open `http://localhost:3000/b/demo-token`, verify the summary, invalid email/file errors, valid submit, pending confirmation, and full-session disabled state by changing the fixture count.

---

## Task 4: Add the admin shell and dashboard

**Files:**
- Create: `app/(admin)/layout.tsx`, `components/admin/admin-shell.tsx`, `components/admin/sidebar.tsx`, `components/admin/topbar.tsx`, `app/(admin)/dashboard/page.tsx`

**Interfaces:**

```tsx
export function AdminShell({ children }: { children: React.ReactNode }): JSX.Element
```

- [ ] **Step 1: Create shared admin shell**

Render sidebar links for Dashboard, Calendar, Approvals, Classes, Settings. Add active route styling, mobile collapse using a native button, and a topbar with studio label and static user menu placeholder. Add `// ponytail: auth guard is intentionally absent until Supabase Auth exists.`

- [ ] **Step 2: Build dashboard metrics**

Read fixture data through API functions only. Show pending approval count, today’s sessions, approved bookings, and the next session. Add links to Approvals, Calendar, and Classes.

- [ ] **Step 3: Verify**

Run: `npm run build`; open `/dashboard`; verify shell navigation and metrics.

---

## Task 5: Build the approvals queue

**Files:**
- Create: `app/(admin)/approvals/page.tsx`, `components/admin/approval-table.tsx`, `components/admin/approval-dialog.tsx`

- [ ] **Step 1: Render pending bookings**

Use `useQuery` with `listApprovals("PENDING")`; show customer, contact, session, amount placeholder from class, created time, and proof action.

- [ ] **Step 2: Add proof preview dialog**

Use shadcn Dialog. Render image preview when URL is an image; otherwise render a file link. Keep dialog keyboard accessible.

- [ ] **Step 3: Add approve/reject mutations**

Use `useMutation`, call `patchApproval`, invalidate approvals and dashboard queries, show success/error toast, and disable the clicked action while pending. Reject requires a confirmation dialog.

- [ ] **Step 4: Verify**

Open `/approvals`; approve the fixture booking after changing its status to pending; confirm it leaves the list and the dashboard count changes.

---

## Task 6: Build calendar and session creation

**Files:**
- Create: `app/(admin)/calendar/page.tsx`, `components/admin/calendar-grid.tsx`, `components/admin/session-dialog.tsx`

- [ ] **Step 1: Implement week calculation**

Create a local helper that returns Monday–Sunday dates for the selected week and groups sessions by local date. Leave the timezone fixed to `Asia/Makassar` for fixture display.

- [ ] **Step 2: Render the calendar grid**

Show week navigation, one column per day, session title/time, occupancy, status badge, and a Copy Magic Link button using `navigator.clipboard.writeText`. Show a toast on success/failure.

- [ ] **Step 3: Add new-session dialog**

Validate class, start/end time, and create a session through the API seam. Generate or return `magic_token` from the adapter; display the generated link after creation.

- [ ] **Step 4: Verify**

Open `/calendar`, navigate weeks, copy a link, create a session, and confirm it appears in the selected week.

---

## Task 7: Build classes management

**Files:**
- Create: `app/(admin)/classes/page.tsx`, `components/admin/class-table.tsx`, `components/admin/class-dialog.tsx`

- [ ] **Step 1: Render class table**

Show title, capacity, price, description, and session count. Keep the table responsive with horizontal overflow inside the table container only.

- [ ] **Step 2: Add create/edit dialog**

Use RHF + Zod for title, capacity, price, and description. Call the typed adapter function and invalidate class/session queries.

- [ ] **Step 3: Verify**

Create and edit a class; reload and confirm fixture adapter state remains available for the browser session.

---

## Task 8: Build settings page and final verification

**Files:**
- Create: `app/(admin)/settings/page.tsx`
- Modify: `lib/api/admin.ts` to add `getStudio()` and `updateStudio(input: Pick<Studio, "name" | "wa_number" | "bank_info">)`.

- [ ] **Step 1: Build the settings form**

Use RHF + Zod for studio name, WhatsApp number, and bank info. Save through `updateStudio`, invalidate studio queries, and show a toast.

- [ ] **Step 2: Verify all routes**

Run: `npm run build`
Expected: PASS.

Manual checklist:
- `/` redirects to `/dashboard`.
- `/b/demo-token` loads the customer flow.
- Invalid magic token shows not-found.
- Invalid customer input stays on the form with errors.
- Valid booking shows pending confirmation.
- `/dashboard`, `/approvals`, `/calendar`, `/classes`, `/settings` render inside one shell.
- Admin mutations invalidate visible counts/lists.
- No page imports JSON fixtures directly.

- [ ] **Step 3: Update README**

Document all routes, the mock adapter limitation, the demo token, and the future replacement point (`lib/api/`).
