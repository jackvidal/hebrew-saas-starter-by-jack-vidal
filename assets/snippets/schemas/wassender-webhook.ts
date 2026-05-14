import { z } from "zod";

/**
 * Wassender webhook payload — based on real observed payloads.
 *
 * Wassender forwards raw WhatsApp Multi-Device events. The shape is nested
 * and uses LID (linked id) addressing rather than plain phone JIDs.
 *
 * We keep this extremely permissive (.passthrough()) and rely on safe field
 * access in the route handler rather than a strict schema.
 */
export const wassenderWebhookSchema = z
  .object({
    event: z.string(),
    timestamp: z.union([z.number(), z.string()]).optional(),
    sessionId: z.string().optional(),
    session_id: z.string().optional(),
    data: z.record(z.string(), z.unknown()),
  })
  .passthrough();

export type WassenderWebhookPayload = z.infer<typeof wassenderWebhookSchema>;
