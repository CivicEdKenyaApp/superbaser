import { supabase } from './supabase';

// ── Platform Overview ────────────────────────────────────────────────────────
export async function getSuperAdminOverview() {
  const [orgsRes, projectsRes, jobsRes, workersRes, backupsRes, billingRes] = await Promise.all([
    supabase.from('organizations').select('id, plan', { count: 'exact' }),
    supabase.from('projects').select('id', { count: 'exact', head: true }),
    supabase.from('jobs').select('id, status, kind, created_at').in('status', ['queued', 'claimed', 'running']),
    supabase.from('worker_heartbeats').select('id, version, queue, running_job_id, last_seen_at'),
    supabase.from('backups').select('id, bytes_total, status, created_at').eq('status', 'completed').order('created_at', { ascending: false }).limit(50),
    supabase.from('billing_events').select('id, event_type, amount_cents, currency, created_at').eq('event_type', 'payment_succeeded').order('created_at', { ascending: false }).limit(50),
  ]);

  const orgs = orgsRes.data ?? [];
  const freeTier  = orgs.filter(o => o.plan === 'free').length;
  const proTier   = orgs.filter(o => o.plan === 'pro').length;
  const premTier  = orgs.filter(o => o.plan === 'premium').length;

  const mrrCents =
    proTier * 1500 + premTier * 4900; // $15 pro, $49 premium in cents

  const storageBytes = (backupsRes.data ?? [])
    .reduce((s, b) => s + (b.bytes_total ?? 0), 0);

  return {
    totalOrgs:    orgsRes.count ?? 0,
    freeTier,
    proTier,
    premiumTier:  premTier,
    totalProjects: projectsRes.count ?? 0,
    activeJobs:   (jobsRes.data ?? []).length,
    workers:      workersRes.data ?? [],
    storageBytes,
    mrrCents,
    recentJobs:   jobsRes.data ?? [],
    billingEvents: billingRes.data ?? [],
  };
}

// ── All Organizations ────────────────────────────────────────────────────────
export async function listAllOrganizations() {
  const { data, error } = await supabase
    .from('organizations')
    .select('id, name, slug, plan, created_at, stripe_customer_id')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getOrgDetails(orgId: string) {
  const [orgRes, membersRes, projectsRes, backupsRes] = await Promise.all([
    supabase.from('organizations').select('*').eq('id', orgId).single(),
    supabase.from('organization_members').select('id, role, user_id, created_at').eq('organization_id', orgId),
    supabase.from('projects').select('id, name, status, created_at').eq('organization_id', orgId),
    supabase.from('backups').select('id, status, bytes_total, created_at').eq('organization_id', orgId).order('created_at', { ascending: false }).limit(5),
  ]);
  return {
    org: orgRes.data,
    members: membersRes.data ?? [],
    projects: projectsRes.data ?? [],
    recentBackups: backupsRes.data ?? [],
  };
}

// ── Plan Limits ──────────────────────────────────────────────────────────────
export async function listPlanLimits() {
  const { data, error } = await supabase
    .from('plan_limits')
    .select('*')
    .order('backup_interval_sec', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ── Worker Fleet ─────────────────────────────────────────────────────────────
export async function listWorkerHeartbeats() {
  const { data, error } = await supabase
    .from('worker_heartbeats')
    .select('id, version, queue, cpu_percent, ram_mb, running_job_id, last_seen_at')
    .order('last_seen_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ── Global Jobs ──────────────────────────────────────────────────────────────
export async function listAllJobs(statusFilter?: string) {
  let q = supabase
    .from('jobs')
    .select('id, kind, status, priority, attempt, max_attempts, error_code, error_message, started_at, finished_at, created_at, organization_id, project_id, backup_id, trace_id, claimed_by')
    .order('created_at', { ascending: false })
    .limit(200);
  if (statusFilter && statusFilter !== 'all') {
    q = q.eq('status', statusFilter);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ── Billing Events ───────────────────────────────────────────────────────────
export async function listAllBillingEvents() {
  const { data, error } = await supabase
    .from('billing_events')
    .select('id, organization_id, event_type, from_plan, to_plan, amount_cents, currency, paystack_event_id, created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ── Audit Logs ───────────────────────────────────────────────────────────────
export async function listSuperAdminAuditLogs() {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('id, action, actor_user_id, resource_type, resource_id, metadata, created_at, organization_id')
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ── Support Emails ───────────────────────────────────────────────────────────
export async function listSupportEmails(statusFilter?: string) {
  let q = supabase
    .from('support_emails')
    .select('id, thread_id, from_email, to_email, subject, body_text, status, assigned_to, message_id, created_at')
    .order('created_at', { ascending: false })
    .limit(100);
  if (statusFilter && statusFilter !== 'all') {
    q = q.eq('status', statusFilter);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getEmailThread(threadId: string) {
  const [emailsRes, repliesRes] = await Promise.all([
    supabase
      .from('support_emails')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true }),
    supabase
      .from('email_replies')
      .select('*')
      .order('sent_at', { ascending: true }),
  ]);
  return {
    emails: emailsRes.data ?? [],
    replies: repliesRes.data ?? [],
  };
}

export async function getSupportEmailById(id: string) {
  const { data, error } = await supabase
    .from('support_emails')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getEmailRepliesForEmail(emailId: string) {
  const { data, error } = await supabase
    .from('email_replies')
    .select('*')
    .eq('email_id', emailId)
    .order('sent_at', { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}
