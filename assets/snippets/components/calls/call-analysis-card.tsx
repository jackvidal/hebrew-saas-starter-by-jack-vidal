"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  CheckSquare,
  Handshake,
  Lightbulb,
  ListChecks,
  Sparkles,
  Tag,
} from "lucide-react";
import type { Call } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { CallSentimentBadge } from "./call-sentiment-badge";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime } from "@/lib/utils";
import { t } from "@/i18n/he";

interface Props {
  call: Call;
}

export function CallAnalysisCard({ call }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [analyzing, startAnalyze] = useTransition();
  const [creating, startCreate] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const hasTranscript = !!call.transcript && call.transcript.trim().length > 0;
  const isAnalyzed = !!call.analyzedAt;

  const runAnalysis = () => {
    if (!hasTranscript) return;
    setError(null);
    startAnalyze(async () => {
      try {
        const res = await fetch(`/api/calls/${call.id}/analyze`, {
          method: "POST",
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? t.calls.aiAnalysis.error);
        }
        router.refresh();
      } catch (e) {
        const msg = e instanceof Error ? e.message : t.calls.aiAnalysis.error;
        setError(msg);
        toast({
          title: t.calls.aiAnalysis.error,
          description: msg,
          variant: "destructive",
        });
      }
    });
  };

  const createTasks = () => {
    startCreate(async () => {
      try {
        const res = await fetch(`/api/calls/${call.id}/create-tasks`, {
          method: "POST",
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? t.errors.generic);
        }
        const data = await res.json();
        toast({
          title: t.calls.aiAnalysis.tasksCreated,
          description: `${data.created} משימות`,
          variant: "success",
        });
        router.refresh();
      } catch (e) {
        const msg = e instanceof Error ? e.message : t.errors.generic;
        toast({
          title: t.errors.generic,
          description: msg,
          variant: "destructive",
        });
      }
    });
  };

  // Not analyzed yet — show the CTA
  if (!isAnalyzed) {
    return (
      <div className="mt-3 flex flex-col gap-2 rounded-lg border border-dashed border-border bg-muted/30 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4 text-primary" />
            {t.calls.aiAnalysis.title}
          </div>
          <Button
            size="sm"
            onClick={runAnalysis}
            disabled={!hasTranscript || analyzing}
          >
            {analyzing
              ? t.calls.aiAnalysis.running
              : t.calls.aiAnalysis.runButton}
          </Button>
        </div>
        {!hasTranscript && (
          <p className="text-xs text-muted-foreground">
            {t.calls.aiAnalysis.noTranscriptHint}
          </p>
        )}
        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}
      </div>
    );
  }

  // Analyzed — show the rich UI
  const keyTopics = (call.keyTopics as string[] | null) ?? [];
  const prospectCommitments = (call.prospectCommitments as string[] | null) ?? [];
  const myCommitments = (call.myCommitments as string[] | null) ?? [];
  const recommendedNextSteps =
    (call.recommendedNextSteps as string[] | null) ?? [];
  const redFlags = (call.redFlags as string[] | null) ?? [];

  const hasActionable =
    myCommitments.length > 0 || recommendedNextSteps.length > 0;

  return (
    <div className="mt-3 rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-primary" />
          {t.calls.aiAnalysis.title}
        </div>
        <div className="flex items-center gap-2">
          {call.sentiment && <CallSentimentBadge sentiment={call.sentiment} />}
          <Button
            variant="ghost"
            size="sm"
            onClick={runAnalysis}
            disabled={analyzing}
          >
            {analyzing
              ? t.calls.aiAnalysis.running
              : t.calls.aiAnalysis.rerunButton}
          </Button>
        </div>
      </div>

      {call.analyzedAt && (
        <p className="text-xs text-muted-foreground">
          {t.calls.aiAnalysis.analyzedAt}: {formatDateTime(call.analyzedAt)}
        </p>
      )}

      {/* Summary */}
      {call.summary && (
        <Section
          icon={<Sparkles className="h-4 w-4 text-primary" />}
          title={t.calls.aiAnalysis.summary}
        >
          <p className="text-sm leading-relaxed">{call.summary}</p>
        </Section>
      )}

      {/* Sentiment reason */}
      {call.sentimentReason && (
        <Section
          icon={
            call.sentiment === "POSITIVE" ? (
              <CheckCircle2 className="h-4 w-4 text-success" />
            ) : call.sentiment === "NEGATIVE" ? (
              <AlertCircle className="h-4 w-4 text-destructive" />
            ) : (
              <Tag className="h-4 w-4 text-muted-foreground" />
            )
          }
          title={t.calls.aiAnalysis.sentiment}
        >
          <p className="text-sm text-muted-foreground leading-relaxed">
            {call.sentimentReason}
          </p>
        </Section>
      )}

      {/* Key topics */}
      {keyTopics.length > 0 && (
        <Section
          icon={<Tag className="h-4 w-4 text-primary" />}
          title={t.calls.aiAnalysis.keyTopics}
        >
          <div className="flex flex-wrap gap-1.5">
            {keyTopics.map((topic, i) => (
              <span
                key={i}
                className="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground"
              >
                {topic}
              </span>
            ))}
          </div>
        </Section>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Prospect commitments */}
        <Section
          icon={<Handshake className="h-4 w-4 text-success" />}
          title={t.calls.aiAnalysis.prospectCommitments}
        >
          {prospectCommitments.length > 0 ? (
            <BulletList items={prospectCommitments} tone="success" />
          ) : (
            <p className="text-xs text-muted-foreground">
              {t.calls.aiAnalysis.emptyField}
            </p>
          )}
        </Section>

        {/* My commitments */}
        <Section
          icon={<CheckSquare className="h-4 w-4 text-primary" />}
          title={t.calls.aiAnalysis.myCommitments}
        >
          {myCommitments.length > 0 ? (
            <BulletList items={myCommitments} tone="default" />
          ) : (
            <p className="text-xs text-muted-foreground">
              {t.calls.aiAnalysis.emptyField}
            </p>
          )}
        </Section>
      </div>

      {/* Recommended next steps */}
      <Section
        icon={<ListChecks className="h-4 w-4 text-warning" />}
        title={t.calls.aiAnalysis.recommendedNextSteps}
      >
        <BulletList items={recommendedNextSteps} tone="warning" />
      </Section>

      {/* Red flags */}
      {redFlags.length > 0 && (
        <Section
          icon={<AlertCircle className="h-4 w-4 text-destructive" />}
          title={t.calls.aiAnalysis.redFlags}
        >
          <BulletList items={redFlags} tone="destructive" />
        </Section>
      )}

      {/* The killer button — auto-create tasks */}
      {hasActionable && (
        <div className="border-t border-border pt-3">
          <Button
            onClick={createTasks}
            disabled={creating}
            className="w-full sm:w-auto"
          >
            <Lightbulb className="h-4 w-4" />
            {creating
              ? t.calls.aiAnalysis.creatingTasks
              : t.calls.aiAnalysis.createTasks}
          </Button>
        </div>
      )}
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}
        {title}
      </h4>
      {children}
    </div>
  );
}

function BulletList({
  items,
  tone,
}: {
  items: string[];
  tone: "default" | "success" | "warning" | "destructive";
}) {
  const dotColor = {
    default: "bg-primary",
    success: "bg-success",
    warning: "bg-warning",
    destructive: "bg-destructive",
  }[tone];

  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm">
          <span
            className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dotColor}`}
          />
          <span className="leading-relaxed">{item}</span>
        </li>
      ))}
    </ul>
  );
}
