
-- =========================================================================
-- ENUMS
-- =========================================================================
CREATE TYPE public.app_role AS ENUM ('admin','moderator','user');
CREATE TYPE public.org_role AS ENUM ('owner','admin','member','viewer');
CREATE TYPE public.job_status AS ENUM ('queued','claimed','running','succeeded','failed','cancelled');
CREATE TYPE public.job_kind AS ENUM ('backup','restore','verify','storage','cleanup','notification','billing');
CREATE TYPE public.job_priority AS ENUM ('critical','high','normal','low');
CREATE TYPE public.backup_status AS ENUM ('pending','running','completed','failed','cancelled','verified');
CREATE TYPE public.restore_status AS ENUM ('pending','running','completed','failed','cancelled');
CREATE TYPE public.notification_severity AS ENUM ('info','success','warning','error');

-- =========================================================================
-- PROFILES
-- =========================================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_self_select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_self_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Utility: touch updated_at
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_touch BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================================
-- APP ROLES
-- =========================================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_self_select" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- =========================================================================
-- ORGANIZATIONS + MEMBERS
-- =========================================================================
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'free',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_orgs_touch BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE TABLE public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role org_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members TO authenticated;
GRANT ALL ON public.organization_members TO service_role;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- Security-definer helpers to avoid recursive RLS
CREATE OR REPLACE FUNCTION public.is_org_member(_org UUID, _user UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = _org AND user_id = _user);
$$;

CREATE OR REPLACE FUNCTION public.org_role_of(_org UUID, _user UUID) RETURNS org_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.organization_members WHERE organization_id = _org AND user_id = _user LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(_org UUID, _user UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.org_role_of(_org, _user) IN ('owner','admin');
$$;

CREATE OR REPLACE FUNCTION public.is_org_owner(_org UUID, _user UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.org_role_of(_org, _user) = 'owner';
$$;

CREATE POLICY "orgs_member_select" ON public.organizations FOR SELECT TO authenticated
  USING (public.is_org_member(id, auth.uid()));
CREATE POLICY "orgs_creator_insert" ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);
CREATE POLICY "orgs_admin_update" ON public.organizations FOR UPDATE TO authenticated
  USING (public.is_org_admin(id, auth.uid())) WITH CHECK (public.is_org_admin(id, auth.uid()));
CREATE POLICY "orgs_owner_delete" ON public.organizations FOR DELETE TO authenticated
  USING (public.is_org_owner(id, auth.uid()));

CREATE POLICY "members_visible_to_org" ON public.organization_members FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "members_admin_write" ON public.organization_members FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin(organization_id, auth.uid()) OR user_id = auth.uid());
CREATE POLICY "members_admin_update" ON public.organization_members FOR UPDATE TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid())) WITH CHECK (public.is_org_admin(organization_id, auth.uid()));
CREATE POLICY "members_admin_delete" ON public.organization_members FOR DELETE TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid()) OR user_id = auth.uid());

-- Auto-add creator as owner
CREATE OR REPLACE FUNCTION public.tg_org_add_creator() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_org_add_creator AFTER INSERT ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.tg_org_add_creator();

-- =========================================================================
-- PROJECTS + CREDENTIALS
-- =========================================================================
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  supabase_project_ref TEXT,
  region TEXT,
  postgres_version TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  inventory JSONB,
  last_inventory_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_projects_touch BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE POLICY "projects_member_select" ON public.projects FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "projects_admin_insert" ON public.projects FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin(organization_id, auth.uid()));
CREATE POLICY "projects_admin_update" ON public.projects FOR UPDATE TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid())) WITH CHECK (public.is_org_admin(organization_id, auth.uid()));
CREATE POLICY "projects_admin_delete" ON public.projects FOR DELETE TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid()));

