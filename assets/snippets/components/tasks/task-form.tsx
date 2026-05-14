"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import type { Task, TaskPriority, TaskStatus } from "@prisma/client";
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
  createTaskAction,
  updateTaskAction,
  type FormState,
} from "@/app/(dashboard)/tasks/actions";
import { toDateTimeLocalValue } from "@/lib/utils";
import { t } from "@/i18n/he";

const STATUS_VALUES: TaskStatus[] = [
  "PENDING",
  "IN_PROGRESS",
  "DONE",
  "CANCELED",
];
const PRIORITY_VALUES: TaskPriority[] = ["LOW", "MEDIUM", "HIGH"];
const initial: FormState = {};

export function CreateTaskButton({
  leadId,
  variant = "default",
  size = "sm",
  label,
}: {
  leadId: string;
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "default" | "lg";
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    createTaskAction,
    initial,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size={size} variant={variant}>
          <Plus className="h-4 w-4" />
          {label ?? t.tasks.new}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.tasks.new}</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="space-y-4">
          <input type="hidden" name="leadId" value={leadId} />
          <Field label={t.tasks.fields.title} required>
            <Input
              name="title"
              required
              maxLength={200}
              placeholder={t.tasks.placeholderTitle}
              autoFocus
            />
          </Field>
          <Field label={t.tasks.fields.description}>
            <Textarea
              name="description"
              rows={3}
              maxLength={2000}
              placeholder={t.tasks.placeholderDescription}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t.tasks.fields.dueDate}>
              <Input
                type="datetime-local"
                name="dueDate"
                dir="ltr"
                className="text-start"
              />
            </Field>
            <Field label={t.tasks.fields.priority}>
              <Select name="priority" defaultValue="MEDIUM">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_VALUES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {t.tasks.priority[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
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
              {pending ? t.common.saving : t.tasks.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditTaskDialog({
  task,
  open,
  onOpenChange,
}: {
  task: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const action = updateTaskAction.bind(null, task.id);
  const [state, formAction, pending] = useActionState(action, initial);

  useEffect(() => {
    if (state.ok) onOpenChange(false);
  }, [state, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.tasks.edit}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <Field label={t.tasks.fields.title} required>
            <Input
              name="title"
              defaultValue={task.title}
              required
              maxLength={200}
            />
          </Field>
          <Field label={t.tasks.fields.description}>
            <Textarea
              name="description"
              rows={3}
              maxLength={2000}
              defaultValue={task.description ?? ""}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t.tasks.fields.dueDate}>
              <Input
                type="datetime-local"
                name="dueDate"
                dir="ltr"
                className="text-start"
                defaultValue={
                  task.dueDate ? toDateTimeLocalValue(task.dueDate) : ""
                }
              />
            </Field>
            <Field label={t.tasks.fields.priority}>
              <Select name="priority" defaultValue={task.priority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_VALUES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {t.tasks.priority[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label={t.tasks.fields.status}>
            <Select name="status" defaultValue={task.status}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_VALUES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t.tasks.status[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              {pending ? t.common.saving : t.tasks.save}
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
