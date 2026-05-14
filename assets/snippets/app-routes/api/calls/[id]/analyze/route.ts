import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { analyzeCall } from "@/lib/ai/analyze-call";
import { revalidatePath } from "next/cache";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const call = await prisma.call.findFirst({
    where: { id, ownerId: user.id },
  });
  if (!call) {
    return NextResponse.json({ error: "Call not found" }, { status: 404 });
  }
  if (!call.transcript || !call.transcript.trim()) {
    return NextResponse.json(
      { error: "אין תמלול לניתוח" },
      { status: 400 },
    );
  }

  try {
    const result = await analyzeCall(call.transcript);

    const updated = await prisma.call.update({
      where: { id: call.id },
      data: {
        summary: result.summary,
        keyTopics: result.keyTopics,
        sentiment: result.sentiment,
        sentimentReason: result.sentimentReason,
        prospectCommitments: result.prospectCommitments,
        myCommitments: result.myCommitments,
        recommendedNextSteps: result.recommendedNextSteps,
        redFlags: result.redFlags,
        analyzedAt: new Date(),
        modelUsed: result.modelUsed,
      },
    });

    revalidatePath(`/leads/${call.leadId}`);
    return NextResponse.json({ call: updated });
  } catch (err) {
    console.error("Call analysis failed", err);
    const raw = err instanceof Error ? err.message : "שגיאה לא ידועה";
    const sanitized =
      raw.length > 200 || /\b(invocation|prisma|stack|TypeError)\b/i.test(raw)
        ? "ניתוח השיחה נכשל. אנא נסו שוב."
        : raw;
    return NextResponse.json({ error: sanitized }, { status: 500 });
  }
}
