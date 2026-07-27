import { useEffect, useState } from "react";
import { Bell, LogOut, Search, User, Database, Shield, FileText, Settings, CreditCard } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { OrgSwitcher } from "./OrgSwitcher";

export function TopBar() {
  const [email, setEmail] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const navigateTo = (path: string) => {
    window.location.hash = path;
  };

  async function signOut() {
    await supabase.auth.signOut();
    navigateTo("/auth");
  }

  return (
    <header className="glass-panel sticky top-4 z-30 flex items-center gap-3 px-4 py-2">
      <OrgSwitcher />
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="glass-subtle relative flex flex-1 max-w-xl h-10 items-center justify-between rounded-md border border-transparent px-3 text-sm text-muted-foreground transition-colors hover:border-border"
      >
        <span className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <span>Search projects, backups, restores…</span>
        </span>
        <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type a command or search workspace..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Navigation">
            <CommandItem onSelect={() => { setOpen(false); navigateTo("/"); }}>
              <Database className="mr-2 h-4 w-4" />
              <span>Console Dashboard</span>
              <CommandShortcut>↵</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => { setOpen(false); navigateTo("/settings"); }}>
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </CommandItem>
            <CommandItem onSelect={() => { setOpen(false); navigateTo("/billing"); }}>
              <CreditCard className="mr-2 h-4 w-4" />
              <span>Billing & Subscription</span>
            </CommandItem>
          </CommandGroup>
          <CommandGroup heading="Quick Actions">
            <CommandItem onSelect={() => { setOpen(false); navigateTo("/"); }}>
              <Shield className="mr-2 h-4 w-4 text-emerald-500" />
              <span>View Disaster Recovery Status</span>
            </CommandItem>
            <CommandItem onSelect={() => { setOpen(false); navigateTo("/"); }}>
              <FileText className="mr-2 h-4 w-4" />
              <span>View System Audit Logs</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      <button type="button" aria-label="Notifications" className="p-2 rounded-full text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors">
        <Bell className="h-4 w-4" />
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label="Account" className="p-2 rounded-full text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors">
            <User className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="truncate">{email ?? "Account"}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => navigateTo("/settings")}>Settings</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => navigateTo("/billing")}>Billing</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={signOut}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
