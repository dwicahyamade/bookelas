import { ApiError } from "@/lib/errors";
import { supabaseAdmin } from "@/lib/server/supabase";

const BUCKET = "payment-proofs";

export async function uploadProof(sessionId: string, file: File): Promise<string> {
  const arrayBuf = await file.arrayBuffer();
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const path = `${sessionId}/${crypto.randomUUID()}.${ext}`;
  const contentType = file.type || "application/octet-stream";
  const sb = supabaseAdmin();
  const { error } = await sb.storage.from(BUCKET).upload(path, arrayBuf, { contentType, upsert: false });
  if (error) throw new ApiError(500, "Gagal mengunggah bukti bayar", "UPLOAD_FAILED");
  return path;
}

export async function proofSignedUrl(path: string, expiresIn = 900): Promise<string> {
  const sb = supabaseAdmin();
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) throw new ApiError(500, "Gagal membuat URL bukti bayar", "SIGNED_URL_FAILED");
  return data.signedUrl;
}
