import { NextResponse } from "next/server";
import {
  Prisma,
  type WhatsappMessageType,
  type WhatsappStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyWassenderSignature } from "@/lib/webhooks/wassender";
import { wassenderWebhookSchema } from "@/schemas/wassender-webhook";
import { normalizePhone } from "@/lib/whatsapp/send";

export const runtime = "nodejs";

/**
 * Wassender webhook receiver.
 *
 * Real Wassender payload (messages.received):
 *   {
 *     event: "messages.received",
 *     sessionId: "<the user's Wassender token>",
 *     data: {
 *       messages: {
 *         key: { fromMe, cleanedSenderPn, remoteJid, senderPn },
 *         message: { conversation, imageMessage, ... },
 *         messageTimestamp: <unix seconds>
 *       }
 *     }
 *   }
 *
 * We:
 *  1. Verify signature.
 *  2. Insert webhook_events for idempotency.
 *  3. Route to the right Leadero user by matching sessionId → Profile.wassenderToken.
 *  4. Extract sender phone + body and upsert lead + insert WhatsappMessage.
 *
 * Returns 200 on all processed events (even on internal errors) so Wassender
 * doesn't retry forever on a payload we can't handle.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const secret = process.env.WASSENDER_WEBHOOK_SECRET;
  const signature =
    req.headers.get("x-webhook-signature") ??
    req.headers.get("X-Webhook-Signature");

  if (secret) {
    if (!verifyWassenderSignature(rawBody, signature, secret)) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 },
      );
    }
  }

  let payloadJson: unknown;
  try {
    payloadJson = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = wassenderWebhookSchema.safeParse(payloadJson);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const event = parsed.data;
  const eventName = event.event.toLowerCase();
  const sessionId = event.sessionId ?? event.session_id ?? "";

  // Build a stable idempotency key from the WA message id when available.
  const messages = pick<Record<string, unknown>>(event.data, "messages");
  const key = messages ? pick<Record<string, unknown>>(messages, "key") : null;
  const providerMsgId =
    asString(key?.id) ??
    asString(messages?.id) ??
    asString(event.data?.id) ??
    cryptoRandomId();
  const externalId = `${eventName}:${providerMsgId}`;

  // Idempotency guard
  let webhookEventId: string;
  try {
    const created = await prisma.webhookEvent.create({
      data: {
        source: "wassender",
        externalId,
        payload: payloadJson as Prisma.InputJsonValue,
      },
    });
    webhookEventId = created.id;
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    throw err;
  }

  try {
    // Skip the simulator's test event — nothing to persist.
    if (eventName === "webhook.test") {
      await prisma.webhookEvent.update({
        where: { id: webhookEventId },
        data: { processedAt: new Date() },
      });
      return NextResponse.json({ ok: true, kind: "test" });
    }

    // Match user by sessionId = wassenderToken
    if (!sessionId) throw new Error("Webhook payload missing sessionId");
    const profile = await prisma.profile.findFirst({
      where: { wassenderToken: sessionId },
    });
    if (!profile) {
      throw new Error(
        `No Leadero user matches Wassender sessionId. Token not configured in Settings?`,
      );
    }

    // Delivery-status callbacks (message.sent, .delivered, .read, .failed).
    if (
      eventName.includes("delivered") ||
      eventName.includes("read") ||
      eventName.includes("failed") ||
      eventName === "message.sent" ||
      eventName === "messages.sent"
    ) {
      const newStatus: WhatsappStatus = eventName.includes("read")
        ? "READ"
        : eventName.includes("delivered")
          ? "DELIVERED"
          : eventName.includes("failed")
            ? "FAILED"
            : "SENT";
      if (providerMsgId) {
        await prisma.whatsappMessage.updateMany({
          where: { externalId: providerMsgId, ownerId: profile.id },
          data: { status: newStatus },
        });
      }
      await prisma.webhookEvent.update({
        where: { id: webhookEventId },
        data: { processedAt: new Date() },
      });
      return NextResponse.json({ ok: true, kind: "status_update" });
    }

    // Treat anything else as a received message.
    if (!messages) {
      throw new Error("Webhook payload missing data.messages");
    }

    const isFromMe = key?.fromMe === true;
    const senderPhone =
      normalizePhone(asString(key?.cleanedSenderPn) ?? "") ||
      normalizePhone(stripJid(asString(key?.senderPn))) ||
      normalizePhone(stripJid(asString(key?.remoteJid)));

    if (!senderPhone) {
      throw new Error("Could not extract sender phone from payload");
    }

    const messageBody = extractMessageBody(messages.message);
    const messageType = detectMessageType(messages.message);
    const sentAt = parseTimestamp(messages.messageTimestamp ?? event.timestamp);

    // The "other side" = the lead. If fromMe, the lead is the recipient
    // (which Wassender doesn't include reliably for outbound). For incoming,
    // the lead is the sender.
    const leadPhone = senderPhone; // we only support inbound routing reliably

    // Find-or-create lead
    let lead = await prisma.lead.findFirst({
      where: { ownerId: profile.id, phone: leadPhone },
    });
    if (!lead) {
      lead = await prisma.lead.create({
        data: {
          ownerId: profile.id,
          fullName: leadPhone,
          phone: leadPhone,
          source: "whatsapp",
          status: "NEW",
        },
      });
    }

    const myNumber = profile.whatsappNumber ?? "";
    await prisma.whatsappMessage.create({
      data: {
        ownerId: profile.id,
        leadId: lead.id,
        direction: isFromMe ? "OUTBOUND" : "INBOUND",
        messageType,
        body: messageBody,
        fromNumber: isFromMe ? myNumber : leadPhone,
        toNumber: isFromMe ? leadPhone : myNumber,
        status: isFromMe ? "SENT" : "DELIVERED",
        externalId: providerMsgId,
        sentAt,
      },
    });

    await prisma.webhookEvent.update({
      where: { id: webhookEventId },
      data: { processedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Wassender webhook processing failed:", message);
    await prisma.webhookEvent.update({
      where: { id: webhookEventId },
      data: { error: message.slice(0, 1000) },
    });
    return NextResponse.json({ ok: false, error: message });
  }
}

// ─── helpers ──────────────────────────────────────────────────────────────

function pick<T>(obj: Record<string, unknown> | undefined, key: string): T | null {
  if (!obj) return null;
  const v = obj[key];
  return v && typeof v === "object" ? (v as T) : null;
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function stripJid(value: string | undefined): string {
  if (!value) return "";
  return value.split("@")[0] ?? value;
}

function extractMessageBody(msg: unknown): string | null {
  if (!msg || typeof msg !== "object") return null;
  const m = msg as Record<string, unknown>;
  if (typeof m.conversation === "string") return m.conversation;
  const ext = m.extendedTextMessage as Record<string, unknown> | undefined;
  if (ext && typeof ext.text === "string") return ext.text;
  const img = m.imageMessage as Record<string, unknown> | undefined;
  if (img && typeof img.caption === "string") return img.caption;
  const vid = m.videoMessage as Record<string, unknown> | undefined;
  if (vid && typeof vid.caption === "string") return vid.caption;
  const doc = m.documentMessage as Record<string, unknown> | undefined;
  if (doc && typeof doc.caption === "string") return doc.caption;
  return null;
}

function detectMessageType(msg: unknown): WhatsappMessageType {
  if (!msg || typeof msg !== "object") return "TEXT";
  const m = msg as Record<string, unknown>;
  if (m.conversation || m.extendedTextMessage) return "TEXT";
  if (m.imageMessage) return "IMAGE";
  if (m.videoMessage) return "VIDEO";
  if (m.audioMessage || m.pttMessage) return "AUDIO";
  if (m.documentMessage) return "DOCUMENT";
  return "OTHER";
}

function parseTimestamp(ts: unknown): Date {
  if (ts === undefined || ts === null) return new Date();
  const n = typeof ts === "string" ? Number(ts) : (ts as number);
  if (!Number.isFinite(n)) return new Date();
  return new Date(n > 1e12 ? n : n * 1000);
}

function cryptoRandomId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
