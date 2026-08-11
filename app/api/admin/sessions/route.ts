import type { NextRequest } from "next/server";
import { ApiError } from "@/lib/errors";
import { assertAdmin } from "@/lib/server/auth";
import { createSessionRow, listSessionsByDate } from "@/lib/server/data";
import { handleApiError, jsonOk } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    assertAdmin(req);
    const start = req.nextUrl.searchParams.get("start_date");
    const end = req.nextUrl.searchParams.get("end_date");
    if (!start || !end) throw new ApiError(400, "start_date dan end_date wajib", "VALIDATION_ERROR");
    return jsonOk(await listSessionsByDate(start, end));
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    assertAdmin(req);
    const body = await req.json().catch(() => ({}));
    if (!body?.class_id || !body?.start_time || !body?.end_time) {
      throw new ApiError(400, "class_id, start_time, end_time wajib", "VALIDATION_ERROR");
    }
    return jsonOk(await createSessionRow(body), { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
