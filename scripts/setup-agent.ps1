# ─────────────────────────────────────────────────────────────────────────────
# SuperBaser Agentic Architecture — Full Setup Script (PowerShell / Windows)
# Run ONCE from repo root after first clone or to initialize Cloudflare resources
# ─────────────────────────────────────────────────────────────────────────────

$ErrorActionPreference = "Stop"

Write-Host "=== SuperBaser Agentic Architecture Setup ===" -ForegroundColor Cyan

# Step 0: Verify Wrangler auth
Write-Host "`nStep 0: Verifying Wrangler..." -ForegroundColor Yellow
& cmd /c "npx wrangler whoami 2>&1"

# ─── Item 19: Vectorize Index ────────────────────────────────────────────────
Write-Host "`nStep 1 [Item 19]: Creating Vectorize index 'superbaser-docs'..." -ForegroundColor Yellow
Write-Host "  Dimensions: 768, Model preset: @cf/baai/bge-base-en-v1.5, Metric: cosine"
& cmd /c "npx wrangler vectorize create superbaser-docs --preset @cf/baai/bge-base-en-v1.5 2>&1"

# ─── Item 7: KV Namespace ────────────────────────────────────────────────────
Write-Host "`nStep 2 [Item 7]: Creating KV namespace 'superbaser-agent-kv'..." -ForegroundColor Yellow
& cmd /c "npx wrangler kv namespace create superbaser-agent-kv 2>&1"
Write-Host "  >> Copy the KV ID from above and replace PLACEHOLDER_KV_ID in:"
Write-Host "     worker/wrangler.jsonc, ingestion/wrangler.jsonc, sentinel/wrangler.jsonc"
Read-Host "  Press ENTER after updating wrangler.jsonc files..."

# ─── Item 21: Seed manifest to KV ───────────────────────────────────────────
Write-Host "`nStep 3 [Item 21]: Seeding source manifest to KV..." -ForegroundColor Yellow
$kvId = Read-Host "  Enter KV Namespace ID"
& cmd /c "npx wrangler kv key put --namespace-id $kvId source-manifest --path ingestion/manifest.json 2>&1"

# ─── Item 6: AI Gateway reminder ─────────────────────────────────────────────
Write-Host "`nStep 4 [Item 6]: AI Gateway Setup" -ForegroundColor Yellow
Write-Host "  >> Create in Cloudflare Dashboard: AI > AI Gateway > Create"
Write-Host "  >> Name: superbaser-ai-gateway"
Write-Host "  >> Enable: Logging, Caching, Rate Limiting, Content Moderation, Retries"
Write-Host "  >> Copy Account ID and Gateway ID into worker/wrangler.jsonc vars"
Read-Host "  Press ENTER when done..."

# ─── Item 2: Supabase Service Role Key ───────────────────────────────────────
Write-Host "`nStep 5 [Item 2]: Setting SUPABASE_SERVICE_ROLE_KEY secrets..." -ForegroundColor Yellow
Write-Host "  superbaser-agent:"
& cmd /c "npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --name superbaser-agent 2>&1"
Write-Host "  superbaser-sentinel:"
& cmd /c "npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --name superbaser-sentinel 2>&1"

# ─── Item 1: Multi-LLM cascade secrets ─────────────────────────────────────
Write-Host "`nStep 6 [Item 1]: Setting Multi-LLM cascade provider secrets..." -ForegroundColor Yellow

Write-Host "  CEREBRAS_API_KEY (Provider 1 — fastest):"
& cmd /c "npx wrangler secret put CEREBRAS_API_KEY --name superbaser-agent 2>&1"

Write-Host "  GROQ_API_KEY (Provider 2):"
& cmd /c "npx wrangler secret put GROQ_API_KEY --name superbaser-agent 2>&1"
& cmd /c "npx wrangler secret put GROQ_API_KEY --name superbaser-sentinel 2>&1"

Write-Host "  DEEPSEEK_API_KEY (Provider 4):"
& cmd /c "npx wrangler secret put DEEPSEEK_API_KEY --name superbaser-agent 2>&1"

Write-Host "  OPENROUTER_API_KEY (Provider 5 — last resort):"
& cmd /c "npx wrangler secret put OPENROUTER_API_KEY --name superbaser-agent 2>&1"

# ─── Item 3: GitHub PAT ──────────────────────────────────────────────────────
Write-Host "`nStep 7 [Item 3]: Setting GitHub PAT secrets..." -ForegroundColor Yellow
Write-Host "  superbaser-ingestion:"
& cmd /c "npx wrangler secret put GITHUB_TOKEN --name superbaser-ingestion 2>&1"
Write-Host "  superbaser-sentinel:"
& cmd /c "npx wrangler secret put GITHUB_TOKEN --name superbaser-sentinel 2>&1"

# ─── Item 23: Sentinel Slack Webhook ─────────────────────────────────────────
Write-Host "`nStep 8 [Item 23]: Setting Sentinel Slack webhook..." -ForegroundColor Yellow
& cmd /c "npx wrangler secret put SLACK_WEBHOOK_URL --name superbaser-sentinel 2>&1"

# ─── Item 24: Deploy Workers ──────────────────────────────────────────────────
Write-Host "`nStep 9 [Item 24]: Deploying SuperbAgent Worker..." -ForegroundColor Yellow
Set-Location worker
& cmd /c "npm install --legacy-peer-deps 2>&1"
& cmd /c "npx wrangler deploy 2>&1"
Set-Location ..

Write-Host "`nStep 10 [Item 24]: Deploying Ingestion Worker..." -ForegroundColor Yellow
Set-Location ingestion
& cmd /c "npm install --legacy-peer-deps 2>&1"
& cmd /c "npx wrangler deploy 2>&1"
Set-Location ..

Write-Host "`nStep 11 [Item 24]: Deploying Sentinel Worker..." -ForegroundColor Yellow
Set-Location sentinel
& cmd /c "npm install --legacy-peer-deps 2>&1"
& cmd /c "npx wrangler deploy 2>&1"
Set-Location ..

Write-Host "`n=== Deployment Complete! ===" -ForegroundColor Green
Write-Host ""
Write-Host "FINAL STEPS to enable the agent:" -ForegroundColor Cyan
Write-Host "  1. Verify health: curl https://superbaser-agent.workers.dev/health"
Write-Host "  2. Update VITE_SB_AGENT_WS_URL in .env with the deployed Worker URL"
Write-Host "  3. In Cloudflare Pages > Settings > Environment Variables:"
Write-Host "     Set VITE_SB_AGENT_ENABLED=true"
Write-Host "     Set VITE_SB_AGENT_WS_URL=wss://superbaser-agent.workers.dev"
Write-Host "  4. Push to main to trigger Cloudflare Pages auto-deploy"
Write-Host "  5. Monitor Worker logs: npx wrangler tail --name superbaser-agent"
