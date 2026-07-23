import { createFileRoute } from "@tanstack/react-router";
import { CreditCard } from "lucide-react";
import { PageHeader } from "@/components/ui-ext/PageHeader";
import { GlassCard, SubtleCard } from "@/components/ui-ext/GlassCard";
import { EmptyState } from "@/components/ui-ext/EmptyState";
import { useActiveOrg } from "@/hooks/useActiveOrg";

export const Route = createFileRoute("/_authenticated/billing")({
  head: () => ({
    meta: [
      { title: "Billing - Restore Platform" },
      { name: "description", content: "Current plan, usage and invoices for your Restore Platform organization." },
      { property: "og:title", content: "Billing - Restore Platform" },
      { property: "og:description", content: "Current plan, usage and invoices." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BillingPage,
});

function BillingPage() {
  const orgId = useActiveOrg();
  if (!orgId) return <EmptyState icon={<CreditCard className="h-6 w-6" />} title="Select an organization" />;
  return (
    <div className="space-y-6">
      <PageHeader title="Billing" description="Plan, usage and invoices for the active organization." />
      <div className="grid gap-4 md:grid-cols-3">
        <SubtleCard>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Current plan</div>
          <div className="mt-1 text-lg font-semibold">Free</div>
          <div className="text-xs text-muted-foreground">Upgrade to unlock scheduled retention beyond 30 days.</div>
        </SubtleCard>
        <SubtleCard>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Storage used</div>
          <div className="mt-1 text-lg font-semibold">See dashboard</div>
        </SubtleCard>
        <SubtleCard>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Next invoice</div>
          <div className="mt-1 text-lg font-semibold">-</div>
        </SubtleCard>
      </div>
      <GlassCard>
        <h3 className="text-sm font-semibold tracking-tight">Invoices</h3>
        <div className="mt-3 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Invoices will appear here once a paid plan is active.
        </div>
      </GlassCard>
    </div>
  );
}
