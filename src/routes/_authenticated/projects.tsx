import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { FolderKanban, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui-ext/PageHeader";
import { GlassCard } from "@/components/ui-ext/GlassCard";
import { EmptyState } from "@/components/ui-ext/EmptyState";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listProjects } from "@/lib/queries.functions";
import { createProject } from "@/lib/mutations.functions";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { formatRelative } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/projects")({
  head: () => ({
    meta: [
      { title: "Projects - Restore Platform" },
      { name: "description", content: "Connect Supabase projects for backup, restore, verification and scheduled recovery." },
      { property: "og:title", content: "Projects - Restore Platform" },
      { property: "og:description", content: "Connect Supabase projects for backup and restore." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const orgId = useActiveOrg();
  const list = useServerFn(listProjects);
  const create = useServerFn(createProject);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    supabaseProjectRef: "",
    region: "",
    dbHost: "",
    dbPort: "5432",
    dbName: "postgres",
    dbUser: "postgres",
    dbPassword: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["projects", orgId],
    queryFn: () => list({ data: { organizationId: orgId! } }),
    enabled: !!orgId,
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId) return;
    setBusy(true);
    try {
      await create({
        data: {
          organizationId: orgId,
          name: form.name,
          supabaseProjectRef: form.supabaseProjectRef || undefined,
          region: form.region || undefined,
          credentials: form.dbHost
            ? {
                dbHost: form.dbHost,
                dbPort: Number(form.dbPort),
                dbName: form.dbName,
                dbUser: form.dbUser,
                dbPassword: form.dbPassword,
              }
            : undefined,
        },
      });
      await qc.invalidateQueries({ queryKey: ["projects", orgId] });
      toast.success("Project connected");
      setOpen(false);
      setForm({ name: "", supabaseProjectRef: "", region: "", dbHost: "", dbPort: "5432", dbName: "postgres", dbUser: "postgres", dbPassword: "" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create project");
    } finally {
      setBusy(false);
    }
  }

  if (!orgId) return <EmptyState title="Select an organization" description="Use the switcher above to pick one." />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Connect the Supabase projects you want to back up, restore, or migrate."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Connect project
          </Button>
        }
      />

      {isLoading ? (
        <GlassCard>Loading projects…</GlassCard>
      ) : (data ?? []).length === 0 ? (
        <EmptyState
          icon={<FolderKanban className="h-6 w-6" />}
          title="No projects yet"
          description="Connect a Supabase project to start capturing backups and running verified restores."
          action={<Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />Connect project</Button>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(data ?? []).map((p) => (
            <GlassCard key={p.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link to="/projects/$id" params={{ id: p.id }} className="text-sm font-semibold hover:underline">
                    {p.name}
                  </Link>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {p.supabase_project_ref ?? "no project ref"} · {p.region ?? "unknown region"}
                  </div>
                </div>
                <span className="rounded-full bg-accent/80 px-2.5 py-1 text-[10px] uppercase tracking-widest bevel">
                  {p.status}
                </span>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                <span>Created {formatRelative(p.created_at)}</span>
                <Link to="/projects/$id" params={{ id: p.id }} className="text-primary hover:underline">
                  Open →
                </Link>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Connect a Supabase project</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label>Name</Label>
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Production" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Project ref</Label>
                <Input value={form.supabaseProjectRef} onChange={(e) => setForm({ ...form, supabaseProjectRef: e.target.value })} placeholder="abcdefghij" />
              </div>
              <div className="grid gap-1.5">
                <Label>Region</Label>
                <Input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} placeholder="us-east-1" />
              </div>
            </div>
            <div className="rounded-xl bg-accent/40 p-3 text-xs text-muted-foreground">
              Direct connection credentials are encrypted with AES-GCM and never leave the server.
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>DB host</Label>
                <Input value={form.dbHost} onChange={(e) => setForm({ ...form, dbHost: e.target.value })} placeholder="db.xxxx.supabase.co" />
              </div>
              <div className="grid gap-1.5">
                <Label>DB port</Label>
                <Input value={form.dbPort} onChange={(e) => setForm({ ...form, dbPort: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label>DB name</Label>
                <Input value={form.dbName} onChange={(e) => setForm({ ...form, dbName: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label>DB user</Label>
                <Input value={form.dbUser} onChange={(e) => setForm({ ...form, dbUser: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>DB password</Label>
              <Input type="password" value={form.dbPassword} onChange={(e) => setForm({ ...form, dbPassword: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={busy || !form.name.trim()}>{busy ? "Connecting…" : "Connect project"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
