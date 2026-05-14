"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TaskStatus, TaskPriority } from "@prisma/client";
import { t } from "@/i18n/he";

const STATUS_VALUES: TaskStatus[] = [
  "PENDING",
  "IN_PROGRESS",
  "DONE",
  "CANCELED",
];
const PRIORITY_VALUES: TaskPriority[] = ["LOW", "MEDIUM", "HIGH"];

export function TaskFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value && value !== "ALL") next.set(key, value);
    else next.delete(key);
    startTransition(() => router.replace(`${pathname}?${next.toString()}`));
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <FilterField label={t.tasks.fields.status}>
        <Select
          value={params.get("status") ?? "ALL"}
          onValueChange={(v) => update("status", v)}
        >
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t.tasks.filterAll}</SelectItem>
            {STATUS_VALUES.map((s) => (
              <SelectItem key={s} value={s}>
                {t.tasks.status[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label={t.tasks.fields.priority}>
        <Select
          value={params.get("priority") ?? "ALL"}
          onValueChange={(v) => update("priority", v)}
        >
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t.tasks.filterAll}</SelectItem>
            {PRIORITY_VALUES.map((p) => (
              <SelectItem key={p} value={p}>
                {t.tasks.priority[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label={t.tasks.fields.dueDate}>
        <Select
          value={params.get("due") ?? "ALL"}
          onValueChange={(v) => update("due", v)}
        >
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t.tasks.filterAll}</SelectItem>
            <SelectItem value="OVERDUE">{t.tasks.filterOverdue}</SelectItem>
            <SelectItem value="TODAY">{t.tasks.filterToday}</SelectItem>
            <SelectItem value="WEEK">{t.tasks.filterWeek}</SelectItem>
          </SelectContent>
        </Select>
      </FilterField>
    </div>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
