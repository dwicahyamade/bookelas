import type { NextRequest } from "next/server";
import { assertAdmin } from "@/lib/server/auth";
import { updateClassRow } from "@/lib/server/data";
import { handleApiError, jsonOk } from "@/lib/http";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    assertAdmin(req);
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    return jsonOk(await updateClassRow(id, body));
  } catch (e) {
    return handleApiError(e);
  }
}
