"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2, ExternalLink } from "lucide-react";
import type { Meeting } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { MeetingStatusBadge } from "./meeting-status-badge";
import { EditMeetingDialog } from "./meeting-form";
import { deleteMeetingAction } from "@/app/(dashboard)/meetings/actions";
import { formatDateTime } from "@/lib/utils";
import { t } from "@/i18n/he";

export function MeetingList({ meetings }: { meetings: Meeting[] }) {
  const [editing, setEditing] = useState<Meeting | null>(null);
  const [, startTransition] = useTransition();

  if (meetings.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
        {t.leads.detail.noMeetings}
      </div>
    );
  }

  return (
    <>
      <ul className="space-y-3">
        {meetings.map((m) => (
          <li
            key={m.id}
            className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{formatDateTime(m.scheduledAt)}</span>
                <MeetingStatusBadge status={m.status} />
                <span className="text-xs text-muted-foreground">
                  {m.durationMinutes} דק'
                </span>
              </div>
              {m.meetingUrl && (
                <a
                  href={m.meetingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  dir="ltr"
                >
                  <ExternalLink className="h-3 w-3" />
                  <bdi>{m.meetingUrl}</bdi>
                </a>
              )}
              {m.notes && (
                <p className="text-sm text-muted-foreground">{m.notes}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(m)}
              >
                <Pencil className="h-3.5 w-3.5" />
                {t.common.edit}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive"
                onClick={() => {
                  if (confirm(t.meetings.confirmDelete)) {
                    startTransition(async () => {
                      await deleteMeetingAction(m.id);
                    });
                  }
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {editing && (
        <EditMeetingDialog
          meeting={editing}
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
        />
      )}
    </>
  );
}