-- Credentials: encrypted blob stored server-side only. Never SELECT-able by users.
CREATE TABLE public.project_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL UNIQUE REFERENCES public.projects(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  encrypted_payload TEXT NOT NULL,
  encryption_key_id TEXT NOT NULL,
  db_host TEXT,
  db_port INT,
  db_name TEXT,
  db_user TEXT,
  last_validated_at TIMESTAMPTZ,
  last_validation_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.project_credentials TO service_role;
-- No grants to authenticated: users must go through server functions.
ALTER TABLE public.project_credentials ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_creds_touch BEFORE UPDATE ON public.project_credentials FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
-- No policies for authenticated: fully server-side.

-- =========================================================================
-- BACKUPS
-- =========================================================================
CREATE TABLE public.backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  status backup_status NOT NULL DEFAULT 'pending',
  bytes_total BIGINT,
  bytes_uploaded BIGINT DEFAULT 0,
  sql_object_key TEXT,
  storage_object_key TEXT,
  manifest JSONB,
  checksum_sha256 TEXT,
  compression TEXT DEFAULT 'gzip',
  stage TEXT,
  progress_percent NUMERIC(5,2) DEFAULT 0,
  eta_seconds INT,
  bytes_per_second BIGINT,
  error_code TEXT,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  triggered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  triggered_via TEXT NOT NULL DEFAULT 'manual',
  schedule_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.backups TO authenticated;
GRANT ALL ON public.backups TO service_role;
ALTER TABLE public.backups ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_backups_touch BEFORE UPDATE ON public.backups FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE POLICY "backups_member_select" ON public.backups FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "backups_admin_insert" ON public.backups FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin(organization_id, auth.uid()));
CREATE POLICY "backups_admin_update" ON public.backups FOR UPDATE TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid())) WITH CHECK (public.is_org_admin(organization_id, auth.uid()));
CREATE POLICY "backups_admin_delete" ON public.backups FOR DELETE TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid()));

-- =========================================================================
-- RESTORES
-- =========================================================================
CREATE TABLE public.restores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  backup_id UUID NOT NULL REFERENCES public.backups(id) ON DELETE RESTRICT,
  destination_project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  status restore_status NOT NULL DEFAULT 'pending',
  stage TEXT,
  progress_percent NUMERIC(5,2) DEFAULT 0,
  eta_seconds INT,
  bytes_per_second BIGINT,
  report JSONB,
  error_code TEXT,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  triggered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restores TO authenticated;
GRANT ALL ON public.restores TO service_role;
ALTER TABLE public.restores ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_restores_touch BEFORE UPDATE ON public.restores FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE POLICY "restores_member_select" ON public.restores FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "restores_admin_insert" ON public.restores FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin(organization_id, auth.uid()));
CREATE POLICY "restores_admin_update" ON public.restores FOR UPDATE TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid())) WITH CHECK (public.is_org_admin(organization_id, auth.uid()));
CREATE POLICY "restores_admin_delete" ON public.restores FOR DELETE TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid()));

-- =========================================================================
-- VERIFICATION REPORTS
-- =========================================================================
CREATE TABLE public.verification_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  backup_id UUID REFERENCES public.backups(id) ON DELETE CASCADE,
  restore_id UUID REFERENCES public.restores(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  summary JSONB,
  diffs JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.verification_reports TO authenticated;
GRANT ALL ON public.verification_reports TO service_role;
ALTER TABLE public.verification_reports ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_verify_touch BEFORE UPDATE ON public.verification_reports FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
CREATE POLICY "verify_member_select" ON public.verification_reports FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "verify_admin_write" ON public.verification_reports FOR ALL TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid())) WITH CHECK (public.is_org_admin(organization_id, auth.uid()));

-- =========================================================================
-- SCHEDULES
-- =========================================================================
CREATE TABLE public.schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cron_expression TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  enabled BOOLEAN NOT NULL DEFAULT true,
  retention_days INT NOT NULL DEFAULT 30,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedules TO authenticated;
GRANT ALL ON public.schedules TO service_role;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_sched_touch BEFORE UPDATE ON public.schedules FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
CREATE POLICY "sched_member_select" ON public.schedules FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "sched_admin_write" ON public.schedules FOR ALL TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid())) WITH CHECK (public.is_org_admin(organization_id, auth.uid()));

-- =========================================================================
-- NOTIFICATIONS
-- =========================================================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  severity notification_severity NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  body TEXT,
  link_url TEXT,
  resource_type TEXT,
  resource_id UUID,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_visible" ON public.notifications FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()) AND (user_id IS NULL OR user_id = auth.uid()));
