import { Frown, Meh, Smile } from "lucide-react";
import type { CallSentiment } from "@prisma/client";
import { cn } from "@/lib/utils";
import { t } from "@/i18n/he";

const config: Record<
  CallSentiment,
  { icon: typeof Smile; className: string }
> = {
  POSITIVE: {
    icon: Smile,
    className: "border-success/40 bg-success/10 text-success",
  },
  NEUTRAL: {
    icon: Meh,
    className: "border-border bg-muted text-muted-foreground",
  },
  NEGATIVE: {
    icon: Frown,
    className: "border-destructive/40 bg-destructive/10 text-destructive",
  },
};

export function CallSentimentBadge({ sentiment }: { sentiment: CallSentiment }) {
  const { icon: Icon, className } = config[sentiment];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {t.calls.sentimentLabel[sentiment]}
    </span>
  );
}
