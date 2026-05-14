import { z } from "zod";

export const taskStatusEnum = z.enum([
  "PENDING",
  "IN_PROGRESS",
  "DONE",
  "CANCELED",
]);
export type TaskStatusValue = z.infer<typeof taskStatusEnum>;

export const taskPriorityEnum = z.enum(["LOW", "MEDIUM", "HIGH"]);
export type TaskPriorityValue = z.infer<typeof taskPriorityEnum>;

const emptyToNull = (v: string) => (v.length === 0 ? null : v);

export const taskCreateSchema = z.object({
  leadId: z.string().uuid(),
  title: z.string().trim().min(1, "כותרת היא שדה חובה").max(200),
  description: z
    .string()
    .trim()
    .max(2000)
    .transform(emptyToNull)
    .nullable(),
  dueDate: z
    .string()
    .trim()
    .transform(emptyToNull)
    .nullable()
    .refine(
      (v) => v === null || !isNaN(Date.parse(v)),
      "תאריך יעד לא תקין",
    ),
  status: taskStatusEnum.default("PENDING"),
  priority: taskPriorityEnum.default("MEDIUM"),
});

export const taskUpdateSchema = taskCreateSchema
  .omit({ leadId: true })
  .partial();

export type TaskCreateInput = z.infer<typeof taskCreateSchema>;
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;
