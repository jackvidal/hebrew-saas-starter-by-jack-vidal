# Architecture

## Stack at a glance

```
┌─ Browser (RTL Hebrew UI) ─────────────────────────────────────────┐
│  Next.js 16 App Router + React 19 + Tailwind v3 + shadcn/ui       │
└──────┬─────────────────────────────────────────┬──────────────────┘
       │ Server Actions / fetch                  │ Supabase JS (auth)
       ▼                                         ▼
┌─ Next.js Route Handlers ─────┐         ┌─ Supabase Auth ───────────┐
│  /api/*, /api/webhooks/*     │         │  email + password sessions │
└──┬───────┬─────────┬─────────┘         └──────────┬────────────────┘
   │       │         │                              │
   │       │         │ Anthropic SDK                │
   │       │         ▼                              │
   │       │  ┌──────────────────┐                  │
   │       │  │ Claude Sonnet 4.6│ + web_fetch tool │
   │       │  └──────────────────┘                  │
   │       │                                        │
   ▼       ▼                                        ▼
┌─ Supabase Postgres ──────────────────────────────────────────────┐
│  profiles · domain_table · domain_table_2 · webhook_events        │
│  All owned tables: RLS enforced via auth.uid() = owner_id         │
└──────────────────────────────────────────────────────────────────┘
                  ▲
                  │ POST /api/webhooks/<provider> (HMAC verified)
                  │
        ┌─────────┴─────────┐
        │  Cal.com / etc.   │
        └───────────────────┘
```

## Why this stack

| Choice | Why this and not alternatives |
|---|---|
| **Next.js 16 App Router + TS** | One deployable, SSR for correct RTL on first paint, Server Actions remove form boilerplate. Pin to `next@latest` to avoid Vercel vulnerability rejections. |
| **Tailwind v3 (not v4)** | shadcn/ui is solid on v3; v4 has compat edges. Logical properties (`ms-*`, `me-*`, `start-*`, `end-*`) make RTL essentially free. |
| **shadcn/ui (own-the-code)** | Copy the component into your repo; patch RTL quirks directly when needed. No npm dependency to fight. |
| **Heebo via `next/font`** | Built for Hebrew + Latin, self-hosted, no FOUT. |
| **Supabase Postgres** | DB + Auth + RLS in one product. RLS is the cleanest "users see only their data" enforcement. |
| **Prisma ORM** | Type-safe queries, easy migrations. Use Supabase JS only for auth; use Prisma for all data reads/writes. |
| **Supabase Auth (email + password)** | Free, session cookies work seamlessly with Next.js middleware, RLS policies reference `auth.uid()` directly. |
| **Anthropic Claude Sonnet 4.6** | Best price/quality. Default to `web_fetch_20260209` server tool (Anthropic fetches the URL — no bot-blocking, no cheerio dep). |
| **Zod** | Validate every API input, every webhook payload. |
| **Vercel + Supabase free tier** | Sufficient for V1 traffic. Vercel handles webhook ingress with no infra config. |

## Folder layout

