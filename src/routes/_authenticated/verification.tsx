import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui-ext/PageHeader";
import { GlassCard } from "@/components/ui-ext/GlassCard";
import { EmptyState } from "@/components/ui-ext/EmptyState";
import { StatusBadge } from "@/components/ui-ext/StatusBadge";
import { listVerifications } from "@/lib/queries.functions";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/verification")({
  head: () => ({
    meta: [
      { title: "Verification - Restore Platform" },
      { name: "description", content: "Side-by-side source and destination comparison for every restore." },
      { property: "og:title", content: "Verification - Restore Platform" },
      { property: "og:description", content: "Side-by-side source and destination comparison." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VerifyPage,
});

function VerifyPage() {
  const orgId = useActiveOrg();
  const list = useServerFn(listVerifications);
  const { data, isLoading } = useQuery({
    queryKey: ["verify", orgId],
    queryFn: () => list({ data: { organizationId: orgId! } }),
    enabled: !!orgId,
  });

  if (!orgId) return <EmptyState title="Select an organization" />;

  return (
    <div className="space-y-6">
      <PageHeader title="Verification" description="Structured reports comparing source and destination after each restore." />
      {isLoading ? (
        <GlassCard>Loading…</GlassCard>
      ) : (data ?? []).length === 0 ? (
        <EmptyState icon={<ShieldCheck className="h-6 w-6" />} title="No verification reports yet" description="Reports are generated automatically after each restore completes." />
      ) : (
        <div className="grid gap-3">
          {(data ?? []).map((r) => {
            const summary = (r.summary ?? {}) as Record<string, { source?: number; destination?: number; status?: string }>;
            const items = Object.entries(summary);
            return (
              <GlassCard key={r.id}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">Report {r.id.slice(0, 8)}</div>
                    <div className="text-xs text-muted-foreground">{formatDateTime(r.created_at)}</div>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
                {items.length ? (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-left text-xs uppercase tracking-widest text-muted-foreground">
                        <tr>
                          <th className="py-2">Item</th>
                          <th className="py-2">Source</th>
                          <th className="py-2">Destination</th>
                          <th className="py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {items.map(([k, v]) => (
                          <tr key={k}>
                            <td className="py-2 capitalize">{k}</td>
                            <td className="py-2">{v.source ?? "-"}</td>
                            <td className="py-2">{v.destination ?? "-"}</td>
                            <td className="py-2">{v.status ?? "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="mt-3 text-xs text-muted-foreground">No summary yet.</div>
                )}
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
