import { cn } from "@/lib/utils";
import { CheckCircle2, CircleAlert, CircleDashed, CirclePause, Loader2, XCircle } from "lucide-react";

const map: Record<string, { label: string; className: string; Icon: typeof CheckCircle2 }> = {
  pending: { label: "Pending", className: "bg-muted text-muted-foreground", Icon: CircleDashed },
  queued: { label: "Queued", className: "bg-muted text-muted-foreground", Icon: CircleDashed },
  claimed: { label: "Claimed", className: "bg-info/15 text-info", Icon: Loader2 },
  running: { label: "Running", className: "bg-info/15 text-info", Icon: Loader2 },
  succeeded: { label: "Succeeded", className: "bg-success/15 text-success", Icon: CheckCircle2 },
  completed: { label: "Completed", className: "bg-success/15 text-success", Icon: CheckCircle2 },
  verified: { label: "Verified", className: "bg-success/15 text-success", Icon: CheckCircle2 },
  failed: { label: "Failed", className: "bg-destructive/15 text-destructive", Icon: XCircle },
  cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground", Icon: CirclePause },
  warning: { label: "Warning", className: "bg-warning/20 text-warning-foreground", Icon: CircleAlert },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const entry = map[status] ?? { label: status, className: "bg-muted text-muted-foreground", Icon: CircleDashed };
  const { Icon } = entry;
  const spin = status === "running" || status === "claimed";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bevel",
        entry.className,
        className,
      )}
    >
      <Icon className={cn("h-3.5 w-3.5", spin && "animate-spin")} />
      {entry.label}
    </span>
  );
}
