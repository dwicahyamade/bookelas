// Week helpers, timezone-fixed to Asia/Makassar for display. Dates kept as ISO.

export const STUDIO_TZ = "Asia/Makassar";

function startOfWeekLocal(d: Date): Date {
  // Monday as first day of week, computed in studio local time.
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: STUDIO_TZ, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const local = new Date(Date.UTC(get("year"), get("month") - 1, get("day")));
  const day = local.getUTCDay(); // 0 Sun..6 Sat
  const diff = (day + 6) % 7; // days since Monday
  local.setUTCDate(local.getUTCDate() - diff);
  local.setUTCHours(0, 0, 0, 0);
  return local;
}

export function getWeekRange(anchorISO: string): { start: Date; end: Date } {
  const start = startOfWeekLocal(new Date(anchorISO));
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);
  return { start, end };
}

export function getWeekDays(anchorISO: string): Date[] {
  const { start } = getWeekRange(anchorISO);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    return d;
  });
}

export function shiftWeek(anchorISO: string, weeks: number): string {
  const d = new Date(anchorISO);
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  return d.toISOString();
}

export function isSameDay(a: Date, b: Date): boolean {
  return new Intl.DateTimeFormat("en-US", { timeZone: STUDIO_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(a) ===
    new Intl.DateTimeFormat("en-US", { timeZone: STUDIO_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(b);
}

export function isToday(d: Date): boolean {
  return isSameDay(d, new Date());
}
