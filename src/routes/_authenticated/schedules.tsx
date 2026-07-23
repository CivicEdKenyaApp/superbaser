import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CalendarClock, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui-ext/PageHeader";
import { GlassCard } from "@/components/ui-ext/GlassCard";
import { EmptyState } from "@/components/ui-ext/EmptyState";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { listSchedules, listProjects } from "@/lib/queries.functions";
import { createSchedule, toggleSchedule, deleteSchedule } from "@/lib/mutations.functions";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { formatRelative } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/schedules")({
  head: () => ({
    meta: [
      { title: "Schedules - Restore Platform" },
      { name: "description", content: "Cron-based schedules for automatic backups across every connected project." },
      { property: "og:title", content: "Schedules - Restore Platform" },
      { property: "og:description", content: "Cron-based schedules for automatic backups." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SchedulesPage,
});

function SchedulesPage() {
  const orgId = useActiveOrg();
  const qc = useQueryClient();
  const list = useServerFn(listSchedules);
  const listP = useServerFn(listProjects);
  const create = useServerFn(createSchedule);
  const toggle = useServerFn(toggleSchedule);
  const del = useServerFn(deleteSchedule);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", cronExpression: "0 3 * * *", timezone: "UTC", retentionDays: 30, projectId: "" });
  const [busy, setBusy] = useState(false);

  const schedules = useQuery({
    queryKey: ["schedules", orgId],
    queryFn: () => list({ data: { organizationId: orgId! } }),
    enabled: !!orgId,
  });
  const projects = useQuery({
    queryKey: ["projects", orgId],
    queryFn: () => listP({ data: { organizationId: orgId! } }),
    enabled: !!orgId,
  });

  async function submit() {
    if (!orgId || !form.projectId) return;
    setBusy(true);
    try {
      await create({ data: { organizationId: orgId, ...form } });
      await qc.invalidateQueries({ queryKey: ["schedules", orgId] });
      toast.success("Schedule created");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create schedule");
    } finally {
      setBusy(false);
    }
  }

  if (!orgId) return <EmptyState title="Select an organization" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schedules"
        description="Automate backups on any cron cadence and set retention windows."
        actions={
          <Button onClick={() => setOpen(true)} disabled={(projects.data ?? []).length === 0}>
            <Plus className="mr-2 h-4 w-4" /> New schedule
          </Button>
        }
      />
      {schedules.isLoading ? (
        <GlassCard>Loading…</GlassCard>
      ) : (schedules.data ?? []).length === 0 ? (
        <EmptyState icon={<CalendarClock className="h-6 w-6" />} title="No schedules yet" description="Set up your first automated backup cadence." />
      ) : (
        <div className="grid gap-3">
          {(schedules.data ?? []).map((s) => (
            <GlassCard key={s.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">{s.name}</div>
                  <div className="mt-1 font-mono text-xs text-muted-foreground">{s.cron_expression} · {s.timezone}</div>
                  <div className="mt-1 text-xs text-muted-foreground">Retention {s.retention_days}d · last run {formatRelative(s.last_run_at)}</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-xs">
                    <Switch
                      checked={s.enabled}
                      onCheckedChange={async (v) => {
                        await toggle({ data: { id: s.id, enabled: v } });
                        qc.invalidateQueries({ queryKey: ["schedules", orgId] });
                      }}
                    />
                    <span>{s.enabled ? "Enabled" : "Paused"}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={async () => {
                      if (!confirm("Delete schedule?")) return;
                      await del({ data: { id: s.id } });
                      qc.invalidateQueries({ queryKey: ["schedules", orgId] });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New schedule</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label>Project</Label>
              <Select value={form.projectId} onValueChange={(v) => setForm({ ...form, projectId: v })}>
                <SelectTrigger><SelectValue placeholder="Pick a project" /></SelectTrigger>
                <SelectContent>
                  {(projects.data ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nightly production" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Cron expression</Label>
                <Input value={form.cronExpression} onChange={(e) => setForm({ ...form, cronExpression: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label>Timezone</Label>
                <Input value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label>Retention (days)</Label>
                <Input type="number" value={form.retentionDays} onChange={(e) => setForm({ ...form, retentionDays: Number(e.target.value) })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={busy || !form.name || !form.projectId}>{busy ? "Saving…" : "Create schedule"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
