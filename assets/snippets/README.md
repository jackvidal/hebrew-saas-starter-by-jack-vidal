# Snippets — full Leadero source as a reference implementation

This folder is the **complete TypeScript source** of the Leadero project at the end of its 5-build-session evolution. Every file here was shipped to production and tested with real users, real Cal.com bookings, real WhatsApp messages, real Whisper transcriptions, and real Claude analyses.

Use it as:
- **A copy-paste source** when scaffolding a new Hebrew SaaS (drop the files into `src/...` and rename per your domain)
- **A reference implementation** when you're unsure how a pattern fits together end-to-end
- **A starting point** when you want to fork Leadero for a new vertical (real estate, coaching, agencies, etc.)

## Mapping snippet paths → project paths

| Snippet path | Place in your project at |
|---|---|
| `app-routes/api/...` | `src/app/api/...` |
| `app-routes/auth/...` | `src/app/(auth)/...` |
| `app-routes/dashboard/...` | `src/app/(dashboard)/...` |
| `components/...` | `src/components/...` |
| `lib/...` | `src/lib/...` |
| `schemas/...` | `src/schemas/...` |
| `hooks/...` | `src/hooks/...` |
| `i18n/he.ts` | `src/i18n/he.ts` |
| `layout.tsx`, `globals.css`, `page.tsx` | `src/app/` |
| `middleware.ts` | `src/middleware.ts` |

## What's inside, by session

### Session 1 — Foundation + Leads + AI website analysis + Cal.com webhook
- `lib/ai/analyze-website.ts`, `lib/ai/prompts.ts`
- `lib/webhooks/cal.ts`
- `app-routes/api/leads/[id]/analyze/route.ts`
- `app-routes/api/webhooks/cal/route.ts`
- `components/leads/`, `components/meetings/`, `components/analysis/`
- `schemas/cal-webhook.ts`, `schemas/lead.ts`, `schemas/meeting.ts`

### Session 2 — Tasks
- `app-routes/dashboard/tasks/actions.ts`, `page.tsx`
- `components/tasks/`
- `schemas/task.ts`

### Session 3 — Calls + AI call analysis
- `lib/ai/analyze-call.ts`, `lib/ai/call-prompts.ts`
- `app-routes/api/calls/[id]/analyze/route.ts`
- `app-routes/api/calls/[id]/create-tasks/route.ts`
- `components/calls/call-analysis-card.tsx`
- `schemas/call.ts`

### Session 4 — Audio upload + Whisper transcription
- `lib/ai/transcribe-audio.ts`
- `app-routes/api/calls/[id]/transcribe/route.ts`
- `components/calls/audio-upload.tsx` (the drag-drop 3-stage progress UI)

### Session 5 — WhatsApp via Wassender
- `lib/whatsapp/send.ts`
- `lib/webhooks/wassender.ts`
- `lib/ai/draft-whatsapp-reply.ts`
- `app-routes/api/webhooks/wassender/route.ts`
- `app-routes/api/whatsapp/draft/route.ts`
- `app-routes/dashboard/whatsapp/actions.ts`
- `components/whatsapp/whatsapp-panel.tsx`
- `schemas/wassender-webhook.ts`

## How to use

1. **Read the reference doc** for the feature first (`references/whatsapp-wassender.md`, `references/audio-transcription.md`, etc.). The doc explains the *why*; the snippet shows the *what*.
2. **Copy the snippet file(s)** into the matching path in your project (see table above).
3. **Adjust imports** if your `@/` alias is different.
4. **Rename domain types** if your entity isn't a `Lead` (e.g., `Property`, `Patient`, `Project`).
5. **Add the matching Prisma model** from `assets/templates/prisma-schema.template.prisma` and run `db:push`.
6. **Add the matching RLS policy block** from `assets/templates/supabase-policies.template.sql` in the Supabase SQL editor.

## What NOT to copy verbatim

- **`i18n/he.ts`** — start from it, but replace domain-specific strings (lead status names, meeting types, etc.) for your project
- **Lead status enum / values** — `NEW / MEETING_SCHEDULED / ...` is sales-specific. Real-estate might be `INQUIRY / VIEWING_BOOKED / OFFER_MADE / SOLD`.
- **AI system prompts** — `lib/ai/prompts.ts`, `call-prompts.ts`, `draft-whatsapp-reply.ts` all have Hebrew prompts tuned for the sales-CRM use case. Rewrite the persona for support, coaching, real estate, etc.
- **Hardcoded paths** like `revalidatePath('/leads/${id}')` — match your route names.

## What to copy verbatim

- `lib/auth.ts`, `lib/prisma.ts`, `lib/utils.ts`, `lib/supabase/*` — generic plumbing
- `lib/webhooks/cal.ts`, `lib/webhooks/wassender.ts` — security primitives (signature verification)
- `middleware.ts` — Supabase session refresh helper
- `components/ui/*` — RTL-corrected shadcn primitives
- `hooks/use-toast.ts` — generic
- The 3-stage progress UI pattern in `components/calls/audio-upload.tsx`
- The thread + composer pattern in `components/whatsapp/whatsapp-panel.tsx`
