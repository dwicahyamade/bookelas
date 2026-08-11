import assert from "node:assert/strict";
import { getWeekDays, getWeekRange, isSameDay, shiftWeek } from "./calendar.ts";

function demo() {
  // 2026-08-12 is a Wednesday; week should start Mon 2026-08-10.
  const anchor = "2026-08-12T10:00:00+08:00";
  const { start, end } = getWeekRange(anchor);
  assert.equal(start.getUTCDay(), 1, "week starts Monday");
  assert.equal(end.getUTCDay(), 0, "week ends Sunday");
  const days = getWeekDays(anchor);
  assert.equal(days.length, 7, "seven days");
  assert.equal(days[0].getUTCDay(), 1, "first day Monday");

  // shift by one week
  const next = shiftWeek(anchor, 1);
  assert.equal(isSameDay(new Date(next), new Date("2026-08-19T10:00:00+08:00")), true, "shiftWeek +1 lands same weekday next week");

  // isSameDay across tz boundary near midnight Makassar (+08:00)
  const a = new Date("2026-08-15T22:00:00+08:00"); // Sat 22:00 WITA
  const b = new Date("2026-08-15T15:00:00Z");      // same instant, same Makassar day
  assert.equal(isSameDay(a, b), true, "same Makassar day across tz representation");

  console.log("calendar.self-check: OK");
}

demo();
