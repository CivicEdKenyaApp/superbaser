-- FILE 2 OF 15: supabase/migrations/20260727000000_backup_pipeline_upgrade.sql
-- Run this in Supabase SQL Editor

ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS progress INT DEFAULT 0;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS progress_message TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS error JSONB;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS result JSONB;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS engine_used TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS engine_fallback_used BOOLEAN DEFAULT false;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_jobs_status_claimed ON public.jobs (status, claimed_at);

ALTER TABLE public.backups ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false;
ALTER TABLE public.backups ADD COLUMN IF NOT EXISTS verification_report_id UUID REFERENCES public.verification_reports(id);
ALTER TABLE public.backups ADD COLUMN IF NOT EXISTS encrypted BOOLEAN DEFAULT false;
ALTER TABLE public.backups ADD COLUMN IF NOT EXISTS encryption_method TEXT;
ALTER TABLE public.backups ADD COLUMN IF NOT EXISTS sha256 TEXT;
ALTER TABLE public.backups ADD COLUMN IF NOT EXISTS size_bytes BIGINT;
ALTER TABLE public.backups ADD COLUMN IF NOT EXISTS tables_count INT;
ALTER TABLE public.backups ADD COLUMN IF NOT EXISTS rows_count BIGINT;
ALTER TABLE public.backups ADD COLUMN IF NOT EXISTS engine_used TEXT;
ALTER TABLE public.backups ADD COLUMN IF NOT EXISTS format TEXT DEFAULT 'custom';

ALTER TABLE public.project_credentials ADD COLUMN IF NOT EXISTS connection_type TEXT;
ALTER TABLE public.project_credentials ADD COLUMN IF NOT EXISTS region TEXT;
ALTER TABLE public.project_credentials ADD COLUMN IF NOT EXISTS project_ref TEXT;
ALTER TABLE public.project_credentials ADD COLUMN IF NOT EXISTS ssl_mode TEXT DEFAULT 'require';
ALTER TABLE public.project_credentials ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ;
ALTER TABLE public.project_credentials ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending';

ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS retention_daily INT DEFAULT 7;
ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS retention_weekly INT DEFAULT 4;
ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS retention_monthly INT DEFAULT 12;
ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS last_run_at TIMESTAMPTZ;
ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS consecutive_failures INT DEFAULT 0;

ALTER TABLE public.verification_reports ADD COLUMN IF NOT EXISTS checksum_match BOOLEAN;
ALTER TABLE public.verification_reports ADD COLUMN IF NOT EXISTS restore_duration_ms INT;
ALTER TABLE public.verification_reports ADD COLUMN IF NOT EXISTS error_details TEXT;

ALTER TABLE public.restores ADD COLUMN IF NOT EXISTS target_host TEXT;
ALTER TABLE public.restores ADD COLUMN IF NOT EXISTS target_database TEXT;
ALTER TABLE public.restores ADD COLUMN IF NOT EXISTS force_used BOOLEAN DEFAULT false;
ALTER TABLE public.restores ADD COLUMN IF NOT EXISTS engine_used TEXT;
ALTER TABLE public.restores ADD COLUMN IF NOT EXISTS tables_restored INT;
ALTER TABLE public.restores ADD COLUMN IF NOT EXISTS rows_restored BIGINT;

CREATE TABLE IF NOT EXISTS public.worker_heartbeats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id TEXT NOT NULL,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'healthy',
  jobs_processed INT DEFAULT 0,
  jobs_failed INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.worker_heartbeats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "heartbeats_service_all" ON public.worker_heartbeats;
CREATE POLICY "heartbeats_service_all" ON public.worker_heartbeats
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "heartbeats_admin_read" ON public.worker_heartbeats;
CREATE POLICY "heartbeats_admin_read" ON public.worker_heartbeats
  FOR SELECT TO authenticated USING (public.is_superadmin());

GRANT ALL ON public.worker_heartbeats TO service_role;
GRANT SELECT ON public.worker_heartbeats TO authenticated;

CREATE INDEX IF NOT EXISTS idx_worker_heartbeats_worker ON public.worker_heartbeats (worker_id);
CREATE INDEX IF NOT EXISTS idx_worker_heartbeats_last_seen ON public.worker_heartbeats (last_seen DESC);

CREATE TABLE IF NOT EXISTS public.sla_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  max_age_hours INT NOT NULL DEFAULT 24,
  last_verified_backup_age_hours INT,
  last_checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'unknown',
  details JSONB
);

