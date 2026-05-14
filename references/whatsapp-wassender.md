# WhatsApp via Wassender — outbound + inbound + AI draft reply

This is the most-debugged integration in the Leadero build. Wassender's quirks bit hard during Session 5 — read this whole doc before touching any code.

The flow:
- **Outbound** — user types in the WhatsApp panel of a lead, server action calls Wassender's `/api/send-message` with the user's Personal Access Token. Wassender forwards it to WhatsApp.
- **Inbound** — Wassender forwards raw WhatsApp Multi-Device events to our webhook. We parse, route to the right user by `sessionId === Profile.wassenderToken`, find-or-create the lead by phone, save the message.
- **AI draft** — button on the panel reads the conversation thread, asks Claude for a friendly-professional Hebrew reply, fills the textarea.

---

## Schema additions

```prisma
enum WhatsappDirection {
  INBOUND
  OUTBOUND
}

enum WhatsappMessageType {
  TEXT
  IMAGE
  VIDEO
  AUDIO
  DOCUMENT
  OTHER
}

enum WhatsappStatus {
  PENDING
  SENT
  DELIVERED
  READ
  FAILED
}

model Profile {
  // ... existing fields
  whatsappNumber String? @map("whatsapp_number")
  wassenderToken String? @map("wassender_token")
  whatsappMessages WhatsappMessage[]
}

model Lead {
  // ... existing fields
  whatsappMessages WhatsappMessage[]
  phone String?  // index this — webhook routing matches by phone
  @@index([ownerId, phone])
}

model WhatsappMessage {
  id              String              @id @default(uuid()) @db.Uuid
  ownerId         String              @map("owner_id") @db.Uuid
  owner           Profile             @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  leadId          String              @map("lead_id") @db.Uuid
  lead            Lead                @relation(fields: [leadId], references: [id], onDelete: Cascade)
  direction       WhatsappDirection
  messageType     WhatsappMessageType @default(TEXT) @map("message_type")
  body            String?
  mediaUrl        String?             @map("media_url")
  fromNumber      String              @map("from_number")
  toNumber        String              @map("to_number")
  status          WhatsappStatus      @default(SENT)
  externalId      String?             @unique @map("external_id") // provider message id
  sentAt          DateTime            @map("sent_at")
  errorMessage    String?             @map("error_message")
  createdAt       DateTime            @default(now()) @map("created_at")
  updatedAt       DateTime            @updatedAt @map("updated_at")

  @@index([ownerId, sentAt])
  @@index([leadId, sentAt])
  @@map("whatsapp_messages")
}
```

## RLS

```sql
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "whatsapp_messages_select_own" ON public.whatsapp_messages;
CREATE POLICY "whatsapp_messages_select_own" ON public.whatsapp_messages
  FOR SELECT USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "whatsapp_messages_insert_own" ON public.whatsapp_messages;
CREATE POLICY "whatsapp_messages_insert_own" ON public.whatsapp_messages
  FOR INSERT WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "whatsapp_messages_update_own" ON public.whatsapp_messages;
CREATE POLICY "whatsapp_messages_update_own" ON public.whatsapp_messages
  FOR UPDATE USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "whatsapp_messages_delete_own" ON public.whatsapp_messages;
CREATE POLICY "whatsapp_messages_delete_own" ON public.whatsapp_messages
  FOR DELETE USING (owner_id = auth.uid());
```

---

## Per-user vs system secrets

| Secret | Where it lives | Why |
|---|---|---|
| Wassender Personal Access Token | `Profile.wassenderToken` | Different per user — each user connects their own WhatsApp via QR scan in Wassender |
| User's WhatsApp number | `Profile.whatsappNumber` | Different per user |
| Wassender webhook secret | `WASSENDER_WEBHOOK_SECRET` env var | System-level — same value for all events that arrive at our single endpoint |

**Anti-pattern:** putting the Wassender token in env. That works only for single-user apps. Don't.

---

## Outbound — Wassender API

