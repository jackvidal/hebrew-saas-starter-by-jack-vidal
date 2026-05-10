# Cal.com Webhook Recipe — HMAC + Idempotency + Email Routing

The pattern works for **any signed webhook** (Cal.com, Stripe, Shopify, Linear, etc.) with minor adjustments. Three pillars:

1. **Verify HMAC signature** with `timingSafeEqual` (timing-attack resistant)
2. **Insert into `webhook_events` first** for idempotency (replay-safe)
3. **Route to a JackCRM user via a profile field** (e.g., `calOrganizerEmail`)

## The signature verifier — `src/lib/webhooks/cal.ts`

```ts
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
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
```

Why `timingSafeEqual` and not `===`? String comparison short-circuits on the first mismatched character, leaking how many bytes match via timing. `timingSafeEqual` always takes the same time regardless of where the mismatch is. Critical for HMAC.

## The webhook events table — `prisma/schema.prisma`

```prisma
model WebhookEvent {
  id          String    @id @default(uuid()) @db.Uuid
  source      String                        // 'cal.com'
  externalId  String    @map("external_id") // Cal's bookingId or triggerEvent+payload hash
  payload     Json
  processedAt DateTime? @map("processed_at")
  error       String?
  createdAt   DateTime  @default(now()) @map("created_at")

  @@unique([source, externalId])
  @@map("webhook_events")
}
```

The `@@unique([source, externalId])` is what makes idempotency work — INSERT on a duplicate fails with P2002, which we catch and treat as "already processed."

## The Zod payload schema — `src/schemas/cal-webhook.ts`

```ts
import { z } from "zod";

export const calAttendeeSchema = z.object({
  name: z.string().optional(),
  email: z.string().email(),
  timeZone: z.string().optional(),
}).passthrough();  // tolerate Cal.com adding fields

export const calOrganizerSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
  timeZone: z.string().optional(),
}).passthrough();

export const calBookingPayloadSchema = z.object({
  uid: z.string(),
  title: z.string().optional(),
  startTime: z.string(),
  endTime: z.string(),
  organizer: calOrganizerSchema.optional(),
  attendees: z.array(calAttendeeSchema).default([]),
  location: z.string().optional(),
  additionalNotes: z.string().nullable().optional(),
}).passthrough();

export const calWebhookSchema = z.object({
  triggerEvent: z.enum([
    "BOOKING_CREATED",
    "BOOKING_RESCHEDULED",
    "BOOKING_CANCELLED",
    "MEETING_ENDED",
  ]),
  payload: calBookingPayloadSchema,
}).passthrough();

export type CalWebhookPayload = z.infer<typeof calWebhookSchema>;
```

`.passthrough()` on inner objects is intentional — don't break when Cal.com adds new fields.

## The handler — `src/app/api/webhooks/cal/route.ts`

The flow:

```
1. Read raw body (req.text() — must be raw for HMAC)
2. Verify signature against CAL_WEBHOOK_SECRET → 401 if invalid
3. Parse JSON, validate with Zod → 400 if malformed
4. INSERT into webhook_events with UNIQUE(source, externalId)
   ↳ If P2002 (duplicate): return 200 immediately ("already processed")
   ↳ Otherwise: continue
5. Look up which Profile owns this organizer email → throw if none
6. Upsert Lead by (ownerId, email)
7. Upsert Meeting by calEventId
8. Auto-update lead status based on event type
9. Mark webhook_events.processedAt = now()
10. Return 200 (or 200 + error field if processing failed —
    don't 500, or Cal.com retries forever)
```

Key code:

