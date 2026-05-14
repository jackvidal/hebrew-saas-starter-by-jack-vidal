"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { taskCreateSchema, taskUpdateSchema } from "@/schemas/task";

export type FormState = { error?: string; ok?: boolean };

function parseForm(formData: FormData) {
  return {
    leadId: (formData.get("leadId") as string) ?? "",
    title: (formData.get("title") as string) ?? "",
    description: (formData.get("description") as string) ?? "",
    dueDate: (formData.get("dueDate") as string) ?? "",
    status: (formData.get("status") as string) ?? "PENDING",
    priority: (formData.get("priority") as string) ?? "MEDIUM",
  };
}

export async function createTaskAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = taskCreateSchema.safeParse(parseForm(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "קלט לא תקין" };
  }

  // Verify the lead belongs to the user
  const lead = await prisma.lead.findFirst({
    where: { id: parsed.data.leadId, ownerId: user.id },
    select: { id: true },
  });
  if (!lead) return { error: "הליד לא נמצא" };

  await prisma.task.create({
    data: {
      leadId: parsed.data.leadId,
      ownerId: user.id,
      title: parsed.data.title,
      description: parsed.data.description,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      status: parsed.data.status,
      priority: parsed.data.priority,
    },
  });

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  revalidatePath(`/leads/${parsed.data.leadId}`);
  return { ok: true };
}

export async function updateTaskAction(
  taskId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = taskUpdateSchema.safeParse(parseForm(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "קלט לא תקין" };
  }

  const existing = await prisma.task.findFirst({
    where: { id: taskId, ownerId: user.id },
    select: { leadId: true, status: true },
  });
  if (!existing) return { error: "המשימה לא נמצאה" };

  const nextStatus = parsed.data.status ?? existing.status;
  const completedAt =
    nextStatus === "DONE" && existing.status !== "DONE"
      ? new Date()
      : nextStatus !== "DONE"
        ? null
        : undefined;

  await prisma.task.update({
    where: { id: taskId },
    data: {
      ...(parsed.data.title !== undefined && { title: parsed.data.title }),
      ...(parsed.data.description !== undefined && {
        description: parsed.data.description,
      }),
      ...(parsed.data.dueDate !== undefined && {
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      }),
      ...(parsed.data.status !== undefined && { status: parsed.data.status }),
      ...(parsed.data.priority !== undefined && {
        priority: parsed.data.priority,
      }),
      ...(completedAt !== undefined && { completedAt }),
    },
  });

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  revalidatePath(`/leads/${existing.leadId}`);
  return { ok: true };
}

export async function toggleTaskDoneAction(taskId: string) {
  const user = await requireUser();
  const task = await prisma.task.findFirst({
    where: { id: taskId, ownerId: user.id },
    select: { leadId: true, status: true },
  });
  if (!task) return;

  const isDone = task.status === "DONE";
  await prisma.task.update({
    where: { id: taskId },
    data: {
      status: isDone ? "PENDING" : "DONE",
      completedAt: isDone ? null : new Date(),
    },
  });

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  revalidatePath(`/leads/${task.leadId}`);
}

export async function deleteTaskAction(taskId: string) {
  const user = await requireUser();
  const task = await prisma.task.findFirst({
    where: { id: taskId, ownerId: user.id },
    select: { leadId: true },
  });
  if (!task) return;

  await prisma.task.delete({ where: { id: taskId } });

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  revalidatePath(`/leads/${task.leadId}`);
}
