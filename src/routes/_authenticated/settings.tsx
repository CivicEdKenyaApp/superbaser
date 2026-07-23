import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Plus, Trash2, Webhook } from "lucide-react";
import { PageHeader } from "@/components/ui-ext/PageHeader";
import { GlassCard, SubtleCard } from "@/components/ui-ext/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui-ext/EmptyState";
import { listApiKeys, listWebhooks, listAuditLogs } from "@/lib/queries.functions";
import { createApiKey, revokeApiKey, createWebhook, deleteWebhook } from "@/lib/mutations.functions";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime, formatRelative } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings - Restore Platform" },
      { name: "description", content: "Profile, API keys, webhooks and audit log for your Restore Platform organization." },
      { property: "og:title", content: "Settings - Restore Platform" },
      { property: "og:description", content: "Profile, API keys, webhooks and audit log." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const orgId = useActiveOrg();
  const qc = useQueryClient();
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  const listKeys = useServerFn(listApiKeys);
  const listHooks = useServerFn(listWebhooks);
  const listAudit = useServerFn(listAuditLogs);
  const createKey = useServerFn(createApiKey);
  const revoke = useServerFn(revokeApiKey);
  const createHook = useServerFn(createWebhook);
  const delHook = useServerFn(deleteWebhook);

  const keys = useQuery({ queryKey: ["keys", orgId], queryFn: () => listKeys({ data: { organizationId: orgId! } }), enabled: !!orgId });
  const hooks = useQuery({ queryKey: ["hooks", orgId], queryFn: () => listHooks({ data: { organizationId: orgId! } }), enabled: !!orgId });
  const audit = useQuery({ queryKey: ["audit", orgId], queryFn: () => listAudit({ data: { organizationId: orgId! } }), enabled: !!orgId });

  const [keyName, setKeyName] = useState("");
  const [hookUrl, setHookUrl] = useState("");
  const [revealed, setRevealed] = useState<string | null>(null);

  if (!orgId) return <EmptyState title="Select an organization" />;

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Profile, API access, webhooks, and audit history." />

      <Tabs defaultValue="profile">
        <TabsList className="glass-subtle">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="apikeys">API keys</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="audit">Audit log</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          <GlassCard>
            <h3 className="text-sm font-semibold tracking-tight">Account</h3>
            <div className="mt-3 grid gap-3">
              <div className="grid gap-1.5">
                <Label>Email</Label>
                <Input value={email ?? ""} readOnly />
              </div>
            </div>
          </GlassCard>
        </TabsContent>

        <TabsContent value="apikeys" className="mt-4 space-y-4">
          <GlassCard>
            <div className="flex items-end gap-3">
              <div className="grid flex-1 gap-1.5">
                <Label>New key name</Label>
                <Input value={keyName} onChange={(e) => setKeyName(e.target.value)} placeholder="CI backup runner" />
              </div>
              <Button
                onClick={async () => {
                  try {
                    const res = await createKey({ data: { organizationId: orgId, name: keyName } });
                    setRevealed(res.fullKey);
                    setKeyName("");
                    qc.invalidateQueries({ queryKey: ["keys", orgId] });
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Failed");
                  }
                }}
                disabled={!keyName.trim()}
              >
                <Plus className="mr-2 h-4 w-4" /> Create
              </Button>
            </div>
            {revealed ? (
              <div className="mt-4 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm">
                <div className="font-medium">Copy this key now - it will not be shown again.</div>
                <code className="mt-2 block break-all font-mono text-xs">{revealed}</code>
              </div>
            ) : null}
          </GlassCard>
          <GlassCard className="p-0">
            {(keys.data ?? []).length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">No API keys yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-widest text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="p-4">Name</th>
                    <th className="p-4">Prefix</th>
                    <th className="p-4">Last used</th>
                    <th className="p-4">Status</th>
                    <th className="p-4" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(keys.data ?? []).map((k) => (
                    <tr key={k.id}>
                      <td className="p-4">{k.name}</td>
                      <td className="p-4 font-mono text-xs">rp_{k.prefix}…</td>
                      <td className="p-4 text-muted-foreground">{formatRelative(k.last_used_at)}</td>
                      <td className="p-4">{k.revoked_at ? "Revoked" : "Active"}</td>
                      <td className="p-4 text-right">
                        {!k.revoked_at ? (
                          <Button variant="ghost" size="sm" onClick={async () => { await revoke({ data: { id: k.id } }); qc.invalidateQueries({ queryKey: ["keys", orgId] }); }}>
                            Revoke
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </GlassCard>
        </TabsContent>

        <TabsContent value="webhooks" className="mt-4 space-y-4">
          <GlassCard>
            <div className="flex items-end gap-3">
              <div className="grid flex-1 gap-1.5">
                <Label>URL</Label>
                <Input value={hookUrl} onChange={(e) => setHookUrl(e.target.value)} placeholder="https://example.com/webhook" />
              </div>
              <Button
                onClick={async () => {
                  try {
                    await createHook({ data: { organizationId: orgId, url: hookUrl } });
                    setHookUrl("");
                    qc.invalidateQueries({ queryKey: ["hooks", orgId] });
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Failed");
                  }
                }}
                disabled={!hookUrl.trim()}
              >
                <Webhook className="mr-2 h-4 w-4" /> Add
              </Button>
            </div>
          </GlassCard>
          <div className="grid gap-3">
            {(hooks.data ?? []).map((h) => (
              <SubtleCard key={h.id}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{h.url}</div>
                    <div className="text-xs text-muted-foreground">Events: {h.events.join(", ")} · last {h.last_delivery_status ?? "never"} {formatRelative(h.last_delivery_at)}</div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={async () => { await delHook({ data: { id: h.id } }); qc.invalidateQueries({ queryKey: ["hooks", orgId] }); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </SubtleCard>
            ))}
            {(hooks.data ?? []).length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                <KeyRound className="mx-auto mb-2 h-4 w-4" /> No webhooks yet.
              </div>
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <GlassCard className="p-0">
            {(audit.data ?? []).length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">No audit events yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-widest text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="p-4">Time</th>
                    <th className="p-4">Actor</th>
                    <th className="p-4">Action</th>
                    <th className="p-4">Resource</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(audit.data ?? []).map((a) => (
                    <tr key={a.id}>
                      <td className="p-4 text-muted-foreground">{formatDateTime(a.created_at)}</td>
                      <td className="p-4 font-mono text-xs">{a.actor_user_id?.slice(0, 8) ?? "system"}</td>
                      <td className="p-4">{a.action}</td>
                      <td className="p-4 font-mono text-xs">{a.resource_type} {a.resource_id?.slice(0, 8) ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </GlassCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}
