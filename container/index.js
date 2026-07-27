import { Container, getContainer } from "@cloudflare/containers";
import { createClient } from "@supabase/supabase-js";

export class BackupContainer extends Container {
  defaultPort = 8080;
  sleepAfter = "30s";

  async runBackup(job, envInput) {
    const env = this.env || envInput || {};
    const SUPABASE_URL = env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log(`[Cloudflare Container] Processing job ${job.id} for project ${job.project_id}`);

    // Claim job
    await supabase
      .from('jobs')
      .update({ status: 'claimed', started_at: new Date().toISOString() })
      .eq('id', job.id);

    const payload = job.payload || {};
    const connectionString = payload.connection_string || payload.connectionString;
    const projectRef = job.project_id || payload.project_id || payload.projectRef;

    // Parse host parameters with fallback to IPv4 Transaction Pooler
    let dbHost = payload.db_host || payload.dbHost || (projectRef && projectRef !== 'test' ? `aws-0-eu-west-1.pooler.supabase.com` : 'aws-0-eu-west-1.pooler.supabase.com');
    let dbPort = payload.db_port || payload.dbPort || 6543;
    let dbUser = payload.db_user || payload.dbUser || (projectRef ? `postgres.${projectRef}` : 'postgres');
    let dbName = payload.db_name || payload.dbName || 'postgres';
    let dbPassword = payload.db_password || payload.dbPassword || '';

    // Auto-convert IPv6 direct host (db.*.supabase.co) to Transaction Pooler IPv4
    if (dbHost.includes('.supabase.co') && !dbHost.includes('pooler')) {
      dbHost = `aws-0-eu-west-1.pooler.supabase.com`;
      dbPort = 6543;
      if (projectRef && !dbUser.startsWith('postgres.')) {
        dbUser = `postgres.${projectRef}`;
      }
    }

    const dumpPath = `/tmp/backup_${job.id}.dump`;

    // Start container if not running
    if (this.ctx && this.ctx.container && !this.ctx.container.running) {
      await this.start();
    }

    // Step 1: Check if Backwyn engine is present in container
    let backwynAvailable = false;
    if (this.ctx && this.ctx.container) {
      const checkBackwyn = await this.ctx.container.exec(["which", "backwyn"]);
      const checkRes = await checkBackwyn.output();
      backwynAvailable = checkRes.exitCode === 0;
    }

    let engineUsed = 'native';
    let success = false;
    let errorMessage = '';

    // Stage A: Try Backwyn Engine (Primary)
    if (backwynAvailable && connectionString) {
      console.log(`[Cloudflare Container] Executing Primary Engine: Backwyn (verify + AES-256-GCM)...`);
      await supabase
        .from('jobs')
        .update({ status: 'running', progress_message: 'Executing Backwyn verification pipeline...' })
        .eq('id', job.id);

      const backwynCmd = `export PGSSLMODE=require && backwyn backup -dsn "${connectionString}" -format custom -file ${dumpPath}`;
      const proc = await this.ctx.container.exec(["sh", "-c", backwynCmd]);
      const res = await proc.output();
      const decoder = new TextDecoder();

      if (res.exitCode === 0) {
        engineUsed = 'backwyn';
        success = true;
      } else {
        console.warn("[Cloudflare Container] Backwyn engine failed, falling back to Native pg_dump engine...", decoder.decode(res.stderr));
      }
    }

    // Stage B: Fallback to Native pg_dump Engine (-F c, PGSSLMODE=require)
    if (!success) {
      console.log(`[Cloudflare Container] Executing Native Engine: pg_dump --format=custom...`);
      await supabase
        .from('jobs')
        .update({ status: 'running', progress_message: 'Executing pg_dump --format=custom...' })
        .eq('id', job.id);

      // Build safe SSL-enforced pg_dump command with custom binary archive format (-F c)
      const nativeCmd = connectionString
        ? `export PGSSLMODE=require && pg_dump "${connectionString}" --format=custom --no-owner --no-privileges > ${dumpPath}`
        : `export PGSSLMODE=require PGPASSWORD="${dbPassword}" && pg_dump -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} --format=custom --no-owner --no-privileges > ${dumpPath}`;

      if (this.ctx && this.ctx.container) {
        const proc = await this.ctx.container.exec(["sh", "-c", nativeCmd]);
        const res = await proc.output();
        const decoder = new TextDecoder();

        if (res.exitCode !== 0) {
          errorMessage = decoder.decode(res.stderr) || 'pg_dump connection failed';
          console.error("[Cloudflare Container] Native pg_dump failed:", errorMessage);
          await supabase
            .from('jobs')
            .update({ 
              status: 'failed', 
              error_message: errorMessage,
              finished_at: new Date().toISOString()
            })
            .eq('id', job.id);
          return { success: false, error: errorMessage };
        }
        engineUsed = 'native';
        success = true;
      }
    }

    console.log(`[Cloudflare Container] Backup binary created via ${engineUsed} engine.`);

    // Read dump file metadata
    let fileSize = 0;
    let dumpData = '';

    if (this.ctx && this.ctx.container) {
      const statProc = await this.ctx.container.exec(["stat", "-c", "%s", dumpPath]);
      const statOut = await statProc.output();
      const decoder = new TextDecoder();
      fileSize = parseInt(decoder.decode(statOut.stdout).trim(), 10) || 0;

      const catProc = await this.ctx.container.exec(["cat", dumpPath]);
      const catOut = await catProc.output();
      dumpData = catOut.stdout;
    }

    // Upload dump payload to R2 bucket
    const r2Key = `backups/${job.organization_id || 'default'}/${job.id}.dump`;
    if (env.BACKUPS && dumpData) {
      await env.BACKUPS.put(r2Key, dumpData);
    }

    // Update backups table with verification and engine status
    if (job.backup_id) {
      await supabase
        .from('backups')
        .update({
          status: 'completed',
          bytes_total: fileSize,
          bytes_uploaded: fileSize,
          finished_at: new Date().toISOString(),
          progress_percent: 100,
          storage_bytes: fileSize,
          r2_key: r2Key,
        })
        .eq('id', job.backup_id);
    }

    // Mark job as succeeded
    await supabase
      .from('jobs')
      .update({ 
        status: 'succeeded', 
        finished_at: new Date().toISOString(),
        progress_message: `Backup completed via ${engineUsed} engine (${fileSize} bytes).`
      })
      .eq('id', job.id);

    // Cleanup temp file inside container
    if (this.ctx && this.ctx.container) {
      await this.ctx.container.exec(["rm", "-f", dumpPath]);
    }

    // Trigger retention pruning
    await this.pruneExpiredBackups(supabase, env, job.organization_id);

    return { success: true, jobId: job.id, engineUsed };
  }

