---
name: hebrew-saas-starter-by-jack-vidal
description: Scaffold a complete Hebrew-first RTL SaaS web app with Next.js (App Router) + TypeScript + Tailwind + shadcn/ui, Supabase auth + Postgres + Row Level Security, Prisma ORM, Anthropic Claude (web_fetch) for AI features, optional Cal.com webhook automation, dark mode toggle, and Vercel deployment. Use this skill whenever the user wants to build a new Hebrew/RTL SaaS or admin app, scaffold a CRM/booking/dashboard product in Hebrew, create a per-user multi-tenant app with auth and RLS, or duplicate the JackCRM template for a new domain. Trigger generously — even when the user only mentions "Hebrew web app", "RTL dashboard", "CRM in Hebrew", "Supabase + Next.js project", or "deploy a SaaS to Vercel", load this skill, because the patterns here (RLS recipe, signed-webhook handler, cached-system-prompt AI tool, no-flash dark mode, RTL `<bdi>` for emails) are non-obvious and easy to get wrong from scratch.
---

# Hebrew SaaS Starter — by Jack Vidal

A battle-tested recipe for building a Hebrew-first, RTL, full-stack SaaS web app on Next.js + Supabase + Vercel. Distilled from the JackCRM project — every pattern here was shipped to production and survived real bookings, real users, and real Cal.com webhooks.

## When to use this skill

Trigger this skill when the user wants any of:
- A new Hebrew/RTL SaaS, dashboard, or admin app
- A CRM, booking system, or project tool with Hebrew UI
- A Next.js app with Supabase auth + Postgres + RLS
- An app where each user sees only their own data
- An app that needs Cal.com webhook integration
- An app that calls Claude for AI analysis of URLs
- A duplicate of JackCRM for a new domain (real estate, coaching, agencies, etc.)

## What this skill gives you

- **Tech stack rationale** and version pins that work together
- **Step-by-step setup** for Supabase, GitHub, Vercel, Cal.com (the order matters — wrong order causes preventable failures)
- **Templates** for the foundational files: Prisma schema, RLS policies, env file, root layout, middleware, auth helpers, AI lib, webhook handler
- **Customization guide** — exactly what to change per project vs what to keep
- **Recipe-level docs** for the patterns that are easy to get wrong: RLS, signed webhooks, web_fetch + tool_use, RTL with mixed Latin content, dark mode without flash

---

## The workflow

When invoked, follow this sequence. Don't skip ahead — each step depends on the previous.

### Step 1 — Confirm intent (always)

Ask 4 questions before writing any code:

1. **Project name?** (Lowercase, kebab-case, e.g., `realestate-crm`. NPM rejects capitals.)
2. **Domain?** What problem does it solve? Sketch the 1–3 main entities (e.g., "real estate: Properties, Showings, Buyers")
3. **Cal.com integration needed?** Yes/no. Big architectural shift if yes (webhook handler, organizer-email mapping in profiles table).
4. **AI feature needed?** Yes/no. Default is the website-analysis pattern, but it can be adapted to any "fetch + analyze + structured-output" task.

These answers shape the whole scaffold. Do not start writing files until they're confirmed. If the user has already provided enough context in the conversation, skim and confirm rather than re-asking.

### Step 2 — Plan the data model

Given the user's domain, sketch the Prisma schema. Every owned table follows the same pattern:
- `id` UUID primary key
- `ownerId` UUID FK → `profiles.id` with `onDelete: Cascade`
- `createdAt` / `updatedAt`
- Composite indexes on `(ownerId, ...)` for the common queries

Also keep the `webhook_events` table for idempotency if Cal.com (or any other webhook) is in play. Read [references/data-model.md](references/data-model.md) for the full pattern + RLS implications. Show the schema to the user before generating code.

### Step 3 — Run setup (mostly user actions, you guide)

Walk the user through the setup checklist in [references/setup-checklist.md](references/setup-checklist.md). This covers:
- Supabase project creation
- Database connection strings (the `&` URL-encoding gotcha)
- Pushing the Prisma schema
- Running the RLS policies SQL
- Disabling email confirmation for local dev
- Anthropic API key
- GitHub repo + Vercel deploy
- Cal.com webhook (optional)

The user does the browser steps; you do the CLI steps (`gh repo create`, `vercel link`, `vercel env add`, etc.).

### Step 4 — Scaffold the codebase

Generate files in this order. Each builds on the previous:

