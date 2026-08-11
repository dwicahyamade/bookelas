import type { NextRequest } from "next/server";
import { assertAdmin } from "@/lib/server/auth";
import { getStudio, updateStudioRow } from "@/lib/server/data";
import { handleApiError, jsonOk } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    assertAdmin(req);
    return jsonOk(await getStudio());
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    assertAdmin(req);
    return jsonOk(await updateStudioRow(await req.json()));
  } catch (e) {
    return handleApiError(e);
  }
}
