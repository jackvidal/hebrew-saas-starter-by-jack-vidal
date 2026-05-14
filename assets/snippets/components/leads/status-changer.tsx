"use client";

import { useTransition } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { LeadStatus } from "@prisma/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LeadStatusBadge } from "./lead-status-badge";
import { quickUpdateStatusAction } from "@/app/(dashboard)/leads/actions";

const STATUS_VALUES: LeadStatus[] = [
  "NEW",
  "MEETING_SCHEDULED",
  "MEETING_COMPLETED",
  "DEAL_CLOSED",
  "DEAL_LOST",
];

export function StatusChanger({
  leadId,
  current,
}: {
  leadId: string;
  current: LeadStatus;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={pending}
          className="inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          <LeadStatusBadge status={current} />
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        {STATUS_VALUES.map((s) => (
          <DropdownMenuItem
            key={s}
            disabled={s === current}
            onSelect={() => {
              if (s === current) return;
              startTransition(async () => {
                await quickUpdateStatusAction(leadId, s);
              });
            }}
            className="flex items-center justify-between"
          >
            <LeadStatusBadge status={s} />
            {s === current && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