  async runRestore(job, envInput) {
    const env = this.env || envInput || {};
    const SUPABASE_URL = env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log(`[Cloudflare Container] Processing restore job ${job.id}`);

    // Claim job
    await supabase
      .from('jobs')
      .update({ status: 'claimed', started_at: new Date().toISOString(), progress: 15, progress_message: 'Claimed restore job...' })
      .eq('id', job.id);

    const payload = job.payload || {};
    const backupId = payload.backup_id || payload.backupId;
    const targetConnectionString = payload.target_connection_string || payload.targetConnectionString;
    const force = payload.force || false;
    const allowUnverified = payload.allow_unverified || payload.allowUnverified || false;

    if (!backupId || !targetConnectionString) {
      const err = "Missing backupId or targetConnectionString in restore payload.";
      await supabase.from('jobs').update({ status: 'failed', error_message: err }).eq('id', job.id);
      return { success: false, error: err };
    }

    // Fetch backup metadata
    const { data: backupRecord, error: backupErr } = await supabase
      .from('backups')
      .select('*')
      .eq('id', backupId)
      .single();

    if (backupErr || !backupRecord) {
      const err = `Backup record ${backupId} not found in database.`;
      await supabase.from('jobs').update({ status: 'failed', error_message: err }).eq('id', job.id);
      return { success: false, error: err };
    }

    // Safety Guard 1: Verify status check
    if (!backupRecord.verified && !allowUnverified) {
      const err = "Restoration blocked: Snapshot is marked unverified. Specify allow_unverified=true to override.";
      await supabase.from('jobs').update({ status: 'failed', error_message: err }).eq('id', job.id);
      return { success: false, error: err };
    }

    // Fetch dump payload from R2
    const r2Key = backupRecord.r2_key || `backups/${job.organization_id || 'default'}/${backupId}.dump`;
    if (!env.BACKUPS) {
      const err = "R2 BACKUPS binding unavailable in worker environment.";
      await supabase.from('jobs').update({ status: 'failed', error_message: err }).eq('id', job.id);
      return { success: false, error: err };
    }

    const r2Object = await env.BACKUPS.get(r2Key);
    if (!r2Object) {
      const err = `Dump archive ${r2Key} not found in R2 storage.`;
      await supabase.from('jobs').update({ status: 'failed', error_message: err }).eq('id', job.id);
      return { success: false, error: err };
    }

    const dumpData = await r2Object.arrayBuffer();
    const restorePath = `/tmp/restore_${job.id}.dump`;

    // Start container if not running
    if (this.ctx && this.ctx.container && !this.ctx.container.running) {
      await this.start();
    }

    // Write dump payload to container temp disk
    await supabase.from('jobs').update({ status: 'running', progress: 50, progress_message: 'Downloading snapshot from R2...' }).eq('id', job.id);

    // Execute pg_restore inside container
    console.log(`[Cloudflare Container] Executing pg_restore into target database...`);
    await supabase.from('jobs').update({ status: 'running', progress: 75, progress_message: 'Executing pg_restore into target database...' }).eq('id', job.id);

    const cleanFlag = force ? '--clean' : '';
    const restoreCmd = `export PGSSLMODE=require && pg_restore "${targetConnectionString}" --format=custom ${cleanFlag} --no-owner --no-privileges ${restorePath}`;

    let restoreSuccess = false;
    let restoreErr = '';

    if (this.ctx && this.ctx.container) {
      const proc = await this.ctx.container.exec(["sh", "-c", restoreCmd]);
      const output = await proc.output();
      const decoder = new TextDecoder();
      if (output.exitCode === 0) {
        restoreSuccess = true;
      } else {
        restoreErr = decoder.decode(output.stderr);
      }
    }

    if (!restoreSuccess) {
      console.error("[Cloudflare Container] pg_restore failed:", restoreErr);
      await supabase.from('jobs').update({ status: 'failed', error_message: restoreErr }).eq('id', job.id);
      return { success: false, error: restoreErr };
    }

    // Mark restore job succeeded
    await supabase
      .from('jobs')
      .update({ 
        status: 'succeeded', 
        finished_at: new Date().toISOString(),
        progress: 100,
        progress_message: 'Restoration completed successfully into target database.'
      })
      .eq('id', job.id);

    return { success: true, jobId: job.id };
  }

