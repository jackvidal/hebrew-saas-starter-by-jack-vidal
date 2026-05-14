"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addNoteAction, type FormState } from "@/app/(dashboard)/leads/actions";
import { t } from "@/i18n/he";

const initial: FormState = {};

export function AddNoteForm({ leadId }: { leadId: string }) {
  const action = addNoteAction.bind(null, leadId);
  const [state, formAction, pending] = useActionState(action, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok && formRef.current) formRef.current.reset();
  }, [state.ok]);

  return (
    <form ref={formRef} action={formAction} className="space-y-2">
      <Textarea
        name="content"
        rows={3}
        placeholder={t.leads.detail.notePlaceholder}
        required
      />
      {state.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? t.common.saving : t.leads.detail.addNote}
        </Button>
      </div>
    </form>
  );
}
