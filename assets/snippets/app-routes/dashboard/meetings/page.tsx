import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MeetingStatusBadge } from "@/components/meetings/meeting-status-badge";
import { formatDateTime } from "@/lib/utils";
import { t } from "@/i18n/he";

export default async function MeetingsPage() {
  const user = await requireUser();
  const now = new Date();

  const [upcoming, past] = await Promise.all([
    prisma.meeting.findMany({
      where: {
        ownerId: user.id,
        scheduledAt: { gte: now },
        status: { in: ["SCHEDULED"] },
      },
      orderBy: { scheduledAt: "asc" },
      include: { lead: { select: { id: true, fullName: true, company: true } } },
      take: 50,
    }),
    prisma.meeting.findMany({
      where: {
        ownerId: user.id,
        OR: [{ scheduledAt: { lt: now } }, { status: { not: "SCHEDULED" } }],
      },
      orderBy: { scheduledAt: "desc" },
      include: { lead: { select: { id: true, fullName: true, company: true } } },
      take: 50,
    }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t.meetings.title}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{t.meetings.upcoming}</CardTitle>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.meetings.none}</p>
          ) : (
            <MeetingRows rows={upcoming} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.meetings.past}</CardTitle>
        </CardHeader>
        <CardContent>
          {past.length === 0 ? (
            <p className="text-sm text-muted-foreground">—</p>
          ) : (
            <MeetingRows rows={past} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

type Row = {
  id: string;
  scheduledAt: Date;
  durationMinutes: number;
  status: "SCHEDULED" | "COMPLETED" | "CANCELED" | "NO_SHOW";
  lead: { id: string; fullName: string; company: string | null };
};

function MeetingRows({ rows }: { rows: Row[] }) {
  return (
    <ul className="divide-y divide-border">
      {rows.map((m) => (
        <li key={m.id} className="flex items-center justify-between gap-3 py-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">{formatDateTime(m.scheduledAt)}</span>
              <MeetingStatusBadge status={m.status} />
              <span className="text-xs text-muted-foreground">
                {m.durationMinutes} דק'
              </span>
            </div>
            <Link
              href={`/leads/${m.lead.id}`}
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              {m.lead.fullName}
              {m.lead.company ? ` · ${m.lead.company}` : ""}
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
