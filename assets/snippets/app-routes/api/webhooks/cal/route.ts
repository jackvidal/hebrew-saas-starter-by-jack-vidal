import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyCalSignature } from "@/lib/webhooks/cal";
import { calWebhookSchema } from "@/schemas/cal-webhook";

export const runtime = "nodejs";

/**
 * Cal.com webhook receiver.
 *
 * 1. Verify HMAC signature against CAL_WEBHOOK_SECRET.
 * 2. Validate payload.
 * 3. Idempotency: insert into webhook_events on (source, externalId).
 *    A unique-constraint failure means we've already processed this event.
 * 4. Route to the right user via Profile.calOrganizerEmail.
 * 5. Upsert lead by (ownerId, email); create/update meeting by calEventId.
 * 6. Auto-update lead status.
 */
export async function POST(req: Request) {
  const secret = process.env.CAL_WEBHOOK_SECRET;
  if (!secret) {
    console.error("CAL_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const rawBody = await req.text();
  const signature =
    req.headers.get("x-cal-signature-256") ??
    req.headers.get("X-Cal-Signature-256");

  if (!verifyCalSignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payloadJson: unknown;
  try {
    payloadJson = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = calWebhookSchema.safeParse(payloadJson);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const event = parsed.data;
  const externalId = `${event.triggerEvent}:${event.payload.uid}`;

  // Idempotency guard: insert first; if duplicate, return 200 immediately.
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
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    throw err;
  }

  try {
    const organizerEmail = event.payload.organizer?.email?.toLowerCase();
    if (!organizerEmail) {
      throw new Error("Webhook payload missing organizer email");
    }

    const profile = await prisma.profile.findFirst({
      where: { calOrganizerEmail: organizerEmail },
    });
    if (!profile) {
      throw new Error(
        `No Leadero user mapped to organizer ${organizerEmail}. Set this on the Settings page.`,
      );
    }

    const attendee = event.payload.attendees[0];
    if (!attendee?.email) {
      throw new Error("Webhook payload missing attendee email");
    }
    const attendeeEmail = attendee.email.toLowerCase();

    // Upsert lead by (ownerId + email)
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
    } else if (attendee.name && lead.fullName !== attendee.name) {
      lead = await prisma.lead.update({
        where: { id: lead.id },
        data: { fullName: attendee.name },
      });
    }

    const scheduledAt = new Date(event.payload.startTime);
    const endTime = new Date(event.payload.endTime);
    const durationMinutes = Math.max(
      5,
      Math.round((endTime.getTime() - scheduledAt.getTime()) / 60000),
    );

    // Decide meeting status from event type
    const meetingStatus =
      event.triggerEvent === "BOOKING_CANCELLED"
        ? "CANCELED"
        : event.triggerEvent === "MEETING_ENDED"
          ? "COMPLETED"
          : "SCHEDULED";

    // Upsert meeting by calEventId (uid)
    await prisma.meeting.upsert({
      where: { calEventId: event.payload.uid },
      create: {
        leadId: lead.id,
        ownerId: profile.id,
        scheduledAt,
        durationMinutes,
        status: meetingStatus,
        notes: event.payload.additionalNotes ?? null,
        meetingUrl: event.payload.location ?? null,
        calEventId: event.payload.uid,
      },
      update: {
        scheduledAt,
        durationMinutes,
        status: meetingStatus,
        meetingUrl: event.payload.location ?? null,
      },
    });

    // Auto-update lead status from event
    if (event.triggerEvent === "MEETING_ENDED") {
      await prisma.lead.updateMany({
        where: {
          id: lead.id,
          status: { in: ["NEW", "MEETING_SCHEDULED"] },
        },
        data: { status: "MEETING_COMPLETED" },
      });
    } else if (
      event.triggerEvent === "BOOKING_CREATED" ||
      event.triggerEvent === "BOOKING_RESCHEDULED"
    ) {
      await prisma.lead.updateMany({
        where: { id: lead.id, status: "NEW" },
        data: { status: "MEETING_SCHEDULED" },
      });
    }

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
    // Return 200 so Cal doesn't retry forever on a malformed/unmapped payload.
    return NextResponse.json({ ok: false, error: message });
  }
}
