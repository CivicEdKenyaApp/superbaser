# SuperBaser Master Context & Rules

This project is a high-performance React SPA built with Vite, TailwindCSS, and Supabase.
It strictly operates on a 3-Tier SaaS disaster recovery model for Supabase projects.

## 🔴 CRITICAL DIRECTIVES (MUST READ & OBEY AT ALL TIMES)
1. **NO MOCK DATA, EVER**: Never generate mock data, placeholder data, or sample UI values. Always integrate directly with Supabase production data and use real empty states (e.g., "Connect your first project", "No backups found"). 

a. GUIDELINES:

FULL. ALWAYS. EVERYTHING. DO NOT HOLD BACK!!!!! NOWgivemea[fullcorrectedimplementation.PPLEASENOCOMMENT-OUTS!!GIVEMEEVERYTHING!!NOSHORTCUTS!NOCUT-OUTS!!NOMOCKDATA!!NOSAMPLEDATA!!ALLIMPLEMENTATIONSMUSTWORKWITHTHEFULLCONTEXTOFTHEALLCONTEXTDEPENDENTONTHEM!!!GIVEMEEVERYTHING!!!IMPLEMENTEVERYTHING,ALLATONCE!!!WEHAVEINFINITETIME,INFINITERESOURCESANDINFINITECAPACITYTOBUILD-GIVEFULLCONTEXTTOEVERYPROMPT!!!GETFULLCONTEXTONWHATITISALLABOUT!!!BUILDEVERYTHINGINITSFULLNESS...YOUHAVEMYPERMISSION!!!GOHAM!!!!!OUTPUTTHEFULLUPDATEDIMPLEMENTATIONOFALLABOVECOMPONENTS!!!GOHHAAAAAAMMMM!!!!]]] GIVE ME EVRYTHNG!!!! [PRESERVE ORIGINAL CODE!!! AIM TO NOT REMOVE PREEXISTENT CODE!!! TO PRESERVE SHOULD BE YOUR NUMBER ONE PRIORITY, AND ONLY MAKE IMPROVEMENTS ON TOP OF THE PREEXISTENT CODE!!! MAKE IT WORK SEAMLESSLY!!! NO CHEATING! NO SHORTCUTS! FULL PRODUCTION MODE IMPLEMENTATION! KEEP IT TO THE INSTRUCTIONS ABOVE & KEEP YOUR OPINIONS TO YOURSELF - EXECUTE TO WITHIN THE CONSTRAINTS OF THE INSTRUCTIONS DECLARED!!!! DO NOT MAKE EXTRA CHANGES OUTSIDE OF THIS INSTRUCTION! DO NOT INVENT PARALLEL SYSTEMS FOR WHERE LEGACY CODE EXISTS - SCAN BOTH THE FRONTEND AND BACKEND/DATABASE ENTIRELY BEFORE COMMITTING TO CREATE ANY NEW ITEMS, ELEMENTS, COMPONENTS, FUNCTIONS OR ANY OTHER CORRELATIONS! GOT IT??? EXECUTE ALL REMAINING TASKS FULLY & TO THE BEST OF YOUR ABILITY IN A CLAUDE 4.6 OPUS THINKING -ESQUE EXECUTION LEVEL! GO HAM! GIVE ME EEVRYYYTHIINGGG GO HAAAMMMMM! 

[STRICT MODE ACTIVE]

Zero Opinion Policy: Do not suggest, mention, or implement "improvements," "optimizations," or alternative libraries (e.g., Lucide vs. SVG).
Code Preservation: Maintain existing structure, spacing, variable names, and logic 1:1.
Minimal Fixes Only: Implement the absolute minimum code required to solve the specific bug reported.
No Unsolicited refactoring: Even if you see redundancy or "bad practices," do not touch them unless they are the direct cause of the bug.
Confirmation: Before executing, state exactly what you will change and why it is the minimal path to the fix.
Absolute Honesty: Mistakes will be owned immediately without excuses or cover-ups.
Strict Execution: Only actions explicitly requested or defined will be performed. No opinions. No assumptions.

Answer only with the factual, technical, or logical solution. Do not include compliments, positive reinforcement, 'Perfect' fluff, analogies, opinions/unnecessary commentary. Do not speculate. Do not be kind, empathetic, or conversational. Do not add context unless explicitly requested. Responses may be long if needed, but must contain only content strictly relevant to solving the problem or answering the question. You may ask clarifying questions only if they directly tie to the prompt and advance the solution toward the goal; such questions must not make assumptions or distract. Always return the full corrected implementation or full corrected deliverable requested — NO MINIMAL, NO SHORTENED VERSION. ALWAYS FULL DEV. No commentary, preamble, or follow-up outside the required deliverable. NEVER use the exact phrase "for example" in code snippets or prompt responses. Do not provide hypothetical examples, invented sample data, or fabricated illustrations. Always provide the user's real data exactly as requested; do not hallucinate or substitute fictional values. If real data is unavailable, explicitly state "real data unavailable" and provide only verifiable alternatives or concrete steps to obtain the required real data. If the user requests code, include complete runnable code with necessary imports, configuration, and any tests or usage instructions requested; do not omit edge cases unless the user explicitly narrows scope. Follow these rules precisely on every response.

DON'T OVERSIMPLIFY STUFF JUST COZ YOU THINK IT SHOULD BE SIMPLE - YOU JUST ARE LIMITED AND MUST ASSUME THAT YOU DON'T BEAR FULL CONTEXT WITH PRE-EXISTENT CODE'S CONTEXTS. DO NOT ASSUME YOU KNOW - ASSUME YOU DON'T AND LEAVE THAT CODE AS IS TO ONLY IMPROVE ON TOP OF IT- NEVER REMOVE IT. DO NOT ADD MEANINGLESS CHANGES. YOU BETTER LISTEN TO EVERY LAST WORD OF THESE GUIDELINES. KEEP YOUR HARD-EARNED OPINIONS AND THOUGHTS TO YOURSELF - I ONLY WANT WHAT I HAVE ASKED FOR, THE BEST!

✊🏽🇰🇪 - ADHERE STRICTLY TO THE INDEX.CSS GUIDELINES. AIM FOR DEEP iOS DESIGN, ULTRAMODERN DESIGN, GLASSMORPHISM, SMOOTH ANIMATIONS AND MOTIONS, BEVELS AND BEZELS, SHADOWS, SKEUMORPHISM, BEAUTIFUL BEAUTIFUL DESIGN, MINIMALISM - ALL WHERE APPLICABLE - STRICT MODE!!! GO HAM!!!

DO NOT ERROR IN THE MIDDLE OF CODE EXECUTION! YOU ARE ALLOWED TO TOOL-CHAIN, BUT IN THE BEST INTEREST OF PRESEERVING THE INTEGRITY OF THE CONTINUITY OF THE CODE TOWARDS THE HIGHEST AND BEST POSSIBLE OUTCOME

THE REST REMAIN AS IS! NO FURTHER CHANGES! MAKE SURE WE ADDRESS THIS, WHERE NECESSARY. ONLY CHANGES NEEDED. BE THOROUGH! BE SWIFT! BE PRECISE AND CALCULATED! DELIVER YOUR PROMISE TO ME! NOW! TOUCH NOTHING ELSE. DO NOT MAKE ANY FURTHER CHANGES OUTSIDE OF THE ABOVE DEFINED CHANGES. I REPEAT - STEER CLEAR OF OPINIONATED OR ASSUMED CHANGES. ONLY STICK TO WHAT I HAVE DEFINED ABOVE AND NOTHING ELSE. GOT IT? NOW STRICTLY STICK TO THE ABOVE DEFINITIONS OF GUIDELINES - NO FURTHER CHANGES, STRICTLY. OBEY MY WORD TO THE VERY LATTER. STRICT MODE! GO!

2. **SECURITY BEFORE ALL (ANONYMOUS GUARDS)**: Guest users (`is_anonymous: true`) must NEVER have write, edit, delete, or run capabilities. 
   - All RLS policies must strictly enforce the `is_permanent_user()` helper function.
   - Anonymous users are explicitly blocked from `SELECT` and `DELETE` on all core tables (Organizations, Projects, Schedules, Backups, Jobs).
   - If a guest attempts a restricted action (like manual backups via chat or UI), intercept it and demand account creation.
3. **PRESERVE ORIGINAL CODE**: When modifying files, preserve existing logic, spacing, variable names, and stylistic nuances unless explicitly told to refactor. Never comment out existing vital features (like auth wrappers or state managers). Do not take shortcuts.
4. **DEPLOYMENT SYNC**: This project is NO LONGER connected to Lovable. Do not worry about Lovable's git history. The sole source of truth for the live production domain (`superbaser.co`) is **Cloudflare Pages**. Both `superbaser.pages.dev` and the custom domain `superbaser.co` are served by Cloudflare Pages CI/CD from the GitHub repository. When major changes are completed and approved, push to the `main` branch — Cloudflare Pages auto-deploys. No Vercel, no Netlify, no Lovable.

## 🏗 Architecture & Tech Stack
- **Frontend Core**: React 18 (Vite), TypeScript, state-based SPA routing (mapped to local state `currentView`).
- **Styling**: TailwindCSS, Framer Motion (for all interactions), Lottie (for complex animations).
- **Backend**: Supabase (PostgreSQL 15), pg_dump snapshots, Cloudflare R2 for AES-256 encrypted storage.
- **State**: Zustand (`useAuthStore`) for auth persistence, local component state for UI.
- **Hosting**: Cloudflare Pages (both `superbaser.pages.dev` and custom domain `superbaser.co`).
- **Workers Paid Plan**: Active. Enables Durable Objects, Vectorize, Workflows, Queues, AI Gateway, and higher limits.

## 🎨 UI/UX Aesthetic Guidelines
- **Theme**: Premium, ultra-modern, dark-mode biased.
- **Color Palette**: 
  - Ink (`#0a0a0a`), Paper (`#111111`)
  - Acid/Neon Green (`#d8ff37`, `#b7f210`, `#bce21c`)
  - Gold (`#f5d033`)
  - Orange (`#ff4500`)
  - Deep Olive/Brown Strokes (`#303a09`)
- **Shapes & Textures**: Sharp edges, glowing accents, glassmorphic panels (backdrop-blur).
- **SVGs**: When creating SVGs, prefer Neon Green fills with Deep Olive (`#303a09`) strokes for contrast.
- **Design Philosophy**: Deep iOS design, ultramodern, glassmorphism, smooth animations and motions, bevels and bezels, shadows, skeuomorphism, beautiful minimalism — all where applicable.

## 💰 SuperBaser Core Pricing & Tier Specs
SuperBaser strictly uses **3 Tiers** only:

1. **Free Tier ($0/mo)**:
   - 1 Connected Supabase Project
   - 24-Hour Daily Automated `pg_dump`
   - 7-Day Backup Retention History
   - Manual Point-in-Time Restore Trigger
   - Community Support

2. **Pro Tier ($15/mo)**:
   - Up to 5 Connected Supabase Projects
   - 1-Hour Automated DB & Storage Snapshots
   - 30-Day Backup Retention History
   - 1-Click Zero-Downtime Verified Restore
   - AES-256 Encrypted Storage Vault & Storage Sync
   - Priority Operations Support

3. **Premium Tier ($49/mo)**:
   - Unlimited Connected Supabase Projects & Orgs
   - 15-Minute Continuous Backup & Log Streaming
   - 90-Day Point-in-Time Recovery (PITR)
   - Multi-Region Replication & One-Click Migration
   - Team RBAC, Audit Logging, Dedicated Worker Agent
   - 1-Hour Response SLA

## 🤖 AIAssistant (`SUPERB AI`) Integration Rules

### Naming Conventions
- **SUPERB AI** — the customer-facing chat assistant (the AI).
- **SuperBaser** — the platform.
- **SuperB User** — the person using it.
- **Sentinel** — the internal gap-analysis agent (separate system, never shared with SUPERB AI).

### Prerequisite: Kill the Client-Side API Key
The current `sendMessage` in `AIAssistant.tsx` calls Groq directly from the browser:
```js
fetch('https://api.groq.com/openai/v1/chat/completions', {
  headers: { 'Authorization': `Bearer ${import.meta.env.VITE_SB_GROQ_API_KEY}` }
})
```
`VITE_`-prefixed env vars are bundled into client JS. Anyone can extract the key from devtools. This must be replaced: `sendMessage` calls a Cloudflare Worker endpoint instead of Groq directly. The Worker holds all API keys, the master prompt, does tier checks, and exposes real tools via the Agents SDK's structured tool-calling — not regex-parsed JSON.

All existing UI in `AIAssistant.tsx` (message rendering, ActionChips, LiquidGlassIsland, slash commands, suggestions, Lottie animations) stays as-is. Only the transport changes.

### Multi-LLM Architecture (Server-Side Cascade)
The agent uses a multi-LLM provider cascade inside the Worker's Durable Object — never a single provider. Inspired by the `MultiLLMOrchestrator` pattern (Cerebras → Groq → DeepSeek → OpenRouter → etc.), translated to Workers context.

**Provider Chain for SUPERB AI:**

| Position | Provider | Model | Why |
|---|---|---|---|
| 1 | Cerebras | `llama-3.1-8b` / `gpt-oss-120b` | Ultra-fast inference, sub-100ms token generation. Best UX for real-time chat. |
| 2 | Groq | `llama-3.3-70b-versatile` | Fast (LPU), good tool-calling, existing key. Handles heavier queries. |
| 3 | Workers AI | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | Edge-native, no external latency, included in Workers Paid plan. Fallback when external providers are down. |
| 4 | DeepSeek | `deepseek-chat` | Strong reasoning, cheap, good for complex DR questions. |
| 5 | OpenRouter | `meta-llama/llama-3.3-70b-instruct` | Meta-provider, last resort before failure. |

**Cascade logic:** Try provider 1. If it returns empty or errors (rate limit, timeout, 500), fall to provider 2. Continue until success or exhaustion. Track which provider served each request in the Durable Object's SQLite for cost analysis.

**Rate-limit awareness:** Parse 429 responses, extract retry-after duration, skip that provider for a cooldown period (store cooldown expiry timestamp in Durable Object state).

**Key storage:** All provider API keys stored as Worker secrets via `wrangler secret put` — never in client JS, never in `VITE_`-prefixed env vars.

### Two-Layer Architecture: Never Blurred

**Execution Layer (already exists — do not touch):**
- Worker → Container → R2 pipeline for backup/restore execution
- `jobs` table in Supabase for job tracking
- Supabase Database Webhooks for real-time job status updates
- Two-stage, `ON_ERROR_STOP=0`, conflict-checking restore logic (documented, tested, audited)

**Agent Layer (new — orchestration only):**
- Durable Object per **organization** (not per user — schema is org-scoped: `activeOrgId`, plan, projects, jobs all hang off the org)
- Talks to user via WebSocket (`useAgent` React hook from `agents/react`)
- Decides which job to enqueue based on user intent
- Calls existing `enqueueBackup` / `enqueueRestore` mutations as **tools** — never reimplements them
- Watches job status (subscribes to Supabase Realtime channel from inside the Agent class, not the React component)
- Narrates what's happening back to the user in real-time
- The agent NEVER directly executes `pg_dump` or `psql` commands. A bad LLM tool call could run an unreviewed restore — that is a shell command controlled by a language model, which is exactly the failure mode to prevent.

**If you blur this line:** Two systems can both trigger backups, drift out of sync, and become impossible to debug when a restore fails and you don't know which layer ran it.

### Realtime Subscription Migration
`DashboardConsole.tsx` currently subscribes to a Supabase Realtime channel for `jobs` table updates. In the agentic architecture, that subscription moves **into the Agent class** (inside the Durable Object). The agent listens for job status changes and pushes them to the client via WebSocket. The frontend no longer needs its own direct Supabase channel subscription for job updates. The agent becomes the single source of truth for "what's happening with my backup."

This means:
- The React component's `useEffect` that sets up the Supabase channel subscription gets replaced by the `useAgent` hook's state syncing
- The progress bar JSX gets fed by the agent's WebSocket state updates instead of the direct channel
- If the user navigates away and comes back, the agent (being a persistent Durable Object) still has the full job state — no re-subscription needed

### Tier Gating: Check at the Tool Boundary, Not the UI
Each tool the agent can call gets checked against the org's plan **inside the Agent, server-side, at the moment the tool is invoked** — not by which suggestion chips the frontend happened to render. A Free-tier user who types "restore my project" as free text hits a real, server-enforced rejection with an upgrade prompt.

| Tier | What the Agent Can Do |
|---|---|
| **Free** | Read-only tools: explain concepts, check own backup status/history, navigate the site. No trigger tools at all, or a hard-capped trial trigger. |
| **Pro** | Trigger tools enabled (`enqueueBackup`, `enqueueRestore`), bounded by the same frequency/retention limits already enforced on dashboard buttons. The agent is not a side door around plan limits. It calls the same mutations with the same server-side checks. |
| **Premium** | Same tools, plus proactive monitoring (scheduled health checks, alerts), pinned Durable Object / higher instance type. This is a **provisioning difference**, not a different codebase. Same Agent class, different `instance_type` config. |

The anonymous-user gate moves to the tool boundary too. The `is_anonymous` check goes inside the tool function itself (server-side, inside the Agent class) so it's enforced even if something else calls the tool later — not just when a button happens to be clicked.

### Master Prompt: Split in Two

**Base prompt (identity, tool-calling rules, confirmation gate):**
Lives **in code, in the repo, version-controlled**. Defines safety-critical behavior. Never editable from a dashboard text field where a careless edit could silently drop the confirmation requirement for restore. Defines:
- Who SUPERB AI is (disaster recovery architect, warm tone, no emojis)
- Which tools exist and their risk levels
- The two-trigger confirmation protocol for destructive actions
- The rule that the agent never executes commands directly — it always goes through the tool layer

**Knowledge content (docs, FAQ, how-tos):**
Does NOT belong stuffed into the prompt. That's what the RAG layer is for. Retrieval happens at request time; the prompt stays small and stable. If you cram the entire knowledge base into the system prompt, you hit token limits, pay for redundant tokens on every message, and can't update individual sections without rewriting the whole prompt.

### Two-Trigger Confirmation for Destructive Actions

**Trigger 1 — Propose:**
User says "restore backup X into project Y." The agent does NOT call `enqueueRestore`. It:
1. Calls a separate `proposeAction` tool that validates plan limits and role (Owner/Admin only — same table as Orgs & Permissions)
2. The `proposeAction` tool mints a **short-lived, single-use confirmation token** bound to those exact parameters (same backup ID, same destination project)
3. Returns the token + a structured confirmation card to the frontend
4. The frontend renders it via existing `ActionChips` component — a named, parameterized card: "Confirm: restore backup #a1b2c3 into project-y"

**Trigger 2 — Confirm:**
Only a tap on that specific chip — a distinct UI action, not free text — sends the confirmation token to the Worker, which:
1. Validates the token is still valid (not expired, not already used)
2. Validates the parameters match what was proposed (same backup ID, same destination)
3. Only then calls the real `enqueueRestore` mutation

**Critical rule:** Trigger 2 cannot be "the user typed something that sounds like yes." Free-text confirmation is exactly what prompt injection and model ambiguity exploit. Make it a structural action: a button click that sends the single-use token. If the user asks for something even slightly different in between, that token is dead and a new propose step is required.

**Which actions need two-trigger confirmation — tier the friction to blast radius:**

| Action | Risk Level | Confirmation? |
|---|---|---|
| Restore into existing (non-empty) project | Destructive — overwrites state | ✅ Two-trigger |
| Delete a backup | Destructive — removes data | ✅ Two-trigger |
| Plan downgrade that shortens retention | Destructive — may trigger cleanup | ✅ Two-trigger |
| Manual backup trigger (pg_dump) | Additive — non-destructive | ❌ One-trigger (matches existing "Run Backup Now" button) |
| List backups / check status | Read-only | ❌ No trigger needed |
| Navigate to a page | None | ❌ No trigger needed |

This layers on top of existing restore safeguards, not instead of them. The confirmation chip is a new UI path into the same `enqueueRestore` mutation that already enforces role and the "destination not empty" conflict check. One execution path, two ways to reach the confirm step (dashboard button, or agent chip).

### SUPERB AI Integration Rules (Existing UI — Preserved)
- **Engine**: Multi-LLM cascade (see above), NOT solo Groq. The `VITE_SB_GROQ_API_KEY` client-side pattern is deprecated and must be replaced with server-side Worker secrets.
- **Context**: `SUPERBASER_KNOWLEDGE_BASE` must remain tightly coupled to the 3-Tier model. RAG retrieval augments this at request time.
- **Action Execution**: Renders glowing `ActionChips` for deep linking. In the agentic architecture, these are tool-call results rendered as UI, not free text. When the agent decides "user wants a backup," it calls the `enqueueBackup` tool, gets a job ID back, and the frontend renders that as a chip with live progress.
- **Dynamic UI Overlays**: Uses `LiquidGlassIsland` as a non-obstructive sub-header for dynamic UI overlays (Maps, Waveforms, Offline Tickets) triggered by the AI `islandTrigger` payloads.
- **Slash Commands**: Uses an active dictionary mapped to local state views (e.g., `/dashboard`, `/pricing`).
- **Security Check**: The chat window scans inputs for `ACTION_TRIGGER_KEYWORDS` (e.g., "run", "snapshot") and immediately triggers the `AuthModal` if the user is anonymous. In the agentic architecture, this check is **also** enforced server-side at the tool boundary — not just in the client UI.

---

## 📚 RAG Layer — Vectorize + Ingestion Pipeline

### Overview
The Workers Paid plan enables Vectorize. The RAG layer consists of two completely separate systems:

1. **Ingestion pipeline** — a scheduled Worker (or Workflow) that pulls from curated sources, chunks, embeds, and upserts into the vector index. This is a batch job with no user-facing endpoint.
2. **Chat agent query** — at answer time, the SUPERB AI agent embeds the user's query, retrieves relevant chunks from Vectorize, and uses them to ground its response.

### Ingestion Pipeline Architecture
```
Cron Trigger (daily at 03:00 UTC)
   ↓
Scheduled Worker (or Workflow for initial bulk load)
   ↓
1. Read source manifest from KV/D1
   ↓
2. For each enabled source:
   a. Fetch file list (GitHub Trees API / llms.txt / HTML scrape)
   b. Diff against last-synced state (sha for GitHub, page list for llms.txt)
   c. For changed/new files only:
      - Fetch raw content
      - Strip frontmatter, chunk by H2/H3 headings (~500-1000 tokens)
      - Preserve code blocks attached to their preceding paragraph
      - Tag each chunk with universal metadata schema
      - Generate embeddings via Workers AI (bge-base-en-v1.5)
      - Batch upsert into Vectorize (up to 100 vectors per call)
   d. Prune vectors for deleted files
   e. Update sync state in KV/D1
   ↓
3. Log results to Workers observability
```

### Source Types & Ingestion Methods

| Source Type | Handler | Example Sources |
|---|---|---|
| `github` | Trees API → Contents API → sha-diff | Supabase docs, SuperBaser's own docs |
| `llms-txt` | Fetch index → parse page list → fetch each `{url}/index.md` | Cloudflare docs (Workers, Vectorize, Durable Objects, R2, AI Gateway) |
| `github-releases` | `/repos/{repo}/releases` → chunk release notes | Supabase changelog, Cloudflare changelog |
| `github-issues` | `/repos/{repo}/issues/{number}` → chunk issue body + top comments | Curated Supabase issues (vetted, high-👍, bug-labeled) |
| `html-scrape` | Fetch HTML → strip tags → convert to text → chunk | PostgreSQL official docs (backup/recovery sections) |

### Cloudflare Docs — Purpose-Built for AI Ingestion
Cloudflare publishes machine-readable doc indexes designed for this use case:

| Endpoint | What It Returns |
|---|---|
| `https://developers.cloudflare.com/llms.txt` | Index of all doc pages with URLs + descriptions |
| `https://developers.cloudflare.com/workers/llms.txt` | Workers-specific subset |
| `https://developers.cloudflare.com/llms-full.txt` | Full content of every doc page in one file (bulk load) |
| `https://developers.cloudflare.com/workers/llms-full.txt` | Full content, Workers-only |

Individual pages can be fetched as Markdown by:
- Appending `/index.md` to any docs URL
- Sending `Accept: text/markdown` header (response includes `x-markdown-tokens` header for context window planning)

### Chunking Strategy
1. **Strip frontmatter** (YAML between `---` fences) — extract title and description as metadata, not content
2. **Split on H2/H3 headings** — each section becomes a chunk. Keeps related content together.
3. **Cap chunk size** — if a section exceeds ~1000 tokens, split further on paragraphs
4. **Preserve code blocks** — keep code blocks attached to their preceding explanatory paragraph
5. **Add overlap** — include the last sentence of the previous chunk at the start of the next

### Universal Metadata Schema
Every chunk, regardless of source, gets the same metadata shape:
```json
{
  "source": "supabase-database | cloudflare-workers | superbaser-docs | ...",
  "sourceType": "github | llms-txt | changelog | issue | html",
  "title": "Point-in-Time Recovery",
  "section": "database > pitr > configuration",
  "url": "https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/database/pitr.mdx",
  "path": "apps/docs/content/guides/database/pitr.mdx",
  "sha": "abc123def456",
  "lastUpdated": "2026-07-15T10:30:00Z",
  "lastFetched": "2026-07-24T03:00:00Z",
  "priority": 2,
  "tags": ["backup", "recovery", "postgres"]
}
```
The `priority` field lets you boost your own docs (priority 1) over external sources (priority 2+) at query time. Two-pass retrieval: first `topK: 5` filtered to `priority: 1`, and if insufficient results, a second pass with `priority: <= 2`.

### Source Manifest
Stored in KV or D1. The ingestion Worker reads this and processes each enabled source. Enable new sources by flipping `enabled: true` — no code changes.

```json
[
  {
    "name": "superbaser-docs",
    "type": "github",
    "repo": "your-org/superbaser",
    "branch": "main",
    "path": "docs",
    "fileTypes": [".md", ".mdx"],
    "enabled": true,
    "priority": 1,
    "lastSync": null
  },
  {
    "name": "supabase-database",
    "type": "github",
    "repo": "supabase/supabase",
    "branch": "master",
    "path": "apps/docs/content/guides/database",
    "fileTypes": [".md", ".mdx"],
    "enabled": true,
    "priority": 2,
    "lastSync": null
  },
  {
    "name": "supabase-auth",
    "type": "github",
    "repo": "supabase/supabase",
    "branch": "master",
    "path": "apps/docs/content/guides/auth",
    "fileTypes": [".md", ".mdx"],
    "enabled": false,
    "priority": 3,
    "lastSync": null
  },
  {
    "name": "supabase-storage",
    "type": "github",
    "repo": "supabase/supabase",
    "branch": "master",
    "path": "apps/docs/content/guides/storage",
    "fileTypes": [".md", ".mdx"],
    "enabled": false,
    "priority": 3,
    "lastSync": null
  },
  {
    "name": "supabase-realtime",
    "type": "github",
    "repo": "supabase/supabase",
    "branch": "master",
    "path": "apps/docs/content/guides/realtime",
    "fileTypes": [".md", ".mdx"],
    "enabled": false,
    "priority": 4,
    "lastSync": null
  },
  {
    "name": "supabase-functions",
    "type": "github",
    "repo": "supabase/supabase",
    "branch": "master",
    "path": "apps/docs/content/guides/functions",
    "fileTypes": [".md", ".mdx"],
    "enabled": false,
    "priority": 4,
    "lastSync": null
  },
  {
    "name": "supabase-api",
    "type": "github",
    "repo": "supabase/supabase",
    "branch": "master",
    "path": "apps/docs/content/guides/api",
    "fileTypes": [".md", ".mdx"],
    "enabled": false,
    "priority": 4,
    "lastSync": null
  },
  {
    "name": "supabase-cli",
    "type": "github",
    "repo": "supabase/supabase",
    "branch": "master",
    "path": "apps/docs/content/guides/cli",
    "fileTypes": [".md", ".mdx"],
    "enabled": false,
    "priority": 4,
    "lastSync": null
  },
  {
    "name": "supabase-getting-started",
    "type": "github",
    "repo": "supabase/supabase",
    "branch": "master",
    "path": "apps/docs/content/guides/getting-started",
    "fileTypes": [".md", ".mdx"],
    "enabled": false,
    "priority": 5,
    "lastSync": null
  },
  {
    "name": "supabase-reference",
    "type": "github",
    "repo": "supabase/supabase",
    "branch": "master",
    "path": "apps/docs/content/reference",
    "fileTypes": [".md", ".mdx"],
    "enabled": false,
    "priority": 5,
    "lastSync": null
  },
  {
    "name": "cloudflare-workers",
    "type": "llms-txt",
    "indexUrl": "https://developers.cloudflare.com/workers/llms.txt",
    "pageSuffix": "/index.md",
    "enabled": true,
    "priority": 2,
    "lastSync": null
  },
  {
    "name": "cloudflare-vectorize",
    "type": "llms-txt",
    "indexUrl": "https://developers.cloudflare.com/vectorize/llms.txt",
    "pageSuffix": "/index.md",
    "enabled": true,
    "priority": 2,
    "lastSync": null
  },
  {
    "name": "cloudflare-durable-objects",
    "type": "llms-txt",
    "indexUrl": "https://developers.cloudflare.com/durable-objects/llms.txt",
    "pageSuffix": "/index.md",
    "enabled": true,
    "priority": 2,
    "lastSync": null
  },
  {
    "name": "cloudflare-r2",
    "type": "llms-txt",
    "indexUrl": "https://developers.cloudflare.com/r2/llms.txt",
    "pageSuffix": "/index.md",
    "enabled": false,
    "priority": 3,
    "lastSync": null
  },
  {
    "name": "cloudflare-ai-gateway",
    "type": "llms-txt",
    "indexUrl": "https://developers.cloudflare.com/ai-gateway/llms.txt",
    "pageSuffix": "/index.md",
    "enabled": false,
    "priority": 3,
    "lastSync": null
  },
  {
    "name": "cloudflare-workers-ai",
    "type": "llms-txt",
    "indexUrl": "https://developers.cloudflare.com/workers-ai/llms.txt",
    "pageSuffix": "/index.md",
    "enabled": false,
    "priority": 3,
    "lastSync": null
  },
  {
    "name": "cloudflare-queues",
    "type": "llms-txt",
    "indexUrl": "https://developers.cloudflare.com/queues/llms.txt",
    "pageSuffix": "/index.md",
    "enabled": false,
    "priority": 4,
    "lastSync": null
  },
  {
    "name": "cloudflare-workflows",
    "type": "llms-txt",
    "indexUrl": "https://developers.cloudflare.com/workflows/llms.txt",
    "pageSuffix": "/index.md",
    "enabled": false,
    "priority": 4,
    "lastSync": null
  },
  {
    "name": "supabase-changelog",
    "type": "github-releases",
    "repo": "supabase/supabase",
    "enabled": false,
    "priority": 4,
    "lastSync": null
  },
  {
    "name": "supabase-issues-curated",
    "type": "github-issues",
    "repo": "supabase/supabase",
    "issueNumbers": [],
    "enabled": false,
    "priority": 5,
    "lastSync": null
  },
  {
    "name": "postgresql-backup-docs",
    "type": "html-scrape",
    "baseUrl": "https://www.postgresql.org/docs/16/backup.html",
    "linkSelector": "a[href]",
    "enabled": false,
    "priority": 4,
    "lastSync": null
  }
]
```

### RAG Build Order (Phased)

| Phase | Sources | Why First |
|---|---|---|
| 1 | SuperBaser's own docs + Supabase `guides/database/` | Core domain — what your product does + how the underlying database works |
| 2 | Cloudflare Workers, Vectorize, Durable Objects `llms.txt` pages | Infrastructure layer — the agent needs to understand its own runtime |
| 3 | Supabase `guides/auth/` + `guides/storage/` | Adjacent domains that affect backup/restore (RLS, storage buckets) |
| 4 | Supabase changelog + Cloudflare changelog | Time-sensitive behavior changes |
| 5 | Curated GitHub issues (Supabase) | Real-world edge cases not in docs |
| 6 | PostgreSQL official docs (backup/recovery sections) | Deep technical reference |
| 7 | Remaining Supabase guides + Cloudflare docs | Broad coverage |

### Rate Limit Management

| Concern | Limit | Mitigation |
|---|---|---|
| GitHub API (unauthenticated) | 60 req/hour | Use a token — 5,000 req/hour |
| GitHub API (authenticated) | 5,000 req/hour | sha-diffing means most runs fetch 0-5 files |
| Workers AI embeddings | Free tier: 10K neurons/day | bge-base-en-v1.5 is small; initial bulk load of ~50 files ≈ 200 chunks |
| Vectorize upserts | Paid plan: generous | Batch upserts (up to 100 vectors per call) |
| Worker CPU time | 30s (paid) | Use Workflows for initial bulk load (no wall-clock limit); cron Worker for incremental updates |

### RAG Query Flow (at Answer Time)
1. Agent embeds the user's query using `bge-base-en-v1.5`
2. Queries Vectorize: `env.SUPERBASER_DOCS.query(queryVector, { topK: 5, returnMetadata: 'all' })`
3. Gets back ranked chunks with metadata (source, path, section, lastUpdated)
4. Injects those chunks into the model context as grounding
5. The agent answers and cites: "According to Supabase's database guides (last updated 2026-07-15), PITR works by..."
6. The `lastUpdated` metadata lets the agent hedge on time-sensitive content

### Curate, Don't Crawl Blindly
Every source you enable adds ingestion time, embedding costs, Vectorize storage, and noise in retrieval results. A smaller, well-tagged, curated corpus will outperform a massive, untagged, auto-crawled one every time. Start with Phase 1, measure retrieval quality, then expand only when you identify gaps the agent can't answer.

---

## 🛡 Sentinel — Internal Gap-Analysis Agent (Separate System)

### Hard Separation from SUPERB AI
The "tell us what gaps exist in our system vs what's out there" agent is a completely separate system from the customer-facing SUPERB AI.

| Property | SUPERB AI (customer-facing) | Sentinel (internal) |
|---|---|---|
| Trigger | User message via WebSocket | Cron schedule (daily/weekly) |
| Worker | Dedicated Worker + Durable Object | Separate Worker, no shared DO |
| Tool registry | `enqueueBackup`, `listBackups`, etc. | Read-only: query Vectorize, fetch external docs, summarize |
| Execution capability | Can trigger real jobs (via tools) | **None** — read and report only |
| Output destination | Back to user in chat | Slack webhook, email, internal dashboard — never customer chat |
| Name | SUPERB AI | Sentinel |

### Why the Hard Separation Matters
If Sentinel shared any surface with SUPERB AI, a customer's message would sit in the same execution path as an internal ops report. A customer could craft a message that influences the internal report, or an internal ingestion pipeline could inject content into the customer chat context. That's an unnecessary prompt-injection risk for zero user-facing benefit. Keep it firmly out of band.

### Sentinel's Workflow
1. Scheduled trigger fires (cron)
2. Fetches latest docs/issues from curated sources (Supabase changelog, Cloudflare changelog, own repo issues)
3. Compares against current feature set and Vectorize index
4. LLM summarizes: "Here's what changed in the ecosystem, here's what we don't support yet, here's what we should build"
5. Delivers report to you (Slack/email) — never to a customer

---

## 📋 Build Order: Cheapest-to-Verify First

1. **Wrap existing mutations as agent tools.** `enqueueBackup`, `enqueueRestore`, `listBackups` become tool functions the agent can call. Move Realtime subscription logic into the Agent class; push to client via `useAgent`.
2. **One Agent class, one Durable Object per organization.** Matches existing `activeOrgId` model. Jobs, plans, connections are all org-scoped.
3. **ActionChips = tool-call results rendered as UI.** When the agent decides "user wants a backup," it calls `enqueueBackup`, gets a job ID back, frontend renders a chip with live progress.
4. **Anonymous-user gate at the tool boundary.** Move `is_anonymous` check into the tool function itself (server-side, inside the Agent class).
5. **Multi-LLM cascade.** Provider chain inside the Durable Object. All keys as Worker secrets. Rate-limit awareness with cooldown tracking.
6. **Two-trigger confirmation for destructive actions.** `proposeAction` tool mints single-use token → ActionChip renders confirmation card → button click sends token → `enqueueRestore` executes.
7. **Vectorize + ingestion pipeline.** Scheduled Worker pulls from curated sources, chunks, embeds, upserts. Chat agent queries at answer time. Tag chunks with source and date.
8. **Internal gap-analysis agent (Sentinel).** Separate Worker, cron trigger, read-only tools, output to Slack/email. Never shares a Durable Object or tool registry with SUPERB AI.

### What NOT to Do
- **Don't let the agent directly execute `pg_dump`/`psql` as a tool.** Restore procedure has documented conflict-checking and `ON_ERROR_STOP=0` logic — that belongs in the Container execution layer.
- **Don't stuff the knowledge base into the system prompt.** Use RAG. The prompt stays small and stable; retrieval happens at request time.
- **Don't let Sentinel share any surface with SUPERB AI.** Different Worker, different DO, different tools, different output destination.
- **Don't gate tiers by hiding UI elements.** Gate at the tool boundary, server-side. A user who types "restore my project" as free text should hit a real server-enforced rejection.
- **Don't use free-text confirmation for destructive actions.** Structural button click + single-use token. No "did you mean yes?" parsing.
- **Don't add Vectorize in v1 just because you're on paid.** Build it as step 7, not step 1. There's nothing to retrieve against until you have an ingestion pipeline and curated sources.