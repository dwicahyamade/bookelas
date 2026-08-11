import { z } from "zod";

const FIVE_MB = 5 * 1024 * 1024;

export const MAX_FILE_BYTES = FIVE_MB;

function fileAccepts(f: File) {
  return f.type.startsWith("image/") || f.type === "application/pdf";
}

export const bookingSchema = z.object({
  customer_name: z
    .string()
    .trim()
    .min(2, "Nama lengkap minimal 2 karakter")
    .max(100, "Nama lengkap maksimal 100 karakter"),
  customer_wa: z
    .string()
    .trim()
    .min(8, "Nomor WhatsApp minimal 8 digit")
    .max(20, "Nomor WhatsApp maksimal 20 digit")
    .regex(/^[0-9+\-\s]+$/, "Hanya angka, spasi, +, atau -"),
  customer_email: z.string().trim().email("Format email tidak valid"),
  payment_proof: z
    .instanceof(File, { message: "Bukti transfer wajib diunggah" })
    .refine((f) => f.size > 0, "Bukti transfer wajib diunggah")
    .refine((f) => f.size <= FIVE_MB, "Ukuran file maksimal 5 MB")
    .refine(fileAccepts, "Format harus gambar (JPG/PNG) atau PDF")
});

export type BookingFormValues = z.infer<typeof bookingSchema>;

export function describeFileError(error: unknown): string | null {
  if (!(error instanceof z.ZodError)) return null;
  const issue = error.issues.find((i) => i.path[0] === "payment_proof");
  return issue?.message ?? null;
}
