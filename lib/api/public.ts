import { ApiError } from "@/lib/errors";
import { remainingSlots } from "@/lib/booking";
import type { Booking, ClassSession, CreateBookingInput, PublicSession } from "@/lib/types";
import bookingsFixture from "@/lib/mock/bookings.json";
import sessionsFixture from "@/lib/mock/sessions.json";
import classesFixture from "@/lib/mock/classes.json";
import studiosFixture from "@/lib/mock/studios.json";

// ponytail: fixture adapter is in-memory and module-scoped; replace with transactional
// DB query (Supabase) when backend exists. Swap this file's body — signatures stay.

type BookingRow = Booking;
type SessionRow = ClassSession;

const bookings = bookingsFixture as BookingRow[];
const sessions = sessionsFixture as SessionRow[];

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function buildPublicSession(session: SessionRow): PublicSession {
  const cls = classesFixture.find((c) => c.id === session.class_id);
  const studio = studiosFixture.find((s) => s.id === cls?.studio_id);
  if (!cls || !studio) {
    throw new ApiError(500, "Data sesi tidak lengkap", "SESSION_DATA_INCOMPLETE");
  }
  const approvedCount = bookings.filter(
    (b) => b.session_id === session.id && b.status === "APPROVED"
  ).length;
  return {
    ...session,
    class: cls,
    studio,
    approved_count: approvedCount,
    remaining_slots: remainingSlots(cls.capacity, approvedCount)
  };
}

export async function getSessionByToken(token: string): Promise<PublicSession> {
  await delay(120);
  const session = sessions.find((s) => s.magic_token === token);
  if (!session) throw new ApiError(404, "Sesi tidak ditemukan", "SESSION_NOT_FOUND");
  return buildPublicSession(session);
}

export async function createBooking(input: CreateBookingInput): Promise<Booking> {
  await delay(300);
  const session = sessions.find((s) => s.id === input.session_id);
  if (!session) throw new ApiError(404, "Sesi tidak ditemukan", "SESSION_NOT_FOUND");

  const pub = buildPublicSession(session);
  if (pub.remaining_slots <= 0) {
    throw new ApiError(409, "Kelas sudah penuh", "SESSION_FULL");
  }

  const booking: Booking = {
    id: `booking-${crypto.randomUUID().slice(0, 8)}`,
    session_id: input.session_id,
    customer_name: input.customer_name,
    customer_wa: input.customer_wa,
    customer_email: input.customer_email,
    // ponytail: fixture stores filename only; backend will upload multipart to Storage.
    payment_proof_url: `/proofs/${input.payment_proof.name}`,
    status: "PENDING",
    created_at: new Date().toISOString()
  };
  bookings.push(booking);
  return booking;
}
