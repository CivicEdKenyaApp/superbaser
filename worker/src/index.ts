// ─── SuperbAgent — Cloudflare Agents SDK Durable Object ──────────────────────
// Items: 8 (Orchestrator), 10 (State Schema), 11 (WebSocket + JWT Auth),
//        12 (Graceful Degradation), 13 (Tools), 14 (Confirmation Tokens),
//        15 (ACTION_TRIGGER_KEYWORDS server-side), 22 (RAG Query)
// ─────────────────────────────────────────────────────────────────────────────

import { Agent, routeAgentRequest } from 'agents';
import { buildBasePrompt, TOOL_SCHEMAS } from './prompts/base-prompt';
import { createClient } from '@supabase/supabase-js';

// ─── Environment Bindings ─────────────────────────────────────────────────────
export interface Env {
  SUPERB_AGENT: DurableObjectNamespace;
  SENTINEL_AGENT: DurableObjectNamespace;
  AI: Ai;
  VECTOR_INDEX: VectorizeIndex;
  AGENT_KV: KVNamespace;

  // Secrets (wrangler secret put)
  CEREBRAS_API_KEY: string;
  GROQ_API_KEY: string;
  DEEPSEEK_API_KEY: string;
  OPENROUTER_API_KEY: string;
  MISTRAL_API_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_URL: string;
  GITHUB_TOKEN: string;
  CF_AI_GATEWAY_ID: string;
  CF_ACCOUNT_ID: string;
  AGENT_FEATURE_FLAG: string;
}

// ─── Item 10: Agent State Schema ──────────────────────────────────────────────
export interface AgentState {
  // Conversation
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
  }>;

  // Item 14: Pending action proposals (single-use confirmation tokens)
  pendingProposals: Array<{
    token: string;
    action: 'restore' | 'delete_backup';
    backupId: string;
    destinationProjectId?: string;
    organizationId: string;
    expiresAt: string;
    usedAt?: string;
  }>;

  // Job tracking
  activeJobIds: string[];
  jobStatusCache: Record<string, {
    status: string;
    updatedAt: string;
    progress?: number;
  }>;

  // Item 8: Multi-LLM cascade cooldown timestamps per provider
  providerCooldowns: {
    cerebras?: string;
    groq?: string;
    workersAi?: string;
    deepseek?: string;
    openrouter?: string;
  };

  // Org context
  activeOrgId: string;
  plan: 'free' | 'pro' | 'premium';
  userRole: 'owner' | 'admin' | 'member' | 'viewer';
  userName: string;
  userId: string;
  isAnonymous: boolean;
  supabaseJwt: string;

  // RAG context cache (last retrieved chunks)
  ragContextCache: string;
  ragCachedFor: string;

  // Page context — frontend posts this on every message so prompts are page-aware
  currentView: string;
}

// ─── Item 15: ACTION_TRIGGER_KEYWORDS (server-side mirror) ───────────────────
const ACTION_TRIGGER_KEYWORDS = [
  'run', 'trigger', 'snapshot', 'pg_dump', 'backup', 'restore',
  'create org', 'enqueue', 'execute', 'delete', 'drop', 'remove'
];

function isActionQuery(text: string): boolean {
  const lower = text.toLowerCase();
  return ACTION_TRIGGER_KEYWORDS.some(kw => lower.includes(kw));
}

// ─── Item 8: Multi-LLM Provider Cascade ───────────────────────────────────────
interface LLMProvider {
  name: 'cerebras' | 'groq' | 'workersAi' | 'deepseek' | 'openrouter';
  endpoint?: string;
  model: string;
  apiKeyEnvVar: keyof Env;
}

