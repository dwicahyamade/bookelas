"use server";

import { computePublicSession, createBookingRow, getSessionByToken as loadSession } from "@/lib/server/data";
import { supabaseAdmin } from "@/lib/server/supabase";
import { uploadProof } from "@/lib/server/storage";
import { bookingSchema } from "@/lib/validation/booking";
import { ApiError } from "@/lib/errors";
import type { Booking, CreateBookingInput, PublicSession } from "@/lib/types";

export async function getSessionByToken(token: string): Promise<PublicSession> {
  const pub = await loadSession(token);
  if (pub.branch.deleted_at || pub.class.deleted_at) throw new ApiError(410, "Sesi tidak tersedia", "SESSION_UNAVAILABLE");
  return pub;
}

export async function createBooking(input: CreateBookingInput): Promise<Booking> {
  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Data tidak valid", "VALIDATION_ERROR");

  const { data: session, error } = await supabaseAdmin().from("class_sessions").select("*").eq("id", input.session_id).maybeSingle();
  if (error || !session) throw new ApiError(404, "Sesi tidak ditemukan", "SESSION_NOT_FOUND");

  const pub = await computePublicSession(session);
  if (pub.branch.deleted_at || pub.class.deleted_at) throw new ApiError(409, "Sesi tidak tersedia", "BRANCH_INACTIVE");
  if (!pub.branch.is_active) throw new ApiError(409, "Sesi tidak tersedia", "BRANCH_INACTIVE");
  if (pub.remaining_slots <= 0) throw new ApiError(409, "Kelas sudah penuh", "CLASS_FULL");

  const proofUrl = await uploadProof(input.session_id, input.payment_proof);
  return createBookingRow({
    session_id: input.session_id,
    customer_name: parsed.data.customer_name,
    customer_wa: parsed.data.customer_wa,
    customer_email: parsed.data.customer_email,
    payment_proof_url: proofUrl,
  });
}
