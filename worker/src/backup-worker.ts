// ─── Backup Worker — Standalone backup/restore/verify dispatcher ──────────────
// FILE 12 OF 15: Backup Worker (separate from SuperbAgent worker)
// Handles job dispatch, progress reporting, SLA checks, scheduling.
// This is a SEPARATE worker from the SuperbAgent worker (src/index.ts).
// Deploy with: wrangler deploy --config wrangler-backup.jsonc

export interface BackupWorkerEnv {
  BACKUP_CONTAINER: DurableObjectNamespace;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  R2_BACKUPS: R2Bucket;
  ENCRYPTION_KEY: string;
  WORKER_URL: string;
}

interface WebhookPayload {
  type: string;
  table: string;
  record: {
    id: string;
    organization_id: string;
    project_id: string;
    kind: string;
    status: string;
    payload: any;
    created_at: string;
  };
  old_record?: any;
}

export default {
  async fetch(request: Request, env: BackupWorkerEnv): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/health')
      return Response.json({ status: 'ok', timestamp: new Date().toISOString() });

    if (request.method === 'POST' && url.pathname === '/heartbeat') {
      const body = await request.json() as any;
      await supabaseRpc(env, 'update_heartbeat', { p_worker_id: body.worker_id, p_status: body.status || 'healthy', p_jobs_processed: body.jobs_processed || 0, p_jobs_failed: body.jobs_failed || 0 });
      return Response.json({ success: true });
    }

    if (request.method === 'POST' && url.pathname === '/claim-job') {
      const body = await request.json() as any;
      return Response.json(await supabaseRpc(env, 'claim_job', { p_worker_id: body.worker_id }));
    }

    if (request.method === 'POST' && url.pathname === '/update-progress') {
      const body = await request.json() as any;
      const result = await supabaseRpc(env, 'update_job_progress', { p_job_id: body.job_id, p_progress: body.progress, p_message: body.message });
      return Response.json({ success: result === true });
    }

    if (request.method === 'POST' && url.pathname === '/complete-job') {
      const body = await request.json() as any;
      const result = await supabaseRpc(env, 'complete_job', { p_job_id: body.job_id, p_success: body.success, p_result: body.result || null, p_error: body.error || null, p_engine_used: body.engine_used || null, p_engine_fallback_used: body.engine_fallback_used || false });
      return Response.json({ success: result === true });
    }

    if (request.method === 'POST' && url.pathname === '/record-backup') {
      const body = await request.json() as any;
      const result = await supabaseRpc(env, 'record_backup', { p_project_id: body.project_id, p_job_id: body.job_id, p_r2_key: body.r2_key, p_size_bytes: body.size_bytes, p_sha256: body.sha256, p_engine_used: body.engine_used, p_format: body.format || 'custom', p_encrypted: body.encrypted || false, p_encryption_method: body.encryption_method || null, p_tables_count: body.tables_count || null, p_rows_count: body.rows_count || null, p_verified: body.verified || false });
      return Response.json({ success: true, backup_id: result });
    }

    if (request.method === 'POST' && url.pathname === '/record-verification') {
      const body = await request.json() as any;
      const result = await supabaseRpc(env, 'record_verification', { p_backup_id: body.backup_id, p_verified: body.verified, p_tables_count: body.tables_count || null, p_rows_count: body.rows_count || null, p_checksum_match: body.checksum_match || null, p_restore_duration_ms: body.restore_duration_ms || null, p_error_details: body.error_details || null });
      return Response.json({ success: true, report_id: result });
    }

    if (request.method === 'POST' && url.pathname === '/record-restore') {
      const body = await request.json() as any;
      const result = await supabaseRpc(env, 'record_restore', { p_backup_id: body.backup_id, p_project_id: body.project_id, p_target_host: body.target_host, p_target_database: body.target_database, p_status: body.status, p_tables_restored: body.tables_restored || null, p_rows_restored: body.rows_restored || null, p_engine_used: body.engine_used || null, p_force_used: body.force_used || false, p_errors: body.errors || null });
      return Response.json({ success: true, restore_id: result });
    }

    if (request.method === 'POST' && url.pathname === '/prune') {
      const body = await request.json() as any;
      return Response.json(await supabaseRpc(env, 'prune_old_backups', { p_project_id: body.project_id, p_keep_daily: body.keep_daily || 7, p_keep_weekly: body.keep_weekly || 4, p_keep_monthly: body.keep_monthly || 12 }));
    }

    if (request.method === 'POST' && url.pathname === '/sla-check') {
      const body = await request.json() as any;
      return Response.json(await supabaseRpc(env, 'check_sla', { p_project_id: body.project_id, p_max_age_hours: body.max_age_hours || 24 }));
    }

    // Supabase Database Webhook — job INSERT triggers container dispatch
    if (request.method === 'POST' && url.pathname === '/') {
      const payload = await request.json() as WebhookPayload;
      if (payload.type !== 'INSERT' || payload.table !== 'jobs')
        return Response.json({ success: true, message: 'Ignored: not a job insert' });
      const job = payload.record;
      if (!['backup', 'restore', 'verify', 'storage', 'cleanup'].includes(job.kind))
        return Response.json({ success: true, message: 'Ignored: not a backup job kind' });

      const doId = env.BACKUP_CONTAINER.idFromName('backup-runner');
      const doStub = env.BACKUP_CONTAINER.get(doId);
      const containerResponse = await doStub.fetch(new Request('https://internal/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: job.id, organization_id: job.organization_id, project_id: job.project_id, kind: job.kind, payload: job.payload }),
      }));
      const containerResult = await containerResponse.json() as any;
      return Response.json({ success: true, job_id: job.id, container: containerResult });
    }

    return new Response('Not found', { status: 404 });
  },

  async scheduled(event: ScheduledEvent, env: BackupWorkerEnv, ctx: ExecutionContext): Promise<void> {
    // Trigger due schedules
    const dueSchedules = await supabaseRpc(env, 'get_due_schedules', {});
    const schedules = Array.isArray(dueSchedules) ? dueSchedules : [];
    for (const schedule of schedules) {
      await fetch(env.SUPABASE_URL + '/rest/v1/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_KEY, 'apikey': env.SUPABASE_SERVICE_KEY },
        body: JSON.stringify({ organization_id: schedule.organization_id, project_id: schedule.project_id, kind: 'backup', priority: 'normal', status: 'queued', payload: { source: 'schedule', schedule_id: schedule.id, retention_daily: schedule.retention_daily, retention_weekly: schedule.retention_weekly, retention_monthly: schedule.retention_monthly } }),
      });
      await supabaseRpc(env, 'update_schedule_next_run', { p_schedule_id: schedule.id, p_success: true });
    }

    // SLA checks for all projects
    const projectsResp = await fetch(env.SUPABASE_URL + '/rest/v1/projects?select=id', {
      headers: { 'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_KEY, 'apikey': env.SUPABASE_SERVICE_KEY },
    });
    const projects = await projectsResp.json() as any[];
    for (const project of projects) {
      await supabaseRpc(env, 'check_sla', { p_project_id: project.id, p_max_age_hours: 24 });
    }

    // Prune per schedule retention settings
    const schedulesResp = await fetch(env.SUPABASE_URL + '/rest/v1/schedules?select=project_id,retention_daily,retention_weekly,retention_monthly&enabled=eq.true', {
      headers: { 'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_KEY, 'apikey': env.SUPABASE_SERVICE_KEY },
    });
    const allSchedules = await schedulesResp.json() as any[];
    for (const s of allSchedules) {
      await supabaseRpc(env, 'prune_old_backups', { p_project_id: s.project_id, p_keep_daily: s.retention_daily, p_keep_weekly: s.retention_weekly, p_keep_monthly: s.retention_monthly });
    }
  },
};

async function supabaseRpc(env: BackupWorkerEnv, fn: string, params: any): Promise<any> {
  const response = await fetch(env.SUPABASE_URL + '/rest/v1/rpc/' + fn, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_KEY, 'apikey': env.SUPABASE_SERVICE_KEY },
    body: JSON.stringify(params),
  });
  return response.json();
}
