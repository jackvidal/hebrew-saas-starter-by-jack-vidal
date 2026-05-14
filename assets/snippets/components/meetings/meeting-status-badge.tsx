import { Badge } from "@/components/ui/badge";
import type { MeetingStatus } from "@prisma/client";
import { t } from "@/i18n/he";

const variantMap: Record<
  MeetingStatus,
  "default" | "secondary" | "success" | "warning" | "destructive" | "outline"
> = {
  SCHEDULED: "secondary",
  COMPLETED: "success",
  CANCELED: "destructive",
  NO_SHOW: "warning",
};

export function MeetingStatusBadge({ status }: { status: MeetingStatus }) {
  return (
    <Badge variant={variantMap[status]} className="font-normal">
      {t.meetings.status[status]}
    </Badge>
  );
}
