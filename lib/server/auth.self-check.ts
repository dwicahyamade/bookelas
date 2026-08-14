import assert from "node:assert/strict";
import { signToken, verifyToken, timingSafeEqualString, type SessionClaims } from "./auth-token.ts";

function demo() {
  process.env.AUTH_SECRET = "test-secret-at-least-16-chars!!";
  process.env.AUTH_MAX_AGE_SECONDS = "43200";

  const adminClaims: SessionClaims = {
    user_id: "u1", username: "kasir", role: "admin", branch_id: "b1", exp: Date.now() + 3600_000,
  };
  const superClaims: SessionClaims = {
    user_id: "s1", username: "superadmin", role: "superadmin", branch_id: null, exp: Date.now() + 3600_000,
  };

  const ta = signToken(adminClaims);
  const parsed = verifyToken(ta);
  assert.ok(parsed, "admin token parses");
  assert.equal(parsed.role, "admin", "role admin");
  assert.equal(parsed.branch_id, "b1", "branch_id preserved");
  assert.equal(parsed.username, "kasir", "username preserved");

  const ts = signToken(superClaims);
  const ps = verifyToken(ts);
  assert.ok(ps, "superadmin token parses");
  assert.equal(ps.role, "superadmin", "role superadmin");
  assert.equal(ps.branch_id, null, "superadmin branch null");

  assert.equal(verifyToken(ts + "x"), null, "tampered rejected");
  assert.equal(verifyToken(undefined), null, "missing rejected");
  assert.equal(verifyToken("a.b"), null, "malformed rejected");
  assert.equal(verifyToken(signToken({ ...adminClaims, exp: Date.now() - 1000 })), null, "expired rejected");

  assert.equal(timingSafeEqualString("abc", "abc"), true, "timingSafe equal");
  assert.equal(timingSafeEqualString("abc", "abd"), false, "timingSafe not equal");
  console.log("auth.self-check: OK");
}

demo();
