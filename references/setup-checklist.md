# Setup Checklist

Step-by-step guide for the external services this stack depends on. Phases 1–4 are required for any project; Phase 5 (Cal.com) is optional. Phase 6 (deploy) should happen after the local build is confirmed working.

The user does the browser steps; you do the CLI steps.

---

## Phase 1 — Supabase project (~5 min)

User actions:

1. Sign in at [supabase.com](https://supabase.com)
2. **New project** → fill in:
   - Project name: kebab-case (e.g., `realestate-crm`)
   - **Database password**: click "Generate a password" → SAVE IT (1Password / notes file). Critical to copy now — Supabase shows it only once.
   - Region: closest to user (Frankfurt for Europe/Israel; Singapore for Asia)
   - Plan: Free tier is fine for V1
3. Wait ~2 min for provisioning

When the project is ready, the user needs to grab 5 values from the Supabase dashboard:

### A. From Settings → API Keys

Modern Supabase shows two key types:
- **Publishable key** (`sb_publishable_...`) — this IS the anon key, just renamed
- **Secret key** (`sb_secret_...`) — this IS the service_role key, just renamed

Both work with all Supabase SDKs. Map them:

| Supabase shows | Goes into env var |
|---|---|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| Publishable key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Secret key | `SUPABASE_SERVICE_ROLE_KEY` |

(If the user only sees publishable + secret and is confused they're missing the "anon key": the publishable key IS the anon key in the new naming.)

### B. From "Connect" button at top → ORMs → Prisma

Both URLs come pre-formatted. Each has `[YOUR-PASSWORD]` as a placeholder — replace with the database password from step 2.

| Supabase shows | Goes into env var |
|---|---|
| Pooled connection (port 6543) | `DATABASE_URL` |
| Direct connection (port 5432) | `DIRECT_URL` |

⚠️ **Password URL-encoding**: If the password contains `&`, `@`, `#`, `:`, `?`, `/`, encode it. `&` → `%26`, `@` → `%40`, `!` → `%21`, etc. Without encoding, the parser thinks the URL ends at the `&` and authentication fails. The cleanest fix: ask the user to **reset the database password** to alphanumeric only (Settings → Database → Reset password).

---

## Phase 2 — Wire env vars locally

You (the agent) write `.env.local` in the project. Use [assets/templates/env.example.template](../assets/templates/env.example.template) as the structure. The user pastes the values inline — do **not** ask them to paste secrets in chat.

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
DATABASE_URL=postgresql://postgres.xxxxx:PASSWORD@aws-1-region.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.xxxxx:PASSWORD@aws-1-region.pooler.supabase.com:5432/postgres
ANTHROPIC_API_KEY=sk-ant-PLACEHOLDER
ANTHROPIC_MODEL=claude-sonnet-4-6
CAL_WEBHOOK_SECRET=whsec_PLACEHOLDER
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Then verify connectivity:

```bash
npm install
npx prisma generate
npm run db:push   # uses dotenv-cli to read .env.local
```

If `db:push` fails:
- "DIRECT_URL not found" → confirm `dotenv-cli` is installed and `package.json` script uses `dotenv -e .env.local --`
- "Authentication failed" → password is wrong OR not URL-encoded. Ask user to reset and retry. Sometimes there's also a 30–60s propagation delay after a password reset; retry once.
- "ECONNREFUSED" / "ENOTFOUND" → check the host portion of the connection string

If `db:push` succeeds, all 6 tables (or however many your schema has) are now in Supabase. Verify in Supabase dashboard → Table Editor.

---

## Phase 3 — Apply RLS policies

Open Supabase → **SQL Editor** → New query → paste the contents of `supabase/policies.sql` (generated from [assets/templates/supabase-policies.template.sql](../assets/templates/supabase-policies.template.sql)) → **Run**.

Expect "Success. No rows returned." This creates:
- The `auth.users → public.profiles` trigger (auto-creates a profile on signup)
- RLS policies on every owned table
- (Webhook events table stays service-role only — no policies = denies all by default)

Verify by going to Authentication → Policies — every owned table should show the four policies (select_own / insert_own / update_own / delete_own).

---

## Phase 4 — Auth config (~1 min)

In Supabase → **Authentication** → **Sign In / Providers** → **Email**:
- Toggle **"Confirm email"** OFF (for local dev — re-enable in production)
- Save

Optional: Authentication → URL Configuration → Site URL `http://localhost:3000` (default; verify it's there).

Now you can boot the app:

```bash
npm run dev
```

Open `http://localhost:3000`, sign up, and verify the trigger created a row in `public.profiles` (Supabase Table Editor → profiles).

---

## Phase 5 — Cal.com webhook (optional, ~5 min)

Skip if no calendar integration is needed.

1. **Sign up at [cal.com](https://cal.com)** with the email that should be the "organizer" — this email is how the webhook routes bookings to a JackCRM user.
2. **Create an event type** (default 30-min meeting works fine).
3. **Settings → Developer → Webhooks → New Webhook**:
   - Subscriber URL: `https://YOUR-APP.vercel.app/api/webhooks/cal` (after deploy) — or use ngrok URL for local testing
   - Event triggers: ☑ Booking Created, ☑ Booking Rescheduled, ☑ Booking Cancelled, ☑ Meeting Ended
   - Secret: generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` (give it to the user to paste)
   - Custom payload template: leave OFF
   - Save

4. Push the secret to env:
   ```bash
   printf '<the-secret>' | vercel env add CAL_WEBHOOK_SECRET production --force
   vercel deploy --prod --yes
   ```

5. In the JackCRM app: **Settings** page → **אימייל Cal.com (מארגן הפגישה)** → enter the Cal.com organizer email → save.

6. **Test**: book a meeting on the public Cal.com link from a different email. Refresh `/leads` — within ~5 seconds a new lead should appear with status "נקבעה פגישה."

If nothing appears, debug with [references/cal-webhook.md](cal-webhook.md) (idempotency table inspection + signature verification test).

---

## Phase 6 — Deploy (GitHub + Vercel, ~10 min)

Prereqs the user needs: GitHub account, Vercel account (Vercel signs in with GitHub — one account does both).

Check what's already authenticated:

```bash
gh auth status
vercel whoami
```

If not authenticated:
```bash
gh auth login        # browser flow once
vercel login         # browser flow once
```

Then everything from here is CLI:

```bash
# 1. git init + commit
git init -b main
# Verify .gitignore protects .env.local first
grep -E "^\.env" .gitignore   # should match
git add .
git commit -m "Initial commit"

# 2. GitHub repo + push
gh repo create <project-name> --private --source=. --push

# 3. Vercel link (creates project, connects to GitHub for auto-deploys)
vercel link --yes --project <project-name> --scope <your-vercel-team>
# If --scope is missing, the CLI prints the available scopes and you re-run with --scope

# 4. Push env vars to Vercel
# For each KEY=VALUE in .env.local:
printf 'VALUE' | vercel env add KEY production --force
# (Skip NEXT_PUBLIC_APP_URL until step 6)

# 5. Deploy
vercel deploy --prod --yes

# 6. Now you have the URL — set NEXT_PUBLIC_APP_URL
printf 'https://your-project.vercel.app' | vercel env add NEXT_PUBLIC_APP_URL production --force
vercel deploy --prod --yes  # rebuild with the new env var
```

7. **Update Supabase URL allowlist** (user, browser):
   - Supabase → Authentication → URL Configuration
   - Site URL → `https://your-project.vercel.app`
   - Redirect URLs → add `https://your-project.vercel.app/**` AND keep `http://localhost:3000/**` for dev

8. (If using Cal.com) Update the webhook subscriber URL in Cal.com to the Vercel URL.

---

## Common deploy failures and fixes

### "Vulnerable version of Next.js detected"
Vercel scans `package.json` for known-vulnerable Next.js versions and rejects deploys. Fix:
```bash
npm install next@latest eslint-config-next@latest --save
rm -rf .next
npm run build  # verify locally
git commit -am "Upgrade Next.js"
git push
```

Note: Next.js 16 changed `middleware.ts` → `proxy.ts` convention (still works, just deprecation warning). It also reconfigures `tsconfig.json` slightly on build — let it.

### "Could not create a project called "X" because of npm naming restrictions"
The folder name has uppercase letters. Either rename the folder to lowercase OR scaffold `package.json` manually with a lowercase `name` field (recommended — preserves the user's preferred folder name).

### Auth redirects fail in production
Almost always missing Supabase Site URL / Redirect URLs allowlist (Phase 6 step 7).

### Webhook returns 401 in Cal.com history
Secret mismatch. Regenerate, push to Vercel, redeploy, paste fresh into Cal.com (carefully — triple-click select before pasting to avoid partial pastes).
