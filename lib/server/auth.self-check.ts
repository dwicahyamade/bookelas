import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { signToken, verifyToken, timingSafeEqualString } from "./auth.ts";

function demo() {
  process.env.AUTH_SECRET = "test-secret-at-least-16-chars!!";
  process.env.AUTH_MAX_AGE_SECONDS = "43200";

  const t = signToken();
  assert.equal(verifyToken(t), true, "valid token verifies");
  assert.equal(verifyToken(t + "x"), false, "tampered token rejected");
  assert.equal(verifyToken(undefined), false, "missing token rejected");
  assert.equal(verifyToken("a.b"), false, "malformed token rejected");

  // Expiry: same payload format as auth.ts, but with a past exp.
  const expiredPayload = `${Date.now() - 1000}.abc`;
  const expired = `${Buffer.from(expiredPayload).toString("base64url")}.${createHmac("sha256", process.env.AUTH_SECRET).update(expiredPayload).digest("base64url")}`;
  assert.equal(verifyToken(expired), false, "expired token rejected");

  assert.equal(timingSafeEqualString("abc", "abc"), true, "timingSafeEqualString equal");
  assert.equal(timingSafeEqualString("abc", "abd"), false, "timingSafeEqualString not equal");
  console.log("auth.self-check: OK");
}

demo();
