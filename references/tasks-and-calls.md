# Tasks + Calls (with AI call analysis)

The Tasks and Calls modules in Leadero share a structural pattern:
- Both are owned tables (`ownerId` UUID FK to `profiles`)
- Both belong to exactly one `Lead`
- Both use `useActionState` for the create/edit dialog
- Both have a list component that lives inside the lead detail page (not a top-level page)
- Calls have a layered AI feature (analyze → suggest tasks → one-click create)

Read this doc when adding a Tasks or Calls feature to a Hebrew SaaS, OR when adapting the pattern to a different "owned belongs-to-lead" entity (e.g., showings, sessions, opportunities, deals).

---

## Tasks — schema

```prisma
enum TaskStatus {
  PENDING
  IN_PROGRESS
  DONE
  CANCELED
}

enum TaskPriority {
  LOW
  MEDIUM
  HIGH
}

model Task {
  id          String       @id @default(uuid()) @db.Uuid
  ownerId     String       @map("owner_id") @db.Uuid
  owner       Profile      @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  leadId      String       @map("lead_id") @db.Uuid
  lead        Lead         @relation(fields: [leadId], references: [id], onDelete: Cascade)
  title       String
  description String?
  dueDate     DateTime?    @map("due_date")
  status      TaskStatus   @default(PENDING)
  priority    TaskPriority @default(MEDIUM)
  completedAt DateTime?    @map("completed_at")
  createdAt   DateTime     @default(now()) @map("created_at")
  updatedAt   DateTime     @updatedAt @map("updated_at")

  @@index([ownerId, status, dueDate])
  @@index([leadId])
  @@map("tasks")
}
```

## Tasks — RLS

```sql
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tasks_select_own" ON public.tasks;
CREATE POLICY "tasks_select_own" ON public.tasks
  FOR SELECT USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "tasks_insert_own" ON public.tasks;
CREATE POLICY "tasks_insert_own" ON public.tasks
  FOR INSERT WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "tasks_update_own" ON public.tasks;
CREATE POLICY "tasks_update_own" ON public.tasks
  FOR UPDATE USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "tasks_delete_own" ON public.tasks;
CREATE POLICY "tasks_delete_own" ON public.tasks
  FOR DELETE USING (owner_id = auth.uid());
```

## Tasks — UI

A list of tasks lives on the lead detail page. Each row shows:
- Checkbox to toggle status (`PENDING` ↔ `DONE`)
- Title + optional description
- Due-date badge (overdue=red, today=orange, soon=blue, none=muted)
- Priority badge
- Action menu (edit, delete)

A separate top-level `/tasks` page shows all tasks across all leads, with three filter dropdowns: status, priority, and due-window (`all` / `overdue` / `today` / `week`).

Filters live in the query string (`?status=PENDING&priority=HIGH&due=overdue`) so they survive refresh and are linkable.

---

## Calls — schema

```prisma
enum CallDirection {
  INBOUND
  OUTBOUND
}

enum CallSentiment {
  POSITIVE
  NEUTRAL
  NEGATIVE
}

model Call {
  id              String        @id @default(uuid()) @db.Uuid
  ownerId         String        @map("owner_id") @db.Uuid
  owner           Profile       @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  leadId          String        @map("lead_id") @db.Uuid
  lead            Lead          @relation(fields: [leadId], references: [id], onDelete: Cascade)
  direction       CallDirection
  occurredAt      DateTime      @map("occurred_at")
  durationSeconds Int?          @map("duration_seconds")
  notes           String?
  transcript      String?
  audioUrl        String?       @map("audio_url")

  // AI analysis fields (populated by /api/calls/[id]/analyze)
  summary              String?
  keyTopics            Json?          @map("key_topics")
  sentiment            CallSentiment?
  sentimentReason      String?        @map("sentiment_reason")
  prospectCommitments  Json?          @map("prospect_commitments")
  myCommitments        Json?          @map("my_commitments")
  recommendedNextSteps Json?          @map("recommended_next_steps")
  redFlags             Json?          @map("red_flags")
  analyzedAt           DateTime?      @map("analyzed_at")
  modelUsed            String?        @map("model_used")

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@index([ownerId, occurredAt])
  @@index([leadId, occurredAt])
  @@map("calls")
}
```

