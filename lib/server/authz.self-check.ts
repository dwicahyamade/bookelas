import assert from "node:assert/strict";
import { assertBranchAccess, branchFilter, canManageAllBranches } from "./authz.ts";
import type { CurrentUser } from "./auth.ts";

const admin: CurrentUser = { id: "u1", username: "kasir", role: "admin", branch_id: "b1" };
const superadmin: CurrentUser = { id: "s1", username: "super", role: "superadmin", branch_id: null };

function demo() {
  assert.doesNotThrow(() => assertBranchAccess(admin, "b1"), "admin own branch ok");
  assert.throws(() => assertBranchAccess(admin, "b2"), "admin other branch 403");
  assert.throws(() => assertBranchAccess(admin, null), "admin null branch 403");
  assert.throws(() => assertBranchAccess(admin, undefined), "admin undefined branch 403");
  assert.doesNotThrow(() => assertBranchAccess(superadmin, "b1"), "superadmin any branch ok");
  assert.doesNotThrow(() => assertBranchAccess(superadmin, null), "superadmin null ok");
  assert.doesNotThrow(() => assertBranchAccess(superadmin, undefined), "superadmin undefined ok");

  assert.deepEqual(branchFilter(admin), { branch_id: "b1" }, "admin filter");
  assert.deepEqual(branchFilter(superadmin), {}, "superadmin no filter");

  assert.equal(canManageAllBranches(admin), false, "admin not all");
  assert.equal(canManageAllBranches(superadmin), true, "superadmin all");

  console.log("authz.self-check: OK");
}

demo();
