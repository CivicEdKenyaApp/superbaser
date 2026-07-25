# SuperBaser

Automated database, storage, and auth backup/restore platform for Supabase projects. React SPA (Vite) frontend, Supabase backend, Cloudflare Workers agent layer.

**Live site:** https://www.superbaser.co
**Motto:** Back up. Restore. Move on.

---

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Architecture](#architecture)
4. [Pricing Tiers](#pricing-tiers)
5. [Security Model](#security-model)
6. [SUPERB AI Agent](#superb-ai-agent)
7. [RAG Layer](#rag-layer)
8. [Sentinel](#sentinel)
9. [Deployment](#deployment)
10. [Current Deployment Status](#current-deployment-status)
11. [Repository Structure](#repository-structure)
12. [Environment Variables & Secrets](#environment-variables--secrets)
13. [Local Development](#local-development)
14. [Critical Directives](#critical-directives)

---

## Overview

SuperBaser connects to a target Supabase project and automates:

- Scheduled database backups via `pg_dumpall` (full cluster dump: roles, schemas, data)
- Scheduled Storage file backups (separate from the database dump, since Postgres does not store file bytes)
- Backup verification (integrity check, header validation, row/file count reconciliation) before a backup is marked restorable
- Two-pass restore into a new or existing target project (database via `psql`, then Storage files via `service_role` key)
- Automated retention cleanup based on plan tier
- A chat-based assistant (SUPERB AI) for status checks, triggering backups, and proposing restores through a two-step confirmation flow

A target project consists of more than a PostgreSQL database — it also includes Storage, Authentication, roles, permissions, and platform-managed schemas. Recovering only the database is insufficient to restore a working application.

---

## Tech Stack

**Frontend**
- React 18 (Vite), TypeScript
- State-based SPA routing (local state `currentView`)
- TailwindCSS
- Framer Motion (all interactions)
- Lottie (animations)
- Zustand (`useAuthStore`) for auth persistence

**Backend / Data**
- Supabase (PostgreSQL 15) — control plane: users, organizations, projects, jobs, backups, restores, schedules
- Row Level Security (RLS) enforced on all core tables
- `pg_dumpall` for database backups, `psql` for restores

**Edge / Agent Layer (Cloudflare, Workers Paid plan)**
- Cloudflare Workers — `superbaser-agent`, `superbaser-ingestion`, `superbaser-sentinel`
- Durable Objects — stateful agent instances (one per organization)
- Vectorize — RAG vector index (`superbaser-docs`)
- Workers AI — embedding generation (`bge-base-en-v1.5`), edge inference fallback
- AI Gateway (`superbaser-ai-gateway`) — model request governance
- KV — shared state (source manifest, sync state), namespace `7c573c8bdfbe47449c95b04faf54e711`
- Cron Triggers — ingestion (`30 3 * * *`), Sentinel (`0 3 * * *`)

**Hosting**
- Cloudflare Pages — sole source of truth for `superbaser.co` and `superbaser.pages.dev`. Vercel, Netlify, and Lovable are not used.

---

## Architecture

### Two-Layer Separation (never blurred)

**Execution layer** (does the actual backup/restore work):
- SuperBaser Backend (Supabase) — receives job-queue events, routes to the backup engine, runs a 15-minute scheduler that checks backup intervals and retention windows per org
- SuperBaser Backup Engine — isolated environment that wakes on demand, runs `pg_dumpall` and Storage capture, streams output to SuperBaser Storage, then shuts down
- SuperBaser Storage — object storage for backup archives, zero egress fees passed through as generous tier limits
- `jobs` table in Supabase for job tracking
- Two-stage restore logic: database pass (`psql`, tolerant of pre-existing roles/schemas in a fresh project) then Storage pass (`service_role` key, writes to private buckets)

**Agent layer** (orchestration only — the customer-facing SUPERB AI):
- One Durable Object per organization (matches the existing `activeOrgId` model — jobs, plans, and connections are org-scoped)
- Talks to the user over WebSocket
- Decides which job to enqueue based on intent
- Calls existing `enqueueBackup` / `enqueueRestore` mutations as tools — never reimplements the execution logic
- Watches job status via a Realtime subscription moved server-side into the Agent class (replaces the old per-component Supabase channel subscription in `DashboardConsole.tsx`)
- Never directly executes `pg_dump`/`psql` as a tool call — that logic stays in the Container/Backup Engine, where it is tested and auditable

### Backup pipeline

```
User clicks "Run Backup"
    ↓
Job queued in SuperBaser Backend
    ↓
SuperBaser Backup Engine wakes up
    ↓
Database and files captured
    ↓
Backup verified and saved to SuperBaser Storage
    ↓
Engine shuts back down — no idle cost, no idle wait
```

### Scheduler behavior

A single scheduler runs every 15 minutes and performs two functions per organization:

1. Compares time since last backup against the org's tier interval (24h Free / 1h Pro / 15min Premium) and enqueues a new backup job if due.
2. Prunes backups older than the tier's retention window (7d Free / 30d Pro / 90d Premium) from SuperBaser Storage, marking them purged.

### What gets backed up

| Component | Captured via | Notes |
|---|---|---|
| Database | `pg_dumpall` | Full cluster dump: every role (`anon`, `authenticated`, `service_role`, etc.), every schema (`auth`, `storage`, `realtime`, `public`, extensions, GraphQL layer, migration history). Plain-text SQL, not a binary format. Role passwords excluded; role structure preserved. |
| Storage files | Separate object capture | Postgres only stores file *metadata* (bucket, path, size, type) in the `storage` schema — never the bytes. Files are captured as their own archive alongside the SQL dump. |
| Auth / users | Included in `auth` schema dump | Sessions, identities, login credentials — restored so users can sign back in without a password reset. |

### Restore pipeline

1. **Database pass** — SQL snapshot loaded via `psql`. A fresh target project already has default roles/schemas; the restore is written to tolerate that (no failure or duplication on pre-existing objects).
2. **Storage pass** — file bytes uploaded from the Storage archive to match the bucket/path records already recreated by pass one. Uses the `service_role` key to write into private buckets.
3. **Verification** — post-restore counts (tables, buckets) compared against the original backup's recorded counts.

### Verification (pre-restore trust check)

Before any backup is marked restorable:
- Archive integrity check (corruption detection without full unpack)
- Header validation (confirms a genuine, complete dump vs. partial/malformed)
- Row and file count reconciliation against source project state at backup time

A failed check is flagged immediately in the dashboard, not discovered during an actual restore attempt.

---

## Pricing Tiers

SuperBaser uses exactly **3 tiers**:

| | Free | Pro | Premium |
|---|---|---|---|
| Price | $0/mo | $15/mo | $49/mo |
| Connected projects | 1 | Up to 5 | Unlimited (+ orgs) |
| Backup frequency | Daily (24h) | Hourly | Every 15 minutes |
| Retention window | 7 days | 30 days | 90 days |
| Restore | Manual point-in-time | 1-click, zero-downtime, verified | 1-click verified + multi-region migration |
| Storage sync | — | AES-256 encrypted vault | AES-256 encrypted vault |
| Support | Community | Priority | 1-hour response SLA |
| Extra | — | — | Team RBAC, audit logging, Dedicated Worker Agent, continuous backup/log streaming, 90-day PITR |

Tier enforcement: the SuperBaser Backend scheduler checks each org's plan every 15 minutes and gates both backup frequency and retention cleanup against it. Enforcement is server-side, not UI-hidden — a user cannot bypass limits by calling the agent instead of clicking a dashboard button.

"Dedicated Worker Agent" (Premium) is a provisioning difference (pinned Durable Object / higher instance type), not a separate codebase.

---

## Security Model

### Credentials collected

| Credential | Purpose | Handling |
|---|---|---|
| Direct connection string | Lets the backup engine connect to Postgres and run `pg_dumpall` | Used exclusively at backup time |
| Project URL | Status checks, dashboard display | — |
| Service Role Key | Storage file discovery and restore (bypasses RLS to reach private buckets) | Stored securely server-side, never in the frontend |

- Never collected on a public page — only inside an authenticated dashboard session.
- Encrypted the moment they leave the browser, before being written anywhere.
- Decrypted only transiently, for the duration of an active backup/restore job.

### Anonymous-user guard

- Guests (`is_anonymous: true`) never have write, edit, delete, or run capability.
- Enforced by the `is_permanent_user()` RLS helper function on all core tables (Organizations, Projects, Schedules, Backups, Jobs) — anonymous users are explicitly blocked from `SELECT` and `DELETE`.
- In the agent layer, this check happens at the **tool boundary**, server-side, inside the Durable Object — not only in the client UI. A guest typing a restore request as free text hits the same server-side rejection as clicking a disabled button.

### Tier gating

Checked server-side, inside the Agent, at the moment a tool is invoked — never by which UI chip was or wasn't rendered.

| Tier | Agent tool access |
|---|---|
| Free | Read-only: explain concepts, check own backup status/history, navigate. No trigger tools (or a hard-capped trial trigger). |
| Pro | Trigger tools enabled (`enqueueBackup`, `enqueueRestore`), bounded by the same frequency/retention limits as the dashboard buttons. |
| Premium | Same tools, plus proactive monitoring and dedicated provisioning. |

### Destructive-action confirmation (two-trigger protocol)

**Trigger 1 — Propose.** The agent calls `proposeAction`, which validates plan limits and role (Owner/Admin only), mints a short-lived single-use confirmation token bound to the exact parameters (backup ID, destination project), and returns a structured confirmation card rendered as an `ActionChip`.

**Trigger 2 — Confirm.** Only a tap on that specific chip — a distinct UI action, never free text — sends the token back. The Worker validates the token is unexpired, unused, and matches the original parameters, then calls the real mutation.

Free-text confirmation ("yes", "do it") is never accepted for destructive actions — this closes the prompt-injection / model-ambiguity exploit path.

Actions requiring two-trigger confirmation:

| Action | Confirmation required |
|---|---|
| Restore into an existing (non-empty) project | Yes |
| Delete a backup | Yes |
| Plan downgrade that shortens retention | Yes |
| Manual backup trigger | No (additive, non-destructive, matches the one-click dashboard button) |
| List backups / check status | No |
| Navigate to a page | No |

---

## SUPERB AI Agent

### Naming

- **SUPERB AI** — the customer-facing chat assistant.
- **SuperBaser** — the platform.
- **SuperB User** — the person using it.
- **Sentinel** — the internal gap-analysis agent (fully separate from SUPERB AI; see below).

### Transport

`sendMessage` in `AIAssistant.tsx` connects to the Worker-hosted agent over WebSocket (`useAgent` / `useAgentChat` from `agents/react`) instead of calling an LLM provider directly from the browser. All model keys and the master prompt live server-side as Worker secrets — never in `VITE_`-prefixed client env vars.

### Multi-LLM cascade

Runs inside the Durable Object. Tries providers in order; on failure (rate limit, timeout, 5xx) falls to the next. Rate-limit cooldowns tracked per-provider in the Durable Object's SQLite.

| Order | Provider | Model | Role |
|---|---|---|---|
| 1 | Cerebras | `llama-3.1-8b` / `gpt-oss-120b` | Fastest, primary |
| 2 | Groq | `llama-3.3-70b-versatile` | Fast, tool-calling, handles heavier queries |
| 3 | Workers AI | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | Edge-native fallback |
| 4 | DeepSeek | `deepseek-chat` | Complex reasoning fallback |
| 5 | OpenRouter | `meta-llama/llama-3.3-70b-instruct` | Last resort |

### Master prompt

Split by risk profile:
- **Base prompt** (`worker/src/prompts/base-prompt.ts`) — identity, tool registry, confirmation protocol. Version-controlled in the repo, never editable from a dashboard field.
- **Knowledge content** (`worker/src/prompts/knowledge-base.ts`) — preserved from the legacy `SUPERBASER_KNOWLEDGE_BASE`, supplemented by RAG retrieval at request time rather than stuffed into the prompt.

### Verbosity and formatting constraints

Base prompt enforces:
- Maximum ~2 sentences of prose per response.
- A trailing ` ```suggestions ` JSON block, parsed and stripped server-side before the text reaches the client, then rendered as `ActionChips`.
- No manual enumeration of features or walls of text — the UI (chips, islands) carries structured information, not prose.

### UI surfaces (preserved from the legacy implementation, transport swapped)

- `ActionChips` — render tool-call results as tappable, pre-populated actions (e.g., a specific job ID, a specific confirmation token) rather than generic suggestions.
- `LiquidGlassIsland` — non-obstructive overlay for dynamic states (live job progress/waveform, map view, offline ticket), driven by `onStateUpdate` pushes from the Durable Object, not polling.
- Slash commands — local dictionary mapped to `currentView` state.
- Markdown/code rendering — bold text and fenced code blocks render in styled glassmorphic blocks with copy-to-clipboard; legacy `parseMessageContent` (internal links, `#copy:` tokens, fuzzy page-name navigation) is preserved and runs on the plain-text segments.
- Page-context awareness — `currentView` from `App.tsx` is piped into every WebSocket message so the agent knows what page the user is looking at and can tailor suggestions accordingly.

### Tool-call → chip pipeline

```
User message → WebSocket → Durable Object
    ↓
LLM cascade selects a tool with structured parameters
    ↓
Tool execute() runs server-side (Supabase queries, tier checks, token minting)
    ↓
Structured result streams back over the WebSocket
    ↓
Frontend maps the result to an ActionChip pre-populated with real IDs
    ↓
Tap → agent.stub.<method>() (RPC call into the Durable Object)
    ↓
Durable Object validates and executes the real mutation
    ↓
this.setState() pushes updated state to all connected clients
```

No project IDs, backup IDs, or job IDs are typed by the user — the agent gathers them server-side and the chip carries them.

---

## RAG Layer

Two fully separate systems: an ingestion pipeline (batch, cron-triggered) and query-time retrieval (inside the chat agent).

### Ingestion pipeline (`superbaser-ingestion` Worker)

```
Cron trigger (03:30 UTC daily)
    ↓
Read source manifest from KV (key: source-manifest, namespace 7c573c8bdfbe47449c95b04faf54e711)
    ↓
Per enabled source: fetch file list (GitHub Trees API / llms.txt) → diff against last-synced state
    ↓
Changed files: strip frontmatter, chunk by H2/H3 headings, preserve code-block context
    ↓
Embed via Workers AI (bge-base-en-v1.5) → batch upsert into Vectorize (superbaser-docs)
    ↓
Prune vectors for deleted files, update sync state
```

Manual trigger: `POST /trigger` on the ingestion Worker.

### Source types

| Type | Method |
|---|---|
| `github` | GitHub Trees API → Contents API → sha-diff |
| `llms-txt` | Fetch Cloudflare's machine-readable doc index → fetch each page as Markdown |
| `github-releases` | Changelog ingestion |
| `github-issues` | Curated, vetted issue threads only — never a bulk crawl |
| `html-scrape` | Fallback for non-Markdown sources (e.g., PostgreSQL official docs) |

### Metadata schema (every chunk)

```json
{
  "source": "supabase-database | cloudflare-workers | superbaser-docs | ...",
  "sourceType": "github | llms-txt | changelog | issue | html",
  "title": "string",
  "section": "string",
  "url": "string",
  "path": "string",
  "sha": "string",
  "lastUpdated": "ISO 8601",
  "lastFetched": "ISO 8601",
  "priority": "integer (1 = own docs, boosted at query time)",
  "tags": ["string"]
}
```

### Build order (curated, phased — never an unbounded crawl)

1. SuperBaser's own docs + Supabase `guides/database/`
2. Cloudflare Workers / Vectorize / Durable Objects `llms.txt`
3. Supabase `guides/auth/` + `guides/storage/`
4. Supabase + Cloudflare changelogs
5. Curated GitHub issues
6. PostgreSQL official docs (backup/recovery)
7. Remaining Supabase/Cloudflare guides

### Query-time retrieval

Agent embeds the user query with the same model, queries Vectorize (`topK: 5`), optionally two-pass filtered by `priority`, injects ranked chunks as grounding context, and can cite source + `lastUpdated` so time-sensitive claims are hedged rather than stated flatly.

---

## Sentinel

Internal gap-analysis agent. Hard-separated from SUPERB AI — no shared Worker, Durable Object, or tool registry.

| | SUPERB AI | Sentinel |
|---|---|---|
| Trigger | User message | Cron (`0 3 * * *`) |
| Execution capability | Can trigger real jobs via tools | None — read-only |
| Output | Back to the user in chat | Slack webhook / email — never customer-facing |

Workflow: fetch latest external docs/issues from curated sources → compare against current feature set and the Vectorize index → LLM-summarize ecosystem changes and coverage gaps → deliver report out-of-band.

---

## Deployment

**Sole hosting target: Cloudflare Pages.** No Vercel, no Netlify, no Lovable. Both `superbaser.pages.dev` and the custom domain `superbaser.co` are served by the same Cloudflare Pages CI/CD pipeline from the GitHub `main` branch.

### Deploy flow

```
Push to main
    ↓
Cloudflare Pages auto-builds
    ↓
Live on superbaser.pages.dev and superbaser.co
```

### Worker deployment (each is a separate `wrangler deploy`)

```bash
cd worker      && npm install --legacy-peer-deps && npx wrangler deploy && cd ..
cd ingestion   && npm install --legacy-peer-deps && npx wrangler deploy && cd ..
cd sentinel    && npm install --legacy-peer-deps && npx wrangler deploy && cd ..
```

### Frontend activation (feature flag)

Set in Cloudflare Pages → Production environment variables:

```
VITE_SB_AGENT_ENABLED=true
VITE_SB_AGENT_WS_URL=wss://superbaser-agent.saemscodes.workers.dev
```

Defaults to `false` — legacy path runs until explicitly flipped, so the rollout carries zero production risk until confirmed.

---

## Current Deployment Status

State as of the latest verified terminal output.

### Workers — all three deployed and live

| Worker | URL | Status |
|---|---|---|
| `superbaser-agent` | `https://superbaser-agent.saemscodes.workers.dev` | Deployed. Health check returned `{"status":"ok","agent":"superb-agent"}`. |
| `superbaser-ingestion` | `https://superbaser-ingestion.saemscodes.workers.dev` | Deployed. Cron: `30 3 * * *`. |
| `superbaser-sentinel` | `https://superbaser-sentinel.saemscodes.workers.dev` | Deployed. Cron: `0 3 * * *`. |

### Infrastructure

| Resource | ID / Name | Status |
|---|---|---|
| Vectorize index | `superbaser-docs` | Created |
| KV namespace (unified) | `7c573c8bdfbe47449c95b04faf54e711` | Bound to all three Workers |
| Source manifest | key `source-manifest` in the unified KV namespace | Seeded remotely |
| AI Gateway | `superbaser-ai-gateway` | Created, bound |

### Secrets set

| Secret | Workers |
|---|---|
| `GROQ_API_KEY` | agent, sentinel |
| `CEREBRAS_API_KEY` | agent |
| `DEEPSEEK_API_KEY` | agent |
| `SUPABASE_SERVICE_ROLE_KEY` | agent, sentinel |
| `GITHUB_TOKEN` | ingestion, sentinel |
| `SLACK_WEBHOOK_URL` | sentinel |

`SUPABASE_URL` is a plain `vars` entry in each `wrangler.jsonc`, not a secret — attempting to set it as a secret correctly errors with "Binding name already in use."

`OPENROUTER_API_KEY` not set — cascade position 5 is skipped; not a functional blocker.

### RAG ingestion

Triggered successfully post-KV-unification: `{"status":"ingestion_complete"}`.

### Known resolved issues

1. **KV namespace mismatch** — `superbaser-agent` was initially bound to an older KV namespace (`fafd90f981c441a6ac244ebb175b3c07`) while `superbaser-ingestion`/`superbaser-sentinel` were bound to a newly created one. Resolved by updating `worker/wrangler.jsonc` to the unified ID and redeploying.
2. **KV manifest seeded locally only** — `wrangler kv key put` defaults to local storage; required `--remote` flag. Corrected and re-seeded to the unified namespace.
3. **`SentinelAgent` Durable Object export error** on the agent Worker — `worker/wrangler.jsonc` incorrectly listed `SentinelAgent` in its own `durable_objects`/`migrations` blocks (that class lives only in the `sentinel/` Worker). Removed; agent redeployed successfully.
4. **Frontend deployed to Vercel** during migration (`npx vercel --prod` run multiple times, aliased to `www.superbaser.co`) — contradicts the Cloudflare-Pages-only deployment rule. Superseded by setting the feature-flag env vars in Cloudflare Pages and pushing to `main`; Vercel deploy prompts were subsequently declined.
5. **Health-check URLs** initially used `*.workers.dev` without the account subdomain — corrected to `*.saemscodes.workers.dev`.
6. **Frontend verbosity/formatting regression** after the WebSocket migration — the legacy client-side `parseMessageContent` had no Markdown/code-block rendering (it relied on a JSON-stripping regex specific to the old Groq direct-fetch response shape), and the LLM defaulted to verbose prose without the old prompt's strict JSON-only constraint. Addressed by: adding a `renderAssistantContent` layer for bold/code-block rendering that hands plain-text segments to the legacy parser; adding a hard verbosity cap and a mandatory trailing ` ```suggestions ` block to `base-prompt.ts`; parsing and stripping that block server-side before streaming text to the client; piping `currentView` into every WebSocket payload for page-aware suggestions. Deployed and pushed — **not yet independently verified against the live site**; requires manual confirmation (see Verification Checklist below).

### Verification Checklist (not yet confirmed — verify manually)

- [ ] Cloudflare Pages latest build shows Success for the `main` commit
- [ ] `VITE_SB_AGENT_ENABLED=true` and `VITE_SB_AGENT_WS_URL` set in Pages Production env
- [ ] Live chat on superbaser.co connects over WebSocket and responds
- [ ] Response length is short (≤2 sentences) with a rendered suggestions row, not a text wall
- [ ] Bold/code-block Markdown renders in styled blocks with copy function
- [ ] "Restore my backup" produces a confirmation `ActionChip`, not an immediate restore
- [ ] Tapping the confirmation chip executes the restore; a stale/mismatched token is rejected
- [ ] Anonymous session attempting a trigger action is redirected to `AuthModal`
- [ ] Free-tier account attempting a trigger action receives a server-side upgrade rejection, not a missing button

### Remaining / deferred work

- `OPENROUTER_API_KEY` not set (cascade position 5 unused)
- AI Gateway logging/caching/rate-limit/guardrail configuration not yet set beyond creation
- No load/production testing performed on the two-trigger confirmation flow under concurrent use
- Legacy `VITE_SB_GROQ_API_KEY` and the legacy direct-fetch code path in `AIAssistant.tsx` not yet removed (retained intentionally as rollback fallback until the flag has been stable in production)

---

## Repository Structure

```
SuperBaser/
├── src/
│   ├── components/
│   │   ├── AIAssistant.tsx         # SUPERB AI chat UI, WebSocket transport, ActionChips, LiquidGlassIsland
│   │   └── DashboardConsole.tsx    # Org/project dashboard; Realtime job subscription now lives in the Agent
│   ├── lib/
│   │   ├── auth-store.ts           # Zustand auth persistence
│   │   ├── assistant-context.ts    # Legacy SUPERBASER_KNOWLEDGE_BASE, sanitizeResponse, affirmations
│   │   ├── mutations.ts            # enqueueBackup, enqueueRestore, createOrganization, etc.
│   │   ├── queries.ts              # listBackups, listRestores, listSchedules, getDashboardSummary
│   │   ├── org-store.ts
│   │   └── supabase.ts             # Supabase client (browser, anon key)
│   ├── hooks/
│   └── App.tsx                     # currentView state routing; piped into agent WebSocket payload
├── worker/                         # superbaser-agent (customer-facing SUPERB AI)
│   ├── wrangler.jsonc               # Durable Object, KV, Vectorize, AI, AI Gateway vars
│   ├── src/
│   │   ├── index.ts                 # SuperbAgent class: cascade, tools, tool boundary, token storage
│   │   └── prompts/
│   │       ├── base-prompt.ts       # Version-controlled identity/tool/confirmation rules
│   │       └── knowledge-base.ts    # Preserved SUPERBASER_KNOWLEDGE_BASE
│   └── .dev.vars                    # Local secrets (never committed)
├── ingestion/                       # superbaser-ingestion (RAG batch pipeline)
│   ├── wrangler.jsonc
│   ├── manifest.json                # Source manifest (also seeded to KV for the deployed Worker)
│   └── src/index.ts
├── sentinel/                        # superbaser-sentinel (internal gap-analysis, read-only)
│   ├── wrangler.jsonc
│   └── src/index.ts
├── scripts/
│   ├── setup-agent.sh
│   └── setup-agent.ps1
├── docs.html                        # Standalone /docs page — architecture, pricing, security, FAQ, glossary
├── AGENT.md                         # Master context/rules file (source for this README)
└── .env                             # VITE_ vars; legacy Groq key retained as flagged fallback
```

---

## Environment Variables & Secrets

### Frontend (`.env`, Cloudflare Pages Production)

| Variable | Purpose | Status |
|---|---|---|
| `VITE_SB_AGENT_ENABLED` | Feature flag: WebSocket agent vs. legacy path | Set to `true` in Pages Production |
| `VITE_SB_AGENT_WS_URL` | Agent Worker WebSocket URL | `wss://superbaser-agent.saemscodes.workers.dev` |
| `VITE_SB_GROQ_API_KEY` | Legacy direct-fetch key | Retained, marked LEGACY, rollback-only |

### Worker secrets (`wrangler secret put`)

| Secret | Workers | Purpose |
|---|---|---|
| `GROQ_API_KEY` | agent, sentinel | LLM cascade position 2 |
| `CEREBRAS_API_KEY` | agent | LLM cascade position 1 |
| `DEEPSEEK_API_KEY` | agent | LLM cascade position 4 |
| `OPENROUTER_API_KEY` | agent | LLM cascade position 5 — not yet set |
| `SUPABASE_SERVICE_ROLE_KEY` | agent, sentinel | Server-side Supabase access (bypasses RLS) |
| `GITHUB_TOKEN` | ingestion, sentinel | GitHub API rate limit (5,000/hr authenticated vs. 60/hr) |
| `SLACK_WEBHOOK_URL` | sentinel | Gap-analysis report delivery |

### Worker vars (`wrangler.jsonc`, plain text, not secrets)

`SUPABASE_URL`, `CF_AI_GATEWAY_ID`, `CF_ACCOUNT_ID`, `AGENT_FEATURE_FLAG`, `ENVIRONMENT`.

---

## Local Development

```bash
npm install
npm run dev
```

Worker development (each subproject independently):

```bash
cd worker && npm install --legacy-peer-deps && npx wrangler dev
cd ingestion && npm install --legacy-peer-deps && npx wrangler dev
cd sentinel && npm install --legacy-peer-deps && npx wrangler dev
```

Node engine warnings (`EBADENGINE`) from Babel-related transitive dependencies during `npm install --legacy-peer-deps` are non-fatal (current environment: Node v22.15.0; some packages request `^22.18.0 || >=24.11.0`).

---

## Critical Directives

1. **No mock data.** Integrate directly with Supabase production data. Use real empty states ("Connect your first project", "No backups found").
2. **Anonymous guard.** Guests never get write/edit/delete/run capability. Enforced by RLS (`is_permanent_user()`) and, in the agent layer, at the tool boundary server-side.
3. **Preserve original code.** Modifications preserve existing logic, spacing, variable names, and structure unless a refactor is explicitly requested. Never comment out vital features (auth wrappers, state managers).
4. **Deployment sync.** Cloudflare Pages is the sole source of truth for `superbaser.co`. No Vercel, no Netlify, no Lovable.
