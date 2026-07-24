// ─── SuperBaser System Knowledge Base & Inference Context ───────────────────────

export const SUPERBASER_KNOWLEDGE_BASE = `
SUPERBASER IDENTITY:
- Type: Cloudflare Workers + Cloudflare Containers + Cloudflare R2 disaster recovery & pg_dumpall backup engine for Supabase
- Architecture: Edge Worker trigger (cron */15 * * * *) -> Durable Object Container (runs native pg_dumpall) -> Cloudflare R2 Vault (superbaser-backups)
- System Motto: "Automated Postgres Snapshots, Cloudflare R2 Vault Sync & 1-Click Zero-Downtime Restores"

CONSOLE NAVIGATION & SUBPAGES:
- Dashboard (#dashboard): High-level system inventory, total archive volume, active schedules, and live backup trigger.
- Projects (#projects): Direct PG host configuration, Port 5432 SSL mode parameters, region info.
- Backups (#backups): SQL snapshot download links, R2 bucket key inspector, status tags.
- Restores (#restores): 1-click psql database ingestion, storage bucket reconstruction.
- Schedules (#schedules): Tier-based automated backup cron pipeline configuration.
- Verification (#verification): Automated archive integrity checksum tests.
- Storage (#storage): Cloudflare R2 archive volume metrics & object key browser.
- Logs (#logs): Real-time engine execution logs & container telemetry.
- Organizations (#organizations): Multi-tenant organization creation & team management.
- Billing (#billing): Subscription management for Free ($0/mo), Pro ($15/mo), and Premium ($49/mo) tiers.
- Settings (#settings): Profile display name & avatar configuration.
- Support (#support): Operations runbooks & emergency disaster recovery contact info.

SUPERBASER CORE PRICING & TIER SPECS (3 TIERS ONLY):
1. Free Tier ($0/mo):
   - 1 Connected Supabase Project
   - 24-Hour Daily Automated pg_dump
   - 7-Day Backup Retention History
   - Manual Point-in-Time Restore Trigger
   - Community Support

2. Pro Tier ($15/mo):
   - Up to 5 Connected Supabase Projects
   - 1-Hour Automated DB & Storage Snapshots
   - 30-Day Backup Retention History
   - 1-Click Zero-Downtime Verified Restore
   - AES-256 Encrypted Storage Vault & Storage Sync
   - Priority Operations Support

3. Premium Tier ($49/mo):
   - Unlimited Connected Supabase Projects & Orgs
   - 15-Minute Continuous Backup & Log Streaming
   - 90-Day Point-in-Time Recovery (PITR)
   - Multi-Region Replication & One-Click Migration
   - Team RBAC, Audit Logging, Dedicated Worker Agent
   - 1-Hour Response SLA

SECURITY & PRIVACY GUARANTEES:
- Database connection strings are processed securely and utilized inside isolated Cloudflare Container execution environments for pg_dumpall.
- Backup SQL dumps streamed to Cloudflare R2 enforce AES-256 encryption at rest.
- Row Level Security (RLS) policies enforce strict data isolation: Anonymous users (is_anonymous = true) are blocked from INSERT, UPDATE, SELECT, and DELETE operations.
- Unauthenticated checkout/action progress is saved via localStorage (superbaser_pending_action) and automatically resumed post sign-in.
`;

export const FRIENDLY_SECURITY_AFFIRMATIONS = [
  "Quick note: Your database passwords and connection keys stay 100% safe on your device. We never store or share your secrets!",
  "Rest easy: All your backups are encrypted with enterprise-grade AES-256 security on Cloudflare R2.",
  "Security notice: Your direct PostgreSQL connection uses TLS 1.3 encryption. Fast and completely isolated.",
  "Privacy notice: No plain-text keys leave your browser session. Everything is protected in local memory."
];

export function getRandomAffirmation(): string {
  const index = Math.floor(Math.random() * FRIENDLY_SECURITY_AFFIRMATIONS.length);
  return FRIENDLY_SECURITY_AFFIRMATIONS[index];
}

export function sanitizeResponse(text: string): string {
  if (!text || text.trim().length === 0) {
    return "I am sorry, I ran into a brief issue connecting to my inference engine. Could you please ask again?";
  }

  // Detect 5 consecutive identical words in a row (e.g. "dump dump dump dump dump")
  const repeatRegex = /\b(\w{3,})\b(?:\s+\1){4,}/i;
  if (repeatRegex.test(text)) {
    return "I am sorry, I encountered a brief issue processing that query. Please ask your question again!";
  }

  return text;
}
