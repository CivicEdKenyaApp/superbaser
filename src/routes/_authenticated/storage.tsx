import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Database } from "lucide-react";
import { PageHeader } from "@/components/ui-ext/PageHeader";
import { GlassCard } from "@/components/ui-ext/GlassCard";
import { EmptyState } from "@/components/ui-ext/EmptyState";
import { listStorageObjects } from "@/lib/queries.functions";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { formatBytes, formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/storage")({
  head: () => ({
    meta: [
      { title: "Storage - Restore Platform" },
      { name: "description", content: "Explore backup storage archives object-by-object across every bucket." },
      { property: "og:title", content: "Storage - Restore Platform" },
      { property: "og:description", content: "Explore backup storage archives object-by-object." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StoragePage,
});

function StoragePage() {
  const orgId = useActiveOrg();
  const list = useServerFn(listStorageObjects);
  const { data, isLoading } = useQuery({
    queryKey: ["storage", orgId],
    queryFn: () => list({ data: { organizationId: orgId! } }),
    enabled: !!orgId,
  });

  if (!orgId) return <EmptyState title="Select an organization" />;

  type Obj = NonNullable<typeof data>[number];
  const buckets = new Map<string, Obj[]>();
  for (const o of data ?? []) {
    if (!buckets.has(o.bucket)) buckets.set(o.bucket, []);
    buckets.get(o.bucket)!.push(o);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Storage explorer" description="Objects captured inside backup storage archives, grouped by source bucket." />
      {isLoading ? (
        <GlassCard>Loading…</GlassCard>
      ) : (data ?? []).length === 0 ? (
        <EmptyState icon={<Database className="h-6 w-6" />} title="No storage objects yet" description="Objects appear here as soon as a backup enumerates and uploads them." />
      ) : (
        <div className="grid gap-4">
          {[...buckets.entries()].map(([bucket, objs]) => (
            <GlassCard key={bucket}>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">{bucket}</div>
                  <div className="text-xs text-muted-foreground">{objs.length} objects</div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-widest text-muted-foreground">
                    <tr>
                      <th className="py-2">Path</th>
                      <th className="py-2">Size</th>
                      <th className="py-2">MIME</th>
                      <th className="py-2">Modified</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {objs.map((o) => (
                      <tr key={o.id}>
                        <td className="py-2 font-mono text-xs">{o.path}</td>
                        <td className="py-2">{formatBytes(o.size_bytes)}</td>
                        <td className="py-2 text-muted-foreground">{o.mime_type ?? "-"}</td>
                        <td className="py-2 text-muted-foreground">{formatDateTime(o.last_modified)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
