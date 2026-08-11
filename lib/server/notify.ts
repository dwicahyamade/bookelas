import type { Booking, PublicSession } from "@/lib/types";

export interface BookingNotifyResult {
  email: "sent" | "skipped" | "error";
  wa: "stubbed";
  warnings: string[];
}

export async function notifyBookingConfirmed(
  booking: Booking,
  session: PublicSession
): Promise<BookingNotifyResult> {
  const warnings: string[] = [];

  // WhatsApp: stubbed (provider deferred).
  console.info("[notify:wa] booking confirmed", { bookingId: booking.id, to: booking.customer_wa });

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    warnings.push("RESEND_API_KEY/EMAIL_FROM missing; email skipped");
    return { email: "skipped", wa: "stubbed", warnings };
  }

  const subject = `Konfirmasi booking — ${session.class.title}`;
  const text = `Halo ${booking.customer_name},\n\nBooking kamu untuk ${session.class.title} telah disetujui.\nWaktu: ${new Date(session.start_time).toLocaleString("id-ID", { timeZone: "Asia/Makassar" })} WITA.\n\nTerima kasih,\n${session.studio.name}`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: booking.customer_email, subject, text }),
    });
    if (!res.ok) {
      warnings.push(`Resend HTTP ${res.status}`);
      return { email: "error", wa: "stubbed", warnings };
    }
    return { email: "sent", wa: "stubbed", warnings };
  } catch (e) {
    warnings.push(e instanceof Error ? e.message : "email send failed");
    return { email: "error", wa: "stubbed", warnings };
  }
}