```
project-name/
├── .env.local                         # secrets (gitignored)
├── .env.example                       # template (committed)
├── .gitignore                         # MUST include .env*.local
├── README.md
├── package.json                       # name MUST be lowercase
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.mjs
├── components.json                    # shadcn config
├── prisma/
│   ├── schema.prisma                  # data model
│   └── migrations/
├── public/
├── supabase/
│   └── policies.sql                   # RLS + auto-profile trigger
└── src/
    ├── app/
    │   ├── layout.tsx                 # <html lang="he" dir="rtl"> + theme init
    │   ├── globals.css                # shadcn variables (light+dark)
    │   ├── page.tsx                   # public landing (redirects logged-in users)
    │   ├── (auth)/
    │   │   ├── layout.tsx
    │   │   ├── actions.ts             # login/signup/logout server actions
    │   │   ├── login/page.tsx
    │   │   └── signup/page.tsx
    │   ├── (dashboard)/
    │   │   ├── layout.tsx             # sidebar + topbar
    │   │   ├── dashboard/page.tsx     # home with metrics
    │   │   ├── <entity>/              # one folder per main entity
    │   │   │   ├── page.tsx           # list
    │   │   │   ├── actions.ts         # server actions
    │   │   │   ├── new/page.tsx       # create
    │   │   │   └── [id]/
    │   │   │       ├── page.tsx       # detail
    │   │   │       └── edit/page.tsx
    │   │   └── settings/page.tsx
    │   └── api/
    │       ├── <entity>/[id]/<feature>/route.ts
    │       └── webhooks/<provider>/route.ts
    ├── components/
    │   ├── ui/                        # shadcn primitives (RTL-aware)
    │   ├── layout/                    # sidebar, topbar, theme-toggle
    │   ├── <entity>/                  # entity-specific components
    │   └── analysis/                  # AI features
    ├── lib/
    │   ├── supabase/
    │   │   ├── client.ts              # browser
    │   │   ├── server.ts              # server (cookies)
    │   │   └── middleware.ts          # session refresh + auth gate helper
    │   ├── prisma.ts                  # singleton client
    │   ├── ai/
    │   │   ├── analyze-website.ts     # Claude web_fetch wrapper
    │   │   └── prompts.ts             # cached system prompt + tool schema
    │   ├── webhooks/
    │   │   └── <provider>.ts          # HMAC verify
    │   ├── auth.ts                    # getCurrentUser / requireUser
    │   └── utils.ts                   # cn, Hebrew dates
    ├── i18n/
    │   └── he.ts                      # ALL Hebrew strings (single source)
    ├── types/
    ├── schemas/                       # Zod schemas (shared client+server)
    ├── hooks/
    │   └── use-toast.ts
    └── middleware.ts                  # auth gate via supabase/middleware
```

## Key architectural decisions

### Why Prisma + Supabase JS together (not just one)
- **Supabase JS** for auth only (`signUp`, `signInWithPassword`, session cookies, RLS-aware queries)
- **Prisma** for everything else (data CRUD, transactions, type safety)

Prisma uses the service role key by default which **bypasses RLS**. So:
- Always filter Prisma queries by `ownerId === currentUser.id` in app code
- RLS is the safety net: catches bugs where you forgot the filter
- Never trust `ownerId` from client input — inject from `getCurrentUser()` server-side

### Why `(auth)` and `(dashboard)` route groups
Route groups (parentheses) don't add URL segments. So:
- `app/page.tsx` → `/`
- `app/(auth)/login/page.tsx` → `/login`
- `app/(dashboard)/dashboard/page.tsx` → `/dashboard` (the explicit subroute is needed; `(dashboard)/page.tsx` would conflict with `app/page.tsx`)

This lets you share a layout (`(auth)/layout.tsx` for the centered card UI; `(dashboard)/layout.tsx` for sidebar+topbar) without leaking it into URLs.

### Why all UI strings in `i18n/he.ts`
- Single source of truth — when copy needs to change, you don't grep across 40 files
- Type-safe key access (`as const`)
- Trivial to swap to multi-locale later (replace with `next-intl`)

### Why webhooks live outside the auth gate
The middleware `matcher` in `src/middleware.ts` excludes `/api/webhooks/*` because:
- Cal.com / Stripe / etc. don't have a Supabase session
- Auth is handled by HMAC signature verification instead
- We INSERT into `webhook_events` for idempotency, then process

### Why no cheerio / manual fetch in `lib/ai/`
Claude's `web_fetch_20260209` server tool fetches the URL on Anthropic's infrastructure. This:
- Sidesteps bot-blocking (Vercel data-center IPs get blocked; Anthropic's don't)
- Eliminates cheerio dep + 80 lines of HTML parsing
- Keeps the AI lib to one file

See [ai-analysis.md](ai-analysis.md) for the full pattern + the `tool_choice` gotcha.
