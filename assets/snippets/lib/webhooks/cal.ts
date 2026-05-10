// src/lib/webhooks/cal.ts — HMAC-SHA256 verifier for Cal.com webhooks
// Same pattern works for any signed-webhook provider — adjust header name + algorithm.

import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyCalSignature(
  rawBody: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature) return false;
  const computed = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(computed, "utf-8");
  const b = Buffer.from(signature.replace(/^sha256=/, ""), "utf-8");
  if (a.length !== b.length) return false;
  try {
    // timing-attack resistant. NEVER use === for HMAC compare.
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
