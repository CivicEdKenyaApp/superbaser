import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/ui-ext/PageHeader";
import { GlassCard } from "@/components/ui-ext/GlassCard";
import { EmptyState } from "@/components/ui-ext/EmptyState";
import { StatusBadge } from "@/components/ui-ext/StatusBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listRestores, listBackups, listProjects } from "@/lib/queries.functions";
import { enqueueRestore } from "@/lib/mutations.functions";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { formatDateTime } from "@/lib/format";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/restores")({
  head: () => ({
    meta: [
      { title: "Restores — Restore Platform" },
      { name: "description", content: "Run and monitor restores from any backup into any connected destination project." },
      { property: "og:title", content: "Restores — Restore Platform" },
      { property: "og:description", content: "Run and monitor Supabase restores." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RestoresPage,
});

function RestoresPage() {
  const orgId = useActiveOrg();
  const qc = useQueryClient();
  const list = useServerFn(listRestores);
  const listB = useServerFn(listBackups);
  const listP = useServerFn(listProjects);
  const enqueue = useServerFn(enqueueRestore);
  const [open, setOpen] = useState(false);
  const [backupId, setBackupId] = useState("");
  const [destId, setDestId] = useState("");
  const [busy, setBusy] = useState(false);

  const restores = useQuery({
    queryKey: ["restores", orgId],
    queryFn: () => list({ data: { organizationId: orgId! } }),
    enabled: !!orgId,
    refetchInterval: 5000,
  });
  const backups = useQuery({
    queryKey: ["backups", orgId],
    queryFn: () => listB({ data: { organizationId: orgId! } }),
    enabled: !!orgId,
  });
  const projects = useQuery({
    queryKey: ["projects", orgId],
    queryFn: () => listP({ data: { organizationId: orgId! } }),
    enabled: !!orgId,
  });

  const validBackups = (backups.data ?? []).filter((b) => b.status === "completed" || b.status === "verified");

  async function submit() {
    if (!orgId || !backupId || !destId) return;
    setBusy(true);
    try {
      await enqueue({ data: { organizationId: orgId, backupId, destinationProjectId: destId } });
      await qc.invalidateQueries({ queryKey: ["restores", orgId] });
      toast.success("Restore queued");
      setOpen(false);
      setBackupId("");
      setDestId("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to queue restore");
    } finally {
      setBusy(false);
    }
  }

  if (!orgId) return <EmptyState title="Select an organization" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Restores"
        description="Recover a backup into any destination project. Each stage streams progress and logs."
        actions={
          <Button onClick={() => setOpen(true)} disabled={validBackups.length === 0 || (projects.data ?? []).length === 0}>
            <RotateCcw className="mr-2 h-4 w-4" /> New restore
          </Button>
        }
      />
      {restores.isLoading ? (
        <GlassCard>Loading…</GlassCard>
      ) : (restores.data ?? []).length === 0 ? (
        <EmptyState icon={<RotateCcw className="h-6 w-6" />} title="No restores yet" description="Start one from a completed backup." />
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
                  <th className="p-4">Started</th>
                  <th className="p-4">Finished</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(restores.data ?? []).map((r) => (
                  <tr key={r.id}>
                    <td className="p-4 font-mono text-xs">{r.id.slice(0, 8)}</td>
                    <td className="p-4"><StatusBadge status={r.status} /></td>
                    <td className="p-4 text-muted-foreground">{r.stage ?? "—"}</td>
                    <td className="p-4 w-40">
                      <Progress value={Number(r.progress_percent ?? 0)} />
                    </td>
                    <td className="p-4 text-muted-foreground">{formatDateTime(r.started_at)}</td>
                    <td className="p-4 text-muted-foreground">{formatDateTime(r.finished_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New restore</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label>Source backup</Label>
              <Select value={backupId} onValueChange={setBackupId}>
                <SelectTrigger><SelectValue placeholder="Pick a backup" /></SelectTrigger>
                <SelectContent>
                  {validBackups.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.id.slice(0, 8)} — {formatDateTime(b.created_at)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Destination project</Label>
              <Select value={destId} onValueChange={setDestId}>
                <SelectTrigger><SelectValue placeholder="Pick a project" /></SelectTrigger>
                <SelectContent>
                  {(projects.data ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={busy || !backupId || !destId}>{busy ? "Queuing…" : "Queue restore"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
