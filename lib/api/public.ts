import { apiGet, apiSend } from "@/lib/http";
import type { Booking, CreateBookingInput, PublicSession } from "@/lib/types";

export async function getSessionByToken(token: string): Promise<PublicSession> {
  return apiGet<PublicSession>(`/api/public/session/${encodeURIComponent(token)}`);
}

export async function createBooking(input: CreateBookingInput): Promise<Booking> {
  const fd = new FormData();
  fd.set("session_id", input.session_id);
  fd.set("customer_name", input.customer_name);
  fd.set("customer_wa", input.customer_wa);
  fd.set("customer_email", input.customer_email);
  fd.set("payment_proof", input.payment_proof);
  return apiSend<Booking>("/api/public/booking", { method: "POST", body: fd });
}
