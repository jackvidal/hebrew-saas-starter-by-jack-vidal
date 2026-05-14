# Hebrew SaaS Starter — by Jack Vidal

A Claude Code / Claude Agent skill for scaffolding a Hebrew-first, RTL, full-stack SaaS web app on **Next.js 16 + TypeScript + Tailwind + shadcn/ui + Supabase + Prisma + Anthropic Claude + OpenAI Whisper + Vercel**.

Distilled from the full Leadero (formerly JackCRM) build — a 5-session evolution from a basic CRM to a Hebrew-first product with AI website analysis, AI call analysis, audio transcription, and WhatsApp integration with AI draft replies. Every pattern in here was shipped to production and survived real users, real Cal.com webhooks, real Wassender messages, and real AI inferences.

## What this skill scaffolds

### Foundation
- **Hebrew RTL UI** — `<html dir="rtl">`, Heebo font, logical properties, `<bdi>` for mixed-LTR content
- **Supabase auth** — email + password, session cookies via middleware
- **Per-user data isolation** — RLS policies on every owned table, defense-in-depth with app-side filtering
- **Prisma ORM** — type-safe data layer, migrations
- **Dark mode toggle** — class-based, persisted to localStorage, no white flash on first paint
- **Full Vercel deployment recipe** — including the gotchas (uppercase folder names, vulnerable Next.js, password URL-encoding, Deployment Protection blocking webhooks)

### Domain features (all optional, mix and match)
- **Leads + notes + AI website analysis** — Claude `web_fetch` + custom tool for structured Hebrew output
- **Meetings** — with status auto-updating the lead pipeline
- **Tasks** — full CRUD with priority/due-date/status filters
- **Calls** — manual call logging + AI call analysis (sentiment, commitments, next steps, red flags) + one-click "create tasks from analysis"
- **Audio upload + Whisper transcription** — drag a recording (MP3/WAV/M4A/MP4/WebM, ≤25MB) into Supabase Storage → Whisper transcribes in Hebrew → Claude auto-runs analysis. All in one flow.
- **Cal.com webhook** — HMAC-verified, idempotent, with organizer-email routing
- **WhatsApp via Wassender** — outbound send + inbound webhook + per-conversation AI draft reply button. Routes by `sessionId` matching `Profile.wassenderToken`.

## Install

### Option A: install via the skills CLI (recommended)

```sh
npx skills add https://github.com/jackvidal/hebrew-saas-starter-by-jack-vidal --skill hebrew-saas-starter-by-jack-vidal
```

This installs to your Claude Code skills directory and makes it available in any conversation.

### Option B: clone manually

```sh
git clone https://github.com/jackvidal/hebrew-saas-starter-by-jack-vidal ~/.claude/skills/hebrew-saas-starter-by-jack-vidal
```

## Use

In any Claude Code conversation, invoke the skill:

```
/hebrew-saas-starter-by-jack-vidal
```

Or just describe what you want — the skill auto-triggers on phrases like:
- "Build me a Hebrew CRM for X"
- "Scaffold a Next.js + Supabase project with RTL UI"
- "Duplicate the Leadero template for [new domain]"
- "I want a Hebrew SaaS dashboard with auth + WhatsApp"
- "Add audio transcription to my app"
- "Connect WhatsApp to my CRM via Wassender"

## Structure

