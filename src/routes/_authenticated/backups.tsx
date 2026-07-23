import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Archive } from "lucide-react";
import { PageHeader } from "@/components/ui-ext/PageHeader";
import { GlassCard } from "@/components/ui-ext/GlassCard";
import { EmptyState } from "@/components/ui-ext/EmptyState";
import { StatusBadge } from "@/components/ui-ext/StatusBadge";
import { listBackups } from "@/lib/queries.functions";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { formatBytes, formatDateTime } from "@/lib/format";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/backups")({
  head: () => ({
    meta: [
      { title: "Backups - Restore Platform" },
      { name: "description", content: "Every backup captured across every connected Supabase project, with live progress and verification status." },
      { property: "og:title", content: "Backups - Restore Platform" },
      { property: "og:description", content: "Every backup across every connected Supabase project." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BackupsPage,
});

function BackupsPage() {
  const orgId = useActiveOrg();
  const list = useServerFn(listBackups);
  const { data, isLoading } = useQuery({
    queryKey: ["backups", orgId],
    queryFn: () => list({ data: { organizationId: orgId! } }),
    enabled: !!orgId,
    refetchInterval: 5000,
  });

  if (!orgId) return <EmptyState title="Select an organization" />;
  return (
    <div className="space-y-6">
      <PageHeader title="Backups" description="Full backup history across the organization with live progress." />
      {isLoading ? (
        <GlassCard>Loading…</GlassCard>
      ) : (data ?? []).length === 0 ? (
        <EmptyState icon={<Archive className="h-6 w-6" />} title="No backups yet" description="Kick off the first one from a project." />
      ) : (
        <GlassCard className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-widest text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="p-4">ID</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Stage</th>
                  <th className="p-4">Progress</th>
                  <th className="p-4">Size</th>
                  <th className="p-4">Created</th>
                  <th className="p-4">Finished</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(data ?? []).map((b) => (
                  <tr key={b.id}>
                    <td className="p-4 font-mono text-xs">{b.id.slice(0, 8)}</td>
                    <td className="p-4"><StatusBadge status={b.status} /></td>
                    <td className="p-4 text-muted-foreground">{b.stage ?? "-"}</td>
                    <td className="p-4 w-40">
                      <Progress value={Number(b.progress_percent ?? 0)} />
                      <div className="mt-1 text-xs text-muted-foreground">{Number(b.progress_percent ?? 0).toFixed(0)}%</div>
                    </td>
                    <td className="p-4">{formatBytes(b.bytes_total)}</td>
                    <td className="p-4 text-muted-foreground">{formatDateTime(b.created_at)}</td>
                    <td className="p-4 text-muted-foreground">{formatDateTime(b.finished_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
