import type { NextRequest } from "next/server";
import { assertAdmin } from "@/lib/server/auth";
import { listApprovalsDetailed } from "@/lib/server/data";
import { handleApiError, jsonOk } from "@/lib/http";
import type { BookingStatus } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    assertAdmin(req);
    const raw = req.nextUrl.searchParams.get("status");
    const status = raw === "PENDING" || raw === "APPROVED" || raw === "REJECTED" ? raw as BookingStatus : undefined;
    return jsonOk(await listApprovalsDetailed(status));
  } catch (e) {
    return handleApiError(e);
  }
}
