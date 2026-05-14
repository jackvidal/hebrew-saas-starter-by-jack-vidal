import { z } from "zod";

export const callDirectionEnum = z.enum(["INBOUND", "OUTBOUND"]);
export type CallDirectionValue = z.infer<typeof callDirectionEnum>;

const emptyToNull = (v: string) => (v.length === 0 ? null : v);

export const callCreateSchema = z.object({
  leadId: z.string().uuid(),
  direction: callDirectionEnum,
  occurredAt: z
    .string()
    .trim()
    .min(1, "תאריך השיחה הוא שדה חובה")
    .refine((v) => !isNaN(Date.parse(v)), "תאריך לא תקין"),
  durationMinutes: z
    .number()
    .int()
    .min(0, "משך לא יכול להיות שלילי")
    .max(600, "משך ארוך מדי")
    .nullable(),
  notes: z
    .string()
    .trim()
    .max(10000)
    .transform(emptyToNull)
    .nullable(),
  transcript: z
    .string()
    .trim()
    .max(100000)
    .transform(emptyToNull)
    .nullable(),
});

export const callUpdateSchema = callCreateSchema.omit({ leadId: true }).partial();

export type CallCreateInput = z.infer<typeof callCreateSchema>;
export type CallUpdateInput = z.infer<typeof callUpdateSchema>;
