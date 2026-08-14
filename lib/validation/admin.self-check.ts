import assert from "node:assert/strict";
import { branchInputSchema, adminUserInputSchema, adminUserUpdateSchema, slugify } from "./admin.ts";

function demo() {
  assert.equal(slugify("Main Branch"), "main-branch", "slugify basic");
  assert.equal(slugify("  JakSel!! "), "jaksel", "slugify strips + lowercases");

  assert.equal(branchInputSchema.safeParse({ name: "Bandung", slug: "bandung", is_active: true }).success, true, "branch valid");
  assert.equal(branchInputSchema.safeParse({ name: "", slug: "x", is_active: true }).success, false, "branch name empty rejected");
  assert.equal(adminUserInputSchema.safeParse({ username: "kasir1", password: "rahasia123", branch_id: "b1", is_active: true }).success, true, "admin valid");
  assert.equal(adminUserInputSchema.safeParse({ username: "ka", password: "rahasia123", branch_id: "b1", is_active: true }).success, false, "username too short rejected");
  assert.equal(adminUserInputSchema.safeParse({ username: "kasir1", password: "123", branch_id: "b1", is_active: true }).success, false, "password too short rejected");
  assert.equal(adminUserUpdateSchema.safeParse({ branch_id: "b1", is_active: false }).success, true, "update valid");

  console.log("validation/admin.self-check: OK");
}

demo();
