import { supabase } from './supabase';

// ── Plan Limits CRUD ─────────────────────────────────────────────────────────
export async function updatePlanLimit(
  plan: string,
  updates: {
    max_projects?: number;
    backup_interval_sec?: number;
    retention_days?: number;
    max_api_keys?: number;
    storage_sync?: boolean;
    team_rbac?: boolean;
    audit_logging?: boolean;
    pitr_days?: number;
    multi_region?: boolean;
    dedicated_agent?: boolean;
    support_sla_hours?: number | null;
  }
) {
  const { data, error } = await supabase
    .from('plan_limits')
    .update(updates)
    .eq('plan', plan)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

// ── Jobs: force-fail a stuck job ─────────────────────────────────────────────
export async function forceFailJob(jobId: string, reason: string) {
  const { data, error } = await supabase
    .from('jobs')
    .update({
      status: 'failed',
      error_message: `SuperAdmin force-failed: ${reason}`,
      finished_at: new Date().toISOString(),
    })
    .eq('id', jobId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

// ── Jobs: requeue a failed job ───────────────────────────────────────────────
export async function requeueJob(jobId: string) {
  const { data, error } = await supabase
    .from('jobs')
    .update({
      status: 'queued',
      attempt: 0,
      claimed_by: null,
      claimed_at: null,
      started_at: null,
      finished_at: null,
      error_code: null,
      error_message: null,
      scheduled_for: new Date().toISOString(),
    })
    .eq('id', jobId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

// ── Organizations: update plan ────────────────────────────────────────────────
export async function updateOrgPlanSuperAdmin(orgId: string, newPlan: 'free' | 'pro' | 'premium') {
  const { data, error } = await supabase
    .from('organizations')
    .update({ plan: newPlan, updated_at: new Date().toISOString() })
    .eq('id', orgId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

// ── Support Emails: update status ─────────────────────────────────────────────
export async function updateEmailStatus(emailId: string, status: 'unread' | 'read' | 'replied' | 'archived') {
  const { data, error } = await supabase
    .from('support_emails')
    .update({ status })
    .eq('id', emailId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

// ── Support Emails: log a sent reply ─────────────────────────────────────────
export async function logEmailReply(
  emailId: string,
  bodyText: string,
  sentVia: 'cloudflare' | 'resend' | 'smtp',
  status: 'sent' | 'failed',
  errorMessage?: string
) {
  const { data: user } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('email_replies')
    .insert({
      email_id: emailId,
      body_text: bodyText,
      sent_via: sentVia,
      sent_by: user?.user?.id ?? null,
      status,
      error_message: errorMessage ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  if (status === 'sent') {
    await updateEmailStatus(emailId, 'replied');
  }
  return data;
}

// ── Send reply via Worker cascade ─────────────────────────────────────────────
export async function sendEmailReplyViaWorker(payload: {
  emailId: string;
  toEmail: string;
  subject: string;
  bodyText: string;
  messageId?: string;
}): Promise<{ success: boolean; sentVia: string; error?: string }> {
  const workerUrl = import.meta.env.VITE_WORKER_URL || 'https://superbaser-backup.saemscodes.workers.dev';
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;

  try {
    const res = await fetch(`${workerUrl}/api/superadmin/email/reply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      return { success: false, sentVia: 'none', error: text };
    }

    const json = await res.json() as { success: boolean; sentVia: string; error?: string };
    return json;
  } catch (e: any) {
    return { success: false, sentVia: 'none', error: e.message };
  }
}
