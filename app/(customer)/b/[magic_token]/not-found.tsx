import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-screen-sm flex-col px-5">
      <header className="py-5"><span className="font-display text-xl tracking-tight">Bookelas</span></header>
      <div className="flex flex-1 items-center pb-24">
        <section className="space-y-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-ochre">Link tidak aktif</p>
          <h1 className="max-w-[12ch] font-display text-6xl leading-[0.9] tracking-[-0.04em]">Sesi tidak ditemukan.</h1>
          <p className="max-w-sm text-sm leading-6 text-ink/60">Link booking ini mungkin sudah kedaluwarsa atau tidak lengkap. Minta studio mengirimkan link terbaru melalui WhatsApp.</p>
          <Link href="/" className="inline-flex rounded-full bg-cypress px-5 py-3 text-sm font-semibold text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cypress focus-visible:ring-offset-2 focus-visible:ring-offset-paper">Kembali</Link>
        </section>
      </div>
    </main>
  );
}
