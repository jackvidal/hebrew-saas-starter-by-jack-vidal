import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { draftWhatsappReply } from "@/lib/ai/draft-whatsapp-reply";

export const runtime = "nodejs";

const bodySchema = z.object({
  leadId: z.string().uuid(),
});

export async function POST(req: Request) {
  const user = await requireUser();

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const lead = await prisma.lead.findFirst({
    where: { id: parsed.data.leadId, ownerId: user.id },
    select: { id: true, fullName: true },
  });
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const thread = await prisma.whatsappMessage.findMany({
    where: { leadId: lead.id, ownerId: user.id },
    orderBy: { sentAt: "asc" },
    select: { direction: true, body: true, sentAt: true },
  });

  if (thread.length === 0) {
    return NextResponse.json(
      { error: "אין עדיין הודעות בשרשור" },
      { status: 400 },
    );
  }

  try {
    const result = await draftWhatsappReply(thread, lead.fullName);
    return NextResponse.json({ ok: true, text: result.text });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("Draft reply failed:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
