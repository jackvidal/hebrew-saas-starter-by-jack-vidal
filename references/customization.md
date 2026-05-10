# Customization Guide — what changes per project, what stays

Use this as a checklist when adapting the JackCRM template to a new domain (real estate, coaching, agencies, fitness, etc.).

## What ALWAYS stays the same

These pieces are domain-agnostic. Copy them verbatim from the template:

| Area | Files |
|---|---|
| Auth flow | `src/app/(auth)/`, `src/lib/auth.ts`, `src/lib/supabase/*`, `src/middleware.ts` |
| RLS pattern | The shape of `supabase/policies.sql` (per-table policies + auth-trigger). Replace table names but keep the structure. |
| Profiles table | `Profile` model in `prisma/schema.prisma` (just maybe drop `calOrganizerEmail` if Cal.com isn't needed) |
| Webhook events table | `WebhookEvent` model — useful for ANY webhook integration (Cal.com, Stripe, Shopify, etc.) |
| Hebrew RTL setup | `src/app/layout.tsx`, the Heebo font, `dir="rtl"`, `<bdi>` for emails/URLs |
| Theme toggle | `src/components/layout/theme-toggle.tsx` + the inline `<head>` script in root layout |
| `i18n/he.ts` structure | The shape (nested object with `as const`) — replace string values per domain |
| `lib/utils.ts` | `cn`, `formatDate`, `formatDateTime`, `formatRelative`, `toDateTimeLocalValue` — Hebrew locale helpers |
| Build/deploy config | `tsconfig.json`, `tailwind.config.ts`, `next.config.ts`, `postcss.config.mjs`, `.gitignore`, `package.json` scripts |
| Toast / Dialog / Sheet etc. | `src/components/ui/*` — the RTL-aware shadcn primitives. Copy as-is. |

## What ALWAYS changes per project

### 1. Domain entities (the data model)

Replace the `Lead`, `LeadNote`, `Meeting`, `WebsiteAnalysis` models with your domain. Keep the conventions:
- Every owned table has `ownerId` UUID FK to `Profile.id` with `onDelete: Cascade`
- Every owned table has `createdAt` + `updatedAt`
- Composite indexes on `(ownerId, ...)` for the common query patterns
- Use enums for status fields (Postgres enums are first-class in Prisma)
- Use `@map(...)` for snake_case column names if you prefer that in SQL while keeping camelCase in TS

**Example domain swap — real estate CRM:**

| JackCRM | RealEstate CRM |
|---|---|
| `Lead` | `Buyer` |
| `LeadNote` | `BuyerNote` |
| `Meeting` (with `scheduledAt`) | `Showing` (with `scheduledAt`, plus `propertyId` FK) |
| `WebsiteAnalysis` | `MarketReport` |
| `LeadStatus` enum | `BuyerStatus` (`PROSPECT`, `QUALIFIED`, `TOURING`, `OFFER`, `CLOSED`, `LOST`) |
| (none) | `Property` table (address, price, beds, baths, listingUrl) |

When you add a new model, add the matching RLS block to `supabase/policies.sql`:

```sql
ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY;
CREATE POLICY "<table>_select_own" ON public.<table> FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "<table>_insert_own" ON public.<table> FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "<table>_update_own" ON public.<table> FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "<table>_delete_own" ON public.<table> FOR DELETE USING (owner_id = auth.uid());
```

For child tables scoped through a parent (like `LeadNote` is scoped through `Lead.ownerId`), use the EXISTS subquery pattern — see [data-model.md](data-model.md).

### 2. Hebrew strings (`src/i18n/he.ts`)

Every user-facing string lives here. Per-project: replace the domain-specific section but keep the meta sections (`auth`, `common`, `errors`, `theme`, `nav`).

Keep the structure — it's `as const` so you get autocomplete on every key.

### 3. Status badges + Kanban columns

The `<entity>-status-badge.tsx` component maps each enum value to a Tailwind variant + Hebrew label. Update it for the new enum.

The Kanban board (`<entity>-board.tsx`) uses a `COLUMNS` constant — list the statuses in pipeline order. Update for the new domain.

### 4. Sidebar navigation

`src/components/layout/sidebar.tsx` has an `items` array. Add/remove entries to match the new entities.

### 5. AI feature (if used)

The pattern in `src/lib/ai/analyze-website.ts` is "fetch a URL via web_fetch, return structured analysis." It can be adapted to:
- "Analyze a job posting URL → return required skills, salary range, red flags"
- "Analyze a competitor product page → return positioning, USPs, gaps"
- "Analyze a property listing URL → return condition assessment, comparable insights"

What changes: the system prompt (`prompts.ts`), the tool input schema (the structured-output fields), the calling component. What stays: the SDK call shape, the `tool_choice: "auto"` + step-by-step prompt, the error handling, `max_tokens: 8192`.

### 6. Webhook integration (if Cal.com isn't right for this domain)

The Cal.com webhook handler is generalizable. Keep:
- HMAC signature verification (just adjust header name + algorithm)
- `webhook_events` idempotency table
- Routing via a profile field

Replace per provider:
- Header name (Cal.com: `X-Cal-Signature-256`; Stripe: `Stripe-Signature`; Shopify: `X-Shopify-Hmac-SHA256`)
- Payload schema in `src/schemas/<provider>-webhook.ts`
- Routing field (Cal.com uses `calOrganizerEmail`; Stripe might use `stripeCustomerId`)
- Side effects (Cal.com creates Meeting; Stripe creates Subscription; Shopify creates Order)

### 7. Color theme

`src/app/globals.css` has the shadcn HSL variables. Defaults to a blue primary. To change:
- Pick a primary HSL from [tailwind colors](https://tailwindcss.com/docs/colors) or [coolors.co](https://coolors.co)
- Update `--primary` (light + dark) and `--ring` to match
- Optional: tune `--success`, `--warning`, `--destructive` if the brand palette suggests it

### 8. Landing page (`src/app/page.tsx`)

The marketing page on `/`. Replace:
- App name (also in `src/i18n/he.ts → app.name`)
- Tagline
- Feature cards (the 4 Feature components)
- CTAs

### 9. Lead form fields

Each entity's create/edit form lives in `src/components/<entity>/<entity>-form.tsx`. Mirror the Prisma schema fields. Use the same Field/Input/Select pattern.

## What CONDITIONALLY changes

### If you don't need AI analysis
- Skip `src/lib/ai/`, `src/app/api/leads/[id]/analyze/route.ts`
- Skip `src/components/analysis/`
- Remove `@anthropic-ai/sdk` from package.json
- Remove `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` from env files

### If you don't need Cal.com (or any webhook)
- Skip `src/app/api/webhooks/cal/route.ts`, `src/lib/webhooks/cal.ts`, `src/schemas/cal-webhook.ts`
- Drop `WebhookEvent` from Prisma schema (or keep it for future)
- Drop `calOrganizerEmail` from Profile (or rename for the new integration)
- Skip the integrations section in Settings page
- Remove `CAL_WEBHOOK_SECRET` from env files

### If you need email confirmation for production
- Re-enable in Supabase Auth → Sign In / Providers → Email → Confirm email ON
- Customize email templates in Supabase Auth → Email Templates

### If you need teams / multi-user organizations
This is a **bigger change** — the per-user `ownerId` model becomes per-organization. You'd:
- Add `Organization` and `Membership` tables
- Replace `ownerId` with `organizationId` on all owned tables
- Rewrite RLS to check membership: `EXISTS (SELECT 1 FROM memberships WHERE organization_id = X AND user_id = auth.uid())`
- Add organization-switcher UI
- Add roles (admin/member) and permission checks

Probably warrants its own skill at that point — flag this as a major rebuild.

## Smell tests when adapting

Before considering a new domain "done", check:
- [ ] No hardcoded "ליד" / "Lead" leaking through — search the codebase
- [ ] All new tables have RLS policies in `supabase/policies.sql`
- [ ] All new server actions filter by `ownerId === currentUser.id`
- [ ] All new pages live under `(dashboard)` group + are auth-gated by middleware
- [ ] The sidebar shows the new entities
- [ ] The dashboard home metrics make sense for the new domain
- [ ] Status badges are color-coded sensibly (red for failures, green for closed-wins)
- [ ] `i18n/he.ts` has no English fallbacks accidentally left in
