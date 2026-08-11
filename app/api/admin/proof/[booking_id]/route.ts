import type { NextRequest } from "next/server";
import { ApiError } from "@/lib/errors";
import { assertAdmin } from "@/lib/server/auth";
import { proofSignedUrl } from "@/lib/server/storage";
import { handleApiError } from "@/lib/http";
import { supabaseAdmin } from "@/lib/server/supabase";

export const runtime = "nodejs";

export async function GET(req: NextRequest, ctx: { params: Promise<{ booking_id: string }> }) {
  try {
    assertAdmin(req);
    const { booking_id } = await ctx.params;
    const { data, error } = await supabaseAdmin().from("bookings").select("payment_proof_url").eq("id", booking_id).maybeSingle();
    if (error || !data) throw new ApiError(404, "Booking tidak ditemukan", "BOOKING_NOT_FOUND");
    return Response.redirect(await proofSignedUrl(data.payment_proof_url), 302);
  } catch (e) {
    return handleApiError(e);
  }
}
