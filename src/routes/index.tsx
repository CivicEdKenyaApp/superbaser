import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowRight, CircuitBoard, Database, RotateCcw, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Restore Platform — Supabase backup, restore & migration" },
      { name: "description", content: "Production-grade Supabase backup, verified restore, scheduled disaster recovery and migration — with a real operations dashboard." },
      { property: "og:title", content: "Restore Platform — Supabase backup, restore & migration" },
      { property: "og:description", content: "Production-grade Supabase backup, verified restore, scheduled disaster recovery and migration — with a real operations dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Feature({ icon: Icon, title, description }: { icon: React.ComponentType<{ className?: string }>; title: string; description: string }) {
  return (
    <div className="glass-panel p-5">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent/70 bevel">
        <Icon className="h-5 w-5" />
      </div>
      <div className="mt-3 text-sm font-semibold">{title}</div>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function Landing() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-10">
      <header className="glass-panel flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl gradient-primary text-primary-foreground bevel">
            <CircuitBoard className="h-5 w-5" />
          </div>
          <span className="text-sm font-semibold tracking-tight">Restore Platform</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" asChild><Link to="/auth">Sign in</Link></Button>
          <Button asChild><Link to="/auth">Get started <ArrowRight className="ml-1.5 h-4 w-4" /></Link></Button>
        </div>
      </header>

      <section className="mt-14 text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full bg-accent/60 px-3 py-1 text-[11px] uppercase tracking-widest bevel">
          <ShieldCheck className="h-3 w-3 text-success" /> Production-grade Supabase DR
        </div>
        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Backup, restore and migrate every Supabase project with operational confidence.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground">
          Encrypted credentials, verified restores, cron-scheduled disaster recovery, checksum-audited storage archives, RLS-scoped multi-tenancy and a real operations dashboard.
        </p>
        <div className="mt-8 flex items-center justify-center gap-2">
          <Button size="lg" asChild><Link to="/auth">Open dashboard</Link></Button>
        </div>
      </section>

      <section className="mt-16 grid gap-4 sm:grid-cols-3">
        <Feature icon={Database} title="Database & storage" description="pg_dump + object storage export, gzip compression, SHA-256 checksums, manifest per backup." />
        <Feature icon={RotateCcw} title="Verified restores" description="Deterministic restore order, resumable checkpoints, side-by-side verification report." />
        <Feature icon={ShieldCheck} title="Multi-tenant & secure" description="AES-GCM at-rest credentials, RLS scoping per organization, roles, API keys and webhooks." />
      </section>

      <footer className="mt-auto pt-16 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Restore Platform
      </footer>
    </div>
  );
}
