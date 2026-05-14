import Link from "next/link";
import type { LeadStatus, Prisma } from "@prisma/client";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LeadFilters } from "@/components/leads/lead-filters";
import { LeadTable } from "@/components/leads/lead-table";
import { LeadBoard } from "@/components/leads/lead-board";
import { ViewToggle } from "@/components/leads/view-toggle";
import { t } from "@/i18n/he";

const STATUS_VALUES = new Set<LeadStatus>([
  "NEW",
  "MEETING_SCHEDULED",
  "MEETING_COMPLETED",
  "DEAL_CLOSED",
  "DEAL_LOST",
]);

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; view?: string }>;
}) {
  const user = await requireUser();
  const { q, status, view } = await searchParams;
  const currentView = view === "board" ? "board" : "list";

  const where: Prisma.LeadWhereInput = { ownerId: user.id };
  if (status && STATUS_VALUES.has(status as LeadStatus)) {
    where.status = status as LeadStatus;
  }
  if (q && q.trim()) {
    const term = q.trim();
    where.OR = [
      { fullName: { contains: term, mode: "insensitive" } },
      { company: { contains: term, mode: "insensitive" } },
      { email: { contains: term, mode: "insensitive" } },
    ];
  }

  const leads = await prisma.lead.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t.leads.title}</h1>
        <div className="flex items-center gap-3">
          <ViewToggle current={currentView} />
          <Button asChild>
            <Link href="/leads/new">
              <Plus className="h-4 w-4" />
              {t.leads.new}
            </Link>
          </Button>
        </div>
      </div>

      <LeadFilters />

      {currentView === "board" ? (
        <LeadBoard leads={leads} />
      ) : (
        <LeadTable leads={leads} />
      )}
    </div>
  );
}