```
hebrew-saas-starter-by-jack-vidal/
├── SKILL.md                          # Entry point — workflow, triggers, anti-patterns
├── README.md                         # You are here
├── references/                       # Read on-demand
│   ├── architecture.md               # Stack rationale + folder layout
│   ├── setup-checklist.md            # Supabase + GitHub + Vercel + Cal.com + Wassender setup
│   ├── customization.md              # What to change per project vs keep
│   ├── data-model.md                 # Prisma + RLS recipe
│   ├── auth.md                       # Supabase auth flow
│   ├── ai-analysis.md                # Claude web_fetch + custom tool pattern (websites)
│   ├── tasks-and-calls.md            # Tasks CRUD + call logging + AI call analysis
│   ├── audio-transcription.md        # Supabase Storage upload + Whisper + auto-trigger AI
│   ├── cal-webhook.md                # HMAC + idempotency + email routing
│   ├── whatsapp-wassender.md         # Wassender outbound + inbound webhook + AI draft reply
│   ├── hebrew-rtl.md                 # RTL conventions
│   └── theme-toggle.md               # Dark mode without flash
└── assets/
    ├── templates/                    # Copy verbatim, customize names
    │   ├── package.json.template
    │   ├── tsconfig.json.template
    │   ├── tailwind.config.ts.template
    │   ├── globals.css.template
    │   ├── env.example.template
    │   ├── gitignore.template
    │   ├── prisma-schema.template.prisma
    │   ├── supabase-policies.template.sql
    │   ├── root-layout.template.tsx
    │   └── middleware.template.ts
    └── snippets/                     # Library code — copy into src/lib/
        ├── lib/
        │   ├── auth.ts
        │   ├── prisma.ts
        │   ├── utils.ts
        │   ├── supabase/{client,server,middleware}.ts
        │   ├── ai/analyze-website.ts
        │   └── webhooks/cal.ts
        ├── components/theme-toggle.tsx
        └── i18n/he.ts
```

## What's intentionally NOT included

This is a V1 single-user-per-account starter. Out of scope:
- Teams / multi-user organizations
- Email sending (add Resend/Postmark separately)
- Stripe billing
- Multi-language support (add `next-intl`)
- Telephony (Twilio/Vonage) — calls are manually logged
- Outbound WhatsApp marketing / template messages — only conversational replies

These are good follow-ups but warrant their own skills.

## Critical patterns the skill captures

These bit during the original build and the 4 follow-up sessions. Reading them once saves an hour per future project:

1. **Prisma reads `.env`, not `.env.local`** — fix with `dotenv-cli` in scripts
2. **Database password URL-encoding** — `&` → `%26`, etc.
3. **RLS + Prisma = defense in depth** — Prisma bypasses RLS via service role
4. **Cal.com `tool_choice` gotcha** — forcing the analysis tool blocks `web_fetch`
5. **Vercel rejects vulnerable Next.js** — pin to `next@latest`
6. **`create-next-app` rejects uppercase folders** — manually scaffold `package.json`
7. **Email/URL display in RTL** — wrap in `<bdi>` or `dir="ltr"`
8. **Cal.com webhook empty events table** — diagnostic checklist included
9. **Vercel Deployment Protection blocks webhooks** — even production. Disable or set "Only Preview Deployments" before any third-party webhook will reach you.
10. **Wassender uses raw shared secret, not HMAC** — `X-Webhook-Signature` header contains the secret literally; verify with constant-time string equality, not `createHmac()`.
11. **Wassender payload is raw WhatsApp Multi-Device** — text body lives at `data.messages.message.conversation`; sender phone at `data.messages.key.cleanedSenderPn`; LID-style addressing (`@lid` instead of `@s.whatsapp.net`).
12. **Dialog forms with `useActionState` need `[state]` not `[state.ok]` deps** — when state.ok stays true between submissions, React sees no change and the dialog won't close on the second submit.
13. **Whisper accepts video containers** — MP4/WebM upload works because Whisper extracts the audio track. Don't reject video MIME types in the file picker.
14. **Use `--force` on `vercel deploy --prod`** — Vercel's build cache silently serves stale code when only env vars or runtime config change.

## Origin

Built across 5 conversation sessions by Claude Code with Jack Vidal:
1. Empty folder → fully deployed Hebrew CRM with leads, AI website analysis, Cal.com integration
2. Tasks module
3. Call logging + AI call analysis with auto-task creation
4. Audio upload + Whisper transcription with auto-trigger AI
5. WhatsApp via Wassender (outbound + inbound webhook) + AI draft reply button

The skill exists so the same path takes ~10 minutes the next time.

## License

MIT — use freely.

## Author

[Jack Vidal](https://github.com/jackvidal) — `jack@jackvidal.com`
