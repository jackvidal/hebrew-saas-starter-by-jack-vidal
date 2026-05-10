# Hebrew SaaS Starter — by Jack Vidal

A Claude Code / Claude Agent skill for scaffolding a Hebrew-first, RTL, full-stack SaaS web app on **Next.js 16 + TypeScript + Tailwind + shadcn/ui + Supabase + Prisma + Anthropic Claude + Vercel**.

Distilled from the JackCRM build. Every pattern in here was shipped to production and survived real users, real Cal.com webhooks, and real AI website analyses.

## What this skill scaffolds

- **Hebrew RTL UI** — `<html dir="rtl">`, Heebo font, logical properties, `<bdi>` for mixed-LTR content
- **Supabase auth** — email + password, session cookies via middleware
- **Per-user data isolation** — RLS policies on every owned table, defense-in-depth with app-side filtering
- **Prisma ORM** — type-safe data layer, migrations
- **AI features** — Anthropic Claude with `web_fetch_20260209` server tool (no cheerio, no bot-blocking issues)
- **Cal.com webhook integration** — HMAC verification + idempotency table + organizer-email routing
- **Dark mode toggle** — class-based, persisted to localStorage, no white flash on first paint
- **Full Vercel deployment recipe** — including the gotchas (uppercase folder names, vulnerable Next.js, password URL-encoding)

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
- "Duplicate the JackCRM template for [new domain]"
- "I want a Hebrew SaaS dashboard with auth"

## Structure

```
hebrew-saas-starter-by-jack-vidal/
├── SKILL.md                    # Entry point — workflow, triggers, anti-patterns
├── README.md                   # You are here
├── references/                 # Read on-demand
│   ├── architecture.md         # Stack rationale + folder layout
│   ├── setup-checklist.md      # Supabase + GitHub + Vercel + Cal.com setup
│   ├── customization.md        # What to change per project vs keep
│   ├── data-model.md           # Prisma + RLS recipe
│   ├── auth.md                 # Supabase auth flow
│   ├── ai-analysis.md          # Claude web_fetch + custom tool pattern
│   ├── cal-webhook.md          # HMAC + idempotency + email routing
│   ├── hebrew-rtl.md           # RTL conventions
│   └── theme-toggle.md         # Dark mode without flash
└── assets/
    ├── templates/              # Copy verbatim, customize names
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
    └── snippets/               # Library code — copy into src/lib/
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

These are good follow-ups but warrant their own skills.

## Critical patterns the skill captures

These bit during the original build. Reading them once saves an hour per future project:

1. **Prisma reads `.env`, not `.env.local`** — fix with `dotenv-cli` in scripts
2. **Database password URL-encoding** — `&` → `%26`, etc.
3. **RLS + Prisma = defense in depth** — Prisma bypasses RLS via service role
4. **Cal.com `tool_choice` gotcha** — forcing the analysis tool blocks `web_fetch`
5. **Vercel rejects vulnerable Next.js** — pin to `next@latest`
6. **`create-next-app` rejects uppercase folders** — manually scaffold `package.json`
7. **Email/URL display in RTL** — wrap in `<bdi>` or `dir="ltr"`
8. **Cal.com webhook empty events table** — diagnostic checklist included

## Origin

Built during a single session by Claude Code with Jack Vidal, going from empty folder → fully deployed Hebrew CRM with AI analysis and Cal.com integration. The skill exists so the same path takes ~10 minutes the next time.

## License

MIT — use freely.

## Author

[Jack Vidal](https://github.com/jackvidal) — `jack@jackvidal.com`
