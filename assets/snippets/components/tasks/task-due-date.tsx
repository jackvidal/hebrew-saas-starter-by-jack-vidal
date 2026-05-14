import { Clock } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { t } from "@/i18n/he";

interface Props {
  dueDate: Date | string | null;
  /** A done/canceled task should show neutral styling regardless of date */
  muted?: boolean;
}

export function TaskDueDate({ dueDate, muted }: Props) {
  if (!dueDate) {
    return (
      <span className="text-xs text-muted-foreground">
        {t.tasks.noDueDate}
      </span>
    );
  }

  const d = typeof dueDate === "string" ? new Date(dueDate) : dueDate;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
  const startOfWeekEnd = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);

  let label: string;
  let tone: "danger" | "warning" | "default" | "muted";

  if (muted) {
    label = formatDate(d);
    tone = "muted";
  } else if (d < startOfToday) {
    label = t.tasks.overdue;
    tone = "danger";
  } else if (d < startOfTomorrow) {
    label = t.tasks.dueToday;
    tone = "warning";
  } else if (d < new Date(startOfTomorrow.getTime() + 24 * 60 * 60 * 1000)) {
    label = t.tasks.dueTomorrow;
    tone = "default";
  } else if (d < startOfWeekEnd) {
    label = t.tasks.dueSoon;
    tone = "default";
  } else {
    label = formatDate(d);
    tone = "muted";
  }

  const toneClass = {
    danger: "text-destructive",
    warning: "text-warning",
    default: "text-foreground",
    muted: "text-muted-foreground",
  }[tone];

  return (
    <span className={cn("inline-flex items-center gap-1 text-xs", toneClass)}>
      <Clock className="h-3 w-3" />
      {label}
      {tone !== "danger" && tone !== "warning" && (
        <span className="text-muted-foreground/70">· {formatDate(d)}</span>
      )}
    </span>
  );
}
