import Link from "next/link";
import {
  AlertCircle,
  ArrowUpRight,
  CalendarCheck,
  CheckCircle2,
  CheckSquare,
  Sparkles,
  Users,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LeadStatusBadge } from "@/components/leads/lead-status-badge";
import { MeetingStatusBadge } from "@/components/meetings/meeting-status-badge";
import { TaskList } from "@/components/tasks/task-list";
import { formatDateTime, formatRelative } from "@/lib/utils";
import { t } from "@/i18n/he";

export default async function DashboardPage() {
  const user = await requireUser();
  const now = new Date();
  const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

  const [
    totalLeads,
    newLeadsCount,
    closedDeals,
    meetingsThisWeek,
    recentLeads,
    upcomingMeetings,
    overdueCount,
    todayTasks,
  ] = await Promise.all([
    prisma.lead.count({ where: { ownerId: user.id } }),
    prisma.lead.count({ where: { ownerId: user.id, status: "NEW" } }),
    prisma.lead.count({ where: { ownerId: user.id, status: "DEAL_CLOSED" } }),
    prisma.meeting.count({
      where: {
        ownerId: user.id,
        scheduledAt: { gte: now, lte: weekAhead },
        status: "SCHEDULED",
      },
    }),
    prisma.lead.findMany({
      where: { ownerId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.meeting.findMany({
      where: {
        ownerId: user.id,
        scheduledAt: { gte: now },
        status: "SCHEDULED",
      },
      orderBy: { scheduledAt: "asc" },
      take: 5,
      include: { lead: { select: { id: true, fullName: true } } },
    }),
    prisma.task.count({
      where: {
        ownerId: user.id,
        dueDate: { lt: startOfToday },
        status: { notIn: ["DONE", "CANCELED"] },
      },
    }),
    prisma.task.findMany({
      where: {
        ownerId: user.id,
        OR: [
          { dueDate: { gte: startOfToday, lt: startOfTomorrow } },
          {
            dueDate: { lt: startOfToday },
            status: { notIn: ["DONE", "CANCELED"] },
          },
        ],
      },
      orderBy: [{ status: "asc" }, { priority: "desc" }, { dueDate: "asc" }],
      take: 6,
      include: { lead: { select: { id: true, fullName: true } } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t.dashboard.title}</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat
          icon={<Users className="h-5 w-5" />}
          label={t.dashboard.metrics.totalLeads}
          value={totalLeads}
          tone="primary"
        />
        <Stat
          icon={<Sparkles className="h-5 w-5" />}
          label={t.dashboard.metrics.newLeads}
          value={newLeadsCount}
          tone="warning"
        />
        <Stat
          icon={<CalendarCheck className="h-5 w-5" />}
          label={t.dashboard.metrics.meetingsThisWeek}
          value={meetingsThisWeek}
          tone="default"
        />
        <Stat
          icon={<AlertCircle className="h-5 w-5" />}
          label={t.dashboard.overdueTasks}
          value={overdueCount}
          tone={overdueCount > 0 ? "destructive" : "default"}
        />
        <Stat
          icon={<CheckCircle2 className="h-5 w-5" />}
          label={t.dashboard.metrics.dealsClosed}
          value={closedDeals}
          tone="success"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>{t.dashboard.recentLeads}</CardTitle>
            <Link
              href="/leads"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              {t.dashboard.viewAll}
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {recentLeads.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.leads.none}</p>
            ) : (
              <ul className="divide-y divide-border">
                {recentLeads.map((lead) => (
                  <li
                    key={lead.id}
                    className="flex items-center justify-between gap-2 py-3"
                  >
                    <Link
                      href={`/leads/${lead.id}`}
                      className="font-medium hover:text-primary"
                    >
                      {lead.fullName}
                    </Link>
                    <div className="flex items-center gap-2">
                      <LeadStatusBadge status={lead.status} />
                      <span className="hidden text-xs text-muted-foreground sm:inline">
                        {formatRelative(lead.createdAt)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>{t.dashboard.upcomingMeetings}</CardTitle>
            <Link
              href="/meetings"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              {t.dashboard.viewAll}
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {upcomingMeetings.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.meetings.none}</p>
            ) : (
              <ul className="divide-y divide-border">
                {upcomingMeetings.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between gap-2 py-3"
                  >
                    <div className="space-y-1">
                      <Link
                        href={`/leads/${m.lead.id}`}
                        className="text-sm font-medium hover:text-primary"
                      >
                        {m.lead.fullName}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {formatDateTime(m.scheduledAt)}
                      </div>
                    </div>
                    <MeetingStatusBadge status={m.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5" />
            {t.dashboard.todayTasks}
          </CardTitle>
          <Link
            href="/tasks"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            {t.dashboard.viewAll}
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent>
          <TaskList tasks={todayTasks} showLead emptyText={t.tasks.none} />
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "primary" | "success" | "warning" | "default" | "destructive";
}) {
  const toneClass = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    default: "bg-secondary text-foreground",
    destructive: "bg-destructive/10 text-destructive",
  }[tone];

  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-6">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${toneClass}`}
        >
          {icon}
        </div>
        <div className="space-y-0.5">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-2xl font-semibold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}
