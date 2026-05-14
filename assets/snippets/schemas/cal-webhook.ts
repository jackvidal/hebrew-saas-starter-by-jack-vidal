import { z } from "zod";

/**
 * Cal.com webhook payload shape (subset we use).
 * Reference: https://cal.com/docs/core-features/webhooks
 *
 * We are deliberately permissive (.passthrough()) on inner objects so that
 * Cal can add fields without breaking us.
 */

export const calAttendeeSchema = z
  .object({
    name: z.string().optional(),
    email: z.string().email(),
    timeZone: z.string().optional(),
  })
  .passthrough();

export const calOrganizerSchema = z
  .object({
    name: z.string().optional(),
    email: z.string().email().optional(),
    timeZone: z.string().optional(),
  })
  .passthrough();

export const calBookingPayloadSchema = z
  .object({
    uid: z.string(),
    title: z.string().optional(),
    startTime: z.string(),
    endTime: z.string(),
    organizer: calOrganizerSchema.optional(),
    attendees: z.array(calAttendeeSchema).default([]),
    metadata: z.record(z.string(), z.unknown()).optional(),
    location: z.string().optional(),
    additionalNotes: z.string().nullable().optional(),
  })
  .passthrough();

export const calWebhookSchema = z
  .object({
    triggerEvent: z.enum([
      "BOOKING_CREATED",
      "BOOKING_RESCHEDULED",
      "BOOKING_CANCELLED",
      "MEETING_ENDED",
    ]),
    createdAt: z.string().optional(),
    payload: calBookingPayloadSchema,
  })
  .passthrough();

export type CalWebhookPayload = z.infer<typeof calWebhookSchema>;
