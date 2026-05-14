import type { Prisma, TaskStatus, TaskPriority } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { TaskList } from "@/components/tasks/task-list";
import { TaskFilters } from "@/components/tasks/task-filters";
import { t } from "@/i18n/he";

const STATUS_SET = new Set<TaskStatus>([
  "PENDING",
  "IN_PROGRESS",
  "DONE",
  "CANCELED",
]);
const PRIORITY_SET = new Set<TaskPriority>(["LOW", "MEDIUM", "HIGH"]);

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; priority?: string; due?: string }>;
}) {
  const user = await requireUser();
  const { status, priority, due } = await searchParams;

  const where: Prisma.TaskWhereInput = { ownerId: user.id };
  if (status && STATUS_SET.has(status as TaskStatus)) {
    where.status = status as TaskStatus;
  }
  if (priority && PRIORITY_SET.has(priority as TaskPriority)) {
    where.priority = priority as TaskPriority;
  }

  // Due date filters
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
  const startOfNextWeek = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);

  if (due === "OVERDUE") {
    where.dueDate = { lt: startOfToday };
    where.status = { notIn: ["DONE", "CANCELED"] };
  } else if (due === "TODAY") {
    where.dueDate = { gte: startOfToday, lt: startOfTomorrow };
  } else if (due === "WEEK") {
    where.dueDate = { gte: startOfToday, lt: startOfNextWeek };
  }

  const tasks = await prisma.task.findMany({
    where,
    orderBy: [
      { status: "asc" },
      { dueDate: { sort: "asc", nulls: "last" } },
      { priority: "desc" },
    ],
    include: {
      lead: { select: { id: true, fullName: true } },
    },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t.tasks.title}</h1>
      <TaskFilters />
      <TaskList tasks={tasks} showLead emptyText={t.tasks.none} />
    </div>
  );
}
