import Link from "next/link";
import type { Lead } from "@prisma/client";
import { LeadStatusBadge } from "./lead-status-badge";
import { formatDate } from "@/lib/utils";
import { t } from "@/i18n/he";

export function LeadTable({ leads }: { leads: Lead[] }) {
  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card py-16 text-center">
        <div className="text-base font-medium">{t.leads.none}</div>
        <p className="text-sm text-muted-foreground">{t.leads.noneHint}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr className="text-end">
              <Th>{t.leads.fields.fullName}</Th>
              <Th>{t.leads.fields.company}</Th>
              <Th>{t.leads.fields.email}</Th>
              <Th>{t.leads.fields.status}</Th>
              <Th>{t.leads.fields.createdAt}</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {leads.map((lead) => (
              <tr
                key={lead.id}
                className="text-end transition-colors hover:bg-muted/40"
              >
                <Td>
                  <Link
                    href={`/leads/${lead.id}`}
                    className="font-medium text-foreground hover:text-primary"
                  >
                    {lead.fullName}
                  </Link>
                </Td>
                <Td className="text-muted-foreground">
                  {lead.company ?? "—"}
                </Td>
                <Td className="text-muted-foreground" dir="ltr">
                  <bdi>{lead.email ?? "—"}</bdi>
                </Td>
                <Td>
                  <LeadStatusBadge status={lead.status} />
                </Td>
                <Td className="text-muted-foreground">
                  {formatDate(lead.createdAt)}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-end text-xs font-semibold uppercase tracking-wide">
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
  dir,
}: {
  children: React.ReactNode;
  className?: string;
  dir?: "ltr" | "rtl";
}) {
  return (
    <td className={`px-4 py-3 ${className}`} dir={dir}>
      {children}
    </td>
  );
}
