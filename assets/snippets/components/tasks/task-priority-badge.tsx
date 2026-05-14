import { Badge } from "@/components/ui/badge";
import type { TaskPriority } from "@prisma/client";
import { t } from "@/i18n/he";

const variantMap: Record<
  TaskPriority,
  "default" | "secondary" | "success" | "warning" | "destructive" | "outline"
> = {
  LOW: "outline",
  MEDIUM: "secondary",
  HIGH: "destructive",
};

export function TaskPriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <Badge variant={variantMap[priority]} className="font-normal">
      {t.tasks.priority[priority]}
    </Badge>
  );
}
