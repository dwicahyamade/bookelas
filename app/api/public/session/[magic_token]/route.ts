import type { NextRequest } from "next/server";
import { getSessionByToken } from "@/lib/server/data";
import { handleApiError, jsonOk } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ magic_token: string }> }) {
  try {
    const { magic_token } = await ctx.params;
    return jsonOk(await getSessionByToken(magic_token));
  } catch (e) {
    return handleApiError(e);
  }
}