```ts
// src/lib/whatsapp/send.ts
const WASSENDER_BASE_URL = process.env.WASSENDER_API_URL ?? "https://wasenderapi.com/api";

export function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-().]/g, "").replace(/^\+/, "");
}

export async function sendWhatsappText(
  token: string,
  toPhone: string,
  body: string,
): Promise<{ ok: boolean; externalId?: string; error?: string; raw?: unknown }> {
  const to = normalizePhone(toPhone);
  if (!to) return { ok: false, error: "Missing recipient phone" };
  if (!body.trim()) return { ok: false, error: "Empty message" };

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
  if (!res.ok) return { ok: false, error: raw.message ?? raw.error ?? `Wassender error (${res.status})`, raw };

  // Wassender returns either { msgId } or { data: { msgId } } — handle both
  const externalId = raw.msgId ?? raw.messageId ?? raw.id ?? raw.data?.msgId;
  return { ok: true, externalId, raw };
}
```

**Phone format:** Wassender expects E.164 without the `+` (e.g., `972501234567`). The user enters their number in Settings in the same format. The lead's phone is also normalized this way before any send.

## Outbound server action

```ts
// src/app/(dashboard)/whatsapp/actions.ts
"use server";

export async function sendWhatsappAction(_prev, formData): Promise<FormState> {
  const user = await requireUser();
  const parsed = sendSchema.safeParse({
    leadId: formData.get("leadId"),
    body: formData.get("body"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "קלט לא תקין" };

  if (!user.wassenderToken) return { error: "טוקן Wassender לא מוגדר. עברו להגדרות..." };
  if (!user.whatsappNumber) return { error: "מספר וואטסאפ שלך לא מוגדר..." };

  const lead = await prisma.lead.findFirst({
    where: { id: parsed.data.leadId, ownerId: user.id },
    select: { id: true, phone: true },
  });
  if (!lead) return { error: "הליד לא נמצא" };
  if (!lead.phone) return { error: "ללקוח אין מספר טלפון" };

  const result = await sendWhatsappText(user.wassenderToken, lead.phone, parsed.data.body);

  // Save the message either way (FAILED for retry visibility)
  await prisma.whatsappMessage.create({
    data: {
      ownerId: user.id,
      leadId: lead.id,
      direction: "OUTBOUND",
      messageType: "TEXT",
      body: parsed.data.body,
      fromNumber: user.whatsappNumber,
      toNumber: normalizePhone(lead.phone),
      status: result.ok ? "SENT" : "FAILED",
      externalId: result.externalId ?? null,
      sentAt: new Date(),
      errorMessage: result.ok ? null : result.error ?? null,
    },
  });

  revalidatePath(`/leads/${lead.id}`);
  return result.ok ? { ok: true } : { error: result.error ?? "שליחת ההודעה נכשלה" };
}
```

---

## Inbound — webhook signature verification

**THE big gotcha:** Wassender does NOT send HMAC. The `X-Webhook-Signature` header contains the literal shared secret value.

Their own verification example confirms this:
```js
const secret = req.headers['x-webhook-signature'];
if (secret !== env.WEBHOOK_SECRET) return res.status(403).json({ error: 'Forbidden' });
```

So our verifier does constant-time string equality, NOT HMAC:

```ts
// src/lib/webhooks/wassender.ts
import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyWassenderSignature(
  rawBody: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature) return false;
  const clean = signature.replace(/^sha256=/, "").trim();

  // Path 1: raw shared secret (current Wassender behavior)
  if (constantTimeEquals(clean, secret)) return true;

  // Path 2: HMAC-SHA256 of the body (future-proof, in case they upgrade)
  const computed = createHmac("sha256", secret).update(rawBody).digest("hex");
  return constantTimeEquals(clean, computed);
}

function constantTimeEquals(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf-8");
  const bb = Buffer.from(b, "utf-8");
  if (ba.length !== bb.length) return false;
  try { return timingSafeEqual(ba, bb); } catch { return false; }
}
```

## Inbound — payload structure

Real `messages.received` payload from Wassender:

```json
{
  "event": "messages.received",
  "timestamp": 1786677467864,
  "sessionId": "<the user's Wassender token>",
  "data": {
    "messages": {
      "key": {
        "fromMe": false,
        "remoteJid": "84362552951037@lid",
        "senderPn": "13075337860@s.whatsapp.net",
        "cleanedSenderPn": "13075337860",
        "addressingMode": "lid"
      },
      "message": {
        "conversation": "Hi test"
      },
      "messageTimestamp": "1778678400"
    }
  }
}
```

