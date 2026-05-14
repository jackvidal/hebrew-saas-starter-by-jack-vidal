"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LeadStatus } from "@prisma/client";
import { t } from "@/i18n/he";

const STATUS_VALUES: LeadStatus[] = [
  "NEW",
  "MEETING_SCHEDULED",
  "MEETING_COMPLETED",
  "DEAL_CLOSED",
  "DEAL_LOST",
];

export function LeadFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value && value !== "ALL") next.set(key, value);
    else next.delete(key);
    startTransition(() => {
      router.replace(`${pathname}?${next.toString()}`);
    });
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t.leads.search}
          defaultValue={params.get("q") ?? ""}
          onChange={(e) => update("q", e.target.value)}
          className="pe-9"
        />
      </div>
      <Select
        value={params.get("status") ?? "ALL"}
        onValueChange={(v) => update("status", v)}
      >
        <SelectTrigger className="w-full sm:w-56">
          <SelectValue placeholder={t.leads.filterStatus} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">{t.leads.filterAll}</SelectItem>
          {STATUS_VALUES.map((s) => (
            <SelectItem key={s} value={s}>
              {t.leads.status[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
