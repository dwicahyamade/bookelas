import { clearAdminCookie } from "@/lib/server/auth";
import { jsonOk } from "@/lib/http";

export const runtime = "nodejs";

export async function POST() {
  const res = jsonOk({ ok: true });
  clearAdminCookie(res);
  return res;
}
