"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { Meeting, MeetingStatus } from "@prisma/client";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  createMeetingAction,
  updateMeetingAction,
  type FormState,
} from "@/app/(dashboard)/meetings/actions";
import { toDateTimeLocalValue } from "@/lib/utils";
import { t } from "@/i18n/he";

const STATUS_VALUES: MeetingStatus[] = [
  "SCHEDULED",
  "COMPLETED",
  "CANCELED",
  "NO_SHOW",
];
const initial: FormState = {};

export function CreateMeetingButton({ leadId }: { leadId: string }) {
  const [open, setOpen] = useState(false);
  const action = createMeetingAction;
  const [state, formAction, pending] = useActionState(action, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      formRef.current?.reset();
    }
  }, [state]);

  const defaultDate = toDateTimeLocalValue(
    new Date(Date.now() + 60 * 60 * 1000),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" />
          {t.meetings.new}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.meetings.new}</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="space-y-4">
          <input type="hidden" name="leadId" value={leadId} />
          <div className="space-y-2">
            <Label>{t.meetings.fields.scheduledAt}</Label>
            <Input
              type="datetime-local"
              name="scheduledAt"
              defaultValue={defaultDate}
              dir="ltr"
              className="text-start"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t.meetings.fields.duration}</Label>
              <Input
                type="number"
                name="durationMinutes"
                defaultValue={30}
                min={5}
                max={600}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>{t.meetings.fields.status}</Label>
              <Select name="status" defaultValue="SCHEDULED">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_VALUES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {t.meetings.status[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t.meetings.fields.meetingUrl}</Label>
            <Input
              type="url"
              name="meetingUrl"
              dir="ltr"
              className="text-start"
              placeholder="https://meet.example.com/..."
            />
          </div>
          <div className="space-y-2">
            <Label>{t.meetings.fields.notes}</Label>
            <Textarea name="notes" rows={3} />
          </div>
          {state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? t.common.saving : t.meetings.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditMeetingDialog({
  meeting,
  open,
  onOpenChange,
}: {
  meeting: Meeting;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const action = updateMeetingAction.bind(null, meeting.id);
  const [state, formAction, pending] = useActionState(action, initial);

  useEffect(() => {
    if (state.ok) onOpenChange(false);
  }, [state, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.meetings.edit}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label>{t.meetings.fields.scheduledAt}</Label>
            <Input
              type="datetime-local"
              name="scheduledAt"
              defaultValue={toDateTimeLocalValue(meeting.scheduledAt)}
              dir="ltr"
              className="text-start"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t.meetings.fields.duration}</Label>
              <Input
                type="number"
                name="durationMinutes"
                defaultValue={meeting.durationMinutes}
                min={5}
                max={600}
              />
            </div>
            <div className="space-y-2">
              <Label>{t.meetings.fields.status}</Label>
              <Select name="status" defaultValue={meeting.status}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_VALUES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {t.meetings.status[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t.meetings.fields.meetingUrl}</Label>
            <Input
              type="url"
              name="meetingUrl"
              dir="ltr"
              className="text-start"
              defaultValue={meeting.meetingUrl ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label>{t.meetings.fields.notes}</Label>
            <Textarea
              name="notes"
              rows={3}
              defaultValue={meeting.notes ?? ""}
            />
          </div>
          {state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? t.common.saving : t.meetings.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
