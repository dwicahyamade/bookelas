import type { NextRequest } from "next/server";
import { assertAdmin } from "@/lib/server/auth";
import { dashboardMetrics } from "@/lib/server/data";
import { handleApiError, jsonOk } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    assertAdmin(req);
    return jsonOk(await dashboardMetrics());
  } catch (e) {
    return handleApiError(e);
  }
}
