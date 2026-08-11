import type { NextRequest } from "next/server";
import { ApiError } from "@/lib/errors";
import { assertAdmin } from "@/lib/server/auth";
import { approveBookingRpc, buildApprovalRow, getApproval, rejectBooking } from "@/lib/server/data";
import { notifyBookingConfirmed } from "@/lib/server/notify";
import { handleApiError, jsonOk } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(req: NextRequest, ctx: { params: Promise<{ booking_id: string }> }) {
  try {
    assertAdmin(req);
    const { booking_id } = await ctx.params;
    return jsonOk(await getApproval(booking_id));
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ booking_id: string }> }) {
  try {
    assertAdmin(req);
    const { booking_id } = await ctx.params;
    const { status } = await req.json().catch(() => ({} as { status?: string }));

    let booking;
    if (status === "APPROVED") booking = await approveBookingRpc(booking_id);
    else if (status === "REJECTED") booking = await rejectBooking(booking_id);
    else throw new ApiError(400, "Status tidak valid", "VALIDATION_ERROR");

    const row = await buildApprovalRow(booking);
    const notify = status === "APPROVED"
      ? await notifyBookingConfirmed(booking, row.session)
      : { email: "skipped" as const, wa: "stubbed" as const, warnings: [] as string[] };
    const res = jsonOk({ ...row, notify });
    const warning = notify.warnings.join("; ");
    if (warning) res.headers.set("x-notify-warning", warning);
    return res;
  } catch (e) {
    return handleApiError(e);
  }
}
