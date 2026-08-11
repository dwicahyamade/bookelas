"use client";

import { useState } from "react";
import type { Booking, PublicSession } from "@/lib/types";
import { SessionSummary } from "./session-summary";
import { BookingForm } from "./booking-form";
import { BookingSuccess } from "./booking-success";

export function BookingExperience({ session }: { session: PublicSession }) {
  const [booking, setBooking] = useState<Booking | null>(null);
  const isFull = session.remaining_slots === 0;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-screen-sm flex-col">
      <header className="flex items-center justify-between px-5 py-5">
        <span className="font-display text-xl tracking-tight">Bookelas</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-ink/40">Reformer Series</span>
      </header>

      <div className="flex-1 space-y-10 px-5 pb-12 pt-2">
        {booking ? (
          <BookingSuccess booking={booking} session={session} />
        ) : (
          <>
            <SessionSummary session={session} />
            {isFull ? (
              <div className="rounded-xl bg-ochre/10 p-6 text-center">
                <p className="font-display text-2xl text-ochre">Sesi penuh</p>
                <p className="mt-2 text-sm text-ink/60">Mohon maaf, semua slot telah terisi. Hubungi studio untuk daftar tunggu.</p>
                <p className="mt-3 text-sm font-semibold text-cypress">{session.studio.wa_number}</p>
              </div>
            ) : (
              <>
                <div className="space-y-5">
                  <h2 className="text-[11px] font-bold uppercase tracking-[0.22em] text-ink/45">Formulir pendaftaran</h2>
                  <BookingForm session={session} onSuccess={setBooking} />
                </div>
                <p className="text-center text-xs text-ink/40">Dengan mendaftar, kamu menyetujui ketentuan studio. Pembayaran dikonfirmasi setelah bukti diverifikasi.</p>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
