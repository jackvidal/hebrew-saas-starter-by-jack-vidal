---
name: hebrew-saas-starter-by-jack-vidal
description: Scaffold a complete Hebrew-first RTL SaaS web app with Next.js (App Router) + TypeScript + Tailwind + shadcn/ui, Supabase auth + Postgres + Row Level Security + Storage, Prisma ORM, Anthropic Claude (web_fetch + tool_use) and OpenAI Whisper for AI features, Cal.com webhook automation, Wassender WhatsApp integration with AI draft replies, dark mode toggle, and Vercel deployment. Use this skill whenever the user wants to build a new Hebrew/RTL SaaS or admin app, scaffold a CRM/booking/dashboard product in Hebrew, create a per-user multi-tenant app with auth and RLS, add WhatsApp integration via Wassender, add audio transcription via Whisper, add Claude-powered analysis features, or duplicate the Leadero template for a new domain. Trigger generously — even when the user only mentions "Hebrew web app", "RTL dashboard", "CRM in Hebrew", "Supabase + Next.js project", "WhatsApp integration", "audio transcription", or "deploy a SaaS to Vercel", load this skill, because the patterns here (RLS recipe, signed-webhook handler, raw-secret-not-HMAC Wassender auth, Whisper auto-trigger flow, cached-system-prompt AI tool, no-flash dark mode, RTL `<bdi>` for emails) are non-obvious and easy to get wrong from scratch.
---

# Hebrew SaaS Starter — by Jack Vidal

A battle-tested recipe for building a Hebrew-first, RTL, full-stack SaaS web app on Next.js + Supabase + Vercel. Distilled from the Leadero (formerly JackCRM) project across 5 build sessions — every pattern here was shipped to production and survived real bookings, real Wassender messages, real Whisper transcriptions, and real Claude analyses.

## When to use this skill

Trigger this skill when the user wants any of:
- A new Hebrew/RTL SaaS, dashboard, or admin app
- A CRM, booking system, or project tool with Hebrew UI
- A Next.js app with Supabase auth + Postgres + RLS
- An app where each user sees only their own data
- WhatsApp integration via Wassender (outbound + inbound)
- Audio file upload + automatic transcription (Whisper)
- AI analyses with structured Hebrew output (Claude tool_use)
- Cal.com webhook integration
- A duplicate of Leadero for a new domain (real estate, coaching, agencies, etc.)

## What this skill gives you

- **Tech stack rationale** and version pins that work together
- **Step-by-step setup** for Supabase (Auth + Postgres + Storage), GitHub, Vercel, Cal.com, Wassender, OpenAI, Anthropic (the order matters — wrong order causes preventable failures)
- **Templates** for the foundational files: Prisma schema (with calls, tasks, whatsapp_messages), RLS policies, env file, root layout, middleware, auth helpers, AI libs, webhook handlers
- **Customization guide** — exactly what to change per project vs what to keep
- **Recipe-level docs** for the patterns that are easy to get wrong: RLS, signed webhooks, web_fetch + tool_use, Whisper upload flow, Wassender raw-secret auth, RTL with mixed Latin content, dark mode without flash

---

## The workflow

When invoked, follow this sequence. Don't skip ahead — each step depends on the previous.

### Step 1 — Confirm intent (always)

Ask 5 questions before writing any code:

1. **Project name?** (Lowercase, kebab-case, e.g., `realestate-crm`. NPM rejects capitals.)
2. **Domain?** What problem does it solve? Sketch the 1–3 main entities (e.g., "real estate: Properties, Showings, Buyers")
3. **Which features?** Tick a list — leads / meetings / tasks / calls / audio upload / WhatsApp / Cal.com webhook / AI website analysis. Default is "all" but it's good to confirm so the data model is right-sized.
4. **External integrations?**
   - Cal.com webhook → needs organizer-email mapping
   - Wassender WhatsApp → needs phone + token mapping per user
   - Whisper (audio transcription) → needs OpenAI key + Supabase Storage bucket
5. **AI features?** Default is the website-analysis pattern + (if calls enabled) call analysis + (if WhatsApp enabled) draft reply.

These answers shape the whole scaffold. Do not start writing files until they're confirmed. If the user has already provided enough context in the conversation, skim and confirm rather than re-asking.

### Step 2 — Plan the data model

Given the user's domain, sketch the Prisma schema. Every owned table follows the same pattern:
- `id` UUID primary key
- `ownerId` UUID FK → `profiles.id` with `onDelete: Cascade`
- `createdAt` / `updatedAt`
- Composite indexes on `(ownerId, ...)` for the common queries