1. **Project init** — Manually scaffold (don't use `create-next-app` if the folder name has uppercase letters; it rejects). Copy templates from [assets/](assets/).
2. **Hebrew RTL foundation** — `<html lang="he" dir="rtl">`, Heebo font via `next/font`, base layout with no-flash dark-mode init script
3. **shadcn/ui primitives** — Button, Input, Label, Card, Dialog, DropdownMenu, Select, Toast, etc. Don't run `npx shadcn add` blind — copy from [assets/snippets/ui/](assets/snippets/ui/) which has RTL-corrected versions (logical properties `ms-` `me-` `start-` `end-` instead of `ml-` `mr-` `left-` `right-`)
4. **Supabase clients** — browser, server, middleware (read [references/auth.md](references/auth.md))
5. **Prisma + auth helper** — `getCurrentUser()` / `requireUser()`
6. **Domain pages** — list, detail, edit, create per entity
7. **AI feature** (if needed) — read [references/ai-analysis.md](references/ai-analysis.md)
8. **Cal.com webhook** (if needed) — read [references/cal-webhook.md](references/cal-webhook.md)
9. **Theme toggle** — read [references/theme-toggle.md](references/theme-toggle.md)
10. **Settings page** — profile edit + integration mapping (Cal.com organizer email)

### Step 5 — Verify

- `npx prisma generate && npm run db:push` against real Supabase
- Apply [assets/templates/supabase-policies.template.sql](assets/templates/supabase-policies.template.sql) in Supabase SQL editor
- `npm run build` — every route should compile cleanly
- `npm run dev` — sign up, create one row of each main entity, log out, log in as a second user, verify they can't see the first user's rows (RLS smoke test)

### Step 6 — Deploy

Walk the user through the Vercel + GitHub flow in [references/setup-checklist.md](references/setup-checklist.md) (Phase 6). Vercel auto-deploys on every push to `main` after this.

---

## Reference docs (read on demand)

- [references/architecture.md](references/architecture.md) — Stack rationale, folder layout, why Tailwind v3 (not v4), why Prisma vs raw Supabase JS, why RLS as defense-in-depth even with Prisma
- [references/setup-checklist.md](references/setup-checklist.md) — Step-by-step Supabase + Anthropic + GitHub + Vercel + Cal.com setup. The single most-referenced doc.
- [references/customization.md](references/customization.md) — What to change per project (data model, theme color, business logic) vs what to keep verbatim (auth, RLS pattern, deployment, env structure)
- [references/data-model.md](references/data-model.md) — Prisma schema conventions + the RLS-with-Prisma defense-in-depth pattern
- [references/auth.md](references/auth.md) — Supabase auth flow: server/client/middleware split, the `auth.users → profiles` trigger, the `getCurrentUser()` / `requireUser()` helpers
- [references/ai-analysis.md](references/ai-analysis.md) — Claude `web_fetch_20260209` + custom-tool pattern. Includes the tool_choice gotcha (forcing the analysis tool blocks web_fetch — must use `auto` with explicit prompt instructions)
- [references/cal-webhook.md](references/cal-webhook.md) — HMAC verification + `webhook_events` idempotency table + organizer-email routing. The pattern works for any signed webhook (Stripe, Shopify, etc.) with minor adjustments
- [references/hebrew-rtl.md](references/hebrew-rtl.md) — RTL conventions: logical properties, `<bdi>` for emails/URLs, Hebrew dates, mixed-LTR-content cells, the `i18n/he.ts` single-source-of-truth pattern
- [references/theme-toggle.md](references/theme-toggle.md) — Class-based dark mode + the inline `<head>` script that prevents the white flash on first paint

## Templates and snippets (copy directly)

- [assets/templates/](assets/templates/) — package.json, tsconfig, tailwind.config, prisma schema, RLS SQL, env example, root layout, middleware
- [assets/snippets/](assets/snippets/) — Key library files (auth.ts, prisma.ts, supabase clients, AI lib, webhook handler, theme toggle, RTL-aware shadcn components)
- [assets/i18n/he.ts](assets/i18n/he.ts) — Hebrew strings as a starting point — replace domain strings with the new project's terminology

---

## Critical patterns (don't get these wrong)

These are the ones that bit during the original JackCRM build. Future-you will thank present-you for reading these.

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

---

## Anti-patterns to refuse

- **Storing API keys in code or committing `.env.local`** — `.gitignore` `.env*.local` from day one
- **Using the service role key in any `'use client'` file** — only `NEXT_PUBLIC_*` keys are safe in client code
- **Skipping RLS because "Prisma already filters"** — Prisma is the user-friendly path; RLS is the safety net
- **Hard-coding Hebrew strings in components** — always pull from `i18n/he.ts`
- **Forgetting `dotenv-cli` for Prisma scripts** — every developer who clones the repo will hit the same error
- **Using `cheerio` + manual fetch for AI URL analysis** — Claude's `web_fetch` server tool sidesteps bot blocking and is one less dependency

---

## What's intentionally NOT included

This skill is for V1 single-user-per-account SaaS. If the user wants:
- **Multi-user organizations / teams** — needs a different schema (organization → members → resources)
- **Custom pipeline stages** — the LeadStatus enum is hardcoded; would need a polymorphic table
- **Email sending** — add Resend or Postmark separately
- **Stripe billing** — separate concern; layer on top
- **i18n with multiple languages** — `i18n/he.ts` is single-locale; would need `next-intl` or similar

These are good follow-ups; just acknowledge them as out of scope when the user asks.
