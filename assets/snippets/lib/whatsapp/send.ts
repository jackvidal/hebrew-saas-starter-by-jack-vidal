/**
 * Wassender API client for sending WhatsApp messages.
 * Docs: https://wasenderapi.com/docs
 *
 * Auth: Bearer <personal-access-token> per user (stored on Profile.wassenderToken).
 * Endpoint: POST https://wasenderapi.com/api/send-message
 */

const WASSENDER_BASE_URL =
  process.env.WASSENDER_API_URL ?? "https://wasenderapi.com/api";

export interface SendTextResult {
  ok: boolean;
  externalId?: string;
  error?: string;
  raw?: unknown;
}

/**
 * Normalize a phone number to E.164 without the leading "+" — Wassender's expected format.
 * Strips spaces, dashes, parens, leading zeros are kept as-is (user is responsible for entering country code).
 */
export function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-().]/g, "").replace(/^\+/, "");
}

export async function sendWhatsappText(
  token: string,
  toPhone: string,
  body: string,
): Promise<SendTextResult> {
  const to = normalizePhone(toPhone);
  if (!to) return { ok: false, error: "Missing recipient phone" };
  if (!body.trim()) return { ok: false, error: "Empty message" };

  try {
    const res = await fetch(`${WASSENDER_BASE_URL}/send-message`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ to, text: body }),
    });

    const raw = await res.json().catch(() => ({}));

    if (!res.ok) {
      return {
        ok: false,
        error:
          (raw as { message?: string; error?: string }).message ??
          (raw as { error?: string }).error ??
          `Wassender error (${res.status})`,
        raw,
      };
    }

    // Wassender typically returns { success: true, data: { msgId, ... } }
    const externalId = extractExternalId(raw);
    return { ok: true, externalId, raw };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

function extractExternalId(raw: unknown): string | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  if (typeof r.msgId === "string") return r.msgId;
  if (typeof r.messageId === "string") return r.messageId;
  if (typeof r.id === "string") return r.id;
  const data = r.data as Record<string, unknown> | undefined;
  if (data) {
    if (typeof data.msgId === "string") return data.msgId;
    if (typeof data.messageId === "string") return data.messageId;
    if (typeof data.id === "string") return data.id;
  }
  return undefined;
}
