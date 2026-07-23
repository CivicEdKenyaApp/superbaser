import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, PlayCircle, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui-ext/PageHeader";
import { GlassCard, SubtleCard } from "@/components/ui-ext/GlassCard";
import { Button } from "@/components/ui/button";
import { getProject, listBackups } from "@/lib/queries.functions";
import { enqueueBackup, deleteProject } from "@/lib/mutations.functions";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { StatusBadge } from "@/components/ui-ext/StatusBadge";
import { formatBytes, formatDateTime, formatRelative } from "@/lib/format";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/projects/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Project ${params.id.slice(0, 8)} - Restore Platform` },
      { name: "description", content: "Project detail: backups, schedules, credentials, verification history." },
      { property: "og:title", content: "Project - Restore Platform" },
      { property: "og:description", content: "Backups, schedules and verification for a connected Supabase project." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProjectDetail,
});

function ProjectDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const orgId = useActiveOrg();
  const qc = useQueryClient();
  const get = useServerFn(getProject);
  const list = useServerFn(listBackups);
  const enqueue = useServerFn(enqueueBackup);
  const del = useServerFn(deleteProject);

  const project = useQuery({ queryKey: ["project", id], queryFn: () => get({ data: { id } }) });
  const backups = useQuery({
    queryKey: ["backups", orgId],
    queryFn: () => list({ data: { organizationId: orgId! } }),
    enabled: !!orgId,
  });

  const projectBackups = (backups.data ?? []).filter((b) => b.project_id === id);

  async function runBackup() {
    if (!orgId) return;
    try {
      await enqueue({ data: { organizationId: orgId, projectId: id } });
      await qc.invalidateQueries({ queryKey: ["backups", orgId] });
      toast.success("Backup queued");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to queue backup");
    }
  }

  async function remove() {
    if (!confirm("Delete this project and all its backups?")) return;
    try {
      await del({ data: { id } });
      toast.success("Project deleted");
      navigate({ to: "/projects" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete project");
    }
  }

  const p = project.data;
  return (
    <div className="space-y-6">
      <Link to="/projects" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> All projects
      </Link>
      <PageHeader
        title={p?.name ?? "Project"}
        description={p?.supabase_project_ref ? `Ref ${p.supabase_project_ref} · ${p.region ?? "unknown region"}` : undefined}
        actions={
          <>
            <Button onClick={runBackup}>
              <PlayCircle className="mr-2 h-4 w-4" /> Run backup
            </Button>
            <Button variant="outline" onClick={remove}>
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <SubtleCard>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Status</div>
          <div className="mt-1 text-lg font-semibold">{p?.status ?? "-"}</div>
        </SubtleCard>
        <SubtleCard>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Postgres version</div>
          <div className="mt-1 text-lg font-semibold">{p?.postgres_version ?? "unknown"}</div>
        </SubtleCard>
        <SubtleCard>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Last inventory</div>
          <div className="mt-1 text-lg font-semibold">{formatRelative(p?.last_inventory_at ?? null)}</div>
        </SubtleCard>
      </div>

      <GlassCard>
        <h3 className="mb-3 text-sm font-semibold tracking-tight">Backups for this project</h3>
        {projectBackups.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No backups yet. Run one from the button above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="py-2">ID</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Size</th>
                  <th className="py-2">Created</th>
                  <th className="py-2">Finished</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {projectBackups.map((b) => (
                  <tr key={b.id}>
                    <td className="py-2 font-mono text-xs">{b.id.slice(0, 8)}</td>
                    <td className="py-2"><StatusBadge status={b.status} /></td>
                    <td className="py-2">{formatBytes(b.bytes_total)}</td>
                    <td className="py-2 text-muted-foreground">{formatDateTime(b.created_at)}</td>
                    <td className="py-2 text-muted-foreground">{formatDateTime(b.finished_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
