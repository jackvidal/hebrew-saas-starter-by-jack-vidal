"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Lightbulb,
  ListChecks,
  Sparkles,
  Wrench,
} from "lucide-react";
import type { WebsiteAnalysis } from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime } from "@/lib/utils";
import { t } from "@/i18n/he";

interface Props {
  leadId: string;
  websiteUrl: string | null;
  analysis: WebsiteAnalysis | null;
}

export function AnalysisCard({ leadId, websiteUrl, analysis }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const runAnalysis = () => {
    if (!websiteUrl) {
      setError(t.leads.detail.websiteRequired);
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/leads/${leadId}/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? t.analysis.error);
        }
        toast({
          title: "הניתוח הושלם",
          description: "הניתוח נשמר על הליד",
          variant: "success",
        });
        router.refresh();
      } catch (e) {
        const msg = e instanceof Error ? e.message : t.analysis.error;
        setError(msg);
        toast({
          title: t.analysis.error,
          description: msg,
          variant: "destructive",
        });
      }
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          {t.leads.detail.analysis}
        </CardTitle>
        <Button
          size="sm"
          variant={analysis ? "outline" : "default"}
          onClick={runAnalysis}
          disabled={pending || !websiteUrl}
        >
          {pending
            ? t.leads.detail.runningAnalysis
            : analysis
              ? t.analysis.rerun
              : t.leads.detail.runAnalysis}
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        {error && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {!analysis && !error && (
          <p className="text-sm text-muted-foreground">
            {t.leads.detail.noAnalysis}
            {!websiteUrl && (
              <>
                {" "}
                <span className="text-destructive">
                  ({t.leads.detail.websiteRequired})
                </span>
              </>
            )}
          </p>
        )}

        {analysis && (
          <>
            <div className="text-xs text-muted-foreground">
              {t.analysis.runAt}: {formatDateTime(analysis.createdAt)}
              {" · "}
              <span dir="ltr">
                <bdi>{analysis.url}</bdi>
              </span>
            </div>

            <Section
              icon={<Sparkles className="h-4 w-4 text-primary" />}
              title={t.analysis.sectionSummary}
            >
              <p className="text-sm leading-relaxed">{analysis.summary}</p>
            </Section>

            <Section
              icon={<AlertCircle className="h-4 w-4 text-destructive" />}
              title={t.analysis.sectionIssues}
            >
              <BulletList items={analysis.issues as string[]} tone="destructive" />
            </Section>

            <Section
              icon={<Lightbulb className="h-4 w-4 text-warning" />}
              title={t.analysis.sectionOpportunities}
            >
              <BulletList
                items={analysis.opportunities as string[]}
                tone="warning"
              />
            </Section>

            <Section
              icon={<Wrench className="h-4 w-4 text-primary" />}
              title={t.analysis.sectionServices}
            >
              <BulletList
                items={analysis.recommendedServices as string[]}
                tone="default"
              />
            </Section>

            <Section
              icon={<ListChecks className="h-4 w-4 text-success" />}
              title={t.analysis.sectionNextSteps}
            >
              <BulletList
                items={analysis.recommendedNextSteps as string[]}
                tone="success"
              />
            </Section>
          </>
        )}
      </CardContent>
    </Card>
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
    <div className="space-y-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </h3>
      {children}
    </div>
  );
}

function BulletList({
  items,
  tone,
}: {
  items: string[];
  tone: "default" | "destructive" | "warning" | "success";
}) {
  const dotColor = {
    default: "bg-primary",
    destructive: "bg-destructive",
    warning: "bg-warning",
    success: "bg-success",
  }[tone];

  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm">
          <span
            className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dotColor}`}
          />
          <span className="leading-relaxed">
            {tone === "success" ? <CheckCircle2 className="me-1 inline h-3.5 w-3.5 align-text-bottom text-success" /> : null}
            {item}
          </span>
        </li>
      ))}
    </ul>
  );
}
