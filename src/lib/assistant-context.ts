// ─── SuperBaser System Knowledge Base & Inference Context ───────────────────────

export const SUPERBASER_KNOWLEDGE_BASE = `
SUPERBASER IDENTITY:
- Type: Cloudflare-powered automated disaster recovery & database backup engine for Supabase
- Architecture: Cloudflare Workers + Cloudflare R2 Storage Buckets + Supabase Postgres Port 5432 Direct Connections
- System Motto: "Automated Postgres Backups, Continuous R2 Sync & Zero-Downtime Restores"

CONSOLE NAVIGATION & SUBPAGES:
- Dashboard (#dashboard): High-level system inventory, total archive volume, active schedules, and live backup trigger.
- Projects (#projects): Direct PG host configuration, Port 5432 SSL mode parameters, region info.
- Backups (#backups): SQL snapshot download links, R2 bucket key inspector, status tags.
- Restores (#restores): 1-click psql database ingestion, storage bucket reconstruction.
- Schedules (#schedules): Automated hourly/daily cron pipeline configuration.
- Verification (#verification): Automated archive integrity checksum tests.
- Storage (#storage): Cloudflare R2 archive volume metrics & object key browser.
- Logs (#logs): Real-time engine execution logs & container telemetry.
- Organizations (#organizations): Multi-tenant organization creation & team management.
- Billing (#billing): Paystack payment subscription checkout (Jamii, Mwananchi, Taifa) & Lifetime Pro promo codes.
- Settings (#settings): Profile display name & Boring Avatars SVG palette configuration.
- Support (#support): Operations runbooks & emergency disaster recovery contact info.

PAYMENT & BILLING TIERS:
- Jamii Tier (Tier 1 Free): $0/mo — 1 Target Project, Manual pg_dump, 7-Day Retention Auto-Pruning, 500 MB limit.
- Mwananchi Plan (Tier 2 Pro): $15/mo ($150/yr) — Up to 5 Target Projects, Automated Hourly Cron, 30-Day Retention, Cloudflare R2 Sync.
- Taifa Plan (Tier 3 Enterprise / Premium): $49/mo ($490/yr) — Unlimited Target Projects, Parallel Container Workflows, Dedicated Isolation, 24/7 Support.

SECURITY & PRIVACY GUARANTEES:
- Passwords and connection URIs are processed over TLS 1.3 (Port 5432) and stored strictly in browser memory.
- Backup SQL dumps streamed to Cloudflare R2 enforce SSE-S3 AES-256 encryption at rest.
- No plain-text database credentials or secret service role keys ever leave your session.

PROMO CODES:
- Lifetime Pro codes (e.g. LIFETIME-PRO-H7X9K) unlock Lifetime Pro tier with unlimited backup retention.
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
