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
    const dbHost = payload.db_host || payload.dbHost || (projectRef && projectRef !== 'test' ? `db.${projectRef}.supabase.co` : 'db.supabase.co');
    const dbPort = payload.db_port || payload.dbPort || 5432;
    const dbUser = payload.db_user || payload.dbUser || 'postgres';
    const dbName = payload.db_name || payload.dbName || 'postgres';
    const dbPassword = payload.db_password || payload.dbPassword || '';

    const dumpPath = `/tmp/backup_${job.id}.sql`;

    // Build pg_dump command
    const cmd = connectionString
      ? `pg_dump "${connectionString}" --format=plain --no-owner --no-privileges > ${dumpPath}`
      : `PGPASSWORD="${dbPassword}" pg_dump -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} --format=plain --no-owner --no-privileges > ${dumpPath}`;

    // Start container if not running
    if (!this.ctx.container.running) {
      await this.start();
    }

    // Execute pg_dump inside the container
    const process = await this.ctx.container.exec(["sh", "-c", cmd]);
    const output = await process.output();
    const decoder = new TextDecoder();

    if (output.exitCode !== 0) {
      const stderr = decoder.decode(output.stderr);
      console.error("[Cloudflare Container] pg_dump failed:", stderr);
      await supabase
        .from('jobs')
        .update({ status: 'failed', error_message: stderr })
        .eq('id', job.id);
      return { success: false, error: stderr };
    }

    console.log("[Cloudflare Container] pg_dump completed successfully.");

    // Read the dump file from container filesystem
    const catProcess = await this.ctx.container.exec(["cat", dumpPath]);
    const catOutput = await catProcess.output();
    const dumpData = catOutput.stdout;

    // Get file size
    const statProcess = await this.ctx.container.exec(["stat", "-c", "%s", dumpPath]);
    const statOutput = await statProcess.output();
    const fileSize = parseInt(decoder.decode(statOutput.stdout).trim(), 10);

    // Upload to R2 via binding (zero-latency, no egress fees)
    const r2Key = `backups/${job.organization_id || 'default'}/${job.id}.sql`;
    if (env.BACKUPS) {
      await env.BACKUPS.put(r2Key, dumpData);
    }

    // Update backups table with metadata
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
      .update({ status: 'succeeded', finished_at: new Date().toISOString() })
      .eq('id', job.id);

    // Clean up temp file inside container
    await this.ctx.container.exec(["rm", "-f", dumpPath]);

    // Automatically trigger R2 retention garbage collection to protect 99% margins
    await this.pruneExpiredBackups(supabase, env, job.organization_id);

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