Plus keep `webhook_events` for idempotency if any webhook is in play (Cal.com, Wassender, Stripe — anything signed).

Read [references/data-model.md](references/data-model.md) for the full pattern + RLS implications. Show the schema to the user before generating code.

### Step 3 — Run setup (mostly user actions, you guide)

Walk the user through the setup checklist in [references/setup-checklist.md](references/setup-checklist.md). This covers:
- Supabase project creation
- Database connection strings (the `&` URL-encoding gotcha)
- Pushing the Prisma schema
- Running the RLS policies SQL
- **Creating the private `call-audio` Storage bucket** (only if audio upload is enabled)
- Disabling email confirmation for local dev
- Anthropic API key (always)
- OpenAI API key (if audio upload enabled)
- GitHub repo + Vercel deploy
- **Disabling Vercel Deployment Protection** (or setting it to "Only Preview Deployments") — required for any inbound webhook
- Cal.com webhook (optional)
- Wassender signup + token + webhook URL (optional)

The user does the browser steps; you do the CLI steps (`gh repo create`, `vercel link`, `vercel env add`, etc.).

### Step 4 — Scaffold the codebase

Generate files in this order. Each builds on the previous:

1. **Project init** — Manually scaffold (don't use `create-next-app` if the folder name has uppercase letters; it rejects). Copy templates from [assets/](assets/).
2. **Hebrew RTL foundation** — `<html lang="he" dir="rtl">`, Heebo font via `next/font`, base layout with no-flash dark-mode init script
3. **shadcn/ui primitives** — Button, Input, Label, Card, Dialog, DropdownMenu, Select, Toast, Textarea, etc. Don't run `npx shadcn add` blind — copy from [assets/snippets/components/ui/](assets/snippets/components/ui/) which has RTL-corrected versions (logical properties `ms-` `me-` `start-` `end-` instead of `ml-` `mr-` `left-` `right-`)
4. **Supabase clients** — browser, server, middleware (read [references/auth.md](references/auth.md))
5. **Prisma + auth helper** — `getCurrentUser()` / `requireUser()`
6. **Domain pages** — list, detail, edit, create per entity
7. **Tasks** (if enabled) — read [references/tasks-and-calls.md](references/tasks-and-calls.md)
8. **Calls + AI analysis** (if enabled) — read [references/tasks-and-calls.md](references/tasks-and-calls.md)
9. **Audio upload + Whisper** (if enabled) — read [references/audio-transcription.md](references/audio-transcription.md)
10. **AI website analysis** (if enabled) — read [references/ai-analysis.md](references/ai-analysis.md)
11. **Cal.com webhook** (if enabled) — read [references/cal-webhook.md](references/cal-webhook.md)
12. **WhatsApp via Wassender** (if enabled) — read [references/whatsapp-wassender.md](references/whatsapp-wassender.md)
13. **Theme toggle** — read [references/theme-toggle.md](references/theme-toggle.md)
14. **Settings page** — profile edit + integration mapping (Cal.com organizer email, Wassender phone + token)

### Step 5 — Verify

- `npx prisma generate && npm run db:push` against real Supabase
- Apply [assets/templates/supabase-policies.template.sql](assets/templates/supabase-policies.template.sql) in Supabase SQL editor
- `npm run build` — every route should compile cleanly
- `npm run dev` — sign up, create one row of each main entity, log out, log in as a second user, verify they can't see the first user's rows (RLS smoke test)
- If WhatsApp enabled: send an outbound message + use Wassender's "Webhook Simulator" to verify the webhook handler returns 200

### Step 6 — Deploy

Walk the user through the Vercel + GitHub flow in [references/setup-checklist.md](references/setup-checklist.md) (Phase 6). Vercel auto-deploys on every push to `main` after this.

**Critical:** disable Vercel Deployment Protection (Settings → Deployment Protection → Vercel Authentication → toggle off "Require Log In") if the app uses any inbound webhook. Otherwise Wassender / Cal.com / Stripe / etc. get 401 from Vercel's auth layer before reaching your code.

---

## Reference docs (read on demand)

- [references/architecture.md](references/architecture.md) — Stack rationale, folder layout, why Tailwind v3 (not v4), why Prisma vs raw Supabase JS, why RLS as defense-in-depth even with Prisma
- [references/setup-checklist.md](references/setup-checklist.md) — Step-by-step Supabase + Anthropic + OpenAI + GitHub + Vercel + Cal.com + Wassender setup. The single most-referenced doc.
- [references/customization.md](references/customization.md) — What to change per project (data model, theme color, business logic) vs what to keep verbatim (auth, RLS pattern, deployment, env structure)
- [references/data-model.md](references/data-model.md) — Prisma schema conventions + the RLS-with-Prisma defense-in-depth pattern
- [references/auth.md](references/auth.md) — Supabase auth flow: server/client/middleware split, the `auth.users → profiles` trigger, the `getCurrentUser()` / `requireUser()` helpers
- [references/ai-analysis.md](references/ai-analysis.md) — Claude `web_fetch_20260209` + custom-tool pattern. Includes the tool_choice gotcha
- [references/tasks-and-calls.md](references/tasks-and-calls.md) — Tasks CRUD + Calls module + AI call analysis (Claude tool_use on transcript) + one-click auto-task creation from analysis
- [references/audio-transcription.md](references/audio-transcription.md) — Supabase Storage upload pattern (with per-user folder RLS) + OpenAI Whisper transcription + auto-trigger Claude analysis pipeline
- [references/cal-webhook.md](references/cal-webhook.md) — HMAC verification + `webhook_events` idempotency table + organizer-email routing
- [references/whatsapp-wassender.md](references/whatsapp-wassender.md) — Wassender outbound API + inbound webhook (raw shared secret, NOT HMAC) + WhatsApp Multi-Device payload parsing + per-user routing via `sessionId === Profile.wassenderToken` + AI draft reply button
- [references/hebrew-rtl.md](references/hebrew-rtl.md) — RTL conventions
- [references/theme-toggle.md](references/theme-toggle.md) — Class-based dark mode without flash

## Templates and snippets (copy directly)

- [assets/templates/](assets/templates/) — package.json, tsconfig, tailwind.config, prisma schema (with all 5 sessions' entities), RLS SQL, env example, root layout, middleware
- [assets/snippets/](assets/snippets/) — Library code, route handlers, and components for every feature

---

## Critical patterns (don't get these wrong)

These bit during the original Leadero build and the 4 follow-up sessions. Future-you will thank present-you for reading these.

### 1. Prisma reads `.env`, not `.env.local`
The Next.js convention is `.env.local`, but Prisma CLI reads plain `.env`. Without a fix, every `prisma db push` fails with "DIRECT_URL not found." **Fix**: install `dotenv-cli` and update `package.json` scripts:
```json
"db:push": "dotenv -e .env.local -- prisma db push"
```

### 2. Database password URL-encoding
If the user's Supabase database password contains `&`, `@`, `#`, `?`, `:`, `/`, etc., the connection string will break silently. **Fix**: URL-encode the password (`&` → `%26`, `@` → `%40`, etc.) OR ask them to reset to an alphanumeric password.

### 3. RLS + Prisma = defense in depth, not enforcement
Prisma uses the service role key by default, which **bypasses RLS**. This means:
- Always filter by `ownerId === currentUser.id` in app code
- RLS is the safety net for when app code has a bug
- Never trust the client to send the right `ownerId` — always inject it server-side from `getCurrentUser()`

### 4. Cal.com tool_choice gotcha
With Claude's `web_fetch` server tool, **don't** force `tool_choice` to your custom analysis tool. The model can't call `web_fetch` first if forced. **Use `tool_choice: "auto"`** + explicit prompt instructions ("first call web_fetch, then call submit_analysis").

### 5. Vercel rejects vulnerable Next.js
If you scaffold with an older Next.js version, Vercel will reject the deploy with "Vulnerable version of Next.js detected." Always pin to `next@latest` (or the latest minor) in `package.json` to avoid a surprise mid-deploy.

### 6. `create-next-app` rejects uppercase folder names
"name can no longer contain capital letters." Either init the folder lowercase, or scaffold the `package.json` manually with a lowercase `name` field.

### 7. Email/URL display in RTL
Hebrew is RTL but emails and URLs must render LTR. Wrap them in `<bdi dir="ltr">` inside Hebrew text. Without this, "user@example.com" inside an RTL paragraph renders as "moc.elpmaxe@user" visually.

### 8. Cal.com webhook = empty `webhook_events` table is informative
If the table has 0 rows after a real booking, the request never reached your handler — either signature mismatch (401, returns before insert), wrong URL, or the webhook is disabled. If the table has rows but no lead created, check `error` column.

### 9. Vercel Deployment Protection blocks ALL inbound webhooks
By default, new Vercel projects have "Vercel Authentication" enabled with "Standard Protection" — which protects every URL except custom domains. Since you're on `*.vercel.app`, your webhook URL is gated behind Vercel SSO. The auth challenge returns 401, which third-party webhook senders interpret as "wrong secret" but it's actually a redirect to login. **Fix**: Settings → Deployment Protection → toggle off "Require Log In" OR add a custom domain. Without this, no webhook will ever work in production.

### 10. Wassender uses a raw shared secret, not HMAC
The `X-Webhook-Signature` header contains the **literal secret value**, not an HMAC of the body. Their own verification example confirms it: `if (req.headers['x-webhook-signature'] !== env.WEBHOOK_SECRET) return 403`. **Verify with constant-time string equality** (`timingSafeEqual`), not `createHmac()`. The skill's snippet handles both for forward-compat.

### 11. Wassender's payload is raw WhatsApp Multi-Device, not a friendly schema
The real payload looks like:
```json
{
  "event": "messages.received",
  "sessionId": "<token>",
  "data": {
    "messages": {
      "key": { "fromMe": false, "cleanedSenderPn": "13075337860", "remoteJid": "...@lid" },
      "message": { "conversation": "Hi test" }
    }
  }
}
```
Body lives at `data.messages.message.conversation` (or `extendedTextMessage.text`, `imageMessage.caption`, etc.). Sender phone at `data.messages.key.cleanedSenderPn`. Route the event to the right user by matching `event.sessionId === Profile.wassenderToken`.

### 12. Dialog forms with `useActionState` — depend on `[state]`, not `[state.ok]`
When a server action returns `{ ok: true }` twice in a row, `state.ok` stays the boolean `true` and React's `useEffect` doesn't fire — so the dialog won't close on the second submit. **Depend on the whole `state` object** (a new reference every action call) so the effect always runs:
```tsx
useEffect(() => {
  if (state.ok) onOpenChange(false);
}, [state, onOpenChange]); // [state] not [state.ok]
```

### 13. Whisper accepts video containers (MP4 / WebM)
Whisper extracts the audio track from video files. **Do not** filter out `video/mp4` or `video/webm` in your file picker `accept` attribute. The 25 MB limit still applies.

### 14. Use `--force` when env vars or runtime config change
Vercel's build cache silently serves stale code when only env vars or runtime config change. After updating an env var, run `vercel deploy --prod --force` (not just push) to bypass the cache.

### 15. Per-user secrets live on `Profile`, not in env
Wassender's Personal Access Token is per-user — different users have different tokens. Store it on `Profile.wassenderToken`, NOT in `WASSENDER_TOKEN` env. The webhook secret IS shared and lives in env. This pattern generalizes to any per-tenant external integration (Stripe Connect, Twilio subaccounts, etc.).

---

## Anti-patterns to refuse

- **Storing per-user API keys in env** — they're per-user. Put them on `Profile`, encrypt at rest if sensitive.
- **Storing system secrets in code or committing `.env.local`** — `.gitignore` `.env*.local` from day one
- **Using the service role key in any `'use client'` file** — only `NEXT_PUBLIC_*` keys are safe in client code
- **Skipping RLS because "Prisma already filters"** — Prisma is the user-friendly path; RLS is the safety net
- **Hard-coding Hebrew strings in components** — always pull from `i18n/he.ts`
- **Forgetting `dotenv-cli` for Prisma scripts** — every developer who clones the repo will hit the same error
- **Using `cheerio` + manual fetch for AI URL analysis** — Claude's `web_fetch` server tool sidesteps bot blocking and is one less dependency
- **HMAC verification on Wassender webhooks** — they don't sign with HMAC. Use raw equality.
- **Leaving Vercel Deployment Protection on with webhooks** — silent 401, hours of debugging.

---

## What's intentionally NOT included

This skill is for V1 single-user-per-account SaaS. If the user wants:
- **Multi-user organizations / teams** — needs a different schema (organization → members → resources)
- **Custom pipeline stages** — the LeadStatus enum is hardcoded; would need a polymorphic table
- **Email sending** — add Resend or Postmark separately
- **Stripe billing** — separate concern; layer on top
- **i18n with multiple languages** — `i18n/he.ts` is single-locale; would need `next-intl` or similar
- **Telephony (real inbound/outbound calls)** — calls are manually logged
- **WhatsApp broadcast / template messages** — only conversational replies via Wassender

These are good follow-ups; just acknowledge them as out of scope when the user asks.
