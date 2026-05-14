import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verify a Cal.com webhook signature.
 * Cal sends `X-Cal-Signature-256` as a hex-encoded HMAC-SHA256 of the raw
 * request body using the secret configured for the webhook subscription.
 */
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
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
