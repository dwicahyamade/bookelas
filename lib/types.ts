export type BookingStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
export type SessionStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED";

export interface Studio {
  id: string;
  name: string;
  wa_number: string;
  bank_info: string;
}

export interface Class {
  id: string;
  studio_id: string;
  title: string;
  description: string;
  capacity: number;
  price: number;
}

export interface ClassSession {
  id: string;
  class_id: string;
  start_time: string;
  end_time: string;
  magic_token: string;
  status: SessionStatus;
}

export interface Booking {
  id: string;
  session_id: string;
  customer_name: string;
  customer_wa: string;
  customer_email: string;
  payment_proof_url: string;
  status: BookingStatus;
  created_at: string;
}

export interface PublicSession extends ClassSession {
  class: Class;
  studio: Studio;
  approved_count: number;
  remaining_slots: number;
}

export interface CreateBookingInput {
  session_id: string;
  customer_name: string;
  customer_wa: string;
  customer_email: string;
  payment_proof: File;
}
