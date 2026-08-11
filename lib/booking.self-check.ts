import assert from "node:assert/strict";
import { remainingSlots } from "./booking.ts";

function demo() {
  assert.equal(remainingSlots(10, 7), 3, "normal case: 3 remaining");
  assert.equal(remainingSlots(10, 0), 10, "empty session: all open");
  assert.equal(remainingSlots(10, 10), 0, "full session: zero remaining");
  assert.equal(remainingSlots(10, 12), 0, "overbooked fixture: clamps to zero");
  assert.equal(remainingSlots(0, 0), 0, "zero-capacity session: zero");
  console.log("booking.self-check: OK");
}

demo();
