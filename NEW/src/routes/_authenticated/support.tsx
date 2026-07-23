import { createFileRoute } from "@tanstack/react-router";
import { LifeBuoy } from "lucide-react";
import { PageHeader } from "@/components/ui-ext/PageHeader";
import { GlassCard, SubtleCard } from "@/components/ui-ext/GlassCard";

export const Route = createFileRoute("/_authenticated/support")({
  head: () => ({
    meta: [
      { title: "Support — Restore Platform" },
      { name: "description", content: "Docs, runbooks and support channels for Restore Platform." },
      { property: "og:title", content: "Support — Restore Platform" },
      { property: "og:description", content: "Docs, runbooks and support channels." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SupportPage,
});

function SupportPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Support" description="Runbooks, guides and contact for operational assistance." />
      <div className="grid gap-4 md:grid-cols-2">
        <GlassCard>
          <div className="flex items-start gap-3">
            <LifeBuoy className="mt-1 h-5 w-5 text-primary" />
            <div>
              <div className="text-sm font-semibold">Documentation</div>
              <p className="mt-1 text-sm text-muted-foreground">
                Getting Started, backup and restore guides, verification and CLI reference will live in the docs site.
              </p>
            </div>
          </div>
        </GlassCard>
        <GlassCard>
          <div className="text-sm font-semibold">Runbooks</div>
          <ul className="mt-2 grid gap-2 text-sm text-muted-foreground">
            <li>Worker replacement</li>
            <li>Queue backlog resolution</li>
            <li>Failed restore recovery</li>
            <li>Credential rotation</li>
            <li>Incident response</li>
          </ul>
        </GlassCard>
        <SubtleCard className="md:col-span-2">
          <div className="text-sm font-semibold">Contact</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Reach the on-call team via your organization&apos;s configured escalation channel.
          </p>
        </SubtleCard>
      </div>
    </div>
  );
}