const LLM_CASCADE: LLMProvider[] = [
  {
    name: 'cerebras',
    endpoint: 'https://api.cerebras.ai/v1/chat/completions',
    model: 'llama-3.1-8b',
    apiKeyEnvVar: 'CEREBRAS_API_KEY'
  },
  {
    name: 'groq',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama-3.3-70b-versatile',
    apiKeyEnvVar: 'GROQ_API_KEY'
  },
  {
    name: 'workersAi',
    model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    apiKeyEnvVar: 'GROQ_API_KEY' // Workers AI uses AI binding, key not needed
  },
  {
    name: 'deepseek',
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    model: 'deepseek-chat',
    apiKeyEnvVar: 'DEEPSEEK_API_KEY'
  },
  {
    name: 'openrouter',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'meta-llama/llama-3.3-70b-instruct',
    apiKeyEnvVar: 'OPENROUTER_API_KEY'
  }
];

// ─── SuperbAgent Durable Object ───────────────────────────────────────────────
export class SuperbAgent extends Agent<Env, AgentState> {
  initialState: AgentState = {
    messages: [],
    pendingProposals: [],
    activeJobIds: [],
    jobStatusCache: {},
    providerCooldowns: {},
    activeOrgId: '',
    plan: 'free',
    userRole: 'viewer',
    userName: 'SuperB User',
    userId: '',
    isAnonymous: true,
    supabaseJwt: '',
    ragContextCache: '',
    ragCachedFor: '',
    currentView: 'unknown'
  };

  // ─── Item 11: WebSocket Authentication on Upgrade ──────────────────────────
  async onConnect(connection: any) {
    // JWT is passed as a query parameter on the WebSocket URL
    // wss://agent.superbaser.co/agents/superb-agent/{orgId}?token={supabase_jwt}
    const url = new URL(connection.request?.url ?? 'wss://localhost');
    const token = url.searchParams.get('token');

    if (!token) {
      connection.close(4001, 'Unauthorized: missing token');
      return;
    }

    try {
      const supabase = createClient(this.env.SUPABASE_URL, this.env.SUPABASE_SERVICE_ROLE_KEY);
      const { data: { user }, error } = await supabase.auth.getUser(token);

      if (error || !user) {
        connection.close(4001, 'Unauthorized: invalid token');
        return;
      }

      const isAnonymous = (user as any).is_anonymous === true;
      const orgId = url.searchParams.get('orgId') ?? '';

      // Fetch org plan + role from Supabase
      let plan: 'free' | 'pro' | 'premium' = 'free';
      let userRole: 'owner' | 'admin' | 'member' | 'viewer' = 'viewer';

      if (orgId && !isAnonymous) {
        const { data: org } = await supabase
          .from('organizations')
          .select('plan, created_by')
          .eq('id', orgId)
          .single();

        if (org) {
          plan = (org.plan as any) ?? 'free';
          userRole = org.created_by === user.id ? 'owner' : 'member';
        }
      }

      // Initialize/update org context in state
      this.setState({
        ...this.state,
        activeOrgId: orgId,
        plan,
        userRole,
        userName: user.user_metadata?.full_name ?? user.email ?? 'SuperB User',
        userId: user.id,
        isAnonymous,
        supabaseJwt: token
      });

      // Tag this connection with userId for targeted broadcasts
      connection.setState({ userId: user.id });

    } catch (err) {
      connection.close(4002, 'Server error during auth');
    }
  }

  onClose() {
    // Connection cleanup — state persists in DO SQLite
  }

  // ─── Item 8: Incoming message handler ─────────────────────────────────────
  async onMessage(connection: any, message: string) {
    let parsed: any;
    try {
      parsed = JSON.parse(message);
    } catch {
      return;
    }

    const { type, payload } = parsed;

    // Update page context whenever the frontend sends it
    if (payload?.currentView && typeof payload.currentView === 'string') {
      this.setState({ ...this.state, currentView: payload.currentView });
    }

    // Item 17: AuthModal trigger from tool rejection — routed from frontend
    if (type === 'CHAT_MESSAGE') {
      await this.handleChatMessage(connection, payload.text);
    } else if (type === 'CONFIRM_ACTION') {
      // Trigger 2: User clicked confirmation ActionChip — passes token
      await this.handleConfirmAction(connection, payload.token);
    } else if (type === 'DISMISS_PROPOSAL') {
      await this.clearExpiredProposal(payload.token);
    }
  }

