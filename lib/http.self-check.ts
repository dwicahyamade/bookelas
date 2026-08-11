import assert from "node:assert/strict";
import { ApiError } from "./errors.ts";
import { handleApiError, jsonOk } from "./http.ts";

async function demo() {
  assert.equal(jsonOk({ a: 1 }).status, 200, "jsonOk defaults to 200");
  assert.equal(
    (await handleApiError(new ApiError(404, "x", "NOT_FOUND")).json()).code,
    "NOT_FOUND",
    "handleApiError maps code"
  );
  assert.equal(
    (await handleApiError(new Error("boom")).json()).code,
    "INTERNAL",
    "handleApiError fallback INTERNAL"
  );
  console.log("http.self-check: OK");
}

demo().catch((e) => {
  console.error(e);
  process.exit(1);
});
