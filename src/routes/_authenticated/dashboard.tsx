import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, Archive, Database, FolderKanban, RotateCcw, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui-ext/PageHeader";
import { GlassCard, SubtleCard } from "@/components/ui-ext/GlassCard";
import { EmptyState } from "@/components/ui-ext/EmptyState";
import { StatusBadge } from "@/components/ui-ext/StatusBadge";
import { Button } from "@/components/ui/button";
import { dashboardSummary, listWorkerHeartbeats } from "@/lib/queries.functions";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { formatBytes, formatRelative } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Restore Platform" },
      { name: "description", content: "Operational control center for Supabase backups, restores, verification and storage." },
      { property: "og:title", content: "Restore Platform Dashboard" },
      { property: "og:description", content: "Operational control center for Supabase backups and restores." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Metric({ icon: Icon, label, value, hint }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; hint?: string }) {
  return (
    <GlassCard>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
          {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent/70 text-accent-foreground bevel">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </GlassCard>
  );
}

function Dashboard() {
  const orgId = useActiveOrg();
  const summary = useServerFn(dashboardSummary);
  const heartbeats = useServerFn(listWorkerHeartbeats);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", orgId],
    queryFn: () => summary({ data: { organizationId: orgId! } }),
    enabled: !!orgId,
  });
  const { data: hb } = useQuery({ queryKey: ["heartbeats"], queryFn: () => heartbeats(), refetchInterval: 15000 });

  if (!orgId) {
    return (
      <EmptyState
        icon={<FolderKanban className="h-6 w-6" />}
        title="Create your first organization"
        description="Organizations own projects, credentials, backups, restores, and billing. Pick one in the switcher above or create a new one."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Real-time operational view across every connected project."
        actions={
          <Button asChild>
            <Link to="/projects">Manage projects</Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={FolderKanban} label="Projects" value={isLoading ? "—" : String(data?.projectsCount ?? 0)} />
        <Metric icon={Activity} label="Running jobs" value={isLoading ? "—" : String(data?.runningJobs ?? 0)} />
        <Metric icon={Database} label="Backup storage" value={isLoading ? "—" : formatBytes(data?.storageBytes ?? 0)} />
        <Metric icon={ShieldCheck} label="Schedules enabled" value={isLoading ? "—" : String(data?.schedulesEnabled ?? 0)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold tracking-tight">Recent backups</h3>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/backups">View all</Link>
            </Button>
          </div>
          {(data?.recentBackups ?? []).length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No backups yet. Connect a project and create your first backup.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {(data?.recentBackups ?? []).map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Archive className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="truncate text-sm font-medium">{b.id.slice(0, 8)}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {formatBytes(b.bytes_total)} · {formatRelative(b.created_at)}
                    </div>
                  </div>
                  <StatusBadge status={b.status} />
                </li>
              ))}
            </ul>
          )}
        </GlassCard>

        <GlassCard>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold tracking-tight">Recent restores</h3>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/restores">View all</Link>
            </Button>
          </div>
          {(data?.recentRestores ?? []).length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No restores yet. Start one from a completed backup.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {(data?.recentRestores ?? []).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="truncate text-sm font-medium">{r.id.slice(0, 8)}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{formatRelative(r.created_at)}</div>
                  </div>
                  <StatusBadge status={r.status} />
                </li>
              ))}
            </ul>
          )}
        </GlassCard>
      </div>

      <GlassCard>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold tracking-tight">Worker fleet</h3>
          <span className="text-xs text-muted-foreground">Heartbeats refresh every 15s</span>
        </div>
        {(hb ?? []).length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No workers have registered. External workers report via <code>/api/public/worker/report</code>.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(hb ?? []).map((w) => (
              <SubtleCard key={w.id}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{w.id}</span>
                  <span className="text-xs text-muted-foreground">v{w.version ?? "?"}</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <span>CPU {w.cpu_percent ?? "—"}%</span>
                  <span>RAM {w.ram_mb ?? "—"} MB</span>
                  <span>Queue {w.queue ?? "—"}</span>
                  <span>{formatRelative(w.last_seen_at)}</span>
                </div>
              </SubtleCard>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
