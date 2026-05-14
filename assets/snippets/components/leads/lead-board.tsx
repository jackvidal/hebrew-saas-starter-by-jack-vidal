import Link from "next/link";
import type { Lead, LeadStatus } from "@prisma/client";
import { Building2, Mail } from "lucide-react";
import { t } from "@/i18n/he";

const COLUMNS: LeadStatus[] = [
  "NEW",
  "MEETING_SCHEDULED",
  "MEETING_COMPLETED",
  "DEAL_CLOSED",
  "DEAL_LOST",
];

const COLUMN_TONE: Record<LeadStatus, string> = {
  NEW: "border-primary/40 bg-primary/5",
  MEETING_SCHEDULED: "border-secondary bg-secondary/40",
  MEETING_COMPLETED: "border-warning/40 bg-warning/5",
  DEAL_CLOSED: "border-success/40 bg-success/5",
  DEAL_LOST: "border-destructive/40 bg-destructive/5",
};

export function LeadBoard({ leads }: { leads: Lead[] }) {
  const grouped = COLUMNS.reduce<Record<LeadStatus, Lead[]>>(
    (acc, status) => {
      acc[status] = [];
      return acc;
    },
    {} as Record<LeadStatus, Lead[]>,
  );
  for (const lead of leads) grouped[lead.status].push(lead);

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      {COLUMNS.map((status) => (
        <div
          key={status}
          className={`flex min-h-[300px] flex-col rounded-xl border ${COLUMN_TONE[status]}`}
        >
          <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2.5">
            <span className="text-sm font-semibold">
              {t.leads.status[status]}
            </span>
            <span className="rounded-full bg-card px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {grouped[status].length}
            </span>
          </div>
          <ul className="flex-1 space-y-2 p-2">
            {grouped[status].length === 0 ? (
              <li className="rounded-md border border-dashed border-border/60 p-3 text-center text-xs text-muted-foreground">
                —
              </li>
            ) : (
              grouped[status].map((lead) => (
                <li key={lead.id}>
                  <Link
                    href={`/leads/${lead.id}`}
                    className="block rounded-md border border-border bg-card p-3 shadow-sm transition hover:border-primary/40 hover:shadow"
                  >
                    <div className="font-medium">{lead.fullName}</div>
                    {lead.company && (
                      <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <Building2 className="h-3 w-3" />
                        <span>{lead.company}</span>
                      </div>
                    )}
                    {lead.email && (
                      <div
                        className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"
                        dir="ltr"
                      >
                        <Mail className="h-3 w-3" />
                        <bdi className="truncate">{lead.email}</bdi>
                      </div>
                    )}
                  </Link>
                </li>
              ))
            )}
          </ul>
        </div>
      ))}
    </div>
  );
}
