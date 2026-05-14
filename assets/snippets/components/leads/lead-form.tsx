"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { Lead, LeadStatus } from "@prisma/client";
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
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  createLeadAction,
  updateLeadAction,
  type FormState,
} from "@/app/(dashboard)/leads/actions";
import { t } from "@/i18n/he";

const STATUS_VALUES: LeadStatus[] = [
  "NEW",
  "MEETING_SCHEDULED",
  "MEETING_COMPLETED",
  "DEAL_CLOSED",
  "DEAL_LOST",
];

const initial: FormState = {};

export function LeadForm({ lead }: { lead?: Lead }) {
  const action = lead
    ? updateLeadAction.bind(null, lead.id)
    : createLeadAction;
  const [state, formAction, pending] = useActionState(action, initial);

  return (
    <form action={formAction} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{lead ? t.leads.edit : t.leads.new}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label={t.leads.fields.fullName} required>
            <Input
              name="fullName"
              defaultValue={lead?.fullName ?? ""}
              required
            />
          </Field>
          <Field label={`${t.leads.fields.status}`}>
            <Select name="status" defaultValue={lead?.status ?? "NEW"}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_VALUES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t.leads.status[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={`${t.leads.fields.email} (${t.common.optional})`}>
            <Input
              type="email"
              name="email"
              dir="ltr"
              className="text-start"
              defaultValue={lead?.email ?? ""}
            />
          </Field>
          <Field label={`${t.leads.fields.phone} (${t.common.optional})`}>
            <Input
              type="tel"
              name="phone"
              dir="ltr"
              className="text-start"
              defaultValue={lead?.phone ?? ""}
            />
          </Field>
          <Field label={`${t.leads.fields.company} (${t.common.optional})`}>
            <Input name="company" defaultValue={lead?.company ?? ""} />
          </Field>
          <Field label={`${t.leads.fields.websiteUrl} (${t.common.optional})`}>
            <Input
              type="url"
              name="websiteUrl"
              dir="ltr"
              className="text-start"
              placeholder="https://example.com"
              defaultValue={lead?.websiteUrl ?? ""}
            />
          </Field>
          <div className="md:col-span-2">
            <Field label={`${t.leads.fields.notes} (${t.common.optional})`}>
              <Textarea
                name="notes"
                rows={4}
                defaultValue={lead?.notes ?? ""}
              />
            </Field>
          </div>
          <input
            type="hidden"
            name="source"
            value={lead?.source ?? "manual"}
          />
        </CardContent>
      </Card>

      {state.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" asChild>
          <Link href={lead ? `/leads/${lead.id}` : "/leads"}>
            {t.common.cancel}
          </Link>
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? t.common.saving : t.leads.save}
        </Button>
      </div>
    </form>
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
