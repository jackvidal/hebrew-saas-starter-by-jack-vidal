"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { WhatsappMessage } from "@prisma/client";
import {
  Check,
  CheckCheck,
  Clock,
  Loader2,
  Send,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn, formatDateTime } from "@/lib/utils";
import {
  sendWhatsappAction,
  type FormState,
} from "@/app/(dashboard)/whatsapp/actions";
import { t } from "@/i18n/he";

const initial: FormState = {};

interface Props {
  leadId: string;
  leadPhone: string | null;
  messages: WhatsappMessage[];
  hasIntegration: boolean;
}

export function WhatsappPanel({
  leadId,
  leadPhone,
  messages,
  hasIntegration,
}: Props) {
  const [state, formAction, pending] = useActionState(
    sendWhatsappAction,
    initial,
  );
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.ok) {
      toast({ title: t.whatsapp.sent, variant: "success" });
      formRef.current?.reset();
    } else if (state.error) {
      toast({
        title: t.whatsapp.sendError,
        description: state.error,
        variant: "destructive",
      });
    }
  }, [state, toast]);

  useEffect(() => {
    // Auto-scroll to latest message on new mount/load
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages.length]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <WhatsappIcon className="h-5 w-5 text-[#25D366]" />
          {t.whatsapp.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div
          ref={threadRef}
          className={cn(
            "max-h-80 min-h-32 overflow-y-auto rounded-md border border-border bg-muted/20 p-3",
            messages.length === 0 && "flex items-center justify-center",
          )}
        >
          {messages.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">
              {t.whatsapp.none}
              <br />
              <span className="text-xs">{t.whatsapp.noneHint}</span>
            </p>
          ) : (
            <ol className="space-y-2">
              {messages.map((m) => (
                <li
                  key={m.id}
                  className={cn(
                    "flex",
                    m.direction === "OUTBOUND" ? "justify-end" : "justify-start",
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm",
                      m.direction === "OUTBOUND"
                        ? "bg-[#dcf8c6] text-[#1f2937] dark:bg-emerald-900/40 dark:text-emerald-50"
                        : "bg-card text-foreground border border-border",
                  )}
                  >
                    {m.body ? (
                      <p className="whitespace-pre-wrap break-words">
                        {m.body}
                      </p>
                    ) : (
                      <p className="italic text-muted-foreground">
                        {mediaLabel(m.messageType)}
                      </p>
                    )}
                    <div
                      className={cn(
                        "mt-1 flex items-center justify-end gap-1 text-[10px]",
                        m.direction === "OUTBOUND"
                          ? "text-[#5b7a52] dark:text-emerald-200/70"
                          : "text-muted-foreground",
                      )}
                    >
                      <span dir="ltr">{formatDateTime(m.sentAt)}</span>
                      {m.direction === "OUTBOUND" && <StatusTick status={m.status} />}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        {renderComposer({
          leadId,
          leadPhone,
          hasIntegration,
          formRef,
          formAction,
          pending,
        })}
      </CardContent>
    </Card>
  );
}

function renderComposer({
  leadId,
  leadPhone,
  hasIntegration,
  formRef,
  formAction,
  pending,
}: {
  leadId: string;
  leadPhone: string | null;
  hasIntegration: boolean;
  formRef: React.RefObject<HTMLFormElement | null>;
  formAction: (formData: FormData) => void;
  pending: boolean;
}) {
  if (!hasIntegration) {
    return (
      <div className="rounded-md border border-dashed border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
        <p className="font-medium">{t.whatsapp.notConfigured}</p>
        <p className="mt-1 text-xs">{t.whatsapp.notConfiguredHint}</p>
        <Button asChild variant="outline" size="sm" className="mt-2">
          <a href="/settings">{t.whatsapp.goToSettings}</a>
        </Button>
      </div>
    );
  }

  if (!leadPhone) {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/30 p-3 text-sm text-muted-foreground">
        <p className="font-medium">{t.whatsapp.noPhone}</p>
        <p className="mt-1 text-xs">{t.whatsapp.noPhoneHint}</p>
      </div>
    );
  }

  return <Composer leadId={leadId} leadPhone={leadPhone} formRef={formRef} formAction={formAction} pending={pending} />;
}

function Composer({
  leadId,
  leadPhone,
  formRef,
  formAction,
  pending,
}: {
  leadId: string;
  leadPhone: string;
  formRef: React.RefObject<HTMLFormElement | null>;
  formAction: (formData: FormData) => void;
  pending: boolean;
}) {
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleDraft = async () => {
    setDraftError(null);
    setDrafting(true);
    try {
      const res = await fetch("/api/whatsapp/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t.whatsapp.aiDraftError);
      if (textareaRef.current) {
        textareaRef.current.value = data.text;
        textareaRef.current.focus();
      }
    } catch (e) {
      setDraftError(e instanceof Error ? e.message : t.whatsapp.aiDraftError);
    } finally {
      setDrafting(false);
    }
  };

  return (
    <form ref={formRef} action={formAction} className="space-y-2">
      <input type="hidden" name="leadId" value={leadId} />
      <Textarea
        ref={textareaRef}
        name="body"
        rows={2}
        required
        maxLength={4096}
        placeholder={t.whatsapp.composePlaceholder}
        className="resize-none"
      />
      {draftError && (
        <p className="text-xs text-destructive">{draftError}</p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground" dir="ltr">
          <bdi>{leadPhone}</bdi>
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={drafting || pending}
            onClick={handleDraft}
          >
            {drafting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {drafting ? t.whatsapp.aiDrafting : t.whatsapp.aiDraft}
          </Button>
          <Button type="submit" size="sm" disabled={pending}>
            <Send className="h-4 w-4" />
            {pending ? t.whatsapp.sending : t.whatsapp.send}
          </Button>
        </div>
      </div>
    </form>
  );
}

function StatusTick({ status }: { status: WhatsappMessage["status"] }) {
  switch (status) {
    case "PENDING":
      return <Clock className="h-3 w-3" />;
    case "FAILED":
      return <TriangleAlert className="h-3 w-3 text-destructive" />;
    case "READ":
      return <CheckCheck className="h-3 w-3 text-sky-500" />;
    case "DELIVERED":
      return <CheckCheck className="h-3 w-3" />;
    case "SENT":
    default:
      return <Check className="h-3 w-3" />;
  }
}

function mediaLabel(type: WhatsappMessage["messageType"]): string {
  switch (type) {
    case "IMAGE":
      return t.whatsapp.mediaPreview.IMAGE;
    case "VIDEO":
      return t.whatsapp.mediaPreview.VIDEO;
    case "AUDIO":
      return t.whatsapp.mediaPreview.AUDIO;
    case "DOCUMENT":
      return t.whatsapp.mediaPreview.DOCUMENT;
    default:
      return t.whatsapp.mediaPreview.OTHER;
  }
}

function WhatsappIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 2.1.55 4.14 1.6 5.94L2 22l4.27-1.12a9.86 9.86 0 0 0 5.77 1.85h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.13-2.9-7C17.18 3.03 14.69 2 12.04 2zm0 18.13a8.16 8.16 0 0 1-4.16-1.14l-.3-.18-2.53.66.68-2.47-.2-.31a8.13 8.13 0 0 1-1.25-4.34c0-4.5 3.67-8.17 8.17-8.17 2.18 0 4.23.85 5.78 2.4a8.12 8.12 0 0 1 2.39 5.78c0 4.5-3.67 8.17-8.18 8.17zm4.49-6.12c-.25-.13-1.46-.72-1.69-.8-.23-.08-.39-.13-.55.13-.16.25-.64.8-.78.97-.14.16-.29.18-.53.06a6.84 6.84 0 0 1-2.01-1.24 7.5 7.5 0 0 1-1.39-1.73c-.15-.25-.02-.39.11-.51.11-.11.25-.29.38-.43.13-.14.16-.25.25-.41.08-.16.04-.31-.02-.43-.06-.13-.55-1.33-.76-1.83-.2-.48-.4-.41-.55-.42h-.47c-.16 0-.42.06-.64.31-.22.25-.84.82-.84 2 0 1.18.86 2.32.98 2.48.12.16 1.69 2.57 4.09 3.6.57.25 1.02.39 1.37.5.58.18 1.1.16 1.51.1.46-.07 1.41-.58 1.61-1.13.2-.55.2-1.02.14-1.13-.06-.11-.22-.18-.47-.31z" />
    </svg>
  );
}
