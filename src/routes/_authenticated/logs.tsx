import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileClock } from "lucide-react";
import { PageHeader } from "@/components/ui-ext/PageHeader";
import { GlassCard } from "@/components/ui-ext/GlassCard";
import { EmptyState } from "@/components/ui-ext/EmptyState";
import { StatusBadge } from "@/components/ui-ext/StatusBadge";
import { listLogs } from "@/lib/queries.functions";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/logs")({
  head: () => ({
    meta: [
      { title: "Logs - Restore Platform" },
      { name: "description", content: "Structured job log stream across every worker with status, attempts, and errors." },
      { property: "og:title", content: "Logs - Restore Platform" },
      { property: "og:description", content: "Structured job log stream." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LogsPage,
});

function LogsPage() {
  const orgId = useActiveOrg();
  const list = useServerFn(listLogs);
  const { data, isLoading } = useQuery({
    queryKey: ["logs", orgId],
    queryFn: () => list({ data: { organizationId: orgId! } }),
    enabled: !!orgId,
    refetchInterval: 5000,
  });

  if (!orgId) return <EmptyState title="Select an organization" />;

  return (
    <div className="space-y-6">
      <PageHeader title="Logs" description="Structured job history refreshed every 5 seconds." />
      {isLoading ? (
        <GlassCard>Loading…</GlassCard>
      ) : (data ?? []).length === 0 ? (
        <EmptyState icon={<FileClock className="h-6 w-6" />} title="No jobs yet" description="Jobs appear as soon as you enqueue backups or restores." />
      ) : (
        <GlassCard className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-widest text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="p-4">Time</th>
                  <th className="p-4">Kind</th>
                  <th className="p-4">Priority</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Attempt</th>
                  <th className="p-4">Error</th>
                  <th className="p-4">Trace</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(data ?? []).map((j) => (
                  <tr key={j.id}>
                    <td className="p-4 text-muted-foreground">{formatDateTime(j.created_at)}</td>
                    <td className="p-4 capitalize">{j.kind}</td>
                    <td className="p-4 capitalize text-muted-foreground">{j.priority}</td>
                    <td className="p-4"><StatusBadge status={j.status} /></td>
                    <td className="p-4">{j.attempt}</td>
                    <td className="p-4 text-xs text-destructive">{j.error_message ?? ""}</td>
                    <td className="p-4 font-mono text-xs text-muted-foreground">{j.trace_id ?? ""}</td>
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
