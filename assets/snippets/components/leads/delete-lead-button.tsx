"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { deleteLeadAction } from "@/app/(dashboard)/leads/actions";
import { t } from "@/i18n/he";

export function DeleteLeadButton({ leadId }: { leadId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-destructive">
          <Trash2 className="h-4 w-4" />
          {t.leads.delete}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.leads.delete}</DialogTitle>
          <DialogDescription>{t.leads.confirmDelete}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t.common.cancel}
          </Button>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await deleteLeadAction(leadId);
              })
            }
          >
            {pending ? t.common.saving : t.common.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