Notice: AI fields are **nullable** so you can save a call before analyzing, and the analysis can be retried.

## Calls — manual logging

A "Log Call" button opens a dialog with:
- Direction (inbound / outbound)
- Occurred at (datetime-local)
- Duration (minutes, optional)
- Notes (free text, what was discussed)
- Transcript (optional, paste-in textarea — this unlocks AI analysis)

The form uses `useActionState`. Same dialog-close gotcha: depend on `[state]` not `[state.ok]`.

## Calls — AI analysis

`POST /api/calls/[id]/analyze` reads `call.transcript` and calls Claude Sonnet 4.6 with a forced tool call:

```ts
const response = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 16384, // Hebrew tokenizes hungrily; bump for long transcripts
  system: [{
    type: "text",
    text: CALL_ANALYSIS_SYSTEM_PROMPT,
    cache_control: { type: "ephemeral" },
  }],
  tools: [CALL_ANALYSIS_TOOL_DEFINITION],
  tool_choice: { type: "tool", name: CALL_ANALYSIS_TOOL_NAME }, // OK here — no web_fetch
  messages: [{ role: "user", content: `נתח את שיחת המכירה הבאה:\n\n${transcript}` }],
});
```

The tool schema forces structured output:
```ts
{
  name: "submit_call_analysis",
  input_schema: {
    type: "object",
    required: ["summary", "keyTopics", "sentiment", ...],
    properties: {
      summary: { type: "string", description: "סיכום קצר בעברית..." },
      keyTopics: { type: "array", items: { type: "string" } },
      sentiment: { type: "string", enum: ["POSITIVE", "NEUTRAL", "NEGATIVE"] },
      sentimentReason: { type: "string" },
      prospectCommitments: { type: "array", items: { type: "string" } },
      myCommitments: { type: "array", items: { type: "string" } },
      recommendedNextSteps: { type: "array", items: { type: "string" } },
      redFlags: { type: "array", items: { type: "string" } },
    },
  },
}
```

**Gotcha — be lenient with validation.** Claude sometimes returns partial responses (especially on long transcripts hitting `max_tokens`). Save whatever Claude returns with empty-array defaults rather than throwing "missing field":

```ts
const data = toolUseBlock.input as Partial<CallAnalysisInput>;
return {
  summary: data.summary ?? "",
  keyTopics: data.keyTopics ?? [],
  sentiment: data.sentiment ?? "NEUTRAL",
  // ... rest with safe defaults
};
```

## Calls — auto-task creation

After analysis runs, the UI shows a "Create tasks automatically" button. Clicking it iterates `recommendedNextSteps` and creates one `Task` per step (status PENDING, priority MEDIUM, no due date) tied to the same lead.

```ts
await prisma.$transaction(
  recommendedNextSteps.map((title) =>
    prisma.task.create({
      data: {
        ownerId: user.id,
        leadId: call.leadId,
        title,
        priority: "MEDIUM",
        status: "PENDING",
      },
    }),
  ),
);
```

This single button is the "wow moment" of the calls feature — transcript → 5 minutes later you have a structured analysis AND a populated task list ready to act on.

## Calls — UI placement

Call list lives in a Card on the lead detail page (not a top-level page). The list shows direction icon, occurred-at, duration, body preview, and (if analyzed) sentiment badge.

The detail of a single call (with the AI analysis card showing summary / topics / sentiment / commitments / next steps / red flags) opens in a Dialog when the user clicks the call row.

---

## What to change per project

- **Task and call relations** — replace "Lead" with your domain entity (Property, Project, Patient, etc.)
- **Status enums** — pick verbs that match your workflow
- **AI prompts** — `CALL_ANALYSIS_SYSTEM_PROMPT` is in Hebrew and assumes sales calls. For support calls, coaching sessions, or interviews, rewrite the system prompt and tool schema (different fields).
- **Auto-task creation** — if your domain doesn't use tasks, replace with whatever "todo" entity you have (or skip).

## What to keep verbatim

- The nullable AI fields pattern (save first, analyze later, allow retry)
- Lenient response validation with defaults
- `max_tokens: 16384` for Hebrew transcripts
- Prompt caching on the system prompt (saves ~70% of input tokens on retries)
- `tool_choice: { type: "tool", name }` is safe here — there's no `web_fetch` in this flow
