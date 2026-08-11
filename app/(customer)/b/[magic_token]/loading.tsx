export default function Loading() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-screen-sm flex-col">
      <header className="flex items-center justify-between px-5 py-5">
        <span className="font-display text-xl tracking-tight">Bookelas</span>
        <span className="size-2 rounded-full bg-cypress/40" />
      </header>
      <div className="flex-1 space-y-8 px-5 pb-12 pt-2" aria-busy="true" aria-live="polite">
        <div className="space-y-3">
          <div className="h-3 w-24 animate-pulse rounded bg-ink/10" />
          <div className="h-12 w-3/4 animate-pulse rounded bg-ink/10" />
          <div className="h-3 w-full animate-pulse rounded bg-ink/10" />
        </div>
        <div className="space-y-4 border-y border-ink/10 py-5">
          <div className="h-3 w-1/2 animate-pulse rounded bg-ink/10" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-ink/10" />
        </div>
        <div className="space-y-5">
          <div className="h-11 w-full animate-pulse rounded-lg bg-ink/10" />
          <div className="h-11 w-full animate-pulse rounded-lg bg-ink/10" />
          <div className="h-40 w-full animate-pulse rounded-xl bg-ink/10" />
        </div>
      </div>
    </main>
  );
}
