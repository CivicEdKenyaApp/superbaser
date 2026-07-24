-- =========================================================================
-- SUPERBASER DATABASE & SECURITY MIGRATION: 3-TIER SCHEME + ANONYMOUS RLS GUARDS
-- =========================================================================

-- 1. Helper function: Check if current authenticated user is a permanent account (not anonymous)
CREATE OR REPLACE FUNCTION public.is_permanent_user() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL 
    AND (COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, FALSE) IS FALSE);
$$;

-- 2. Enforce 3-tier organization plan constraint (free, pro, premium)
ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS check_valid_plan_tier;

ALTER TABLE public.organizations
  ADD CONSTRAINT check_valid_plan_tier 
  CHECK (lower(plan) IN ('free', 'pro', 'premium'));

-- 3. Ensure last_run_at column exists on schedules table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'schedules' 
      AND column_name = 'last_run_at'
  ) THEN
    ALTER TABLE public.schedules ADD COLUMN last_run_at TIMESTAMPTZ;
  END IF;
END $$;

-- 4. Ensure r2_key column exists on backups table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'backups' 
      AND column_name = 'r2_key'
  ) THEN
    ALTER TABLE public.backups ADD COLUMN r2_key TEXT;
  END IF;
END $$;

-- 5. RLS SECURITY POLICIES: BLOCK ANONYMOUS USERS FROM WRITING DATA

-- Organizations
DROP POLICY IF EXISTS "orgs_member_insert" ON public.organizations;
CREATE POLICY "orgs_member_insert" ON public.organizations 
  FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() = created_by AND public.is_permanent_user());

DROP POLICY IF EXISTS "orgs_member_update" ON public.organizations;
CREATE POLICY "orgs_member_update" ON public.organizations 
  FOR UPDATE TO authenticated 
  USING (public.is_org_member(id, auth.uid()) AND public.is_permanent_user())
  WITH CHECK (public.is_org_member(id, auth.uid()) AND public.is_permanent_user());

-- Projects
DROP POLICY IF EXISTS "projects_member_insert" ON public.projects;
CREATE POLICY "projects_member_insert" ON public.projects 
  FOR INSERT TO authenticated 
  WITH CHECK (public.is_org_member(organization_id, auth.uid()) AND public.is_permanent_user());

DROP POLICY IF EXISTS "projects_member_update" ON public.projects;
CREATE POLICY "projects_member_update" ON public.projects 
  FOR UPDATE TO authenticated 
  USING (public.is_org_member(organization_id, auth.uid()) AND public.is_permanent_user());

-- Schedules
DROP POLICY IF EXISTS "schedules_member_insert" ON public.schedules;
CREATE POLICY "schedules_member_insert" ON public.schedules 
  FOR INSERT TO authenticated 
  WITH CHECK (public.is_org_member(organization_id, auth.uid()) AND public.is_permanent_user());

DROP POLICY IF EXISTS "schedules_member_update" ON public.schedules;
CREATE POLICY "schedules_member_update" ON public.schedules 
  FOR UPDATE TO authenticated 
  USING (public.is_org_member(organization_id, auth.uid()) AND public.is_permanent_user());

-- Backups & Jobs
DROP POLICY IF EXISTS "backups_member_insert" ON public.backups;
CREATE POLICY "backups_member_insert" ON public.backups 
  FOR INSERT TO authenticated 
  WITH CHECK (public.is_org_member(organization_id, auth.uid()) AND public.is_permanent_user());

DROP POLICY IF EXISTS "jobs_member_insert" ON public.jobs;
CREATE POLICY "jobs_member_insert" ON public.jobs 
  FOR INSERT TO authenticated 
  WITH CHECK (public.is_org_member(organization_id, auth.uid()) AND public.is_permanent_user());

-- 6. GAP 2 FIX: UPDATE POLICY FOR JOBS
DROP POLICY IF EXISTS "jobs_member_update" ON public.jobs;
CREATE POLICY "jobs_member_update" ON public.jobs 
  FOR UPDATE TO authenticated 
  USING (public.is_org_member(organization_id, auth.uid()) AND public.is_permanent_user())
  WITH CHECK (public.is_org_member(organization_id, auth.uid()) AND public.is_permanent_user());

-- 7. GAP 1 FIX: SELECT & DELETE POLICIES TO BLOCK ANONYMOUS READ/DELETE
-- Organizations
DROP POLICY IF EXISTS "orgs_member_select" ON public.organizations;
CREATE POLICY "orgs_member_select" ON public.organizations 
  FOR SELECT TO authenticated 
  USING (public.is_org_member(id, auth.uid()) AND public.is_permanent_user());

DROP POLICY IF EXISTS "orgs_member_delete" ON public.organizations;
CREATE POLICY "orgs_member_delete" ON public.organizations 
  FOR DELETE TO authenticated 
  USING (public.is_org_member(id, auth.uid()) AND public.is_permanent_user());

-- Projects
DROP POLICY IF EXISTS "projects_member_select" ON public.projects;
CREATE POLICY "projects_member_select" ON public.projects 
  FOR SELECT TO authenticated 
  USING (public.is_org_member(organization_id, auth.uid()) AND public.is_permanent_user());

DROP POLICY IF EXISTS "projects_member_delete" ON public.projects;
CREATE POLICY "projects_member_delete" ON public.projects 
  FOR DELETE TO authenticated 
  USING (public.is_org_member(organization_id, auth.uid()) AND public.is_permanent_user());

-- Jobs
DROP POLICY IF EXISTS "jobs_member_select" ON public.jobs;
CREATE POLICY "jobs_member_select" ON public.jobs 
  FOR SELECT TO authenticated 
  USING (public.is_org_member(organization_id, auth.uid()) AND public.is_permanent_user());

-- Backups
DROP POLICY IF EXISTS "backups_member_select" ON public.backups;
CREATE POLICY "backups_member_select" ON public.backups 
  FOR SELECT TO authenticated 
  USING (public.is_org_member(organization_id, auth.uid()) AND public.is_permanent_user());

DROP POLICY IF EXISTS "backups_member_delete" ON public.backups;
CREATE POLICY "backups_member_delete" ON public.backups 
  FOR DELETE TO authenticated 
  USING (public.is_org_member(organization_id, auth.uid()) AND public.is_permanent_user());

-- Schedules
DROP POLICY IF EXISTS "schedules_member_select" ON public.schedules;
CREATE POLICY "schedules_member_select" ON public.schedules 
  FOR SELECT TO authenticated 
  USING (public.is_org_member(organization_id, auth.uid()) AND public.is_permanent_user());

DROP POLICY IF EXISTS "schedules_member_delete" ON public.schedules;
CREATE POLICY "schedules_member_delete" ON public.schedules 
  FOR DELETE TO authenticated 
  USING (public.is_org_member(organization_id, auth.uid()) AND public.is_permanent_user());

-- Indexes for schedule interval checks & backup retention cleanup
CREATE INDEX IF NOT EXISTS idx_schedules_enabled_last_run ON public.schedules (enabled, last_run_at);
CREATE INDEX IF NOT EXISTS idx_backups_org_created ON public.backups (organization_id, created_at);
