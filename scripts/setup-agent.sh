#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# SuperBaser Agentic Architecture — Full Setup Script
# Run this ONCE from the repo root after cloning or first deploy.
# All 24 items referenced inline.
# ─────────────────────────────────────────────────────────────────────────────

set -e

echo "=== SuperBaser Agentic Architecture Setup ==="

# ─── PREREQUISITE: wrangler auth ────────────────────────────────────────────
echo ""
echo "Step 0: Verifying Wrangler authentication..."
wrangler whoami || (echo "Run: wrangler login" && exit 1)

# ─── Item 19: Create Vectorize Index ────────────────────────────────────────
echo ""
echo "Step 1 [Item 19]: Creating Vectorize index 'superbaser-docs'..."
echo "  Dimensions: 768 (bge-base-en-v1.5), Metric: cosine"
wrangler vectorize create superbaser-docs --preset @cf/baai/bge-base-en-v1.5 || echo "  (Index may already exist — continuing)"

# ─── Item 6: AI Gateway ─────────────────────────────────────────────────────
echo ""
echo "Step 2 [Item 6]: AI Gateway must be created in Cloudflare Dashboard."
echo "  Navigate to: AI > AI Gateway > Create Gateway"
echo "  Name: superbaser-ai-gateway"
echo "  Enable: Request/Response Logging, Caching, Rate Limiting, Content Moderation"
echo "  After creation, copy the Gateway ID and update WRANGLER_ACCOUNT_ID in worker/wrangler.jsonc"
echo "  Press ENTER when done..."
read -r _

# ─── Item 7: KV Namespace (for sync state + agent KV) ───────────────────────
echo ""
echo "Step 3 [Item 7]: Creating KV namespace 'superbaser-agent-kv'..."
KV_OUTPUT=$(wrangler kv namespace create superbaser-agent-kv 2>&1)
echo "$KV_OUTPUT"
KV_ID=$(echo "$KV_OUTPUT" | grep -oP '"id": "\K[^"]+' || echo "PLACEHOLDER")
echo "  KV ID: $KV_ID"
echo "  Update PLACEHOLDER_KV_ID in worker/wrangler.jsonc, ingestion/wrangler.jsonc, sentinel/wrangler.jsonc"

# ─── Seed source manifest to KV ─────────────────────────────────────────────
if [ "$KV_ID" != "PLACEHOLDER" ]; then
  echo ""
  echo "Step 4 [Item 21]: Seeding source manifest to KV..."
  wrangler kv key put --namespace-id "$KV_ID" "source-manifest" --path ingestion/manifest.json || echo "  (Manual seed required — upload ingestion/manifest.json to KV key 'source-manifest')"
fi

# ─── Item 2: Supabase Service Role Key as Worker Secret ─────────────────────
echo ""
echo "Step 5 [Item 2]: Setting Supabase Service Role Key as Worker secret..."
echo "  For superbaser-agent:"
wrangler secret put SUPABASE_SERVICE_ROLE_KEY --name superbaser-agent
echo "  For superbaser-sentinel:"
wrangler secret put SUPABASE_SERVICE_ROLE_KEY --name superbaser-sentinel

# ─── Item 1: LLM API Keys as Worker Secrets (cascade providers) ────────────
echo ""
echo "Step 6 [Item 1]: Setting Multi-LLM cascade provider keys as Worker secrets..."
echo "  Provider 1 — Cerebras:"
wrangler secret put CEREBRAS_API_KEY --name superbaser-agent

echo "  Provider 2 — Groq:"
wrangler secret put GROQ_API_KEY --name superbaser-agent

echo "  Provider 4 — DeepSeek:"
wrangler secret put DEEPSEEK_API_KEY --name superbaser-agent

echo "  Provider 5 — OpenRouter:"
wrangler secret put OPENROUTER_API_KEY --name superbaser-agent

echo "  Sentinel — Groq (batch analysis):"
wrangler secret put GROQ_API_KEY --name superbaser-sentinel

# ─── Item 3: GitHub PAT as Worker Secret ────────────────────────────────────
echo ""
echo "Step 7 [Item 3]: Setting GitHub PAT as Worker secret for ingestion pipeline..."
echo "  Ingestion worker (5000 req/hr):"
wrangler secret put GITHUB_TOKEN --name superbaser-ingestion
echo "  Sentinel worker (changelog fetches):"
wrangler secret put GITHUB_TOKEN --name superbaser-sentinel

# ─── Item 23: Sentinel Slack Webhook ────────────────────────────────────────
echo ""
echo "Step 8 [Item 23]: Setting Sentinel Slack webhook URL..."
wrangler secret put SLACK_WEBHOOK_URL --name superbaser-sentinel

# ─── Item 24: Deploy Workers ─────────────────────────────────────────────────
echo ""
echo "Step 9 [Item 24]: Deploying SuperbAgent Worker..."
cd worker && wrangler deploy && cd ..

echo ""
echo "Step 10 [Item 24]: Deploying Ingestion Worker..."
cd ingestion && wrangler deploy && cd ..

echo ""
echo "Step 11 [Item 24]: Deploying Sentinel Worker..."
cd sentinel && wrangler deploy && cd ..

# ─── Item 21: Trigger initial RAG ingestion ──────────────────────────────────
echo ""
echo "Step 12 [Item 21]: Triggering initial RAG ingestion run..."
echo "  This will take a few minutes. You can monitor via: wrangler tail --name superbaser-ingestion"
curl -X POST https://superbaser-ingestion.workers.dev/trigger || echo "  (Trigger manually after Worker is deployed)"

echo ""
echo "=== Setup Complete! ==="
echo ""
echo "FINAL STEPS:"
echo "  1. Copy the deployed SuperbAgent Worker URL"
echo "  2. Update VITE_SB_AGENT_WS_URL in .env with wss://superbaser-agent.workers.dev (or custom route)"
echo "  3. Verify Worker is healthy: curl https://superbaser-agent.workers.dev/health"
echo "  4. Set VITE_SB_AGENT_ENABLED=true in Cloudflare Pages environment variables"
echo "  5. Re-deploy Cloudflare Pages: push to main branch"
echo "  6. Monitor via: wrangler tail --name superbaser-agent"
