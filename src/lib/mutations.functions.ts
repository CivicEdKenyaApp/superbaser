import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || `org-${Math.random().toString(36).slice(2, 8)}`;
}

export const createOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ name: z.string().min(2).max(80) }).parse(i))
  .handler(async ({ data, context }) => {
    const baseSlug = slugify(data.name);
    let slug = baseSlug;
    for (let n = 1; n < 20; n++) {
      const { data: existing } = await context.supabase.from("organizations").select("id").eq("slug", slug).maybeSingle();
      if (!existing) break;
      slug = `${baseSlug}-${n}`;
    }
    const { data: row, error } = await context.supabase
      .from("organizations")
      .insert({ name: data.name, slug, created_by: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid(), name: z.string().min(2).max(80) }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("organizations").update({ name: data.name }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("organizations").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organizationId: z.string().uuid(),
        name: z.string().min(1).max(120),
        supabaseProjectRef: z.string().max(64).optional(),
        region: z.string().max(64).optional(),
        credentials: z
          .object({
            dbHost: z.string().min(1),
            dbPort: z.number().int().min(1).max(65535),
            dbName: z.string().min(1),
            dbUser: z.string().min(1),
            dbPassword: z.string().min(1),
            serviceRoleKey: z.string().optional(),
            managementApiToken: z.string().optional(),
          })
          .optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: project, error } = await context.supabase
      .from("projects")
      .insert({
        organization_id: data.organizationId,
        name: data.name,
        supabase_project_ref: data.supabaseProjectRef ?? null,
        region: data.region ?? null,
        created_by: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    if (data.credentials) {
      const { encryptJSON } = await import("./encryption.server");
      const { ciphertext, keyId } = await encryptJSON(data.credentials);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error: credErr } = await supabaseAdmin.from("project_credentials").insert({
        project_id: project.id,
        organization_id: data.organizationId,
        encrypted_payload: ciphertext,
        encryption_key_id: keyId,
        db_host: data.credentials.dbHost,
        db_port: data.credentials.dbPort,
        db_name: data.credentials.dbName,
        db_user: data.credentials.dbUser,
      });
      if (credErr) throw new Error(credErr.message);
    }

    await context.supabase.from("audit_logs").insert({
      organization_id: data.organizationId,
      actor_user_id: context.userId,
      action: "project.created",
      resource_type: "project",
      resource_id: project.id,
      metadata: { name: data.name },
    });
    return project;
  });

export const deleteProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("projects").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const enqueueBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organizationId: z.string().uuid(),
        projectId: z.string().uuid(),
        priority: z.enum(["critical", "high", "normal", "low"]).default("normal"),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: backup, error: bErr } = await context.supabase
      .from("backups")
      .insert({
        organization_id: data.organizationId,
        project_id: data.projectId,
        status: "pending",
        triggered_by: context.userId,
        triggered_via: "manual",
      })
      .select()
      .single();
    if (bErr) throw new Error(bErr.message);

    const { data: job, error: jErr } = await context.supabase
      .from("jobs")
      .insert({
        organization_id: data.organizationId,
        project_id: data.projectId,
        kind: "backup",
        priority: data.priority,
        payload: { backup_id: backup.id },
        backup_id: backup.id,
      })
      .select()
      .single();
    if (jErr) throw new Error(jErr.message);

    await context.supabase.from("audit_logs").insert({
      organization_id: data.organizationId,
      actor_user_id: context.userId,
      action: "backup.enqueued",
      resource_type: "backup",
      resource_id: backup.id,
    });
    return { backup, job };
  });

export const enqueueRestore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organizationId: z.string().uuid(),
        backupId: z.string().uuid(),
        destinationProjectId: z.string().uuid(),
        priority: z.enum(["critical", "high", "normal", "low"]).default("normal"),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: restore, error } = await context.supabase
      .from("restores")
      .insert({
        organization_id: data.organizationId,
        backup_id: data.backupId,
        destination_project_id: data.destinationProjectId,
        status: "pending",
        triggered_by: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    const { data: job, error: jErr } = await context.supabase
      .from("jobs")
      .insert({
        organization_id: data.organizationId,
        project_id: data.destinationProjectId,
        kind: "restore",
        priority: data.priority,
        payload: { restore_id: restore.id, backup_id: data.backupId },
        restore_id: restore.id,
      })
      .select()
      .single();
    if (jErr) throw new Error(jErr.message);
    return { restore, job };
  });

export const createSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organizationId: z.string().uuid(),
        projectId: z.string().uuid(),
        name: z.string().min(1).max(120),
        cronExpression: z.string().min(1).max(120),
        timezone: z.string().default("UTC"),
        retentionDays: z.number().int().min(1).max(3650).default(30),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("schedules")
      .insert({
        organization_id: data.organizationId,
        project_id: data.projectId,
        name: data.name,
        cron_expression: data.cronExpression,
        timezone: data.timezone,
        retention_days: data.retentionDays,
        created_by: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const toggleSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid(), enabled: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("schedules").update({ enabled: data.enabled }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("schedules").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("notifications").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ organizationId: z.string().uuid(), name: z.string().min(1).max(80) }).parse(i))
  .handler(async ({ data, context }) => {
    const raw = crypto.getRandomValues(new Uint8Array(24));
    const key = Array.from(raw).map((b) => b.toString(16).padStart(2, "0")).join("");
    const prefix = key.slice(0, 8);
    const hashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
    const hashed = Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");
    const { error } = await context.supabase.from("api_keys").insert({
      organization_id: data.organizationId,
      name: data.name,
      prefix,
      hashed_key: hashed,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { fullKey: `rp_${key}` };
  });

export const revokeApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organizationId: z.string().uuid(),
        url: z.string().url(),
        events: z.array(z.string()).default(["backup.completed", "restore.completed"]),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const secret = Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const { data: row, error } = await context.supabase
      .from("webhooks")
      .insert({
        organization_id: data.organizationId,
        url: data.url,
        events: data.events,
        secret,
        created_by: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("webhooks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const inviteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organizationId: z.string().uuid(),
        email: z.string().email(),
        role: z.enum(["owner", "admin", "member", "viewer"]).default("member"),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: profile } = await context.supabase.from("profiles").select("id").eq("email", data.email).maybeSingle();
    if (!profile) throw new Error("No user with that email has signed up yet. Ask them to create an account first.");
    const { error } = await context.supabase.from("organization_members").insert({
      organization_id: data.organizationId,
      user_id: profile.id,
      role: data.role,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("organization_members").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ id: z.string().uuid(), role: z.enum(["owner", "admin", "member", "viewer"]) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("organization_members").update({ role: data.role }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
