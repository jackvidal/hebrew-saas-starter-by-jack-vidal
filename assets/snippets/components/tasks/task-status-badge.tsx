import { Badge } from "@/components/ui/badge";
import type { TaskStatus } from "@prisma/client";
import { t } from "@/i18n/he";

const variantMap: Record<
  TaskStatus,
  "default" | "secondary" | "success" | "warning" | "destructive" | "outline"
> = {
  PENDING: "secondary",
  IN_PROGRESS: "default",
  DONE: "success",
  CANCELED: "destructive",
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return (
    <Badge variant={variantMap[status]} className="font-normal">
      {t.tasks.status[status]}
    </Badge>
  );
}