CREATE POLICY "notif_update_own" ON public.notifications FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()) AND (user_id IS NULL OR user_id = auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()) AND (user_id IS NULL OR user_id = auth.uid()));
CREATE POLICY "notif_delete_own" ON public.notifications FOR DELETE TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()) AND (user_id IS NULL OR user_id = auth.uid()));

-- =========================================================================
-- AUDIT LOGS
-- =========================================================================
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  metadata JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_admin_select" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid()));

-- =========================================================================
-- API KEYS
-- =========================================================================
CREATE TABLE public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  prefix TEXT NOT NULL,
  hashed_key TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT ARRAY['read']::TEXT[],
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_keys TO authenticated;
GRANT ALL ON public.api_keys TO service_role;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "apikeys_admin_read" ON public.api_keys FOR SELECT TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid()));
CREATE POLICY "apikeys_admin_write" ON public.api_keys FOR ALL TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid())) WITH CHECK (public.is_org_admin(organization_id, auth.uid()));

-- =========================================================================
-- WEBHOOKS
-- =========================================================================
CREATE TABLE public.webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT ARRAY['backup.completed','restore.completed']::TEXT[],
  secret TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_delivery_at TIMESTAMPTZ,
  last_delivery_status TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhooks TO authenticated;
GRANT ALL ON public.webhooks TO service_role;
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_wh_touch BEFORE UPDATE ON public.webhooks FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
CREATE POLICY "wh_admin_all" ON public.webhooks FOR ALL TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid())) WITH CHECK (public.is_org_admin(organization_id, auth.uid()));

-- =========================================================================
-- JOBS QUEUE
-- =========================================================================
CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  kind job_kind NOT NULL,
  priority job_priority NOT NULL DEFAULT 'normal',
  status job_status NOT NULL DEFAULT 'queued',
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  result JSONB,
  claimed_by TEXT,
  claimed_at TIMESTAMPTZ,
  attempt INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  error_code TEXT,
  error_message TEXT,
  backup_id UUID REFERENCES public.backups(id) ON DELETE SET NULL,
  restore_id UUID REFERENCES public.restores(id) ON DELETE SET NULL,
  trace_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.jobs TO authenticated;
GRANT ALL ON public.jobs TO service_role;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_jobs_touch BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
CREATE POLICY "jobs_member_select" ON public.jobs FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE INDEX idx_jobs_queue ON public.jobs (status, priority, scheduled_for) WHERE status = 'queued';
CREATE INDEX idx_jobs_org ON public.jobs (organization_id, created_at DESC);

-- =========================================================================
-- WORKER HEARTBEATS
-- =========================================================================
CREATE TABLE public.worker_heartbeats (
  id TEXT PRIMARY KEY,
  version TEXT,
  queue TEXT,
  cpu_percent NUMERIC(5,2),
  ram_mb INT,
  running_job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.worker_heartbeats TO authenticated;
GRANT ALL ON public.worker_heartbeats TO service_role;
ALTER TABLE public.worker_heartbeats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hb_any_authenticated" ON public.worker_heartbeats FOR SELECT TO authenticated USING (true);

-- =========================================================================
-- STORAGE MANIFEST (per-backup enumeration)
-- =========================================================================
CREATE TABLE public.backup_storage_objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_id UUID NOT NULL REFERENCES public.backups(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  bucket TEXT NOT NULL,
  path TEXT NOT NULL,
  size_bytes BIGINT,
  mime_type TEXT,
  checksum_sha256 TEXT,
  last_modified TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.backup_storage_objects TO authenticated;
GRANT ALL ON public.backup_storage_objects TO service_role;
ALTER TABLE public.backup_storage_objects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bso_member_select" ON public.backup_storage_objects FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "bso_admin_write" ON public.backup_storage_objects FOR ALL TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid())) WITH CHECK (public.is_org_admin(organization_id, auth.uid()));

CREATE INDEX idx_bso_backup ON public.backup_storage_objects (backup_id);