  // ─── Main chat message processing ─────────────────────────────────────────
  private async handleChatMessage(connection: any, text: string) {
    // Item 15: Server-side ACTION_TRIGGER_KEYWORDS enforcement
    if (this.state.isAnonymous && isActionQuery(text)) {
      this.sendToConnection(connection, {
        type: 'AUTH_REQUIRED',
        payload: {
          message: 'You must sign in or create an account before triggering vital database actions. Please claim your free account to proceed.',
          suggestions: [{ id: 'auth1', label: 'Claim Account Now', prompt: 'How do I claim my free account?' }]
        }
      });
      return;
    }

    // Add user message to state history
    const updatedMessages = [
      ...this.state.messages,
      { role: 'user' as const, content: text, timestamp: new Date().toISOString() }
    ];
    this.setState({ ...this.state, messages: updatedMessages });

    // Broadcast typing indicator
    this.sendToConnection(connection, { type: 'TYPING_START' });

    try {
      // Item 22: RAG query — retrieve context from Vectorize
      const ragContext = await this.queryRAG(text);

      // Build prompt with base prompt + RAG context + page context
      const systemPrompt = buildBasePrompt({
        orgId: this.state.activeOrgId,
        plan: this.state.plan,
        role: this.state.userRole,
        userName: this.state.userName,
        isAnonymous: this.state.isAnonymous,
        currentView: this.state.currentView
      }) + (ragContext ? `\n\n## RETRIEVED KNOWLEDGE (from Vectorize)\n${ragContext}` : '');

      const llmMessages = [
        { role: 'system' as const, content: systemPrompt },
        ...updatedMessages.map(m => ({ role: m.role, content: m.content }))
      ];

      // Item 8: Multi-LLM cascade with cooldown awareness
      const result = await this.runLLMCascade(llmMessages);

      if (!result) {
        // Item 12: Graceful degradation when all providers fail
        this.sendToConnection(connection, {
          type: 'DEGRADED_MODE',
          payload: {
            message: "I'm having trouble connecting right now. Your message has been saved and I'll respond when connectivity is restored.",
            queuedMessage: text
          }
        });
        return;
      }

      let { content, toolCalls, providerUsed } = result;

      // ── Parse and strip ```suggestions block from LLM response ─────────────
      // The LLM embeds a ```suggestions\n[...]\n``` block at the end of every response.
      // We extract it, parse it as JSON chips, and strip it from the visible text
      // so the user never sees raw JSON in the chat bubble.
      let parsedSuggestions: any[] = [];
      const suggestionsMatch = content?.match(/```suggestions\s*([\s\S]*?)```/);
      if (suggestionsMatch) {
        try {
          parsedSuggestions = JSON.parse(suggestionsMatch[1].trim());
        } catch { /* ignore malformed suggestions block */ }
        content = content!.replace(suggestionsMatch[0], '').trim();
      }
      // Fallback to generated suggestions if LLM omitted the block
      if (parsedSuggestions.length === 0) {
        parsedSuggestions = this.generateSuggestions(text, this.state.plan, this.state.currentView);
      }

      // Store assistant response in history (after stripping suggestions block)
      const finalMessages = [
        ...updatedMessages,
        { role: 'assistant' as const, content: content || '', timestamp: new Date().toISOString() }
      ];
      this.setState({ ...this.state, messages: finalMessages });

      // Process tool calls if the LLM requested them
      if (toolCalls && toolCalls.length > 0) {
        for (const toolCall of toolCalls) {
          const toolResult = await this.executeToolCall(toolCall, connection);
          this.sendToConnection(connection, { type: 'TOOL_RESULT', payload: toolResult });
        }
      }

      // Send assistant message to client with parsed suggestion chips
      this.sendToConnection(connection, {
        type: 'ASSISTANT_MESSAGE',
        payload: {
          content,
          providerUsed,
          suggestions: parsedSuggestions
        }
      });

    } catch (err: any) {
      this.sendToConnection(connection, {
        type: 'ERROR',
        payload: { message: `Agent error: ${err.message}` }
      });
    } finally {
      this.sendToConnection(connection, { type: 'TYPING_END' });
    }
  }

