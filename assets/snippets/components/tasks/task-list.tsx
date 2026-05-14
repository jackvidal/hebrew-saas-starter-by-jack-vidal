"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import type { Task } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { TaskStatusBadge } from "./task-status-badge";
import { TaskPriorityBadge } from "./task-priority-badge";
import { TaskDueDate } from "./task-due-date";
import { EditTaskDialog } from "./task-form";
import {
  toggleTaskDoneAction,
  deleteTaskAction,
} from "@/app/(dashboard)/tasks/actions";
import { cn } from "@/lib/utils";
import { t } from "@/i18n/he";

type TaskWithMaybeLead = Task & {
  lead?: { id: string; fullName: string };
};

interface Props {
  tasks: TaskWithMaybeLead[];
  /** Show the lead name + link on each row (only when listing across leads) */
  showLead?: boolean;
  /** Hide the "add" hint when there are no tasks (useful inside cards) */
  emptyText?: string;
}

export function TaskList({ tasks, showLead, emptyText }: Props) {
  const [editing, setEditing] = useState<Task | null>(null);

  if (tasks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
        {emptyText ?? t.tasks.none}
      </div>
    );
  }

  return (
    <>
      <ul className="space-y-2">
        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            showLead={showLead}
            onEdit={() => setEditing(task)}
          />
        ))}
      </ul>
      {editing && (
        <EditTaskDialog
          task={editing}
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
        />
      )}
    </>
  );
}

function TaskRow({
  task,
  showLead,
  onEdit,
}: {
  task: TaskWithMaybeLead;
  showLead?: boolean;
  onEdit: () => void;
}) {
  const [, startTransition] = useTransition();
  const isDone = task.status === "DONE";
  const isInactive = isDone || task.status === "CANCELED";

  return (
    <li
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center sm:gap-4",
        isInactive && "opacity-70",
      )}
    >
      <Checkbox
        checked={isDone}
        onCheckedChange={() => {
          startTransition(async () => {
            await toggleTaskDoneAction(task.id);
          });
        }}
        aria-label={isDone ? t.tasks.markUndone : t.tasks.markDone}
      />

      <div className="min-w-0 flex-1 space-y-1">
        <div
          className={cn(
            "text-sm font-medium leading-tight",
            isDone && "line-through text-muted-foreground",
          )}
        >
          {task.title}
        </div>
        {task.description && (
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {task.description}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <TaskDueDate dueDate={task.dueDate} muted={isInactive} />
          {showLead && task.lead && (
            <Link
              href={`/leads/${task.lead.id}`}
              className="text-xs text-primary hover:underline"
            >
              {task.lead.fullName}
            </Link>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <TaskPriorityBadge priority={task.priority} />
        <TaskStatusBadge status={task.status} />
        <Button variant="ghost" size="icon" onClick={onEdit} aria-label={t.common.edit}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive"
          onClick={() => {
            if (confirm(t.tasks.confirmDelete)) {
              startTransition(async () => {
                await deleteTaskAction(task.id);
              });
            }
          }}
          aria-label={t.common.delete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </li>
  );
}
