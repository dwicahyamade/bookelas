import assert from "node:assert/strict";
import { bookingSchema } from "./booking.ts";

function demo() {
  const valid = bookingSchema.safeParse({
    customer_name: "Sarah Aruna",
    customer_wa: "+628123456789",
    customer_email: "sarah@example.com",
    payment_proof: new File(["proof"], "proof.png", { type: "image/png" })
  });
  assert.equal(valid.success, true, "valid booking passes");

  const invalid = bookingSchema.safeParse({
    customer_name: "S",
    customer_wa: "1",
    customer_email: "not-an-email",
    payment_proof: new File([new Uint8Array(6 * 1024 * 1024)], "proof.exe", { type: "application/octet-stream" })
  });
  assert.equal(invalid.success, false, "invalid booking fails");
  console.log("validation.self-check: OK");
}

demo();
