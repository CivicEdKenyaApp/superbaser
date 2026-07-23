import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const OrgIdInput = z.object({ organizationId: z.string().uuid() });

export const listMyOrganizations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("organization_members")
      .select("role, organizations:organization_id(id, name, slug, plan, created_at)")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      role: row.role,
      organization: row.organizations as unknown as {
        id: string;
        name: string;
        slug: string;
        plan: string;
        created_at: string;
      },
    }));
  });

export const listOrganizationMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => OrgIdInput.parse(i))
  .handler(async ({ data, context }) => {
    const { data: members, error } = await context.supabase
      .from("organization_members")
      .select("id, role, user_id, created_at")
      .eq("organization_id", data.organizationId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    if (!members?.length) return [];
    const ids = members.map((m) => m.user_id);
    const { data: profiles } = await context.supabase
      .from("profiles")
      .select("id, email, display_name, avatar_url")
      .in("id", ids);
    const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
    return members.map((m) => ({ ...m, profile: byId.get(m.user_id) ?? null }));
  });

export const listProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => OrgIdInput.parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("projects")
      .select("id, name, supabase_project_ref, region, postgres_version, status, last_inventory_at, created_at")
      .eq("organization_id", data.organizationId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getProject = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("projects")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const listBackups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => OrgIdInput.parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("backups")
      .select("id, status, bytes_total, bytes_uploaded, stage, progress_percent, started_at, finished_at, verified_at, error_message, project_id, triggered_via, created_at")
      .eq("organization_id", data.organizationId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listRestores = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => OrgIdInput.parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("restores")
      .select("id, status, stage, progress_percent, started_at, finished_at, error_message, destination_project_id, backup_id, created_at")
      .eq("organization_id", data.organizationId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listSchedules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => OrgIdInput.parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("schedules")
      .select("id, name, cron_expression, timezone, enabled, retention_days, last_run_at, next_run_at, project_id, created_at")
      .eq("organization_id", data.organizationId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listVerifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => OrgIdInput.parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("verification_reports")
      .select("id, status, summary, backup_id, restore_id, created_at")
      .eq("organization_id", data.organizationId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listStorageObjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ organizationId: z.string().uuid(), backupId: z.string().uuid().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("backup_storage_objects")
      .select("id, bucket, path, size_bytes, mime_type, last_modified, backup_id")
      .eq("organization_id", data.organizationId)
      .order("path", { ascending: true })
      .limit(1000);
    if (data.backupId) q = q.eq("backup_id", data.backupId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => OrgIdInput.parse(i))
  .handler(async ({ data, context }) => {
    const { data: jobs, error } = await context.supabase
      .from("jobs")
      .select("id, kind, status, priority, attempt, error_code, error_message, started_at, finished_at, created_at, project_id, backup_id, restore_id, trace_id")
      .eq("organization_id", data.organizationId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return jobs ?? [];
  });

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => OrgIdInput.parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("notifications")
      .select("*")
      .eq("organization_id", data.organizationId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listApiKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => OrgIdInput.parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("api_keys")
      .select("id, name, prefix, scopes, last_used_at, expires_at, revoked_at, created_at")
      .eq("organization_id", data.organizationId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listWebhooks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => OrgIdInput.parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("webhooks")
      .select("id, url, events, enabled, last_delivery_at, last_delivery_status, created_at")
      .eq("organization_id", data.organizationId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => OrgIdInput.parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("audit_logs")
      .select("*")
      .eq("organization_id", data.organizationId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listWorkerHeartbeats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("worker_heartbeats")
      .select("*")
      .order("last_seen_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const dashboardSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => OrgIdInput.parse(i))
  .handler(async ({ data, context }) => {
    const orgId = data.organizationId;
    const [projects, backups, restores, jobs, schedules] = await Promise.all([
      context.supabase.from("projects").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
      context.supabase.from("backups").select("id, status, bytes_total, finished_at, created_at").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(10),
      context.supabase.from("restores").select("id, status, created_at").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(10),
      context.supabase.from("jobs").select("id, status, kind").eq("organization_id", orgId).in("status", ["queued", "claimed", "running"]),
      context.supabase.from("schedules").select("id, enabled").eq("organization_id", orgId),
    ]);
    const totalBytes = (backups.data ?? [])
      .filter((b) => b.status === "completed" || b.status === "verified")
      .reduce((s, b) => s + (b.bytes_total ?? 0), 0);
    return {
      projectsCount: projects.count ?? 0,
      runningJobs: (jobs.data ?? []).length,
      schedulesEnabled: (schedules.data ?? []).filter((s) => s.enabled).length,
      storageBytes: totalBytes,
      recentBackups: backups.data ?? [],
      recentRestores: restores.data ?? [],
    };
  });
