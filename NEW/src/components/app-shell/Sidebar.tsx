import { Link, useLocation } from "@tanstack/react-router";
import {
  Activity,
  Archive,
  Bell,
  Building2,
  CalendarClock,
  CircuitBoard,
  CreditCard,
  Database,
  FileClock,
  FolderKanban,
  Gauge,
  LifeBuoy,
  RotateCcw,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: Gauge },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/backups", label: "Backups", icon: Archive },
  { to: "/restores", label: "Restores", icon: RotateCcw },
  { to: "/schedules", label: "Schedules", icon: CalendarClock },
  { to: "/verification", label: "Verification", icon: ShieldCheck },
  { to: "/storage", label: "Storage", icon: Database },
  { to: "/logs", label: "Logs", icon: FileClock },
  { to: "/organizations", label: "Organizations", icon: Building2 },
  { to: "/billing", label: "Billing", icon: CreditCard },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/support", label: "Support", icon: LifeBuoy },
] as const;

export function Sidebar() {
  const loc = useLocation();
  return (
    <aside className="glass-panel sticky top-4 hidden h-[calc(100vh-2rem)] w-[280px] flex-col p-3 lg:flex">
      <Link to="/dashboard" className="flex items-center gap-2 px-2 py-3">
        <div className="grid h-9 w-9 place-items-center rounded-xl gradient-primary text-primary-foreground bevel">
          <CircuitBoard className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-tight">Restore Platform</div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Operations</div>
        </div>
      </Link>

      <nav className="mt-2 flex flex-1 flex-col gap-0.5 overflow-y-auto pr-1">
        {nav.map(({ to, label, icon: Icon }) => {
          const active = loc.pathname === to || loc.pathname.startsWith(to + "/");
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors duration-150",
                active
                  ? "bg-accent/80 text-accent-foreground bevel"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              )}
            >
              <Icon className={cn("h-4 w-4", active && "text-primary")} />
              <span className="font-medium">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-2 rounded-xl border border-border/60 bg-background/50 p-3 text-xs">
        <div className="flex items-center justify-between text-muted-foreground">
          <span>System</span>
          <span className="inline-flex items-center gap-1 text-success">
            <Activity className="h-3 w-3" /> Operational
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between text-muted-foreground">
          <span>Version</span>
          <span>0.1.0</span>
        </div>
      </div>
      <div className="pt-3 text-center text-[10px] text-muted-foreground">
        <Bell className="mx-auto mb-1 h-3 w-3" />
        Live updates enabled
      </div>
    </aside>
  );
}
