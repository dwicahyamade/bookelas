import { ApiError } from "@/lib/errors";
import { remainingSlots } from "@/lib/booking";
import type { Booking, BookingStatus, Class, ClassSession, PublicSession, SessionStatus, Studio } from "@/lib/types";
import bookingsFixture from "@/lib/mock/bookings.json";
import sessionsFixture from "@/lib/mock/sessions.json";
import classesFixture from "@/lib/mock/classes.json";
import studiosFixture from "@/lib/mock/studios.json";

// ponytail: fixture adapter, in-memory; replace with Supabase queries when backend exists.

const bookings = bookingsFixture as Booking[];
const sessions = sessionsFixture as ClassSession[];
const classes = classesFixture as Class[];
const studios = studiosFixture as Studio[];

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function listApprovals(status?: BookingStatus): Promise<Booking[]> {
  await delay(120);
  return bookings
    .filter((b) => (status ? b.status === status : true))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export interface ApprovalRow extends Booking {
  session: PublicSession;
}

export async function listApprovalsDetailed(status?: BookingStatus): Promise<ApprovalRow[]> {
  const list = await listApprovals(status);
  return list.map((b) => {
    const s = sessions.find((x) => x.id === b.session_id);
    if (!s) throw new ApiError(500, "Sesi booking tidak ditemukan", "SESSION_DATA_INCOMPLETE");
    const cls = classes.find((c) => c.id === s.class_id)!;
    const studio = studios.find((st) => st.id === cls.studio_id)!;
    const approvedCount = bookings.filter((x) => x.session_id === s.id && x.status === "APPROVED").length;
    const session: PublicSession = { ...s, class: cls, studio, approved_count: approvedCount, remaining_slots: remainingSlots(cls.capacity, approvedCount) };
    return { ...b, session };
  });
}

function joinSession(b: Booking): ApprovalRow {
  const s = sessions.find((x) => x.id === b.session_id);
  if (!s) throw new ApiError(500, "Sesi booking tidak ditemukan", "SESSION_DATA_INCOMPLETE");
  const cls = classes.find((c) => c.id === s.class_id)!;
  const studio = studios.find((st) => st.id === cls.studio_id)!;
  const approvedCount = bookings.filter((x) => x.session_id === s.id && x.status === "APPROVED").length;
  return { ...b, session: { ...s, class: cls, studio, approved_count: approvedCount, remaining_slots: remainingSlots(cls.capacity, approvedCount) } };
}

export async function getBooking(id: string): Promise<ApprovalRow> {
  await delay(120);
  const b = bookings.find((x) => x.id === id);
  if (!b) throw new ApiError(404, "Booking tidak ditemukan", "BOOKING_NOT_FOUND");
  return joinSession(b);
}

export async function patchApproval(
  id: string,
  status: Exclude<BookingStatus, "PENDING">
): Promise<Booking> {
  await delay(200);
  const booking = bookings.find((b) => b.id === id);
  if (!booking) throw new ApiError(404, "Booking tidak ditemukan", "BOOKING_NOT_FOUND");
  booking.status = status;
  return joinSession(booking);
}

export async function listSessionsByDate(startISO: string, endISO: string): Promise<PublicSession[]> {
  await delay(120);
  const startMs = new Date(startISO).getTime();
  const endMs = new Date(endISO).getTime();
  return sessions
    .filter((s) => {
      const t = new Date(s.start_time).getTime();
      return t >= startMs && t <= endMs;
    })
    .sort((a, b) => (a.start_time < b.start_time ? -1 : 1))
    .map((s) => {
      const cls = classes.find((c) => c.id === s.class_id)!;
      const studio = studios.find((st) => st.id === cls.studio_id)!;
      const approvedCount = bookings.filter(
        (b) => b.session_id === s.id && b.status === "APPROVED"
      ).length;
      return { ...s, class: cls, studio, approved_count: approvedCount, remaining_slots: remainingSlots(cls.capacity, approvedCount) };
    });
}

export interface CreateSessionInput {
  class_id: string;
  start_time: string;
  end_time: string;
}

export async function createSession(input: CreateSessionInput): Promise<PublicSession> {
  await delay(200);
  const cls = classes.find((c) => c.id === input.class_id);
  if (!cls) throw new ApiError(404, "Kelas tidak ditemukan", "CLASS_NOT_FOUND");
  const s: ClassSession = {
    id: `session-${crypto.randomUUID().slice(0, 8)}`,
    class_id: input.class_id,
    start_time: input.start_time,
    end_time: input.end_time,
    magic_token: crypto.randomUUID(),
    status: "SCHEDULED"
  };
  sessions.push(s);
  const studio = studios.find((st) => st.id === cls.studio_id)!;
  return { ...s, class: cls, studio, approved_count: 0, remaining_slots: cls.capacity };
}

export async function listClasses(): Promise<Class[]> {
  await delay(100);
  return classes;
}

export function sessionCountForClass(classId: string): number {
  return sessions.filter((s) => s.class_id === classId).length;
}

export interface ClassInput {
  title: string;
  description: string;
  capacity: number;
  price: number;
}

export async function createClass(input: ClassInput): Promise<Class> {
  await delay(200);
  const c: Class = {
    id: `class-${crypto.randomUUID().slice(0, 8)}`,
    studio_id: studios[0].id,
    ...input
  };
  classes.push(c);
  return c;
}

export async function updateClass(id: string, input: ClassInput): Promise<Class> {
  await delay(200);
  const c = classes.find((x) => x.id === id);
  if (!c) throw new ApiError(404, "Kelas tidak ditemukan", "CLASS_NOT_FOUND");
  Object.assign(c, input);
  return c;
}

export async function getStudio(): Promise<Studio> {
  await delay(80);
  return studios[0];
}

export interface DashboardMetrics {
  pendingCount: number;
  approvedTodayCount: number;
  sessionsTodayCount: number;
  nextSession: PublicSession | null;
  totalCapacity: number;
  totalApproved: number;
}

function isSameDay(a: Date, b: Date, tz = "Asia/Makassar") {
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  return fmt.format(a) === fmt.format(b);
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  await delay(150);
  const pendingCount = bookings.filter((b) => b.status === "PENDING").length;
  const now = new Date();
  const approvedToday = bookings.filter((b) => b.status === "APPROVED" && isSameDay(new Date(b.created_at), now));
  const sessionsToday = sessions.filter((s) => isSameDay(new Date(s.start_time), now));

  const upcoming = sessions
    .filter((s) => s.status === "SCHEDULED" && new Date(s.start_time).getTime() >= now.getTime())
    .sort((a, b) => (a.start_time < b.start_time ? -1 : 1));

  let nextSession: PublicSession | null = null;
  if (upcoming.length) {
    const s = upcoming[0];
    const cls = classes.find((c) => c.id === s.class_id)!;
    const studio = studios.find((st) => st.id === cls.studio_id)!;
    const approvedCount = bookings.filter((b) => b.session_id === s.id && b.status === "APPROVED").length;
    nextSession = { ...s, class: cls, studio, approved_count: approvedCount, remaining_slots: remainingSlots(cls.capacity, approvedCount) };
  }

  const totalCapacity = sessions.reduce((sum, s) => {
    const cls = classes.find((c) => c.id === s.class_id);
    return sum + (cls?.capacity ?? 0);
  }, 0);
  const totalApproved = bookings.filter((b) => b.status === "APPROVED").length;

  return { pendingCount, approvedTodayCount: approvedToday.length, sessionsTodayCount: sessionsToday.length, nextSession, totalCapacity, totalApproved };
}

// unused now; reserved for settings page (Task 8)
export async function updateStudio(input: Pick<Studio, "name" | "wa_number" | "bank_info">): Promise<Studio> {
  await delay(150);
  studios[0] = { ...studios[0], ...input };
  return studios[0];
}
export type { SessionStatus };
