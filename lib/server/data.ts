import { supabaseAdmin } from "@/lib/server/supabase";
import { remainingSlots } from "@/lib/booking";
import { ApiError } from "@/lib/errors";
import { proofSignedUrl } from "@/lib/server/storage";
import type { Booking, BookingStatus, Class, ClassSession, PublicSession, Studio } from "@/lib/types";
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

async function sessionsCountByClass(): Promise<Map<string, number>> {
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
    sb.from("bookings").select("id", { count: "exact", head: true }).eq("status", "PENDING"),
    sb.from("bookings").select("*"),
    sb.from("class_sessions").select("*"),
    sb.from("class_sessions").select("*").eq("status", "SCHEDULED").gte("start_time", now.toISOString()).order("start_time", { ascending: true }).limit(1),
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

export async function getProofSignedUrl(bookingId: string): Promise<string> {
  const { data, error } = await supabaseAdmin().from("bookings").select("payment_proof_url").eq("id", bookingId).maybeSingle();
  if (error || !data) throw new ApiError(404, "Booking tidak ditemukan", "BOOKING_NOT_FOUND");
  return proofSignedUrl(data.payment_proof_url);
}
