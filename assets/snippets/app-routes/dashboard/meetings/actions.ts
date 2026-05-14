"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import {
  meetingCreateSchema,
  meetingUpdateSchema,
} from "@/schemas/meeting";

export type FormState = { error?: string; ok?: boolean };

function parseForm(formData: FormData) {
  return {
    leadId: (formData.get("leadId") as string) ?? "",
    scheduledAt: (formData.get("scheduledAt") as string) ?? "",
    durationMinutes: parseInt(
      (formData.get("durationMinutes") as string) ?? "30",
      10,
    ),
    status: (formData.get("status") as string) ?? "SCHEDULED",
    notes: (formData.get("notes") as string) ?? "",
    meetingUrl: (formData.get("meetingUrl") as string) ?? "",
  };
}

export async function createMeetingAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = meetingCreateSchema.safeParse(parseForm(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "קלט לא תקין" };
  }

  // Confirm the lead belongs to the user
  const lead = await prisma.lead.findFirst({
    where: { id: parsed.data.leadId, ownerId: user.id },
    select: { id: true, status: true },
  });
  if (!lead) return { error: "הליד לא נמצא" };

  await prisma.$transaction(async (tx) => {
    await tx.meeting.create({
      data: {
        leadId: parsed.data.leadId,
        ownerId: user.id,
        scheduledAt: new Date(parsed.data.scheduledAt),
        durationMinutes: parsed.data.durationMinutes,
        status: parsed.data.status,
        notes: parsed.data.notes,
        meetingUrl: parsed.data.meetingUrl,
      },
    });
    // Auto-advance lead status when a future meeting is created
    if (lead.status === "NEW" && parsed.data.status === "SCHEDULED") {
      await tx.lead.update({
        where: { id: lead.id },
        data: { status: "MEETING_SCHEDULED" },
      });
    }
  });

  revalidatePath("/meetings");
  revalidatePath(`/leads/${parsed.data.leadId}`);
  return { ok: true };
}

export async function updateMeetingAction(
  meetingId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = meetingUpdateSchema.safeParse(parseForm(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "קלט לא תקין" };
  }

  const existing = await prisma.meeting.findFirst({
    where: { id: meetingId, ownerId: user.id },
    select: { leadId: true },
  });
  if (!existing) return { error: "הפגישה לא נמצאה" };

  await prisma.$transaction(async (tx) => {
    await tx.meeting.update({
      where: { id: meetingId },
      data: {
        ...(parsed.data.scheduledAt && {
          scheduledAt: new Date(parsed.data.scheduledAt),
        }),
        ...(parsed.data.durationMinutes !== undefined && {
          durationMinutes: parsed.data.durationMinutes,
        }),
        ...(parsed.data.status && { status: parsed.data.status }),
        ...(parsed.data.notes !== undefined && { notes: parsed.data.notes }),
        ...(parsed.data.meetingUrl !== undefined && {
          meetingUrl: parsed.data.meetingUrl,
        }),
      },
    });
    // Auto-advance lead status when meeting is marked complete
    if (parsed.data.status === "COMPLETED") {
      await tx.lead.updateMany({
        where: {
          id: existing.leadId,
          ownerId: user.id,
          status: { in: ["NEW", "MEETING_SCHEDULED"] },
        },
        data: { status: "MEETING_COMPLETED" },
      });
    }
  });

  revalidatePath("/meetings");
  revalidatePath(`/leads/${existing.leadId}`);
  return { ok: true };
}

export async function deleteMeetingAction(meetingId: string) {
  const user = await requireUser();
  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, ownerId: user.id },
    select: { leadId: true },
  });
  if (!meeting) return;

  await prisma.meeting.delete({ where: { id: meetingId } });
  revalidatePath("/meetings");
  revalidatePath(`/leads/${meeting.leadId}`);
}
