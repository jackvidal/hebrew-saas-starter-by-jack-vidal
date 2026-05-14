import { z } from "zod";

export const meetingStatusEnum = z.enum([
  "SCHEDULED",
  "COMPLETED",
  "CANCELED",
  "NO_SHOW",
]);
export type MeetingStatusValue = z.infer<typeof meetingStatusEnum>;

export const meetingCreateSchema = z.object({
  leadId: z.string().uuid(),
  scheduledAt: z.string().datetime().or(
    z.string().refine((v) => !isNaN(Date.parse(v)), "תאריך לא תקין"),
  ),
  durationMinutes: z.number().int().min(5).max(600).default(30),
  status: meetingStatusEnum.default("SCHEDULED"),
  notes: z
    .string()
    .trim()
    .max(5000)
    .nullable()
    .or(z.literal("").transform(() => null)),
  meetingUrl: z
    .string()
    .trim()
    .url("קישור לא תקין")
    .nullable()
    .or(z.literal("").transform(() => null)),
});

export const meetingUpdateSchema = meetingCreateSchema
  .omit({ leadId: true })
  .partial();

export type MeetingCreateInput = z.infer<typeof meetingCreateSchema>;
export type MeetingUpdateInput = z.infer<typeof meetingUpdateSchema>;
