import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "./password.ts";

function demo() {
  const hash = hashPassword("rahasia123");
  assert.ok(hash.startsWith("scrypt$"), "hash format");
  assert.equal(hash.split("$").length, 3, "hash has salt + hash");
  assert.equal(verifyPassword("rahasia123", hash), true, "correct password verifies");
  assert.equal(verifyPassword("salah", hash), false, "wrong password rejected");
  assert.equal(verifyPassword("rahasia123", "garbage"), false, "malformed stored rejected");
  assert.notEqual(hash, hashPassword("rahasia123"), "salt randomizes hash");
  console.log("password.self-check: OK");
}

demo();
