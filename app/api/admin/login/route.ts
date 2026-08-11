import { ApiError } from "@/lib/errors";
import { signToken, setAdminCookie, timingSafeEqualString } from "@/lib/server/auth";
import { handleApiError, jsonOk } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { password } = await req.json().catch(() => ({} as { password?: string }));
    const expected = process.env.ADMIN_PASSWORD;
    if (!expected) throw new ApiError(500, "ADMIN_PASSWORD belum dikonfigurasi", "ADMIN_NOT_CONFIGURED");
    if (typeof password !== "string" || password.length === 0 || !timingSafeEqualString(password, expected)) {
      throw new ApiError(401, "Kata sandi salah", "INVALID_PASSWORD");
    }
    const res = jsonOk({ ok: true });
    setAdminCookie(res, signToken());
    return res;
  } catch (e) {
    return handleApiError(e);
  }
}
