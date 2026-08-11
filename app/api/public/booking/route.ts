import { ApiError } from "@/lib/errors";
import { bookingSchema } from "@/lib/validation/booking";
import { computePublicSession, createBookingRow } from "@/lib/server/data";
import { uploadProof } from "@/lib/server/storage";
import { handleApiError, jsonOk } from "@/lib/http";
import { supabaseAdmin } from "@/lib/server/supabase";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const session_id = String(form.get("session_id") ?? "");
    const parsed = bookingSchema.safeParse({
      customer_name: form.get("customer_name"),
      customer_wa: form.get("customer_wa"),
      customer_email: form.get("customer_email"),
      payment_proof: form.get("payment_proof"),
    });
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Data tidak valid";
      throw new ApiError(400, msg, "VALIDATION_ERROR");
    }

    const sb = supabaseAdmin();
    const { data: session, error } = await sb.from("class_sessions").select("*").eq("id", session_id).maybeSingle();
    if (error || !session) throw new ApiError(404, "Sesi tidak ditemukan", "SESSION_NOT_FOUND");

    const pub = await computePublicSession(session);
    if (pub.remaining_slots <= 0) throw new ApiError(409, "Kelas sudah penuh", "CLASS_FULL");

    const proofUrl = await uploadProof(session_id, parsed.data.payment_proof);
    const booking = await createBookingRow({
      session_id,
      customer_name: parsed.data.customer_name,
      customer_wa: parsed.data.customer_wa,
      customer_email: parsed.data.customer_email,
      payment_proof_url: proofUrl,
    });
    return jsonOk(booking, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