Key extractions:
- **Text body**: `data.messages.message.conversation` (or `extendedTextMessage.text` for replies/formatting, `imageMessage.caption` / `videoMessage.caption` for media)
- **Sender phone**: `data.messages.key.cleanedSenderPn` (preferred), fallback to `senderPn` stripped of `@s.whatsapp.net`
- **Direction**: `data.messages.key.fromMe` boolean
- **Provider message id**: `data.messages.key.id` (for idempotency + status updates)
- **Sent at**: `data.messages.messageTimestamp` (Unix seconds, multiply by 1000 if < 1e12)

The `@lid` (Linked ID) addressing is WhatsApp's newer system that hides the real phone from groups. `cleanedSenderPn` is always the real phone.

## Inbound — routing

```ts
const profile = await prisma.profile.findFirst({
  where: { wassenderToken: sessionId }, // sessionId from the webhook payload
});
if (!profile) throw new Error(`No Leadero user matches Wassender sessionId.`);
```

This is cleaner than matching by phone number — the token is unique per user, and we already store it in Settings.

## Inbound — full handler skeleton

```ts
// src/app/api/webhooks/wassender/route.ts
export const runtime = "nodejs";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const secret = process.env.WASSENDER_WEBHOOK_SECRET;
  const signature = req.headers.get("x-webhook-signature");

  if (secret && !verifyWassenderSignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payloadJson = JSON.parse(rawBody);
  const parsed = wassenderWebhookSchema.safeParse(payloadJson);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const event = parsed.data;
  const messages = event.data?.messages;
  const key = messages?.key;
  const providerMsgId = key?.id ?? messages?.id ?? cryptoRandomId();
  const externalId = `${event.event}:${providerMsgId}`;

  // Idempotency
  let webhookEventId: string;
  try {
    const created = await prisma.webhookEvent.create({
      data: { source: "wassender", externalId, payload: payloadJson },
    });
    webhookEventId = created.id;
  } catch (err) {
    if (err.code === "P2002") return NextResponse.json({ ok: true, duplicate: true });
    throw err;
  }

  try {
    if (event.event === "webhook.test") {
      await prisma.webhookEvent.update({ where: { id: webhookEventId }, data: { processedAt: new Date() } });
      return NextResponse.json({ ok: true, kind: "test" });
    }

    if (!event.sessionId) throw new Error("Missing sessionId");
    const profile = await prisma.profile.findFirst({ where: { wassenderToken: event.sessionId } });
    if (!profile) throw new Error("No Leadero user matches Wassender sessionId");

    // Delivery status callbacks (sent / delivered / read / failed)
    const eventName = event.event.toLowerCase();
    if (eventName.includes("delivered") || eventName.includes("read") ||
        eventName.includes("failed") || eventName === "message.sent") {
      const newStatus = /* map event → SENT/DELIVERED/READ/FAILED */;
      await prisma.whatsappMessage.updateMany({
        where: { externalId: providerMsgId, ownerId: profile.id },
        data: { status: newStatus },
      });
      // ... mark processed and return
    }

    // Received message
    const isFromMe = key.fromMe === true;
    const senderPhone = normalizePhone(key.cleanedSenderPn ?? stripJid(key.senderPn));
    const body = extractMessageBody(messages.message);
    const messageType = detectMessageType(messages.message);
    const sentAt = parseTimestamp(messages.messageTimestamp);

    const leadPhone = senderPhone;
    let lead = await prisma.lead.findFirst({ where: { ownerId: profile.id, phone: leadPhone } });
    if (!lead) {
      lead = await prisma.lead.create({
        data: { ownerId: profile.id, fullName: leadPhone, phone: leadPhone, source: "whatsapp", status: "NEW" },
      });
    }

    await prisma.whatsappMessage.create({
      data: {
        ownerId: profile.id, leadId: lead.id,
        direction: isFromMe ? "OUTBOUND" : "INBOUND",
        messageType, body,
        fromNumber: isFromMe ? profile.whatsappNumber : leadPhone,
        toNumber: isFromMe ? leadPhone : profile.whatsappNumber,
        status: isFromMe ? "SENT" : "DELIVERED",
        externalId: providerMsgId, sentAt,
      },
    });

    await prisma.webhookEvent.update({ where: { id: webhookEventId }, data: { processedAt: new Date() } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    await prisma.webhookEvent.update({ where: { id: webhookEventId }, data: { error: err.message } });
    // Return 200 so Wassender doesn't retry forever on a malformed/unmapped payload
    return NextResponse.json({ ok: false, error: err.message });
  }
}
```

