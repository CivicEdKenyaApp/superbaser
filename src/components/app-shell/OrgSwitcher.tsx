import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listMyOrganizations } from "@/lib/queries.functions";
import { createOrganization } from "@/lib/mutations.functions";
import { getActiveOrgId, setActiveOrgId } from "@/lib/org-store";
import { toast } from "sonner";

export function OrgSwitcher() {
  const list = useServerFn(listMyOrganizations);
  const create = useServerFn(createOrganization);
  const qc = useQueryClient();
  const [activeId, setActive] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const { data } = useQuery({ queryKey: ["orgs"], queryFn: () => list() });

  useEffect(() => {
    if (!data) return;
    const stored = getActiveOrgId();
    if (stored && data.some((r) => r.organization.id === stored)) {
      setActive(stored);
    } else if (data[0]) {
      setActive(data[0].organization.id);
      setActiveOrgId(data[0].organization.id);
    }
  }, [data]);

  const active = data?.find((r) => r.organization.id === activeId);

  async function handleCreate() {
    if (name.trim().length < 2) return;
    setBusy(true);
    try {
      const org = await create({ data: { name: name.trim() } });
      await qc.invalidateQueries({ queryKey: ["orgs"] });
      setActive(org.id);
      setActiveOrgId(org.id);
      setOpen(false);
      setName("");
      toast.success("Organization created");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create organization");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="glass-subtle h-10 min-w-56 justify-between px-3 text-left">
            <div className="flex flex-col leading-tight">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Organization</span>
              <span className="truncate text-sm font-medium">{active?.organization.name ?? "No organization"}</span>
            </div>
            <ChevronsUpDown className="h-4 w-4 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          <DropdownMenuLabel>Your organizations</DropdownMenuLabel>
          {(data ?? []).map((row) => (
            <DropdownMenuItem
              key={row.organization.id}
              onSelect={() => {
                setActive(row.organization.id);
                setActiveOrgId(row.organization.id);
                qc.invalidateQueries();
              }}
              className="flex items-center justify-between"
            >
              <div>
                <div className="text-sm font-medium">{row.organization.name}</div>
                <div className="text-xs text-muted-foreground capitalize">{row.role}</div>
              </div>
              {row.organization.id === activeId ? <Check className="h-4 w-4" /> : null}
            </DropdownMenuItem>
          ))}
          {(data ?? []).length === 0 ? (
            <div className="px-2 py-2 text-xs text-muted-foreground">No organizations yet.</div>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> New organization
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create organization</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="org-name">Name</Label>
            <Input
              id="org-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Inc"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={busy || name.trim().length < 2}>
              {busy ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
