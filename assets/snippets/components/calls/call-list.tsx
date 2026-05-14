"use client";

import { useState, useTransition } from "react";
import { Clock, FileText, Pencil, Trash2 } from "lucide-react";
import type { Call } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { CallDirectionBadge } from "./call-direction-badge";
import { CallAnalysisCard } from "./call-analysis-card";
import { AudioUpload } from "./audio-upload";
import { EditCallDialog } from "./call-form";
import { deleteCallAction } from "@/app/(dashboard)/calls/actions";
import { formatDateTime } from "@/lib/utils";
import { t } from "@/i18n/he";

export function CallList({ calls }: { calls: Call[] }) {
  const [editing, setEditing] = useState<Call | null>(null);
  const [, startTransition] = useTransition();

  if (calls.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
        {t.calls.none}
      </div>
    );
  }

  return (
    <>
      <ul className="space-y-3">
        {calls.map((call) => (
          <li
            key={call.id}
            className="rounded-lg border border-border bg-card p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <CallDirectionBadge direction={call.direction} />
                <span className="text-sm font-medium">
                  {formatDateTime(call.occurredAt)}
                </span>
                {call.durationSeconds !== null && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {Math.round(call.durationSeconds / 60)} {t.calls.minutesShort}
                  </span>
                )}
                {call.transcript && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                    <FileText className="h-3 w-3" />
                    {t.calls.hasTranscript}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setEditing(call)}
                  aria-label={t.common.edit}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  onClick={() => {
                    if (confirm(t.calls.confirmDelete)) {
                      startTransition(async () => {
                        await deleteCallAction(call.id);
                      });
                    }
                  }}
                  aria-label={t.common.delete}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {call.notes && (
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {call.notes}
              </p>
            )}

            {/* If there's no transcript yet, offer audio upload.
                Once transcript exists, show the AI analysis card. */}
            {!call.transcript || call.transcript.trim().length === 0 ? (
              <AudioUpload callId={call.id} />
            ) : (
              <CallAnalysisCard call={call} />
            )}
          </li>
        ))}
      </ul>
      {editing && (
        <EditCallDialog
          call={editing}
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
        />
      )}
    </>
  );
}