  // ─── Item 8: Multi-LLM Cascade Implementation ─────────────────────────────
  private async runLLMCascade(
    messages: Array<{ role: string; content: string }>
  ): Promise<{ content: string; toolCalls?: any[]; providerUsed: string } | null> {
    const now = new Date();

    for (const provider of LLM_CASCADE) {
      // Check cooldown for this provider
      const cooldownKey = provider.name as keyof AgentState['providerCooldowns'];
      const cooldownUntil = this.state.providerCooldowns[cooldownKey];
      if (cooldownUntil && new Date(cooldownUntil) > now) {
        console.log(`[Cascade] Skipping ${provider.name} — in cooldown until ${cooldownUntil}`);
        continue;
      }

      try {
        // Workers AI uses the AI binding, not HTTP
        if (provider.name === 'workersAi') {
          const resp = await (this.env.AI as any).run(provider.model, {
            messages: messages as any[],
            tools: TOOL_SCHEMAS as any[]
          });
          if (resp?.response) {
            return { content: resp.response, toolCalls: resp.tool_calls, providerUsed: 'Workers AI' };
          }
          continue;
        }

        // All other providers: OpenAI-compatible HTTP API
        const apiKey = this.env[provider.apiKeyEnvVar] as string;
        if (!apiKey || apiKey === 'PLACEHOLDER_OPENROUTER_KEY') continue;

        const endpoint = provider.endpoint!;
        // Route through AI Gateway for logging, caching, guardrails (Item 6 & 18)
        const gatewayEndpoint = `https://gateway.ai.cloudflare.com/v1/${this.env.CF_ACCOUNT_ID}/${this.env.CF_AI_GATEWAY_ID}/${provider.name === 'groq' ? 'groq' : provider.name === 'cerebras' ? 'cerebras' : provider.name === 'deepseek' ? 'openai' : 'openai'}/chat/completions`;

        const response = await fetch(gatewayEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: provider.model,
            messages,
            tools: TOOL_SCHEMAS,
            tool_choice: 'auto',
            max_tokens: 1024,
            temperature: 0.7
          })
        });

