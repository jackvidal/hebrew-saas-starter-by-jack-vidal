"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Phone } from "lucide-react";
import type { Call, CallDirection } from "@prisma/client";
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
  createCallAction,
  updateCallAction,
  type FormState,
} from "@/app/(dashboard)/calls/actions";
import { toDateTimeLocalValue } from "@/lib/utils";
import { t } from "@/i18n/he";

const DIRECTION_VALUES: CallDirection[] = ["OUTBOUND", "INBOUND"];
const initial: FormState = {};

export function LogCallButton({
  leadId,
  size = "sm",
}: {
  leadId: string;
  size?: "sm" | "default" | "lg";
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    createCallAction,
    initial,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      formRef.current?.reset();
    }
  }, [state]);

  // Default to current time, rounded down to nearest 5 minutes
  const defaultOccurredAt = (() => {
    const now = new Date();
    now.setMinutes(Math.floor(now.getMinutes() / 5) * 5, 0, 0);
    return toDateTimeLocalValue(now);
  })();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size={size}>
          <Phone className="h-4 w-4" />
          {t.calls.log}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t.calls.log}</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="space-y-4">
          <input type="hidden" name="leadId" value={leadId} />

          <div className="grid grid-cols-2 gap-4">
            <Field label={t.calls.fields.direction} required>
              <Select name="direction" defaultValue="OUTBOUND">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIRECTION_VALUES.map((d) => (
                    <SelectItem key={d} value={d}>
                      {t.calls.direction[d]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t.calls.fields.duration}>
              <Input
                type="number"
                name="durationMinutes"
                min={0}
                max={600}
                placeholder="לדוגמה: 15"
              />
            </Field>
          </div>

          <Field label={t.calls.fields.occurredAt} required>
            <Input
              type="datetime-local"
              name="occurredAt"
              dir="ltr"
              className="text-start"
              defaultValue={defaultOccurredAt}
              required
            />
          </Field>

          <Field label={t.calls.fields.notes}>
            <Textarea
              name="notes"
              rows={4}
              maxLength={10000}
              placeholder={t.calls.placeholders.notes}
            />
          </Field>

          <Field label={t.calls.fields.transcript}>
            <Textarea
              name="transcript"
              rows={5}
              maxLength={100000}
              placeholder={t.calls.placeholders.transcript}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              {t.calls.fields.transcriptHelper}
            </p>
          </Field>

          {state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? t.common.saving : t.calls.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditCallDialog({
  call,
  open,
  onOpenChange,
}: {
  call: Call;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const action = updateCallAction.bind(null, call.id);
  const [state, formAction, pending] = useActionState(action, initial);

  useEffect(() => {
    if (state.ok) onOpenChange(false);
  }, [state, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t.calls.edit}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label={t.calls.fields.direction}>
              <Select name="direction" defaultValue={call.direction}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIRECTION_VALUES.map((d) => (
                    <SelectItem key={d} value={d}>
                      {t.calls.direction[d]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t.calls.fields.duration}>
              <Input
                type="number"
                name="durationMinutes"
                min={0}
                max={600}
                defaultValue={
                  call.durationSeconds !== null
                    ? Math.round(call.durationSeconds / 60)
                    : ""
                }
              />
            </Field>
          </div>

          <Field label={t.calls.fields.occurredAt}>
            <Input
              type="datetime-local"
              name="occurredAt"
              dir="ltr"
              className="text-start"
              defaultValue={toDateTimeLocalValue(call.occurredAt)}
            />
          </Field>

          <Field label={t.calls.fields.notes}>
            <Textarea
              name="notes"
              rows={4}
              maxLength={10000}
              defaultValue={call.notes ?? ""}
            />
          </Field>

          <Field label={t.calls.fields.transcript}>
            <Textarea
              name="transcript"
              rows={5}
              maxLength={100000}
              defaultValue={call.transcript ?? ""}
              className="font-mono text-xs"
            />
          </Field>

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
              {pending ? t.common.saving : t.calls.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required && <span className="text-destructive ms-1">*</span>}
      </Label>
      {children}
    </div>
  );
}
