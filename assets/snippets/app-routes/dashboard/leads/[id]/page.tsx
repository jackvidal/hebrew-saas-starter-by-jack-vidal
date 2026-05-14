import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Building2,
  Globe,
  Mail,
  MessageSquare,
  Pencil,
  Phone,
  StickyNote,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusChanger } from "@/components/leads/status-changer";
import { DeleteLeadButton } from "@/components/leads/delete-lead-button";
import { AddNoteForm } from "@/components/leads/add-note-form";
import { AnalysisCard } from "@/components/analysis/analysis-card";
import { CreateMeetingButton } from "@/components/meetings/meeting-form";
import { MeetingList } from "@/components/meetings/meeting-list";
import { CreateTaskButton } from "@/components/tasks/task-form";
import { TaskList } from "@/components/tasks/task-list";
import { LogCallButton } from "@/components/calls/call-form";
import { CallList } from "@/components/calls/call-list";
import { WhatsappPanel } from "@/components/whatsapp/whatsapp-panel";
import { formatDateTime, formatRelative } from "@/lib/utils";
import { t } from "@/i18n/he";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const lead = await prisma.lead.findFirst({
    where: { id, ownerId: user.id },
    include: {
      leadNotes: {
        orderBy: { createdAt: "desc" },
        include: { author: { select: { fullName: true, email: true } } },
      },
      meetings: { orderBy: { scheduledAt: "desc" } },
      analyses: { orderBy: { createdAt: "desc" }, take: 1 },
      tasks: {
        orderBy: [{ status: "asc" }, { dueDate: "asc" }],
      },
      calls: {
        orderBy: { occurredAt: "desc" },
      },
      whatsappMessages: {
        orderBy: { sentAt: "asc" },
      },
    },
  });
  if (!lead) notFound();

  const latestAnalysis = lead.analyses[0] ?? null;
  const hasWhatsappIntegration = Boolean(
    user.whatsappNumber && user.wassenderToken,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{lead.fullName}</h1>
            <StatusChanger leadId={lead.id} current={lead.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            נוצר {formatRelative(lead.createdAt)}
            {lead.source ? ` · ${lead.source}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/leads/${lead.id}/edit`}>
              <Pencil className="h-4 w-4" />
              {t.common.edit}
            </Link>
          </Button>
          <DeleteLeadButton leadId={lead.id} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{t.leads.detail.info}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <InfoRow icon={<Mail className="h-4 w-4" />} label={t.leads.fields.email}>
                {lead.email ? (
                  <a
                    href={`mailto:${lead.email}`}
                    className="text-primary hover:underline"
                    dir="ltr"
                  >
                    <bdi>{lead.email}</bdi>
                  </a>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </InfoRow>
              <InfoRow icon={<Phone className="h-4 w-4" />} label={t.leads.fields.phone}>
                {lead.phone ? (
                  <a
                    href={`tel:${lead.phone}`}
                    className="text-primary hover:underline"
                    dir="ltr"
                  >
                    <bdi>{lead.phone}</bdi>
                  </a>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </InfoRow>
              <InfoRow icon={<Building2 className="h-4 w-4" />} label={t.leads.fields.company}>
                {lead.company ?? <span className="text-muted-foreground">—</span>}
              </InfoRow>
              <InfoRow icon={<Globe className="h-4 w-4" />} label={t.leads.fields.websiteUrl}>
                {lead.websiteUrl ? (
                  <a
                    href={lead.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                    dir="ltr"
                  >
                    <bdi>{lead.websiteUrl}</bdi>
                  </a>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </InfoRow>
              {lead.notes && (
                <div className="sm:col-span-2 space-y-2 pt-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <StickyNote className="h-4 w-4" />
                    {t.leads.fields.notes}
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                    {lead.notes}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <AnalysisCard
            leadId={lead.id}
            websiteUrl={lead.websiteUrl}
            analysis={latestAnalysis}
          />

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>{t.tasks.title}</CardTitle>
              <CreateTaskButton leadId={lead.id} />
            </CardHeader>
            <CardContent>
              <TaskList tasks={lead.tasks} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>{t.leads.detail.meetings}</CardTitle>
              <CreateMeetingButton leadId={lead.id} />
            </CardHeader>
            <CardContent>
              <MeetingList meetings={lead.meetings} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>{t.calls.title}</CardTitle>
              <LogCallButton leadId={lead.id} />
            </CardHeader>
            <CardContent>
              <CallList calls={lead.calls} />
            </CardContent>
          </Card>

          <WhatsappPanel
            leadId={lead.id}
            leadPhone={lead.phone}
            messages={lead.whatsappMessages}
            hasIntegration={hasWhatsappIntegration}
          />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                {t.leads.detail.notesTimeline}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <AddNoteForm leadId={lead.id} />
              {lead.leadNotes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t.leads.detail.noNotes}
                </p>
              ) : (
                <ul className="space-y-3">
                  {lead.leadNotes.map((n) => (
                    <li
                      key={n.id}
                      className="rounded-md border border-border bg-muted/30 p-3"
                    >
                      <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{n.author.fullName ?? n.author.email}</span>
                        <span>{formatDateTime(n.createdAt)}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">
                        {n.content}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-sm">{children}</div>
    </div>
  );
}
