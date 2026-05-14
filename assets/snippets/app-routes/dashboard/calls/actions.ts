"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { callCreateSchema, callUpdateSchema } from "@/schemas/call";

export type FormState = { error?: string; ok?: boolean };

function parseForm(formData: FormData) {
  const durationRaw = (formData.get("durationMinutes") as string) ?? "";
  return {
    leadId: (formData.get("leadId") as string) ?? "",
    direction: (formData.get("direction") as string) ?? "OUTBOUND",
    occurredAt: (formData.get("occurredAt") as string) ?? "",
    durationMinutes:
      durationRaw === "" ? null : Math.max(0, parseInt(durationRaw, 10) || 0),
    notes: (formData.get("notes") as string) ?? "",
    transcript: (formData.get("transcript") as string) ?? "",
  };
}

export async function createCallAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = callCreateSchema.safeParse(parseForm(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "קלט לא תקין" };
  }

  // Verify the lead belongs to the user
  const lead = await prisma.lead.findFirst({
    where: { id: parsed.data.leadId, ownerId: user.id },
    select: { id: true },
  });
  if (!lead) return { error: "הליד לא נמצא" };

  await prisma.call.create({
    data: {
      leadId: parsed.data.leadId,
      ownerId: user.id,
      direction: parsed.data.direction,
      occurredAt: new Date(parsed.data.occurredAt),
      durationSeconds:
        parsed.data.durationMinutes !== null
          ? parsed.data.durationMinutes * 60
          : null,
      notes: parsed.data.notes,
      transcript: parsed.data.transcript,
    },
  });

  revalidatePath(`/leads/${parsed.data.leadId}`);
  return { ok: true };
}

export async function updateCallAction(
  callId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = callUpdateSchema.safeParse(parseForm(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "קלט לא תקין" };
  }

  const existing = await prisma.call.findFirst({
    where: { id: callId, ownerId: user.id },
    select: { leadId: true },
  });
  if (!existing) return { error: "השיחה לא נמצאה" };

  await prisma.call.update({
    where: { id: callId },
    data: {
      ...(parsed.data.direction !== undefined && {
        direction: parsed.data.direction,
      }),
      ...(parsed.data.occurredAt !== undefined && {
        occurredAt: new Date(parsed.data.occurredAt),
      }),
      ...(parsed.data.durationMinutes !== undefined && {
        durationSeconds:
          parsed.data.durationMinutes !== null
            ? parsed.data.durationMinutes * 60
            : null,
      }),
      ...(parsed.data.notes !== undefined && { notes: parsed.data.notes }),
      ...(parsed.data.transcript !== undefined && {
        transcript: parsed.data.transcript,
      }),
    },
  });

  revalidatePath(`/leads/${existing.leadId}`);
  return { ok: true };
}

export async function deleteCallAction(callId: string) {
  const user = await requireUser();
  const call = await prisma.call.findFirst({
    where: { id: callId, ownerId: user.id },
    select: { leadId: true },
  });
  if (!call) return;

  await prisma.call.delete({ where: { id: callId } });
  revalidatePath(`/leads/${call.leadId}`);
}
