-- ────────────────────────────────────────────────────────────────────────────
-- RLS policies template
-- Run after `prisma db push` (which creates the tables).
--
-- Each owned table follows the same 4-policy pattern:
--   <table>_select_own / insert_own / update_own / delete_own
-- Plus the auto-profile-on-signup trigger.
-- ────────────────────────────────────────────────────────────────────────────

-- ─── auth.users → public.profiles trigger ──────────────────────────────────
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

-- ─── profiles ────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

-- ─── leads (replace with your domain table) ──────────────────────────────
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leads_select_own" ON public.leads;
CREATE POLICY "leads_select_own" ON public.leads
  FOR SELECT USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "leads_insert_own" ON public.leads;
CREATE POLICY "leads_insert_own" ON public.leads
  FOR INSERT WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "leads_update_own" ON public.leads;
CREATE POLICY "leads_update_own" ON public.leads
  FOR UPDATE USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "leads_delete_own" ON public.leads;
CREATE POLICY "leads_delete_own" ON public.leads
  FOR DELETE USING (owner_id = auth.uid());

-- ─── lead_notes (child table — scoped through parent) ────────────────────
ALTER TABLE public.lead_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lead_notes_select_own" ON public.lead_notes;
CREATE POLICY "lead_notes_select_own" ON public.lead_notes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND l.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "lead_notes_insert_own" ON public.lead_notes;
CREATE POLICY "lead_notes_insert_own" ON public.lead_notes
  FOR INSERT WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND l.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "lead_notes_delete_own" ON public.lead_notes;
CREATE POLICY "lead_notes_delete_own" ON public.lead_notes
  FOR DELETE USING (author_id = auth.uid());

-- ─── meetings ────────────────────────────────────────────────────────────
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "meetings_select_own" ON public.meetings;
CREATE POLICY "meetings_select_own" ON public.meetings
  FOR SELECT USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "meetings_insert_own" ON public.meetings;
CREATE POLICY "meetings_insert_own" ON public.meetings
  FOR INSERT WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "meetings_update_own" ON public.meetings;
CREATE POLICY "meetings_update_own" ON public.meetings
  FOR UPDATE USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "meetings_delete_own" ON public.meetings;
CREATE POLICY "meetings_delete_own" ON public.meetings
  FOR DELETE USING (owner_id = auth.uid());

-- ─── webhook_events (service role only — no policies = deny by default) ──
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
-- Service role bypasses RLS; users can't see anything.
