import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Building2, Plus, Trash2, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/ui-ext/PageHeader";
import { GlassCard } from "@/components/ui-ext/GlassCard";
import { EmptyState } from "@/components/ui-ext/EmptyState";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listMyOrganizations, listOrganizationMembers } from "@/lib/queries.functions";
import { inviteMember, removeMember, updateMemberRole, createOrganization } from "@/lib/mutations.functions";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/organizations")({
  head: () => ({
    meta: [
      { title: "Organizations — Restore Platform" },
      { name: "description", content: "Manage organizations, roles and members across your Restore Platform workspace." },
      { property: "og:title", content: "Organizations — Restore Platform" },
      { property: "og:description", content: "Manage organizations, roles and members." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OrgPage,
});

function OrgPage() {
  const orgId = useActiveOrg();
  const qc = useQueryClient();
  const orgs = useServerFn(listMyOrganizations);
  const members = useServerFn(listOrganizationMembers);
  const invite = useServerFn(inviteMember);
  const remove = useServerFn(removeMember);
  const update = useServerFn(updateMemberRole);
  const create = useServerFn(createOrganization);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"owner" | "admin" | "member" | "viewer">("member");

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");

  const orgList = useQuery({ queryKey: ["orgs"], queryFn: () => orgs() });
  const memberList = useQuery({
    queryKey: ["members", orgId],
    queryFn: () => members({ data: { organizationId: orgId! } }),
    enabled: !!orgId,
  });

  async function doInvite() {
    if (!orgId) return;
    try {
      await invite({ data: { organizationId: orgId, email, role } });
      await qc.invalidateQueries({ queryKey: ["members", orgId] });
      toast.success("Member added");
      setInviteOpen(false);
      setEmail("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to invite");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organizations"
        description="Every organization owns its own projects, backups, credentials, and billing."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New organization
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <GlassCard>
          <h3 className="text-sm font-semibold tracking-tight">Your organizations</h3>
          <ul className="mt-3 divide-y divide-border">
            {(orgList.data ?? []).map((r) => (
              <li key={r.organization.id} className="flex items-center justify-between py-2">
                <span className="text-sm">{r.organization.name}</span>
                <span className="text-xs capitalize text-muted-foreground">{r.role}</span>
              </li>
            ))}
            {(orgList.data ?? []).length === 0 ? (
              <li className="py-2 text-sm text-muted-foreground">None yet.</li>
            ) : null}
          </ul>
        </GlassCard>

        <GlassCard>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold tracking-tight">Members of active org</h3>
            <Button size="sm" onClick={() => setInviteOpen(true)} disabled={!orgId}>
              <UserPlus className="mr-2 h-4 w-4" /> Invite
            </Button>
          </div>
          {!orgId ? (
            <EmptyState icon={<Building2 className="h-6 w-6" />} title="Select an organization" />
          ) : (
            <ul className="divide-y divide-border">
              {(memberList.data ?? []).map((m) => (
                <li key={m.id} className="flex items-center justify-between py-2">
                  <div>
                    <div className="text-sm">{m.profile?.display_name ?? m.profile?.email ?? m.user_id.slice(0, 8)}</div>
                    <div className="text-xs text-muted-foreground">{m.profile?.email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={m.role}
                      onValueChange={async (v) => {
                        await update({ data: { id: m.id, role: v as "owner" | "admin" | "member" | "viewer" } });
                        qc.invalidateQueries({ queryKey: ["members", orgId] });
                      }}
                    >
                      <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owner">owner</SelectItem>
                        <SelectItem value="admin">admin</SelectItem>
                        <SelectItem value="member">member</SelectItem>
                        <SelectItem value="viewer">viewer</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={async () => {
                        if (!confirm("Remove member?")) return;
                        await remove({ data: { id: m.id } });
                        qc.invalidateQueries({ queryKey: ["members", orgId] });
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
              {(memberList.data ?? []).length === 0 ? (
                <li className="py-2 text-sm text-muted-foreground">No members.</li>
              ) : null}
            </ul>
          )}
        </GlassCard>
      </div>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add a member</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label>Email of an existing account</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as "owner" | "admin" | "member" | "viewer")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Owner</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button onClick={doInvite} disabled={!email}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New organization</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label>Name</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                try {
                  await create({ data: { name: newName } });
                  await qc.invalidateQueries({ queryKey: ["orgs"] });
                  setCreateOpen(false);
                  setNewName("");
                  toast.success("Organization created");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed");
                }
              }}
              disabled={newName.trim().length < 2}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