ALTER TABLE public.sla_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sla_checks_org_read" ON public.sla_checks;
CREATE POLICY "sla_checks_org_read" ON public.sla_checks
  FOR SELECT TO authenticated
  USING (
    project_id IN (
      SELECT p.id FROM public.projects p
      JOIN public.organizations o ON p.organization_id = o.id
      WHERE public.is_org_member(o.id, auth.uid())
    ) AND public.is_permanent_user()
  );

GRANT SELECT ON public.sla_checks TO authenticated;
GRANT ALL ON public.sla_checks TO service_role;

CREATE INDEX IF NOT EXISTS idx_sla_checks_project ON public.sla_checks (project_id);
CREATE INDEX IF NOT EXISTS idx_sla_checks_status ON public.sla_checks (status);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'worker_heartbeats') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.worker_heartbeats;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'sla_checks') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sla_checks;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.claim_job(p_worker_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_job RECORD;
BEGIN
  SELECT * INTO v_job FROM public.jobs
  WHERE status = 'queued' AND kind IN ('backup', 'restore', 'verify', 'storage', 'cleanup')
  ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'No jobs available');
  END IF;

  UPDATE public.jobs SET status = 'claimed', claimed_at = now(), progress = 0,
    progress_message = 'Job claimed by worker ' || p_worker_id WHERE id = v_job.id;

  RETURN jsonb_build_object('success', true, 'job', to_jsonb(v_job));
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_job(TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.update_job_progress(p_job_id UUID, p_progress INT, p_message TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.jobs SET progress = p_progress, progress_message = p_message, updated_at = now()
  WHERE id = p_job_id AND status = 'running';
  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_job_progress(UUID, INT, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.complete_job(
  p_job_id UUID, p_success BOOLEAN, p_result JSONB DEFAULT NULL,
  p_error JSONB DEFAULT NULL, p_engine_used TEXT DEFAULT NULL, p_engine_fallback_used BOOLEAN DEFAULT false
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.jobs SET
    status = CASE WHEN p_success THEN 'succeeded' ELSE 'failed' END,
    result = p_result, error = p_error, engine_used = p_engine_used,
    engine_fallback_used = p_engine_fallback_used,
    progress = CASE WHEN p_success THEN 100 ELSE progress END,
    progress_message = CASE WHEN p_success THEN 'Completed successfully' ELSE 'Job failed' END,
    completed_at = now(), updated_at = now()
  WHERE id = p_job_id;
  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_job(UUID, BOOLEAN, JSONB, JSONB, TEXT, BOOLEAN) TO service_role;

CREATE OR REPLACE FUNCTION public.record_backup(
  p_project_id UUID, p_job_id UUID, p_r2_key TEXT, p_size_bytes BIGINT,
  p_sha256 TEXT, p_engine_used TEXT, p_format TEXT DEFAULT 'custom',
  p_encrypted BOOLEAN DEFAULT false, p_encryption_method TEXT DEFAULT NULL,
  p_tables_count INT DEFAULT NULL, p_rows_count BIGINT DEFAULT NULL, p_verified BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_backup_id UUID;
BEGIN
  INSERT INTO public.backups (project_id, job_id, r2_key, size_bytes, sha256, engine_used, format, encrypted, encryption_method, tables_count, rows_count, verified, status, created_at)
  VALUES (p_project_id, p_job_id, p_r2_key, p_size_bytes, p_sha256, p_engine_used, p_format, p_encrypted, p_encryption_method, p_tables_count, p_rows_count, p_verified, 'completed', now())
  RETURNING id INTO v_backup_id;

  INSERT INTO public.audit_logs (organization_id, actor_user_id, action, resource_type, resource_id, metadata)
  SELECT pr.organization_id, NULL, 'backup_created', 'backup', v_backup_id,
    jsonb_build_object('job_id', p_job_id, 'engine', p_engine_used, 'size_bytes', p_size_bytes, 'verified', p_verified, 'tables_count', p_tables_count, 'rows_count', p_rows_count)
  FROM public.projects pr WHERE pr.id = p_project_id;

  RETURN v_backup_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_backup(UUID, UUID, TEXT, BIGINT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, INT, BIGINT, BOOLEAN) TO service_role;

CREATE OR REPLACE FUNCTION public.record_verification(
  p_backup_id UUID, p_verified BOOLEAN, p_tables_count INT DEFAULT NULL,
  p_rows_count BIGINT DEFAULT NULL, p_checksum_match BOOLEAN DEFAULT NULL,
  p_restore_duration_ms INT DEFAULT NULL, p_error_details TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_report_id UUID; v_project_id UUID; v_org_id UUID;
BEGIN
  SELECT project_id INTO v_project_id FROM public.backups WHERE id = p_backup_id;

  INSERT INTO public.verification_reports (backup_id, verified, tables_count, rows_count, checksum_match, restore_duration_ms, error_details, verified_at)
  VALUES (p_backup_id, p_verified, p_tables_count, p_rows_count, p_checksum_match, p_restore_duration_ms, p_error_details, now())
  RETURNING id INTO v_report_id;

  UPDATE public.backups SET verified = p_verified, verification_report_id = v_report_id,
    tables_count = COALESCE(p_tables_count, tables_count), rows_count = COALESCE(p_rows_count, rows_count)
  WHERE id = p_backup_id;

  SELECT pr.organization_id INTO v_org_id FROM public.projects pr WHERE pr.id = v_project_id;

  INSERT INTO public.audit_logs (organization_id, actor_user_id, action, resource_type, resource_id, metadata)
  VALUES (v_org_id, NULL, CASE WHEN p_verified THEN 'verification_passed' ELSE 'verification_failed' END, 'backup', p_backup_id,
    jsonb_build_object('report_id', v_report_id, 'tables_count', p_tables_count, 'rows_count', p_rows_count, 'checksum_match', p_checksum_match, 'error', p_error_details));

  IF NOT p_verified THEN
    INSERT INTO public.notifications (organization_id, severity, title, message, created_at)
    VALUES (v_org_id, 'warning', 'Backup verification failed', 'Backup ' || p_backup_id::text || ' failed verification. The backup file may be corrupted.', now());
  END IF;

  RETURN v_report_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_verification(UUID, BOOLEAN, INT, BIGINT, BOOLEAN, INT, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.record_restore(
  p_backup_id UUID, p_project_id UUID, p_target_host TEXT, p_target_database TEXT,
  p_status TEXT, p_tables_restored INT DEFAULT NULL, p_rows_restored BIGINT DEFAULT NULL,
  p_engine_used TEXT DEFAULT NULL, p_force_used BOOLEAN DEFAULT false, p_errors TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_restore_id UUID; v_org_id UUID;
BEGIN
  INSERT INTO public.restores (backup_id, project_id, target_host, target_database, status, tables_restored, rows_restored, engine_used, force_used, errors, started_at, completed_at)
  VALUES (p_backup_id, p_project_id, p_target_host, p_target_database, p_status, p_tables_restored, p_rows_restored, p_engine_used, p_force_used, p_errors, now(), now())
  RETURNING id INTO v_restore_id;

  SELECT pr.organization_id INTO v_org_id FROM public.projects pr WHERE pr.id = p_project_id;

  INSERT INTO public.audit_logs (organization_id, actor_user_id, action, resource_type, resource_id, metadata)
  VALUES (v_org_id, NULL, CASE WHEN p_status = 'completed' THEN 'restore_completed' ELSE 'restore_failed' END, 'backup', p_backup_id,
    jsonb_build_object('restore_id', v_restore_id, 'target_host', p_target_host, 'target_database', p_target_database, 'tables_restored', p_tables_restored, 'rows_restored', p_rows_restored, 'engine', p_engine_used, 'force', p_force_used));

  RETURN v_restore_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_restore(UUID, UUID, TEXT, TEXT, TEXT, INT, BIGINT, TEXT, BOOLEAN, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.update_heartbeat(
  p_worker_id TEXT, p_status TEXT DEFAULT 'healthy', p_jobs_processed INT DEFAULT 0, p_jobs_failed INT DEFAULT 0
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.worker_heartbeats (worker_id, last_seen, status, jobs_processed, jobs_failed)
  VALUES (p_worker_id, now(), p_status, p_jobs_processed, p_jobs_failed)
  ON CONFLICT (worker_id) DO UPDATE SET last_seen = now(), status = p_status,
    jobs_processed = worker_heartbeats.jobs_processed + p_jobs_processed,
    jobs_failed = worker_heartbeats.jobs_failed + p_jobs_failed;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_heartbeat(TEXT, TEXT, INT, INT) TO service_role;

CREATE OR REPLACE FUNCTION public.check_sla(p_project_id UUID, p_max_age_hours INT DEFAULT 24)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_last_backup TIMESTAMPTZ; v_age_hours FLOAT; v_org_id UUID; v_status TEXT;
BEGIN
  SELECT created_at INTO v_last_backup FROM public.backups WHERE project_id = p_project_id AND verified = true ORDER BY created_at DESC LIMIT 1;
  SELECT organization_id INTO v_org_id FROM public.projects WHERE id = p_project_id;

  IF v_last_backup IS NULL THEN
    v_status := 'critical'; v_age_hours := NULL;
  ELSE
    v_age_hours := EXTRACT(EPOCH FROM (now() - v_last_backup)) / 3600;
    IF v_age_hours > p_max_age_hours THEN v_status := 'critical';
    ELSEIF v_age_hours > p_max_age_hours * 0.8 THEN v_status := 'warning';
    ELSE v_status := 'healthy'; END IF;
  END IF;

  INSERT INTO public.sla_checks (project_id, max_age_hours, last_verified_backup_age_hours, status, details)
  VALUES (p_project_id, p_max_age_hours, v_age_hours, v_status, jsonb_build_object('last_backup_at', v_last_backup, 'age_hours', v_age_hours));

  IF v_status = 'critical' THEN
    INSERT INTO public.notifications (organization_id, severity, title, message, created_at)
    VALUES (v_org_id, 'warning', 'No verified backup in ' || p_max_age_hours || ' hours', 'Project has no verified backup within the SLA window. Check backup schedules.', now());
  END IF;

  RETURN jsonb_build_object('status', v_status, 'last_backup_at', v_last_backup, 'age_hours', v_age_hours, 'max_age_hours', p_max_age_hours);
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_sla(UUID, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_sla(UUID, INT) TO authenticated;

CREATE OR REPLACE FUNCTION public.prune_old_backups(
  p_project_id UUID, p_keep_daily INT DEFAULT 7, p_keep_weekly INT DEFAULT 4, p_keep_monthly INT DEFAULT 12
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_deleted_count INT := 0; v_kept_count INT; v_most_recent_id UUID; v_org_id UUID; v_verified_count INT;
BEGIN
  SELECT COUNT(*) INTO v_verified_count FROM public.backups WHERE project_id = p_project_id AND verified = true;
  IF v_verified_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot prune: no verified backups exist');
  END IF;

  SELECT id INTO v_most_recent_id FROM public.backups WHERE project_id = p_project_id AND verified = true ORDER BY created_at DESC LIMIT 1;

  DELETE FROM public.backups WHERE project_id = p_project_id AND id != v_most_recent_id
    AND created_at < now() - (p_keep_daily || ' days')::INTERVAL AND created_at < now() - INTERVAL '24 hours'
    AND NOT (verified = false AND created_at > now() - INTERVAL '48 hours');

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  SELECT COUNT(*) INTO v_kept_count FROM public.backups WHERE project_id = p_project_id;
  SELECT organization_id INTO v_org_id FROM public.projects WHERE id = p_project_id;

  INSERT INTO public.audit_logs (organization_id, actor_user_id, action, resource_type, resource_id, metadata)
  VALUES (v_org_id, NULL, 'prune_executed', 'project', p_project_id,
    jsonb_build_object('deleted_count', v_deleted_count, 'kept_count', v_kept_count, 'keep_daily', p_keep_daily, 'keep_weekly', p_keep_weekly, 'keep_monthly', p_keep_monthly));

  RETURN jsonb_build_object('success', true, 'deleted_count', v_deleted_count, 'kept_count', v_kept_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.prune_old_backups(UUID, INT, INT, INT) TO service_role;

CREATE OR REPLACE FUNCTION public.update_schedule_next_run(p_schedule_id UUID, p_success BOOLEAN)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_frequency TEXT; v_next_run TIMESTAMPTZ;
BEGIN
  SELECT frequency INTO v_frequency FROM public.schedules WHERE id = p_schedule_id;
  v_next_run := CASE v_frequency WHEN 'hourly' THEN now() + INTERVAL '1 hour' WHEN 'daily' THEN now() + INTERVAL '1 day' WHEN 'weekly' THEN now() + INTERVAL '7 days' WHEN 'monthly' THEN now() + INTERVAL '30 days' ELSE now() + INTERVAL '1 day' END;
  UPDATE public.schedules SET next_run_at = v_next_run, last_run_at = now(), consecutive_failures = CASE WHEN p_success THEN 0 ELSE consecutive_failures + 1 END WHERE id = p_schedule_id;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_schedule_next_run(UUID, BOOLEAN) TO service_role;

CREATE OR REPLACE FUNCTION public.get_due_schedules()
RETURNS TABLE(id UUID, project_id UUID, frequency TEXT, retention_daily INT, retention_weekly INT, retention_monthly INT)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.project_id, s.frequency, s.retention_daily, s.retention_weekly, s.retention_monthly
  FROM public.schedules s WHERE s.enabled = true AND s.next_run_at <= now()
  ORDER BY s.next_run_at ASC LIMIT 10 FOR UPDATE SKIP LOCKED;
$$;

GRANT EXECUTE ON FUNCTION public.get_due_schedules() TO service_role;
