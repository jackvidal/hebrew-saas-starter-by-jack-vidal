import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verify a Wassender webhook signature.
 *
 * Wassender's implementation is simpler than typical HMAC: the `X-Webhook-Signature`
 * header contains the raw shared secret itself, not an HMAC of the body.
 * (See the Webhook Simulator's verification example — it does a direct equality
 * check between the header value and the configured secret.)
 *
 * For forward-compatibility we also accept a real HMAC-SHA256 of the body if the
 * provider ever upgrades. Either match counts as valid.
 */
export function verifyWassenderSignature(
  rawBody: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature) return false;
  const clean = signature.replace(/^sha256=/, "").trim();

  // Path 1: raw shared secret (current Wassender behavior)
  if (constantTimeEquals(clean, secret)) return true;

  // Path 2: HMAC-SHA256 of the body (future-proof)
  const computed = createHmac("sha256", secret).update(rawBody).digest("hex");
  return constantTimeEquals(clean, computed);
}

function constantTimeEquals(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf-8");
  const bb = Buffer.from(b, "utf-8");
  if (ba.length !== bb.length) return false;
  try {
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}
