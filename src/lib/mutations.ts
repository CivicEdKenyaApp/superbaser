import { supabase } from './supabase';
import { parseConnectionUri } from './connection-parser';

export async function createOrganization(name: string, userId: string) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.random().toString(36).slice(2, 6);

  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('create_organization_rpc', {
      p_name: name,
      p_slug: slug,
    });
    if (!rpcError && rpcData) {
      return rpcData;
    }
  } catch (e) {
    // Fallback to table insert
  }

  const { data, error } = await supabase
    .from('organizations')
    .insert({
      name,
      slug,
      created_by: userId,
      plan: 'free',
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  await supabase.from('organization_members').insert({
    organization_id: data.id,
    user_id: userId,
    role: 'owner',
  }).catch(() => {});

  return data;
}

export async function createProject(
  organizationId: string, 
  userId: string, 
  name: string, 
  projectRef: string, 
  connectionString?: string,
  projectUrl?: string,
  serviceRoleKey?: string,
  region: string = 'aws-us-east-1'
) {
  let sanitizedUri = connectionString || null;
  if (connectionString) {
    const parsed = parseConnectionUri(connectionString);
    if (parsed.sanitizedUri) {
      sanitizedUri = parsed.sanitizedUri;
    }
  }

  const { data, error } = await supabase
    .from('projects')
    .insert({
      organization_id: organizationId,
      name,
      supabase_project_ref: projectRef,
      region,
      created_by: userId,
      connection_string: sanitizedUri,
      project_url: projectUrl || null,
      service_role_key: serviceRoleKey || null,
    })
    .select()
    .single();

  if (error) {
    // Fallback if schema doesn't have custom columns yet
    const { data: fallbackData, error: fallbackError } = await supabase
      .from('projects')
      .insert({
        organization_id: organizationId,
        name,
        supabase_project_ref: projectRef,
        region,
        created_by: userId,
      })
      .select()
      .single();

    if (fallbackError) throw new Error(fallbackError.message);
    return fallbackData;
  }
  return data;
}

export async function enqueueBackup(organizationId: string, projectId: string) {
  const { data: backup, error: backupErr } = await supabase
    .from('backups')
    .insert({
      organization_id: organizationId,
      project_id: projectId,
      status: 'pending',
      triggered_via: 'manual',
    })
    .select()
    .single();

  if (backupErr) throw new Error(backupErr.message);

  const { data: job, error: jobErr } = await supabase
    .from('jobs')
    .insert({
      organization_id: organizationId,
      project_id: projectId,
      backup_id: backup.id,
      kind: 'backup',
      status: 'queued',
      payload: { project_id: projectId, backup_id: backup.id }
    })
    .select()
    .maybeSingle();

  return { backup, job };
}

export async function enqueueRestore(organizationId: string, backupId: string, targetProjectId: string) {
  const { data, error } = await supabase
    .from('restores')
    .insert({
      organization_id: organizationId,
      backup_id: backupId,
      destination_project_id: targetProjectId,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateOrganizationPlan(organizationId: string, planName: string, paystackRef?: string) {
  const isFreePlan = planName.toLowerCase() === 'free';

  // Paid plan upgrades require a real Paystack reference
  if (!isFreePlan && (!paystackRef || paystackRef.trim() === '')) {
    throw new Error('A valid payment reference is required to activate a paid plan.');
  }

  // Route through the SECURITY DEFINER RPC — the only server-authorised
  // path to write plan and paystack_reference on the organizations table.
  const { data, error } = await supabase.rpc('set_organization_plan', {
    p_organization_id: organizationId,
    p_plan: planName.toLowerCase(),
    p_paystack_reference: isFreePlan ? null : (paystackRef ?? null),
  });

  if (error) {
    throw new Error(error.message || 'Plan update failed.');
  }

  // The RPC returns { success, plan, error }
  if (data && data.success === false) {
    throw new Error(data.error || 'Plan update rejected by server.');
  }

  return data;
}
