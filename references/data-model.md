# Data Model + RLS Recipe

The Prisma + Supabase RLS pattern that powers per-user data isolation.

## The core invariants

1. **Every owned table has `ownerId`** — UUID, FK to `profiles.id`, `onDelete: Cascade`
2. **`profiles.id` mirrors `auth.users.id`** — both are UUIDs, same value, populated by a trigger
3. **RLS policies use `auth.uid()`** — Postgres function that returns the current Supabase user's ID
4. **App code ALSO filters by `ownerId === currentUser.id`** — defense in depth (Prisma bypasses RLS)
5. **Child tables scope through parents** — e.g., a `LeadNote` is auth'd by checking its parent `Lead.ownerId`

## Standard table shape

```prisma
model <Entity> {
  id        String   @id @default(uuid()) @db.Uuid
  ownerId   String   @map("owner_id") @db.Uuid
  owner     Profile  @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  // ...domain fields...
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@index([ownerId, createdAt])
  @@map("<entities>")
}
```

Indexes — always lead with `ownerId`:
- `@@index([ownerId, createdAt])` — for "list my entities"
- `@@index([ownerId, status])` — for filtering by status
- `@@index([ownerId, email])` — for email lookup (e.g., webhook upsert)

## The auth → profile trigger

In `supabase/policies.sql`:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

This fires when Supabase Auth creates a new user; it inserts a matching row in `public.profiles`. Without this, the first thing your app would have to do on every request is "is there a profile? If not, create one" — clunky.

## RLS policies — owned tables

Standard four policies per owned table:

```sql
ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY;

CREATE POLICY "<table>_select_own" ON public.<table>
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "<table>_insert_own" ON public.<table>
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "<table>_update_own" ON public.<table>
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "<table>_delete_own" ON public.<table>
  FOR DELETE USING (owner_id = auth.uid());
```

**Note**: `USING` is checked on read; `WITH CHECK` is checked on write. Keep them consistent — you don't want a user to be able to insert a row they can't then read.

## RLS policies — child tables (scoped through a parent)

For tables like `LeadNote` (which belong to a `Lead`), the owner check goes through the parent:

```sql
ALTER TABLE public.lead_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_notes_select_own" ON public.lead_notes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = lead_id AND l.owner_id = auth.uid()
    )
  );

CREATE POLICY "lead_notes_insert_own" ON public.lead_notes
  FOR INSERT WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = lead_id AND l.owner_id = auth.uid()
    )
  );

CREATE POLICY "lead_notes_delete_own" ON public.lead_notes
  FOR DELETE USING (author_id = auth.uid());
```

The EXISTS pattern is the canonical way to express "this row's owner is auth.uid() via the parent's owner_id."

## RLS policies — webhook_events (service-role only)

Some tables shouldn't be readable by users at all:

```sql
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
-- No policies = no rows visible to anon/authenticated roles.
-- Service role bypasses RLS, so server-side code can still INSERT/UPDATE.
```

This is the right pattern for audit logs, idempotency tables, internal queues — anything users shouldn't see.

## App-side enforcement (the safety net is the safety net)

Prisma uses the service role key (or the pooler URL for the prod path), which **bypasses RLS**. So app code MUST also enforce:

```ts
// ❌ WRONG — trusts the route param
const lead = await prisma.lead.findUnique({ where: { id: params.id } });

// ✅ RIGHT — filter by ownerId server-side
const user = await requireUser();
const lead = await prisma.lead.findFirst({
  where: { id: params.id, ownerId: user.id },
});
```

Same for updates and deletes — use `updateMany` / `deleteMany` with the WHERE clause:

```ts
// ✅ Returns count: 0 if user doesn't own the row (no error, no leak)
await prisma.lead.updateMany({
  where: { id: leadId, ownerId: user.id },
  data: { ...patch },
});
```

Why `updateMany` and not `update`? Because `update` throws if the row doesn't match — leaking the existence of the row to a non-owner. `updateMany` returns `{ count: 0 }` silently.

## Smoke-testing RLS

After applying policies:

1. Sign up as User A in the app
2. Create some entities (e.g. 3 leads)
3. In Supabase SQL Editor, run as `anon` role:
   ```sql
   SET LOCAL ROLE anon;
   SELECT count(*) FROM leads;  -- should be 0 (anon can't see anything)
   ```
4. Sign up as User B in the app
5. As User B, try to fetch User A's lead by ID via the API (`GET /api/leads/<A's id>`) — should 404

If both checks pass, RLS is working. If either fails, the policies aren't applied OR the app code is using the service role to bypass them.

## Migrations workflow

```bash
# Local dev: edit schema, push to dev DB
# (db:push doesn't make migration files — fine for solo dev)
npm run db:push

# When ready for production / want migration history:
npx prisma migrate dev --name add_property_table
# Creates a SQL file in prisma/migrations/

# In production (Vercel build hook or one-off):
npx prisma migrate deploy
```

For a solo project, `db:push` everywhere is fine. For a team / production, switch to `migrate dev` once you have collaborators or a staging DB.

## Adding a new owned table — the full checklist

1. Add the model to `prisma/schema.prisma` with `ownerId` + indexes
2. Add the Profile relation: `<entity> <Entity>[]` (back-reference)
3. Add the RLS block to `supabase/policies.sql`
4. Run `npm run db:push` to create the table
5. Open Supabase SQL Editor, paste the new RLS block, run it
6. Add Zod schemas in `src/schemas/<entity>.ts`
7. Add server actions in `src/app/(dashboard)/<entity>/actions.ts`
8. Add pages: list, new, detail, edit
9. Add to sidebar nav
10. Smoke-test RLS (sign in as second user, confirm isolation)
