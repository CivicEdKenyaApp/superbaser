-- SuperBaser — Complete Backup Pipeline Schema Migration
-- Migration ID: 20260727120000_complete_backup_pipeline_schema.sql

-- 1. Upgrade Jobs Table
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS progress_message TEXT,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS error JSONB,
  ADD COLUMN IF NOT EXISTS result JSONB,
  ADD COLUMN IF NOT EXISTS engine_used TEXT,
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ;

-- Index for high-performance worker claim queries
CREATE INDEX IF NOT EXISTS idx_jobs_status_kind ON public.jobs (status, kind);

-- 2. Upgrade Backups Table
ALTER TABLE public.backups
  ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS encrypted BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS sha256 TEXT,
  ADD COLUMN IF NOT EXISTS storage_bytes BIGINT,
  ADD COLUMN IF NOT EXISTS r2_key TEXT,
  ADD COLUMN IF NOT EXISTS tables_count INTEGER,
  ADD COLUMN IF NOT EXISTS rows_count INTEGER,
  ADD COLUMN IF NOT EXISTS verification_report_id UUID;

-- 3. Upgrade Projects Table
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS connection_string TEXT,
  ADD COLUMN IF NOT EXISTS connection_type TEXT DEFAULT 'transaction_pooler',
  ADD COLUMN IF NOT EXISTS ssl_mode TEXT DEFAULT 'require',
  ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ;

-- 4. Create Verification Reports Table
CREATE TABLE IF NOT EXISTS public.verification_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  backup_id UUID REFERENCES public.backups(id) ON DELETE CASCADE,
  verified BOOLEAN DEFAULT FALSE,
  checksum_match BOOLEAN DEFAULT FALSE,
  tables_count INTEGER DEFAULT 0,
  rows_count INTEGER DEFAULT 0,
  restore_duration_ms INTEGER,
  verified_at TIMESTAMPTZ DEFAULT now(),
  error_details TEXT
);

-- 5. Create Restores Table
CREATE TABLE IF NOT EXISTS public.restores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  backup_id UUID REFERENCES public.backups(id) ON DELETE CASCADE,
  destination_project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending',
  engine_used TEXT,
  tables_restored INTEGER DEFAULT 0,
  rows_restored INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Create Schedules Table
CREATE TABLE IF NOT EXISTS public.schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  frequency TEXT DEFAULT 'daily',
  retention_days INTEGER DEFAULT 30,
  enabled BOOLEAN DEFAULT TRUE,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '1 day'),
  consecutive_failures INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Row Level Security (RLS) Policies
ALTER TABLE public.verification_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow Organization Members Access" ON public.verification_reports
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Allow Organization Members Access" ON public.restores
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Allow Organization Members Access" ON public.schedules
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );
