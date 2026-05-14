import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { formatDate } from "@/lib/utils";

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
  if (!call.analyzedAt) {
    return NextResponse.json(
      { error: "השיחה עוד לא נותחה" },
      { status: 400 },
    );
  }

  // Pull commitments + next steps. AI commitments → HIGH priority,
  // next steps → MEDIUM. Both reference the original call in description.
  const myCommitments = (call.myCommitments as string[] | null) ?? [];
  const nextSteps = (call.recommendedNextSteps as string[] | null) ?? [];

  if (myCommitments.length === 0 && nextSteps.length === 0) {
    return NextResponse.json(
      { error: "אין התחייבויות או צעדים מומלצים ביצירת משימות" },
      { status: 400 },
    );
  }

  const callDate = formatDate(call.occurredAt);
  const sourceTag = `(מתוך ניתוח שיחה מ־${callDate})`;

  const tasksToCreate = [
    ...myCommitments.map((title) => ({
      title,
      description: sourceTag,
      priority: "HIGH" as const,
    })),
    ...nextSteps.map((title) => ({
      title,
      description: sourceTag,
      priority: "MEDIUM" as const,
    })),
  ];

  await prisma.task.createMany({
    data: tasksToCreate.map((task) => ({
      leadId: call.leadId,
      ownerId: user.id,
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: "PENDING" as const,
    })),
  });

  revalidatePath(`/leads/${call.leadId}`);
  revalidatePath("/tasks");
  revalidatePath("/dashboard");

  return NextResponse.json({ created: tasksToCreate.length });
}
