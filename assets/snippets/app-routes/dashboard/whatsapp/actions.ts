"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { normalizePhone, sendWhatsappText } from "@/lib/whatsapp/send";

export type FormState = { error?: string; ok?: boolean };

const sendSchema = z.object({
  leadId: z.string().uuid("ליד לא תקין"),
  body: z.string().trim().min(1, "ההודעה ריקה").max(4096, "ההודעה ארוכה מדי"),
});

export async function sendWhatsappAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();

  const parsed = sendSchema.safeParse({
    leadId: (formData.get("leadId") as string) ?? "",
    body: (formData.get("body") as string) ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "קלט לא תקין" };
  }

  if (!user.wassenderToken) {
    return {
      error:
        "טוקן Wassender לא מוגדר. עברו להגדרות והוסיפו טוקן Personal Access Token.",
    };
  }
  if (!user.whatsappNumber) {
    return {
      error:
        "מספר וואטסאפ שלך לא מוגדר. עברו להגדרות והוסיפו את המספר שלכם.",
    };
  }

  const lead = await prisma.lead.findFirst({
    where: { id: parsed.data.leadId, ownerId: user.id },
    select: { id: true, phone: true },
  });
  if (!lead) return { error: "הליד לא נמצא" };
  if (!lead.phone) return { error: "ללקוח אין מספר טלפון" };

  const fromNumber = user.whatsappNumber;
  const toNumber = normalizePhone(lead.phone);

  const result = await sendWhatsappText(
    user.wassenderToken,
    toNumber,
    parsed.data.body,
  );

  await prisma.whatsappMessage.create({
    data: {
      ownerId: user.id,
      leadId: lead.id,
      direction: "OUTBOUND",
      messageType: "TEXT",
      body: parsed.data.body,
      fromNumber,
      toNumber,
      status: result.ok ? "SENT" : "FAILED",
      externalId: result.externalId ?? null,
      sentAt: new Date(),
      errorMessage: result.ok ? null : (result.error ?? null),
    },
  });

  revalidatePath(`/leads/${lead.id}`);

  if (!result.ok) {
    return { error: result.error ?? "שליחת ההודעה נכשלה" };
  }
  return { ok: true };
}
