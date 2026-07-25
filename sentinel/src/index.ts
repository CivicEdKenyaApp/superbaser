// ─── Sentinel — Internal Gap-Analysis Agent ──────────────────────────────────
// Item 23: Separate Worker from SuperbAgent. No shared Durable Object.
// Read-only: queries Vectorize, fetches changelogs, never touches customer data.
// Reports to Slack webhook or email. Never to customer chat.
// ─────────────────────────────────────────────────────────────────────────────

import { Agent, routeAgentRequest } from 'agents';
import { createClient } from '@supabase/supabase-js';

export interface SentinelEnv {
  SENTINEL_AGENT: DurableObjectNamespace;
  AI: Ai;
  VECTOR_INDEX: VectorizeIndex;
  AGENT_KV: KVNamespace;
  CEREBRAS_API_KEY: string;
  GROQ_API_KEY: string;
  DEEPSEEK_API_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_URL: string;
  GITHUB_TOKEN: string;
  SLACK_WEBHOOK_URL: string;
  CF_AI_GATEWAY_ID: string;
  CF_ACCOUNT_ID: string;
}

interface SentinelState {
  lastRunAt: string;
  gapReport: string;
  knowledgeGaps: string[];
  systemHealthSummary: string;
}

export class SentinelAgent extends Agent<SentinelEnv, SentinelState> {
  initialState: SentinelState = {
    lastRunAt: '',
    gapReport: '',
    knowledgeGaps: [],
    systemHealthSummary: ''
  };

  // Sentinel is fully server-driven — no WebSocket client connections
  // It is triggered by the scheduled Worker cron trigger

  async runGapAnalysis(ctx: ExecutionContext) {
    console.log('[Sentinel] Starting gap analysis run...');

    const report: string[] = [];
    report.push(`# Sentinel Gap Analysis — ${new Date().toISOString()}\n`);

    // ─── 1. Query Vectorize for knowledge coverage ─────────────────────────
    try {
      const queryVector = await (this.env.AI as any).run('@cf/baai/bge-base-en-v1.5', {
        text: ['point in time recovery postgres backup restore supabase']
      });
      const ragResults = await this.env.VECTOR_INDEX.query(queryVector?.data?.[0] ?? [], {
        topK: 10,
        returnMetadata: 'all'
      });

      const coveredSources = new Set(ragResults.matches?.map((m: any) => m.metadata?.source) ?? []);
      report.push(`## Knowledge Base Coverage\nSources indexed: ${[...coveredSources].join(', ')}\nTotal vectors retrieved: ${ragResults.matches?.length ?? 0}\n`);

      // Identify gaps
      const expectedSources = ['supabase-database', 'cloudflare-workers', 'superbaser-docs', 'cloudflare-r2'];
      const missingGaps = expectedSources.filter(s => !coveredSources.has(s));
      if (missingGaps.length > 0) {
        report.push(`### GAPS IDENTIFIED\nMissing sources: ${missingGaps.join(', ')}\n`);
      }
    } catch (err) {
      report.push(`## Vectorize query failed: ${err}\n`);
    }

    // ─── 2. Check Supabase for system health metrics (read-only) ──────────
    try {
      const supabase = createClient(this.env.SUPABASE_URL, this.env.SUPABASE_SERVICE_ROLE_KEY);

      const { data: jobs } = await supabase
        .from('jobs')
        .select('status, kind')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (jobs) {
        const failed = jobs.filter(j => j.status === 'failed').length;
        const total = jobs.length;
        report.push(`## 24h Job Health\nTotal: ${total} | Failed: ${failed} | Failure rate: ${total > 0 ? ((failed / total) * 100).toFixed(1) : 0}%\n`);
      }
    } catch (err) {
      report.push(`## Supabase health check failed: ${err}\n`);
    }

    // ─── 3. Fetch Supabase changelog for new features (read-only) ─────────
    try {
      const changelogResp = await fetch(
        'https://api.github.com/repos/supabase/supabase/releases?per_page=3',
        { headers: { Authorization: `Bearer ${this.env.GITHUB_TOKEN}`, 'User-Agent': 'superbaser-sentinel/1.0' } }
      );
      if (changelogResp.ok) {
        const releases: any[] = await changelogResp.json();
        const latestRelease = releases[0];
        report.push(`## Supabase Latest Release\n${latestRelease?.tag_name}: ${latestRelease?.name}\nPublished: ${latestRelease?.published_at}\n`);
      }
    } catch (err) {
      report.push(`## Supabase changelog fetch failed: ${err}\n`);
    }

    // ─── 4. Run LLM analysis on report (cheapest model — latency irrelevant) ──
    const finalReport = report.join('\n');
    let llmSummary = finalReport;

    try {
      const groqResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            {
              role: 'system',
              content: 'You are Sentinel, an internal gap-analysis agent for SuperBaser. Summarize the following operational report into 3-5 actionable bullet points. Be direct and technical. No fluff.'
            },
            { role: 'user', content: finalReport }
          ],
          max_tokens: 512
        })
      });

      if (groqResp.ok) {
        const groqData: any = await groqResp.json();
        llmSummary = groqData.choices?.[0]?.message?.content ?? finalReport;
      }
    } catch (err) {
      console.error('[Sentinel] LLM analysis failed:', err);
    }

    // ─── 5. Persist state ─────────────────────────────────────────────────
    this.setState({
      lastRunAt: new Date().toISOString(),
      gapReport: finalReport,
      knowledgeGaps: [],
      systemHealthSummary: llmSummary
    });

    // ─── 6. Send to Slack (if configured) ─────────────────────────────────
    if (this.env.SLACK_WEBHOOK_URL && this.env.SLACK_WEBHOOK_URL !== 'PLACEHOLDER') {
      try {
        await fetch(this.env.SLACK_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `*Sentinel Report — ${new Date().toDateString()}*\n\`\`\`\n${llmSummary}\n\`\`\``
          })
        });
      } catch (err) {
        console.error('[Sentinel] Slack notification failed:', err);
      }
    }

    console.log('[Sentinel] Gap analysis complete.');
    return llmSummary;
  }
}

// ─── Sentinel Worker Handler — Cron triggered ─────────────────────────────────
export default {
  async fetch(request: Request, env: SentinelEnv): Promise<Response> {
    const agentResponse = await routeAgentRequest(request, env);
    if (agentResponse) return agentResponse;
    return new Response('Sentinel running', { status: 200 });
  },

  async scheduled(event: ScheduledEvent, env: SentinelEnv, ctx: ExecutionContext): Promise<void> {
    // Cron: daily at 03:00 UTC (defined in sentinel/wrangler.jsonc)
    const stub = await env.SENTINEL_AGENT.get(env.SENTINEL_AGENT.idFromName('global-sentinel'));
    ctx.waitUntil(
      (stub as any).runGapAnalysis(ctx)
    );
  }
};