```ts
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyCalSignature } from "@/lib/webhooks/cal";
import { calWebhookSchema } from "@/schemas/cal-webhook";

export const runtime = "nodejs";  // need Node crypto, not Edge

export async function POST(req: Request) {
  const secret = process.env.CAL_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  // 1. Read raw body
  const rawBody = await req.text();
  const signature = req.headers.get("x-cal-signature-256");

  // 2. Verify signature
  if (!verifyCalSignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // 3. Parse + validate
  let payloadJson: unknown;
  try {
    payloadJson = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = calWebhookSchema.safeParse(payloadJson);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const event = parsed.data;
  const externalId = `${event.triggerEvent}:${event.payload.uid}`;

  // 4. Idempotency guard
  let webhookEventId: string;
  try {
    const created = await prisma.webhookEvent.create({
      data: {
        source: "cal.com",
        externalId,
        payload: payloadJson as Prisma.InputJsonValue,
      },
    });
    webhookEventId = created.id;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    throw err;
  }

  try {
    // 5. Route by organizer email
    const organizerEmail = event.payload.organizer?.email?.toLowerCase();
    if (!organizerEmail) throw new Error("Webhook payload missing organizer email");

    const profile = await prisma.profile.findFirst({
      where: { calOrganizerEmail: organizerEmail },
    });
    if (!profile) {
      throw new Error(
        `No JackCRM user mapped to organizer ${organizerEmail}. Set on Settings page.`
      );
    }

    const attendee = event.payload.attendees[0];
    if (!attendee?.email) throw new Error("Webhook payload missing attendee email");
    const attendeeEmail = attendee.email.toLowerCase();

    // 6. Upsert lead
    let lead = await prisma.lead.findFirst({
      where: { ownerId: profile.id, email: attendeeEmail },
    });
    if (!lead) {
      lead = await prisma.lead.create({
        data: {
          ownerId: profile.id,
          fullName: attendee.name ?? attendeeEmail,
          email: attendeeEmail,
          source: "cal.com",
          status: "MEETING_SCHEDULED",
        },
      });
    }

    const scheduledAt = new Date(event.payload.startTime);
    const endTime = new Date(event.payload.endTime);
    const durationMinutes = Math.max(5, Math.round((endTime.getTime() - scheduledAt.getTime()) / 60000));

    const meetingStatus =
      event.triggerEvent === "BOOKING_CANCELLED" ? "CANCELED"
      : event.triggerEvent === "MEETING_ENDED" ? "COMPLETED"
      : "SCHEDULED";

    // 7. Upsert meeting by calEventId
    await prisma.meeting.upsert({
      where: { calEventId: event.payload.uid },
      create: {
        leadId: lead.id,
        ownerId: profile.id,
        scheduledAt,
        durationMinutes,
        status: meetingStatus,
        meetingUrl: event.payload.location ?? null,
        calEventId: event.payload.uid,
      },
      update: { scheduledAt, durationMinutes, status: meetingStatus },
    });

    // 8. Auto-update lead status
    if (event.triggerEvent === "MEETING_ENDED") {
      await prisma.lead.updateMany({
        where: { id: lead.id, status: { in: ["NEW", "MEETING_SCHEDULED"] } },
        data: { status: "MEETING_COMPLETED" },
      });
    }

    // 9. Mark processed
    await prisma.webhookEvent.update({
      where: { id: webhookEventId },
      data: { processedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Cal webhook processing failed:", message);
    await prisma.webhookEvent.update({
      where: { id: webhookEventId },
      data: { error: message.slice(0, 1000) },
    });
    // Return 200 so Cal.com doesn't retry forever on a malformed/unmapped payload
    return NextResponse.json({ ok: false, error: message });
  }
}
```

## Critical detail: middleware exclusion

The Next.js middleware MUST exclude `/api/webhooks/*` from the auth gate. Otherwise every webhook 307s to `/login`. In `src/middleware.ts`:

```ts
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/webhooks|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

The `api/webhooks` segment in the negative lookahead is the magic.

## Debugging — empty `webhook_events` table

If you booked a real meeting and `webhook_events` is still empty:

| Symptom | Likely cause |
|---|---|
| 0 rows | Cal.com never reached your handler — wrong URL, webhook disabled, or signature 401 (handler returns BEFORE inserting) |
| Rows but `processedAt` null + `error` populated | Got past signature, failed during processing — read `error` column |
| Rows with `processedAt` set but no Lead created | Profile mapping is missing — user needs to set `calOrganizerEmail` in Settings |

To verify your handler accepts a properly-signed payload (rules out signature issues):

```bash
SECRET="<the-real-secret>"
BODY='{"triggerEvent":"BOOKING_CREATED","payload":{"uid":"manual-test-001","startTime":"2026-05-12T10:00:00.000Z","endTime":"2026-05-12T10:30:00.000Z","attendees":[{"name":"Manual Test","email":"manualtest@example.com"}],"organizer":{"email":"<your-organizer-email>"}}}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" -hex | awk '{print $NF}')
curl -i -X POST https://your-app.vercel.app/api/webhooks/cal \
  -H "Content-Type: application/json" \
  -H "X-Cal-Signature-256: $SIG" \
  -d "$BODY"
```

A `200 {"ok":true}` confirms the handler works. If you get 401 from this, the secret in Vercel doesn't match the secret you're using.

## Adapting to Stripe / Shopify / Linear / etc.

Same pattern, different headers:

| Provider | Header | Algorithm |
|---|---|---|
| Cal.com | `X-Cal-Signature-256` | HMAC-SHA256 of body with secret |
| Stripe | `Stripe-Signature` | HMAC-SHA256, but with timestamp + body in signed payload (use `stripe.webhooks.constructEvent` from the SDK) |
| Shopify | `X-Shopify-Hmac-SHA256` | base64-encoded HMAC-SHA256 |
| Linear | `Linear-Signature` | hex-encoded HMAC-SHA256 |

For Stripe specifically, use the SDK's `constructEvent` helper instead of rolling your own — it handles the timestamp correctly to prevent replay attacks beyond 5 minutes.