---

## AI draft reply

Add a "✨ צור טיוטת תגובה" button next to "Send". Clicking it POSTs the leadId to `/api/whatsapp/draft`. The endpoint loads the thread (last ~30 messages), formats it as `[הלקוח]: ...` / `[אני]: ...`, sends to Claude with a Hebrew system prompt that returns one short reply.

System prompt principles:
- Hebrew only
- 1-3 sentences max (WhatsApp is not email)
- Don't include greetings unless it's the first message
- Don't sign with a name
- Answer the customer's last message directly
- If info is missing, suggest a phone call or meeting

```ts
const SYSTEM_PROMPT = `אתה עוזר אישי לבעל עסק קטן בישראל שמנהל לקוחות פוטנציאליים דרך וואטסאפ.
המשימה שלך: לקרוא את שרשור השיחה עם הלקוח ולהציע **תגובה מקצועית, אישית, ובעברית טבעית** שהבעל יוכל לשלוח כתשובה.

עקרונות:
- כתוב בעברית בלבד, בטון ידידותי-מקצועי.
- קצר וענייני — 1-3 משפטים.
- ענה ישירות למה שהלקוח אמר במסר האחרון.
- אל תכלול ברכה אלא אם זו ההודעה הראשונה.
- אל תחתום בשם.

החזר אך ורק את טקסט התגובה המוצעת, בלי הקדמה, בלי הסברים, בלי גרשיים.`;
```

Use `max_tokens: 1024` and prompt-caching on the system prompt. The response text fills the textarea — user edits and sends.

---

## Setup gotchas (in order they bite)

### 1. Vercel Deployment Protection
**This is what 90% of "webhook not arriving" issues turn out to be.** New Vercel projects have "Vercel Authentication → Standard Protection" enabled, which protects every `*.vercel.app` URL behind Vercel SSO. Wassender's webhook gets a 401 redirect to SSO login, not your endpoint.

**Fix:** Vercel Project → Settings → Deployment Protection → toggle off "Require Log In" (or use a custom domain). Without this, no inbound webhook will EVER work, even with the right secret.

### 2. Wassender uses raw secret, not HMAC
Already covered above. The verifier in this skill handles it correctly. Don't "improve" it by computing HMAC of the body.

### 3. Sending to yourself doesn't work
For testing inbound, you can't use the same WhatsApp account that's connected to Wassender. Use a friend's phone, a second number, or a second WhatsApp account.

### 4. Cold start timeouts
Wassender's webhook timeout is 3 seconds. Prisma's cold start on Vercel serverless can hit that. If you see "Webhook Timeout HTTP 408" in Wassender's simulator, the function is slow. Options:
- Keep functions warm with a cron ping
- Move heavy work to `after()` (Next.js 16+) so the response sends fast and processing continues
- Switch to Edge runtime (requires a Prisma-Edge-compatible setup like Prisma Accelerate or Neon serverless driver)

### 5. Vercel build cache
Env var changes don't invalidate the build cache. Use `vercel deploy --prod --force` after env changes.

### 6. Logs return Vercel SSO redirect HTML
`vercel logs <url>` from CLI hits the same Deployment Protection wall when the project is protected. Disable protection (see #1) to read logs from CLI.

---

## What to change per project

- **Wassender base URL** — defaults to `https://wasenderapi.com/api`. Leave as-is unless they self-host.
- **AI draft system prompt** — tune the persona (sales rep vs support rep vs coach). Keep the "Hebrew only / short / no signature" core rules.
- **Lead-from-WhatsApp source** — set `source: "whatsapp"` on the auto-created Lead. Adjust to fit your sources enum.

## What to keep verbatim

- The raw-secret verification path (and the HMAC fallback for forward-compat)
- Per-user routing via `sessionId === Profile.wassenderToken`
- `cleanedSenderPn` first, fallbacks after, for sender phone extraction
- 200 response on processing errors (so Wassender doesn't retry forever on a payload we can't handle)
- The `webhook_events` idempotency table (`source: "wassender"`)
- AI draft endpoint pattern (load last 30 messages, format with `[הלקוח]` / `[אני]`)