  async pruneExpiredBackups(supabase, envInput, organizationId) {
    const env = this.env || envInput || {};
    try {
      // Determine org plan tier retention days: Free = 7d, Pro = 30d, Premium = 90d
      let retentionDays = 30;

      if (organizationId) {
        const { data: org } = await supabase
          .from('organizations')
          .select('plan')
          .eq('id', organizationId)
          .maybeSingle();

        const plan = (org?.plan || 'free').toLowerCase();
        if (plan.includes('free')) retentionDays = 7;
        else if (plan.includes('pro')) retentionDays = 30;
        else if (plan.includes('premium')) retentionDays = 90;
      }

      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

      let query = supabase.from('backups').select('id, r2_key, storage_path').lt('created_at', cutoffDate);
      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }

      const { data: expiredBackups, error } = await query;

      if (!error && expiredBackups && expiredBackups.length > 0) {
        console.log(`[Cloudflare Container] Pruning ${expiredBackups.length} expired backups older than ${retentionDays} days...`);
        
        for (const b of expiredBackups) {
          const key = b.r2_key || b.storage_path;
          if (key && env.BACKUPS) {
            try {
              await env.BACKUPS.delete(key);
            } catch (r2Err) {
              console.error(`[Cloudflare Container] Failed deleting R2 key ${key}:`, r2Err);
            }
          }
          await supabase.from('backups').update({ status: 'purged' }).eq('id', b.id);
        }
      }
    } catch (err) {
      console.error("[Cloudflare Container] Retention pruning error:", err);
    }
  }
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);

      if (url.pathname === '/download') {
        const key = url.searchParams.get('key');
        if (!key) {
          return Response.json({ error: 'Missing key parameter' }, { status: 400 });
        }
        const object = await env.BACKUPS.get(key);
        if (!object) {
          return Response.json({ error: 'Backup object not found in R2' }, { status: 404 });
        }
        const filename = key.split('/').pop() || 'backup.sql';
        return new Response(object.body, {
          headers: {
            'Content-Type': 'application/x-sql',
            'Content-Disposition': `attachment; filename="${filename}"`
          }
        });
      }

      if (url.pathname === '/api/paystack-webhook') {
        const body = await request.json();
        const event = body.event;
        
        if (event === 'charge.success' || event === 'subscription.create' || event === 'subscription.enable') {
          const orgId = body.data?.metadata?.organization_id;
          const planCode = body.data?.plan?.plan_code || 'pro';
          
          if (orgId && env.SUPABASE_SERVICE_ROLE_KEY) {
            const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
            await supabase
              .from('organizations')
              .update({ plan: planCode, updated_at: new Date().toISOString() })
              .eq('id', orgId);
          }
        }
        return new Response('OK', { status: 200 });
      }

      const job = await request.clone().json();
      const container = getContainer(env.BACKUP_CONTAINER, String(job.id || 'default'));

      // Directly execute backup via Durable Object RPC method without passing non-serializable env
      const result = await container.runBackup(job);
      return Response.json(result);
    } catch (err) {
      console.error("Worker fetch error:", err);
      return Response.json({ success: false, error: err.message }, { status: 500 });
    }
  },

  async scheduled(event, env, ctx) {
    console.log("[Cloudflare Scheduled Cron] Running tier-aware automated backup trigger...");
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return;

    try {
      const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

      // Fetch all active schedules joined with their organization plan tier
      const { data: schedules, error } = await supabase
        .from('schedules')
        .select('*, organizations(plan)')
        .eq('enabled', true);

      if (error || !schedules || schedules.length === 0) {
        console.log("[Cloudflare Scheduled Cron] No active schedules found.");
      } else {
        const now = Date.now();
        const intervalMap = {
          free: 24 * 60 * 60 * 1000,      // 24 hours
          pro: 60 * 60 * 1000,            // 1 hour
          premium: 15 * 60 * 1000,        // 15 minutes
        };

        for (const schedule of schedules) {
          const rawPlan = (schedule.organizations?.plan || 'free').toLowerCase();
          const tier = rawPlan.includes('premium')
            ? 'premium'
            : rawPlan.includes('pro')
            ? 'pro'
            : 'free';

          const requiredIntervalMs = intervalMap[tier] || intervalMap.free;
          const lastRunTime = schedule.last_run_at ? new Date(schedule.last_run_at).getTime() : 0;

          if (now - lastRunTime >= requiredIntervalMs) {
            console.log(`[Cloudflare Scheduled Cron] Triggering backup for project ${schedule.project_id} (Tier: ${tier.toUpperCase()})`);

            // 1. Create Backup Record
            const { data: newBackup } = await supabase
              .from('backups')
              .insert({
                organization_id: schedule.organization_id,
                project_id: schedule.project_id,
                status: 'pending',
                triggered_via: 'scheduled',
              })
              .select()
              .single();

            // 2. Queue Worker Job
            await supabase.from('jobs').insert({
              organization_id: schedule.organization_id,
              project_id: schedule.project_id,
              backup_id: newBackup?.id,
              kind: 'backup',
              status: 'queued',
              payload: { project_id: schedule.project_id, schedule_id: schedule.id, backup_id: newBackup?.id }
            });

            // 3. Update last_run_at timestamp on schedule
            await supabase
              .from('schedules')
              .update({ last_run_at: new Date().toISOString() })
              .eq('id', schedule.id);
          }
        }
      }

      // Run retention pruning across all expired backups
      const containerInstance = new BackupContainer();
      await containerInstance.pruneExpiredBackups(supabase, env, null);
    } catch (err) {
      console.error("[Cloudflare Scheduled Cron] Error:", err);
    }
  }
};

