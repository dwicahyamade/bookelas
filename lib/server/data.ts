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
  return data.branch as unknown as Branch;
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
  const [cls, studio, approved, branch] = await Promise.all([
    loadClass(session), getStudio(), approvedCount(session.id), loadBranchForClass(session.class_id),
  ]);
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

// branchId: null = all branches (superadmin). Returns null when unfiltered.
async function classIdsByBranch(branchId: string | null): Promise<string[] | null> {
  if (branchId === null) return null;
  const { data, error } = await supabaseAdmin().from("classes").select("id").eq("branch_id", branchId).is("deleted_at", null);
  if (error) throw new ApiError(500, "Gagal memuat kelas", "QUERY_FAILED");
  return (data ?? []).map((r: { id: string }) => r.id);
}

async function sessionIdsForBranch(branchId: string | null): Promise<string[] | null> {
  const classIds = await classIdsByBranch(branchId);
  if (classIds === null) return null;
  if (classIds.length === 0) return [];
  const { data, error } = await supabaseAdmin().from("class_sessions").select("id").in("class_id", classIds);
  if (error) throw new ApiError(500, "Gagal memuat sesi", "QUERY_FAILED");
  return (data ?? []).map((s: { id: string }) => s.id);
}

export async function listApprovalsDetailed(status?: BookingStatus, branchId: string | null = null): Promise<ApprovalRow[]> {
  const sb = supabaseAdmin();
  const sessionIds = await sessionIdsForBranch(branchId);
  if (sessionIds && sessionIds.length === 0) return [];

  let q = sb.from("bookings").select("*").order("created_at", { ascending: false });
  if (sessionIds) q = q.in("session_id", sessionIds);
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
  const sessionIds = await sessionIdsForBranch(branchId);
  if (sessionIds && sessionIds.length === 0) return [];
  const sb = supabaseAdmin();
  let q = sb.from("bookings").select("*").order("created_at", { ascending: false }).limit(limit);
  if (sessionIds) q = q.in("session_id", sessionIds);
  const { data, error } = await q;
  if (error) throw new ApiError(500, "Gagal memuat riwayat booking", "QUERY_FAILED");
  return Promise.all((data as Booking[]).map(buildApprovalRow));
}

export async function listCustomerBookings(search: string, branchId: string | null = null): Promise<ApprovalRow[]> {
  const term = search.trim();
  if (!term) return [];
  const sessionIds = await sessionIdsForBranch(branchId);
  if (sessionIds && sessionIds.length === 0) return [];
  const sb = supabaseAdmin();
  const run = () => {
    let base = sb.from("bookings").select("*");
    if (sessionIds) base = base.in("session_id", sessionIds);
    return base;
  };
  const [waResult, emailResult] = await Promise.all([
    run().ilike("customer_wa", `%${term}%`),
    run().ilike("customer_email", `%${term}%`),
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

async function sessionsCountByClass(branchId: string | null = null): Promise<Map<string, number>> {
  const sb = supabaseAdmin();
  let q = sb.from("class_sessions").select("class_id");
  if (branchId) {
    const { data: cls } = await sb.from("classes").select("id").eq("branch_id", branchId).is("deleted_at", null);
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
  let classQ = sb.from("classes").select("*").is("deleted_at", null).order("title", { ascending: true });
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
    const { data: cls } = await sb.from("classes").select("id").eq("branch_id", branchId).is("deleted_at", null);
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
  const { data: cls } = await sb.from("classes").select("id, deleted_at").eq("id", input.class_id).maybeSingle();
  if (!cls || cls.deleted_at) throw new ApiError(404, "Kelas tidak ditemukan", "CLASS_NOT_FOUND");
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
  if (branch.deleted_at) throw new ApiError(409, "Cabang tidak tersedia", "BRANCH_DELETED");
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
  }).eq("id", id).is("deleted_at", null).select().maybeSingle();
  if (error || !data) throw new ApiError(404, "Kelas tidak ditemukan", "CLASS_NOT_FOUND");
  return { ...(data as Class), price: Number((data as Class).price) };
}

export async function softDeleteClass(id: string): Promise<void> {
  const { data, error } = await supabaseAdmin()
    .from("classes").update({ deleted_at: new Date().toISOString() })
    .eq("id", id).is("deleted_at", null).select("id").maybeSingle();
  if (error) throw new ApiError(500, "Gagal menghapus kelas", "UPDATE_FAILED");
  if (!data) throw new ApiError(404, "Kelas tidak ditemukan", "CLASS_NOT_FOUND");
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

  let scopedClassIds: string[] | null = null;
  if (branchId) {
    const { data: cls } = await sb.from("classes").select("id").eq("branch_id", branchId).is("deleted_at", null);
    scopedClassIds = (cls ?? []).map((c: { id: string }) => c.id);
  }
  const noClasses = scopedClassIds !== null && scopedClassIds.length === 0;
  const inClause = scopedClassIds && scopedClassIds.length > 0 ? scopedClassIds : null;

  let sessions: SessionRow[] = [];
  let upcoming: SessionRow[] = [];
  if (!noClasses) {
    const [sR, uR] = await Promise.all([
      inClause ? sb.from("class_sessions").select("*").in("class_id", inClause) : sb.from("class_sessions").select("*"),
      inClause
        ? sb.from("class_sessions").select("*").eq("status", "SCHEDULED").gte("start_time", now.toISOString()).in("class_id", inClause).order("start_time", { ascending: true }).limit(1)
        : sb.from("class_sessions").select("*").eq("status", "SCHEDULED").gte("start_time", now.toISOString()).order("start_time", { ascending: true }).limit(1),
    ]);
    if (sR.error) throw new ApiError(500, "Gagal memuat sesi", "QUERY_FAILED");
    sessions = (sR.data ?? []) as SessionRow[];
    upcoming = (uR.data ?? []) as SessionRow[];
  }

  const sessionIds = sessions.map((s) => s.id);
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
  const sessionsToday = sessions.filter((s) => isSameDay(s.start_time));
  const nextSession = upcoming[0] ? await computePublicSession(upcoming[0]) : null;
  const capacities = await Promise.all(sessions.map((s) => loadClass(s)));
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

// Resolve branch_id of a booking/session/class for authorization.
export async function bookingBranchId(bookingId: string): Promise<string | null> {
  const { data } = await supabaseAdmin()
    .from("bookings")
    .select("session:class_sessions!inner(class:classes!inner(branch_id))")
    .eq("id", bookingId)
    .maybeSingle();
  const path = data as unknown as { session?: { class?: { branch_id?: string } } } | null;
  return path?.session?.class?.branch_id ?? null;
}

export async function classBranchId(classId: string): Promise<string | null> {
  const { data } = await supabaseAdmin().from("classes").select("branch_id").eq("id", classId).maybeSingle();
  return data?.branch_id ?? null;
}

export async function sessionBranchId(sessionId: string): Promise<string | null> {
  const { data } = await supabaseAdmin()
    .from("class_sessions").select("class:classes!inner(branch_id)").eq("id", sessionId).maybeSingle();
  const path = data as unknown as { class?: { branch_id?: string } } | null;
  return path?.class?.branch_id ?? null;
}
