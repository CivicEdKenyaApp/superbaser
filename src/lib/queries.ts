import { supabase } from './supabase';

export async function listMyOrganizations(userId: string) {
  const { data, error } = await supabase
    .from("organization_members")
    .select("role, organizations:organization_id(id, name, slug, plan, created_at)")
    .eq("user_id", userId);
    
  if (error) throw new Error(error.message);
  
  return (data ?? []).map((row) => ({
    role: row.role,
    organization: Array.isArray(row.organizations) ? row.organizations[0] : row.organizations,
  }));
}

export async function listProjects(organizationId: string) {
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, supabase_project_ref, region, postgres_version, status, last_inventory_at, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
    
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listBackups(organizationId: string) {
  const { data, error } = await supabase
    .from("backups")
    .select("id, status, bytes_total, bytes_uploaded, stage, progress_percent, started_at, finished_at, verified_at, error_message, project_id, triggered_via, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(200);
    
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listRestores(organizationId: string) {
  const { data, error } = await supabase
    .from("restores")
    .select("id, status, stage, progress_percent, started_at, finished_at, error_message, destination_project_id, backup_id, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(200);
    
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listSchedules(organizationId: string) {
  const { data, error } = await supabase
    .from("schedules")
    .select("id, name, cron_expression, timezone, enabled, retention_days, last_run_at, next_run_at, project_id, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
    
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listLogs(organizationId: string) {
  const { data, error } = await supabase
    .from("jobs")
    .select("id, kind, status, priority, attempt, error_code, error_message, started_at, finished_at, created_at, project_id, backup_id, restore_id, trace_id")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(200);
    
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getDashboardSummary(organizationId: string) {
  const [projectsRes, backupsRes, restoresRes, jobsRes, schedulesRes] = await Promise.all([
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
    supabase.from("backups").select("id, status, bytes_total, finished_at, created_at").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(10),
    supabase.from("restores").select("id, status, created_at").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(10),
    supabase.from("jobs").select("id, status, kind").eq("organization_id", organizationId).in("status", ["queued", "claimed", "running"]),
    supabase.from("schedules").select("id, enabled").eq("organization_id", organizationId),
  ]);

  const totalBytes = (backupsRes.data ?? [])
    .filter((b) => b.status === "completed" || b.status === "verified")
    .reduce((s, b) => s + (b.bytes_total ?? 0), 0);

  return {
    projectsCount: projectsRes.count ?? 0,
    runningJobs: (jobsRes.data ?? []).length,
    schedulesEnabled: (schedulesRes.data ?? []).filter((s) => s.enabled).length,
    storageBytes: totalBytes,
    recentBackups: backupsRes.data ?? [],
    recentRestores: restoresRes.data ?? [],
  };
}