        // Handle rate limiting — Item 8: cooldown tracking
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('retry-after') ?? '60');
          const cooldownExpiry = new Date(Date.now() + retryAfter * 1000).toISOString();
          this.setState({
            ...this.state,
            providerCooldowns: {
              ...this.state.providerCooldowns,
              [cooldownKey]: cooldownExpiry
            }
          });
          console.log(`[Cascade] ${provider.name} rate-limited. Cooldown until ${cooldownExpiry}`);
          continue;
        }

        if (!response.ok) {
          console.log(`[Cascade] ${provider.name} failed with status ${response.status}`);
          continue;
        }

        const data: any = await response.json();
        const choice = data.choices?.[0];
        if (!choice) continue;

        const content = choice.message?.content ?? '';
        const toolCalls = choice.message?.tool_calls ?? [];

        if (content || toolCalls.length > 0) {
          return { content, toolCalls, providerUsed: provider.name };
        }

      } catch (err: any) {
        console.error(`[Cascade] ${provider.name} threw: ${err.message}`);
        continue;
      }
    }

    // Item 12: All providers exhausted
    return null;
  }

  // ─── Item 22: RAG Query via Vectorize ─────────────────────────────────────
  private async queryRAG(query: string): Promise<string> {
    try {
      // Generate embedding for query using Workers AI
      const embeddingResp = await (this.env.AI as any).run('@cf/baai/bge-base-en-v1.5', {
        text: [query]
      });
      const queryVector = embeddingResp?.data?.[0];
      if (!queryVector) return '';

      const results = await this.env.VECTOR_INDEX.query(queryVector, {
        topK: 5,
        returnMetadata: 'all'
      });

      if (!results?.matches?.length) return '';

      return results.matches
        .filter((m: any) => m.score > 0.7)
        .map((m: any) => `[${m.metadata?.title ?? 'Doc'}]\n${m.metadata?.text ?? ''}`)
        .join('\n\n---\n\n');

    } catch (err) {
      // RAG failure is non-fatal — agent continues without retrieved context
      console.error('[RAG] Vectorize query failed:', err);
      return '';
    }
  }

  // ─── Items 13, 14: Tool Execution with Security Boundary ─────────────────
  private async executeToolCall(
    toolCall: { function: { name: string; arguments: string } },
    connection: any
  ): Promise<any> {
    const { name, arguments: argsStr } = toolCall.function;
    let args: any = {};
    try { args = JSON.parse(argsStr); } catch { /* ignore */ }

    const supabase = createClient(this.env.SUPABASE_URL, this.env.SUPABASE_SERVICE_ROLE_KEY);

    // Item 13: is_anonymous check at the tool boundary (server-enforced)
    const restrictedTools = ['enqueue_backup', 'propose_restore', 'confirm_restore', 'propose_delete_backup', 'confirm_delete_backup'];
    if (this.state.isAnonymous && restrictedTools.includes(name)) {
      return {
        tool: name,
        authRequired: true,
        message: 'Account required to execute this action.'
      };
    }

    // Plan tier check at the tool boundary
    if (['enqueue_backup', 'propose_restore', 'confirm_restore'].includes(name) && this.state.plan === 'free') {
      return {
        tool: name,
        planRequired: 'pro',
        message: 'This action requires a Pro or Premium plan. Upgrade at billing.'
      };
    }

    // Role check for destructive actions — Owner/Admin only
    if (['propose_restore', 'confirm_restore', 'propose_delete_backup', 'confirm_delete_backup'].includes(name)) {
      if (!['owner', 'admin'].includes(this.state.userRole)) {
        return {
          tool: name,
          error: 'Insufficient permissions. Only Owners and Admins can execute restore or delete operations.'
        };
      }
    }

    switch (name) {
      case 'list_backups': {
        const query = supabase
          .from('backups')
          .select('id, project_id, status, created_at, triggered_via')
          .eq('organization_id', this.state.activeOrgId)
          .order('created_at', { ascending: false })
          .limit(args.limit ?? 20);

        if (args.projectId) query.eq('project_id', args.projectId);
        const { data, error } = await query;
        return { tool: 'list_backups', data: data ?? [], error: error?.message };
      }

      case 'get_job_status': {
        const { data, error } = await supabase
          .from('jobs')
          .select('id, kind, status, payload, created_at, updated_at')
          .eq('id', args.jobId)
          .single();
        return { tool: 'get_job_status', data: data ?? null, error: error?.message };
      }

      case 'navigate_to': {
        return { tool: 'navigate_to', target: args.target };
      }

      case 'enqueue_backup': {
        // Insert backup record
        const { data: backup, error: backupErr } = await supabase
          .from('backups')
          .insert({
            organization_id: args.organizationId ?? this.state.activeOrgId,
            project_id: args.projectId,
            status: 'pending',
            triggered_via: 'agent'
          })
          .select()
          .single();

        if (backupErr) return { tool: 'enqueue_backup', error: backupErr.message };

        const { data: job } = await supabase
          .from('jobs')
          .insert({
            organization_id: args.organizationId ?? this.state.activeOrgId,
            project_id: args.projectId,
            backup_id: backup.id,
            kind: 'backup',
            status: 'queued',
            payload: { project_id: args.projectId, backup_id: backup.id }
          })
          .select()
          .maybeSingle();

        // Track job for real-time updates
        this.setState({
          ...this.state,
          activeJobIds: [...this.state.activeJobIds, job?.id].filter(Boolean) as string[]
        });

        return { tool: 'enqueue_backup', backup, job, actionChip: { type: 'JOB_PROGRESS', jobId: job?.id } };
      }

      // Item 14: Trigger 1 — Propose restore
      case 'propose_restore': {
        const token = this.generateConfirmationToken();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 min expiry

        const proposal = {
          token,
          action: 'restore' as const,
          backupId: args.backupId,
          destinationProjectId: args.destinationProjectId,
          organizationId: args.organizationId ?? this.state.activeOrgId,
          expiresAt
        };

        this.setState({
          ...this.state,
          pendingProposals: [...this.state.pendingProposals, proposal]
        });

        return {
          tool: 'propose_restore',
          confirmationCard: {
            token,
            label: `Confirm: Restore backup into project`,
            description: `Backup ID: ${args.backupId} → Project: ${args.destinationProjectId}`,
            expiresAt,
            chipType: 'CONFIRM_RESTORE',
            destructive: true
          }
        };
      }

      // Item 14: Trigger 2 — Confirm restore (only via ActionChip click)
      case 'confirm_restore': {
        return await this.handleConfirmAction(connection, args.confirmationToken);
      }

      // Item 14: Trigger 1 — Propose delete backup
      case 'propose_delete_backup': {
        const token = this.generateConfirmationToken();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

        const proposal = {
          token,
          action: 'delete_backup' as const,
          backupId: args.backupId,
          organizationId: args.organizationId ?? this.state.activeOrgId,
          expiresAt
        };

        this.setState({
          ...this.state,
          pendingProposals: [...this.state.pendingProposals, proposal]
        });

        return {
          tool: 'propose_delete_backup',
          confirmationCard: {
            token,
            label: `Confirm: Delete backup permanently`,
            description: `Backup ID: ${args.backupId} — this cannot be undone.`,
            expiresAt,
            chipType: 'CONFIRM_DELETE_BACKUP',
            destructive: true
          }
        };
      }

      // Item 14: Trigger 2 — Confirm delete backup
      case 'confirm_delete_backup': {
        return await this.handleConfirmAction(connection, args.confirmationToken);
      }

      default:
        return { tool: name, error: `Unknown tool: ${name}` };
    }
  }

  // ─── Item 14: Confirmation Token — Trigger 2 Handler ──────────────────────
  private async handleConfirmAction(connection: any, token: string): Promise<any> {
    const now = new Date();

    // Find proposal
    const proposal = this.state.pendingProposals.find(p => p.token === token);

    if (!proposal) {
      return { error: 'Confirmation token not found. Please request a new confirmation.' };
    }

    // Check expiry
    if (new Date(proposal.expiresAt) < now) {
      await this.clearExpiredProposal(token);
      return { error: 'Confirmation token has expired. Please re-initiate the action.' };
    }

    // Check already used
    if (proposal.usedAt) {
      return { error: 'Confirmation token has already been used.' };
    }

    // Mark token as used immediately (prevents double-execution)
    const updatedProposals = this.state.pendingProposals.map(p =>
      p.token === token ? { ...p, usedAt: new Date().toISOString() } : p
    );
    this.setState({ ...this.state, pendingProposals: updatedProposals });

    const supabase = createClient(this.env.SUPABASE_URL, this.env.SUPABASE_SERVICE_ROLE_KEY);

    // Execute the confirmed action
    if (proposal.action === 'restore') {
      const { data, error } = await supabase
        .from('restores')
        .insert({
          organization_id: proposal.organizationId,
          backup_id: proposal.backupId,
          destination_project_id: proposal.destinationProjectId,
          status: 'pending'
        })
        .select()
        .single();

      if (error) return { error: error.message };

      return {
        success: true,
        action: 'restore',
        restore: data,
        actionChip: { type: 'JOB_PROGRESS', jobId: data.id }
      };
    }

    if (proposal.action === 'delete_backup') {
      const { error } = await supabase
        .from('backups')
        .delete()
        .eq('id', proposal.backupId)
        .eq('organization_id', proposal.organizationId);

      if (error) return { error: error.message };
      return { success: true, action: 'delete_backup', backupId: proposal.backupId };
    }

    return { error: 'Unknown proposal action type.' };
  }

  private async clearExpiredProposal(token: string) {
    this.setState({
      ...this.state,
      pendingProposals: this.state.pendingProposals.filter(p => p.token !== token)
    });
  }

  // ─── Utilities ────────────────────────────────────────────────────────────
  private generateConfirmationToken(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private sendToConnection(connection: any, data: any) {
    try {
      connection.send(JSON.stringify(data));
    } catch (err) {
      console.error('[Agent] Failed to send to connection:', err);
    }
  }

  private generateSuggestions(query: string, plan: string, currentView?: string) {
    // Context-aware suggestion chips based on which page the user is currently on
    const byView: Record<string, any[]> = {
      backups: [
        { id: 's1', label: 'Restore This Backup', prompt: 'I want to restore my latest backup', icon: 'refresh' },
        { id: 's2', label: 'Download Snapshot', prompt: 'How do I download a SQL dump from R2?', icon: 'database' },
        { id: 's3', label: 'Check Integrity', prompt: 'How does backup verification work?', icon: 'shield' }
      ],
      restores: [
        { id: 's1', label: 'Start Restore', prompt: 'Restore my latest backup to my project', icon: 'refresh' },
        { id: 's2', label: 'Restore History', prompt: 'Show me my recent restore jobs', icon: 'clock' },
        { id: 's3', label: 'Zero-Downtime Guide', prompt: 'How does 1-click zero-downtime restore work?', icon: 'zap' }
      ],
      projects: [
        { id: 's1', label: 'Run Backup Now', prompt: 'Trigger a manual pg_dump backup right now', icon: 'zap' },
        { id: 's2', label: 'Check Status', prompt: 'What is the status of my last backup job?', icon: 'clock' },
        { id: 's3', label: 'Add Project', prompt: 'How do I connect another Supabase project?', icon: 'database' }
      ],
      billing: [
        { id: 's1', label: 'Compare Plans', prompt: 'What are the differences between Free, Pro, and Premium?', icon: 'database' },
        { id: 's2', label: 'Upgrade to Pro', prompt: 'I want to upgrade to the Pro plan', icon: 'zap' },
        { id: 's3', label: 'Premium Features', prompt: 'What does the Premium plan include?', icon: 'sparkles' }
      ],
      schedules: [
        { id: 's1', label: 'Schedule Backup', prompt: 'How do I set up an automated backup schedule?', icon: 'clock' },
        { id: 's2', label: 'Cron Docs', prompt: 'Explain how cron-based backup pipelines work', icon: 'database' },
        { id: 's3', label: 'Run Now', prompt: 'Trigger an immediate manual pg_dump snapshot', icon: 'zap' }
      ],
      logs: [
        { id: 's1', label: 'Latest Job', prompt: 'What is the status of my last running job?', icon: 'clock' },
        { id: 's2', label: 'Error Details', prompt: 'Explain the most recent backup error in my logs', icon: 'shield' },
        { id: 's3', label: 'Container Logs', prompt: 'How do I read Cloudflare Container execution logs?', icon: 'database' }
      ],
      landing: [
        { id: 's1', label: 'Get Started', prompt: 'How do I connect my first Supabase project?', icon: 'zap' },
        { id: 's2', label: 'View Pricing', prompt: 'Take me to the pricing section', icon: 'database' },
        { id: 's3', label: 'Security Info', prompt: 'How are my database credentials kept safe?', icon: 'shield' }
      ]
    };

    return byView[currentView ?? ''] ?? [
      { id: 's1', label: 'Run Snapshot', prompt: 'Run a manual pg_dump backup right now', icon: 'zap' },
      { id: 's2', label: 'Check Retention', prompt: 'What is the retention rule for my current plan?', icon: 'clock' },
      { id: 's3', label: 'View Billing', prompt: 'How do I upgrade my plan?', icon: 'database' }
    ];
  }
}

// ─── Item 11: Worker HTTP handler — WebSocket routing ─────────────────────────
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Feature flag — Item 24: safe rollout gate
    if (env.AGENT_FEATURE_FLAG !== 'true') {
      return new Response('Agent not enabled', { status: 503 });
    }

    // CORS preflight for WebSocket connections from superbaser.co
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': 'https://superbaser.co',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type'
        }
      });
    }

    // Health check endpoint
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', agent: 'superb-agent' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Route WebSocket agent requests via Agents SDK routing
    // URL pattern: /agents/superb-agent/{orgId}?token={jwt}
    const agentResponse = await routeAgentRequest(request, env);
    if (agentResponse) return agentResponse;

    return new Response('Not found', { status: 404 });
  }
};
