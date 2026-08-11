import type { NextRequest } from "next/server";
import { ApiError } from "@/lib/errors";
import { assertAdmin } from "@/lib/server/auth";
import { createClassRow, listClassesWithCount } from "@/lib/server/data";
import { handleApiError, jsonOk } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    assertAdmin(req);
    return jsonOk(await listClassesWithCount());
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    assertAdmin(req);
    const body = await req.json().catch(() => ({}));
    if (!body?.title || typeof body?.capacity !== "number" || typeof body?.price !== "number") {
      throw new ApiError(400, "title, capacity, price wajib", "VALIDATION_ERROR");
    }
    return jsonOk(await createClassRow(body), { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
