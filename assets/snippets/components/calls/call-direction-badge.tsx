import { PhoneIncoming, PhoneOutgoing } from "lucide-react";
import type { CallDirection } from "@prisma/client";
import { cn } from "@/lib/utils";
import { t } from "@/i18n/he";

export function CallDirectionBadge({
  direction,
  className,
}: {
  direction: CallDirection;
  className?: string;
}) {
  const isInbound = direction === "INBOUND";
  const Icon = isInbound ? PhoneIncoming : PhoneOutgoing;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        isInbound
          ? "border-success/40 bg-success/10 text-success"
          : "border-primary/40 bg-primary/10 text-primary",
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {t.calls.direction[direction]}
    </span>
  );
}
