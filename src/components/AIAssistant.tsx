import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X, Mic, ShieldCheck, Copy, Check, Wifi, WifiOff, Lock, UserCheck, AlertTriangle } from 'lucide-react';
import Lottie from 'lottie-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import fireMicData from '../../context/Fire Mic Animation - LIstening_AI.json';
import aiChatData from '../../context/AI Chat.json';
import { useBandwidth, useOfflineManifest } from '../hooks/useNetworkStatus';
import { useAuthStore } from '../lib/auth-store';
import { SUPERBASER_KNOWLEDGE_BASE, getRandomAffirmation, sanitizeResponse } from '../lib/assistant-context';

// ─── Feature flags ────────────────────────────────────────────────────────────
const AGENT_ENABLED = import.meta.env.VITE_SB_AGENT_ENABLED === 'true';
const AGENT_WS_BASE = import.meta.env.VITE_SB_AGENT_WS_URL ?? 'wss://superbaser-agent.workers.dev';

// ─── Action-trigger keywords (client-side UX gate, non-authoritative) ─────────
const ACTION_TRIGGER_KEYWORDS = [
  'run', 'trigger', 'snapshot', 'pg_dump', 'backup', 'restore',
  'create org', 'enqueue', 'execute', 'delete', 'drop', 'remove'
];

// ─── Full PAGE_DICTIONARY: every navigable destination ───────────────────────
// Key = any natural-language phrase the user/LLM might say
// Value = navigation target (SPA view id for console tabs, or App view for landing/console)
const PAGE_DICTIONARY: Record<string, string> = {
  // Landing page anchors
  'home':         'landing',
  'home page':    'landing',
  'landing':      'landing',
  'pricing':      'landing#pricing',
  'plans':        'landing#pricing',
  'billing plans':'landing#pricing',
  'contact':      'landing#contact',
  'get in touch': 'landing#contact',
  'services':     'landing#services',
  'capabilities': 'landing#services',
  'process':      'landing#process',
  'pipeline':     'landing#process',
  'docs':         'landing#docs',
  'documentation':'landing#docs',

  // Console (dashboard) tabs — both the word and the hash-prefixed form
  'dashboard':    'console#dashboard',
  '#dashboard':   'console#dashboard',
  'console':      'console#dashboard',
  'projects':     'console#projects',
  '#projects':    'console#projects',
  'connected projects': 'console#projects',
  'backups':      'console#backups',
  '#backups':     'console#backups',
  'backup history':'console#backups',
  'restores':     'console#restores',
  '#restores':    'console#restores',
  'restore':      'console#restores',
  'point in time recovery': 'console#restores',
  'schedules':    'console#schedules',
  '#schedules':   'console#schedules',
  'cron':         'console#schedules',
  'automated backups': 'console#schedules',
  'verification': 'console#verification',
  '#verification':'console#verification',
  'integrity':    'console#verification',
  'storage':      'console#storage',
  '#storage':     'console#storage',
  'r2':           'console#storage',
  'cloudflare r2':'console#storage',
  'logs':         'console#logs',
  '#logs':        'console#logs',
  'telemetry':    'console#logs',
  'organizations':'console#organizations',
  '#organizations':'console#organizations',
  'organisation': 'console#organizations',
  'team':         'console#organizations',
  'billing':      'console#billing',
  '#billing':     'console#billing',
  'subscription': 'console#billing',
  'upgrade':      'console#billing',
  'settings':     'console#settings',
  '#settings':    'console#settings',
  'profile':      'console#settings',
  'support':      'console#support',
  '#support':     'console#support',
  'help':         'console#support',
};

// Build regex that matches ALL keys (both single-word and multi-word)
// Order by length descending so longer phrases match before their sub-words
const ALL_PAGE_KEYS = Object.keys(PAGE_DICTIONARY).sort((a, b) => b.length - a.length);
// Escape special chars (especially '#')
const escapedKeys = ALL_PAGE_KEYS.map(k => k.replace(/[.*+?^${}()|[\]\\#]/g, '\\$&'));
const fuzzyRegex = new RegExp(`(?<![\\w#])(${escapedKeys.join('|')})(?![\\w])`, 'gi');

// ─── Suggestion catalogue (used by the dynamic prioritiser) ─────────────────
// Each entry has: id, label, prompt, icon, contexts (which pages show it), authRequired, tier
interface SuggestionEntry {
  id: string;
  label: string;
  prompt: string;
  icon: string;
  contexts: Array<'landing' | 'console' | 'any'>;
  authRequired: boolean;
  tier?: 'free' | 'pro' | 'premium';
  priority: number; // higher = shown first
}

const SUGGESTION_CATALOGUE: SuggestionEntry[] = [
  // Auth gate suggestions (highest priority for anonymous users on landing)
  { id: 'claim',      label: 'Claim Free Account',      prompt: 'How do I sign up for SuperBaser for free?', icon: 'shield', contexts: ['landing','any'], authRequired: false, priority: 100 },
  { id: 'signin',     label: 'Sign In',                  prompt: 'I already have an account, how do I sign in?', icon: 'shield', contexts: ['landing'], authRequired: false, priority: 95 },

  // Landing-specific
  { id: 'pricing',    label: 'Compare Plans',            prompt: 'What are the differences between Free, Pro, and Premium tiers?', icon: 'database', contexts: ['landing'], authRequired: false, priority: 80 },
  { id: 'how_works',  label: 'How It Works',             prompt: 'How does SuperBaser back up and restore my Supabase database?', icon: 'zap', contexts: ['landing'], authRequired: false, priority: 75 },
  { id: 'security',   label: 'Security & Privacy',       prompt: 'How are my database passwords and connection keys secured?', icon: 'shield', contexts: ['landing','any'], authRequired: false, priority: 70 },
  { id: 'r2_storage', label: 'Cloudflare R2 Storage',   prompt: 'How are backups encrypted and stored on Cloudflare R2?', icon: 'sparkles', contexts: ['landing'], authRequired: false, priority: 65 },

  // Console — dashboard
  { id: 'run_backup', label: 'Run Instant Backup',       prompt: 'How do I trigger an immediate pg_dump snapshot right now?', icon: 'zap', contexts: ['console'], authRequired: true, tier: 'free', priority: 90 },
  { id: 'view_dash',  label: 'Dashboard Overview',       prompt: 'Show me the dashboard summary', icon: 'database', contexts: ['console'], authRequired: true, tier: 'free', priority: 85 },

  // Console — backups
  { id: 'dl_backup',  label: 'Download Backup',          prompt: 'How do I download one of my existing SQL backups?', icon: 'database', contexts: ['console'], authRequired: true, tier: 'free', priority: 80 },
  { id: 'retention',  label: 'Check Retention Policy',   prompt: 'What is the backup retention policy for my current plan?', icon: 'clock', contexts: ['console'], authRequired: true, tier: 'free', priority: 78 },

  // Console — restores
  { id: 'restore_1click', label: '1-Click Restore',      prompt: 'How does the 1-click zero-downtime restore work?', icon: 'refresh', contexts: ['console'], authRequired: true, tier: 'pro', priority: 85 },
  { id: 'pitr',       label: 'Point-in-Time Recovery',  prompt: 'How do I restore to a specific point in time?', icon: 'clock', contexts: ['console'], authRequired: true, tier: 'premium', priority: 80 },

  // Console — schedules
  { id: 'cron_setup', label: 'Setup Cron Schedule',      prompt: 'How do I configure automated backup schedules?', icon: 'clock', contexts: ['console'], authRequired: true, tier: 'free', priority: 75 },
  { id: 'cron_1hr',   label: '1-Hour Snapshots',         prompt: 'How do 1-hour automated snapshots work on the Pro tier?', icon: 'clock', contexts: ['console'], authRequired: true, tier: 'pro', priority: 72 },

  // Console — billing
  { id: 'upgrade_pro', label: 'Upgrade to Pro',          prompt: 'How do I upgrade to the Pro plan for $15/mo?', icon: 'zap', contexts: ['console'], authRequired: true, tier: 'free', priority: 88 },
  { id: 'upgrade_prem',label: 'Upgrade to Premium',      prompt: 'What do I get on the Premium plan at $49/mo?', icon: 'sparkles', contexts: ['console'], authRequired: true, tier: 'pro', priority: 82 },

  // Console — organizations
  { id: 'create_org', label: 'Create Organisation',      prompt: 'How do I create a new organisation in SuperBaser?', icon: 'database', contexts: ['console'], authRequired: true, tier: 'free', priority: 70 },
  { id: 'team_rbac',  label: 'Team Roles & Permissions', prompt: 'How does team RBAC work for organisations?', icon: 'shield', contexts: ['console'], authRequired: true, tier: 'premium', priority: 68 },

  // Console — support
  { id: 'support_dr', label: 'Emergency DR Runbook',     prompt: 'Show me the emergency disaster recovery runbook', icon: 'shield', contexts: ['console'], authRequired: true, tier: 'free', priority: 65 },
];

// ─── Dynamic suggestion prioritiser ─────────────────────────────────────────
// Ranks suggestions based on: current page context + auth state + conversation intent
function getDynamicSuggestions(
  currentView: 'landing' | 'console' | string,
  user: any,
  lastUserMessage: string = '',
  lastAssistantMessage: string = ''
): SuggestionEntry[] {
  const isAuthenticated = !!user && !user.is_anonymous;
  const view = currentView === 'console' ? 'console' : 'landing';

  // Detect intent from the last messages
  const combined = (lastUserMessage + ' ' + lastAssistantMessage).toLowerCase();
  const intentBoosts: Record<string, number> = {};

  if (combined.match(/backup|snapshot|pg_dump|dump/)) {
    intentBoosts['run_backup'] = 30;
    intentBoosts['dl_backup'] = 25;
    intentBoosts['retention'] = 20;
  }
  if (combined.match(/restore|recovery|pitr|point.in.time/)) {
    intentBoosts['restore_1click'] = 30;
    intentBoosts['pitr'] = 25;
  }
  if (combined.match(/price|plan|cost|billing|upgrade|pro|premium|free/)) {
    intentBoosts['pricing'] = 30;
    intentBoosts['upgrade_pro'] = 25;
    intentBoosts['upgrade_prem'] = 20;
  }
  if (combined.match(/schedul|cron|automat/)) {
    intentBoosts['cron_setup'] = 30;
    intentBoosts['cron_1hr'] = 25;
  }
  if (combined.match(/secur|encrypt|privacy|key|password/)) {
    intentBoosts['security'] = 30;
  }
  if (combined.match(/org|team|rbac|member/)) {
    intentBoosts['create_org'] = 25;
    intentBoosts['team_rbac'] = 20;
  }
  if (combined.match(/sign.?in|log.?in|account|register|sign.?up/)) {
    intentBoosts['claim'] = 40;
    intentBoosts['signin'] = 35;
  }

  const scored = SUGGESTION_CATALOGUE
    .filter(s => {
      // Filter by context
      if (!s.contexts.includes(view as any) && !s.contexts.includes('any')) return false;
      // Filter by auth: if auth required and user not authenticated, only show if it's a "claim" type
      if (s.authRequired && !isAuthenticated) return false;
      return true;
    })
    .map(s => ({
      ...s,
      score: s.priority + (intentBoosts[s.id] ?? 0)
    }))
    .sort((a, b) => b.score - a.score);

  // If unauthenticated, prepend auth chips regardless of context
  const anonChips = isAuthenticated ? [] : SUGGESTION_CATALOGUE
    .filter(s => ['claim', 'signin'].includes(s.id))
    .map(s => ({ ...s, score: 999 }));

  const combined2 = [...anonChips, ...scored.filter(s => !['claim','signin'].includes(s.id))];
  // Remove duplicates by id
  const seen = new Set<string>();
  return combined2.filter(s => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  }).slice(0, 8); // Cap at 8
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  suggestions?: { id: string; label: string; prompt: string; icon?: string }[];
  confirmationCard?: {
    token: string;
    label: string;
    description: string;
    expiresAt: string;
    chipType: 'CONFIRM_RESTORE' | 'CONFIRM_DELETE_BACKUP';
    destructive: boolean;
  };
}

type IslandMode = "IDLE" | "CHAT_ACTIVE" | "MAP_VIEW" | "OFFLINE_TICKET" | "LIVE_WAVEFORM";
interface IslandPayload { lat?: number; lng?: number; label?: string; items?: string[]; }
interface IslandState { mode: IslandMode; payload: IslandPayload | null; }

// ─── Navigation resolver ─────────────────────────────────────────────────────
// Returns { view: 'landing'|'console', tab?: string, anchor?: string }
function resolveNavTarget(target: string): { view: 'landing' | 'console'; tab?: string; anchor?: string } {
  if (!target) return { view: 'landing' };
  if (target === 'landing') return { view: 'landing' };
  if (target === 'console' || target === 'console#dashboard') return { view: 'console', tab: 'dashboard' };
  if (target.startsWith('console#')) {
    return { view: 'console', tab: target.replace('console#', '') };
  }
  if (target.startsWith('landing#')) {
    return { view: 'landing', anchor: target.replace('landing#', '') };
  }
  // Fallback: treat as anchor on landing
  return { view: 'landing', anchor: target };
}

// ─── Copyable token chip ─────────────────────────────────────────────────────
function CopyableToken({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={handleCopy}
      title={`Tap to copy: ${value}`}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-acid/20 border border-ink text-ink font-mono text-[11px] font-bold cursor-pointer hover:bg-acid active:scale-95 transition-all select-all mx-0.5"
    >
      <span>{label}</span>
      {copied ? <Check className="w-3 h-3 text-[#347000]" /> : <Copy className="w-3 h-3 text-muted" />}
    </button>
  );
}

// ─── In-message page link button ─────────────────────────────────────────────
function PageLink({ label, target, onNavigate }: { label: string; target: string; onNavigate: (target: string) => void }) {
  return (
    <button
      onClick={() => onNavigate(target)}
      className="underline decoration-dotted underline-offset-2 hover:opacity-80 font-bold text-neon transition-all cursor-pointer"
      title={`Navigate to ${label}`}
    >
      {label}
    </button>
  );
}

// ─── Parse message content: handles [text](url), #copy: tokens, page links, plain mentions ─
function parseMessageContent(
  content: string,
  user: any,
  onNavigate?: (target: string) => void,
  isUser?: boolean
) {
  // Replace template variables
  let replacedText = content;
  if (user && !user.is_anonymous) {
    replacedText = replacedText
      .replace(/\[USER_ID\]/g, user.id || '')
      .replace(/\[USER_UUID\]/g, user.id || '')
      .replace(/\[USER_NAME\]/g, user.user_metadata?.full_name || '')
      .replace(/\[USER_EMAIL\]/g, user.email || '')
      .replace(/\[USER_ROLE\]/g, user.role || '');
  } else {
    replacedText = replacedText
      .replace(/\[USER_ID\]/g, '')
      .replace(/\[USER_UUID\]/g, '')
      .replace(/\[USER_NAME\]/g, 'Guest')
      .replace(/\[USER_EMAIL\]/g, '')
      .replace(/\[USER_ROLE\]/g, '');
  }

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  // Match markdown links [text](url) or #copy: tokens
  const mdLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;

  while ((match = mdLinkRegex.exec(replacedText)) !== null) {
    const before = replacedText.substring(lastIndex, match.index);
    if (before) parts.push(...applyPageLinks(before, onNavigate, isUser, parts.length));

    const linkText = match[1];
    const linkUrl = match[2];
    const isCopyAction = linkUrl.startsWith('#copy:');
    const isInternal = !linkUrl.startsWith('http') && !linkUrl.startsWith('//') && !isCopyAction;

    if (isCopyAction) {
      const textToCopy = linkUrl.replace('#copy:', '');
      parts.push(<CopyableToken key={`copy-${match.index}`} value={textToCopy} label={linkText} />);
    } else if (isInternal) {
      if (onNavigate) {
        parts.push(
          <button
            key={`nav-${match.index}`}
            onClick={() => onNavigate(linkUrl)}
            className={`underline decoration-dotted underline-offset-2 hover:opacity-80 font-bold transition-all ${!isUser ? 'text-neon' : 'underline'}`}
          >
            {linkText}
          </button>
        );
      } else {
        parts.push(<span key={`nav-${match.index}`} className="font-bold">{linkText}</span>);
      }
    } else {
      parts.push(
        <a
          key={`ext-${match.index}`}
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`underline hover:opacity-80 font-bold transition-all ${!isUser ? 'text-neon' : ''}`}
        >
          {linkText}
        </a>
      );
    }
    lastIndex = mdLinkRegex.lastIndex;
  }

  const tail = replacedText.substring(lastIndex);
  if (tail) parts.push(...applyPageLinks(tail, onNavigate, isUser, parts.length));

  return parts.length > 0 ? parts : [replacedText];
}

// ─── Apply plain-text page name detection and convert to nav links ────────────
function applyPageLinks(
  text: string,
  onNavigate?: (target: string) => void,
  isUser?: boolean,
  baseKey: number = 0
): React.ReactNode[] {
  if (!onNavigate || isUser) return [text];

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  fuzzyRegex.lastIndex = 0;
  let m;
  let i = 0;

  while ((m = fuzzyRegex.exec(text)) !== null) {
    const before = text.substring(lastIndex, m.index);
    if (before) parts.push(<span key={`t-${baseKey}-${i++}`}>{before}</span>);
    const matched = m[0];
    const target = PAGE_DICTIONARY[matched.toLowerCase()];
    if (target) {
      parts.push(
        <PageLink
          key={`pl-${baseKey}-${i++}`}
          label={matched}
          target={target}
          onNavigate={onNavigate}
        />
      );
    } else {
      parts.push(<span key={`t-${baseKey}-${i++}`}>{matched}</span>);
    }
    lastIndex = fuzzyRegex.lastIndex;
  }

  const tail = text.substring(lastIndex);
  if (tail) parts.push(<span key={`t-${baseKey}-${i++}`}>{tail}</span>);
  return parts;
}

// ─── Code block component ────────────────────────────────────────────────────
function InlineCodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="my-2 rounded-none border-2 border-ink shadow-[3px_3px_0_#171714] overflow-hidden">
      <div className="flex items-center justify-between bg-ink px-3 py-1.5">
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-neon">{lang || 'code'}</span>
        <button
          onClick={handleCopy}
          className="text-[10px] font-mono text-white/60 hover:text-neon transition-colors flex items-center gap-1"
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="bg-ink p-3 overflow-x-auto"><code className="text-neon font-mono text-[0.7rem] leading-relaxed whitespace-pre-wrap break-words">{code}</code></pre>
    </div>
  );
}

// ─── Rich assistant content renderer ─────────────────────────────────────────
// Handles **bold**, ```code blocks```, [link](url), #copy: tokens, plain page mentions
function renderAssistantContent(
  content: string,
  user: any,
  onNavigate?: (target: string) => void
) {
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  const segments: Array<{ type: 'text' | 'code'; lang?: string; content: string }> = [];
  let lastIndex = 0;
  let m;

  while ((m = codeBlockRegex.exec(content)) !== null) {
    if (m.index > lastIndex) {
      segments.push({ type: 'text', content: content.substring(lastIndex, m.index) });
    }
    segments.push({ type: 'code', lang: m[1] || 'text', content: m[2].trim() });
    lastIndex = codeBlockRegex.lastIndex;
  }
  if (lastIndex < content.length) {
    segments.push({ type: 'text', content: content.substring(lastIndex) });
  }

  return segments.map((seg, segIdx) => {
    if (seg.type === 'code') {
      return <InlineCodeBlock key={segIdx} lang={seg.lang!} code={seg.content} />;
    }
    // Bold + inline parsing
    const boldParts = seg.content.split(/\*\*([^*]+)\*\*/g);
    const inlineParsed: React.ReactNode[] = [];
    boldParts.forEach((part, i) => {
      if (i % 2 === 1) {
        inlineParsed.push(<strong key={`b-${segIdx}-${i}`} className="font-bold text-ink">{part}</strong>);
      } else if (part) {
        const parsed = parseMessageContent(part, user, onNavigate, false);
        inlineParsed.push(
          ...(Array.isArray(parsed) ? parsed : [parsed]).map((node, ni) =>
            typeof node === 'string'
              ? <span key={`t-${segIdx}-${i}-${ni}`}>{node}</span>
              : React.cloneElement(node as any, { key: `t-${segIdx}-${i}-${ni}` })
          )
        );
      }
    });
    return <span key={segIdx}>{inlineParsed}</span>;
  });
}

// ─── SVG icon helper ─────────────────────────────────────────────────────────
function SvgIcon({ name, size = 11, className = '' }: { name?: string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {name === 'zap' && <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />}
      {name === 'clock' && <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>}
      {name === 'database' && <><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /></>}
      {name === 'shield' && <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />}
      {name === 'sparkles' && <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z" />}
      {name === 'refresh' && <><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" /></>}
      {(!name || !['zap','clock','database','shield','sparkles','refresh'].includes(name)) && <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />}
    </svg>
  );
}

// ─── Dynamic suggestion chips ────────────────────────────────────────────────
function DynamicSuggestions({ suggestions, onSelect }: { suggestions: any[], onSelect: (prompt: string) => void }) {
  const [currentIndex, setCurrentIndex] = useState(1);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    setCurrentIndex(1);
  }, [suggestions]);

  useEffect(() => {
    if (suggestions.length <= 3 || isHovered) return;
    const timer = setInterval(() => {
      setCurrentIndex(prev => {
        let next = prev + 1;
        if (next >= suggestions.length) next = 1;
        return next;
      });
    }, 8000);
    return () => clearInterval(timer);
  }, [suggestions.length, isHovered]);

  if (!suggestions || suggestions.length === 0) return null;

  const pinned = suggestions[0];
  let visibleRotation: any[] = [];
  if (suggestions.length <= 3) {
    visibleRotation = suggestions.slice(1);
  } else {
    visibleRotation = [
      suggestions[currentIndex],
      suggestions[currentIndex + 1 >= suggestions.length ? 1 : currentIndex + 1]
    ];
  }

  const renderButton = (item: any) => (
    <motion.button
      key={item.id}
      initial={{ opacity: 0, filter: 'blur(4px)' }}
      animate={{ opacity: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, filter: 'blur(4px)' }}
      transition={{ duration: 0.4, ease: 'easeInOut' }}
      onClick={() => onSelect(item.prompt)}
      className="bg-white hover:bg-acid active:scale-95 border-2 border-ink shadow-[2px_2px_0_#171714] px-2.5 py-1 text-[0.68rem] text-ink font-bold uppercase transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
    >
      <SvgIcon name={item.icon} size={11} className="text-ink flex-shrink-0" />
      <span>{item.label}</span>
    </motion.button>
  );

  return (
    <div
      className="flex flex-wrap gap-1.5 mt-1 px-1 justify-start"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {renderButton(pinned)}
      <AnimatePresence mode="popLayout">
        {visibleRotation.map(renderButton)}
      </AnimatePresence>
    </div>
  );
}

// ─── Liquid Glass Island ─────────────────────────────────────────────────────
function LiquidGlassIsland({
  island, onDismiss, isFullscreen, onToggleFullscreen
}: {
  island: IslandState;
  onDismiss: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  if (island.mode === 'IDLE' || island.mode === 'CHAT_ACTIVE') return null;
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={island.mode}
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 36 }}
        className="overflow-hidden flex-shrink-0 border-b-2 border-ink bg-panel"
      >
        <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink">
            {island.mode === 'MAP_VIEW' ? (island.payload?.label || 'Location') :
              island.mode === 'LIVE_WAVEFORM' ? 'Live Audio' : 'Saved Offline'}
          </p>
          <div className="flex items-center gap-1.5">
            <button onClick={onDismiss} className="text-ink/60 hover:text-ink transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        {island.mode === 'LIVE_WAVEFORM' && (
          <motion.div key="waveform-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }} className="px-4 pb-4">
            <div className="flex items-center gap-[3px] h-8">
              {Array.from({ length: 20 }).map((_, i) => (
                <motion.div key={i} className="flex-1 rounded-full bg-neon border border-ink" animate={{ scaleY: [0.2, 1, 0.3, 0.8, 0.2] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.06, ease: 'easeInOut' }} style={{ originY: 'center', height: '100%' }} />
              ))}
            </div>
          </motion.div>
        )}
        {island.mode === 'OFFLINE_TICKET' && island.payload?.items && (
          <motion.div key="ticket-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }} className="px-4 pb-4">
            <div className="space-y-1.5 border border-ink p-2 rounded bg-white">
              {island.payload.items.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2 text-ink">
                  <span className="w-1.5 h-1.5 rounded-full bg-neon mt-1.5 flex-shrink-0 border border-ink" />
                  <p className="text-[11px] font-mono font-bold leading-snug">{item}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Action chips (from agent tool results) ──────────────────────────────────
function ActionChips({
  actions, onAction
}: {
  actions: { label: string; icon: string; action: { type: string; target: string } }[];
  onAction: (action: { type: string; target: string }) => void;
}) {
  if (!actions || actions.length === 0) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.28 }}
      className="flex flex-wrap gap-1.5 px-1 mt-1"
    >
      {actions.map(item => (
        <button
          key={item.label}
          onClick={() => onAction(item.action)}
          className="flex items-center gap-1.5 bg-neon/10 hover:bg-neon/30 active:scale-95 border-2 border-ink rounded-full px-2.5 py-1 text-[11px] text-ink font-bold transition-all whitespace-nowrap shadow-[1px_1px_0_#171714]"
        >
          <SvgIcon name={item.icon} size={10} className="text-ink flex-shrink-0" />
          <span>{item.label}</span>
        </button>
      ))}
    </motion.div>
  );
}

// ─── AIAssistant component ────────────────────────────────────────────────────
export default function AIAssistant({
  onOpenAuthModal,
  currentView,
  onNavigate,
}: {
  onOpenAuthModal?: () => void;
  currentView?: string;
  onNavigate?: (view: 'landing' | 'console', tab?: string, anchor?: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { isLowBandwidth, isOnline } = useBandwidth();
  const { saveManifest } = useOfflineManifest();
  const { user } = useAuthStore();

  const [activeToast, setActiveToast] = useState<string | null>(null);
  const [islandState, setIslandState] = useState<IslandState>({ mode: 'IDLE', payload: null });
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [slashSearch, setSlashSearch] = useState<string | null>(null);
  const [slashIndex, setSlashIndex] = useState(0);
  const [suggestedActions, setSuggestedActions] = useState<{ label: string; icon: string; action: { type: string; target: string } }[]>([]);
  const [isMuted, setIsMuted] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isDegradedMode, setIsDegradedMode] = useState(false);
  const [agentConnected, setAgentConnected] = useState(false);
  const agentWsRef = useRef<WebSocket | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState('');

  // Compute initial suggestions based on current view + auth state
  const initialSuggestions = useMemo(
    () => getDynamicSuggestions(currentView ?? 'landing', user),
    [currentView, user?.id, user?.is_anonymous]
  );

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Habari! I am your SUPERB AI assistant. Ask me anything about database backups, R2 archival, or security pipelines!',
      timestamp: new Date(),
      suggestions: initialSuggestions,
    }
  ]);

  // Recompute greeting suggestions when view/auth changes
  useEffect(() => {
    setMessages(prev => {
      if (prev.length === 1 && prev[0].id === '1') {
        return [{ ...prev[0], suggestions: getDynamicSuggestions(currentView ?? 'landing', user) }];
      }
      return prev;
    });
  }, [currentView, user?.id, user?.is_anonymous]);

  const activeSlashSuggestions = useMemo(() => {
    const PAGE_SUGGESTIONS = Object.entries(PAGE_DICTIONARY).map(([name, path]) => ({ name, path }));
    return slashSearch !== null
      ? PAGE_SUGGESTIONS.filter(s => s.name.includes(slashSearch))
      : [];
  }, [slashSearch]);

  // ─── Navigation handler (dispatched from in-message links & slash commands) ──
  const handleNavigation = useCallback((target: string) => {
    const resolved = resolveNavTarget(target);
    if (onNavigate) {
      onNavigate(resolved.view, resolved.tab, resolved.anchor);
    } else {
      // Fallback: scroll to anchor if no callback provided
      if (resolved.anchor) {
        const el = document.getElementById(resolved.anchor);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        else window.location.hash = resolved.anchor;
      }
    }
    setIsOpen(false); // Close chat panel after navigation
  }, [onNavigate]);

  // ─── Execute action (from agent tool results or JSON blobs) ─────────────────
  const executeAction = useCallback((action: { type: string; target: string }) => {
    if (action.type === 'navigate_to') {
      handleNavigation(action.target);
    } else if (action.type === 'scroll_to') {
      const el = document.getElementById(action.target);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      else window.location.hash = action.target;
    }
  }, [handleNavigation]);

  useEffect(() => {
    if (typeof window !== 'undefined') synthRef.current = window.speechSynthesis || null;
  }, []);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => { scrollToBottom(); }, [messages, isTyping, activeToast, isListening]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
      const hasShown = sessionStorage.getItem('sb_ai_affirmation_shown');
      if (!hasShown) {
        sessionStorage.setItem('sb_ai_affirmation_shown', 'true');
        const t1 = setTimeout(() => {
          setActiveToast(getRandomAffirmation());
          const t2 = setTimeout(() => setActiveToast(null), 4500);
          return () => clearTimeout(t2);
        }, 1200);
        return () => clearTimeout(t1);
      }
    }
  }, [isOpen]);

  const speak = useCallback((text: string) => {
    if (isMuted || !synthRef.current) return;
    synthRef.current.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1;
    synthRef.current.speak(utterance);
  }, [isMuted]);

  // ─── Agent WebSocket ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!AGENT_ENABLED || !isOpen) return;
    const { activeOrgId, session } = useAuthStore.getState();
    const token = session?.access_token;
    if (!token || !activeOrgId) return;

    const wsUrl = `${AGENT_WS_BASE}/agents/superb-agent/${activeOrgId}?token=${token}&orgId=${activeOrgId}`;
    const ws = new WebSocket(wsUrl);
    agentWsRef.current = ws;
    ws.onopen = () => { setAgentConnected(true); setIsDegradedMode(false); };
    ws.onclose = () => { setAgentConnected(false); agentWsRef.current = null; };
    ws.onerror = () => { setAgentConnected(false); };
    ws.onmessage = event => {
      try { handleAgentMessage(JSON.parse(event.data)); } catch { }
    };
    return () => { ws.close(); agentWsRef.current = null; setAgentConnected(false); };
  }, [isOpen, AGENT_ENABLED]);

  // ─── Agent message handler ───────────────────────────────────────────────────
  const handleAgentMessage = useCallback((msg: any) => {
    const { type, payload } = msg;
    switch (type) {
      case 'TYPING_START': setIsTyping(true); break;
      case 'TYPING_END': setIsTyping(false); setIsListening(false); break;

      case 'ASSISTANT_MESSAGE': {
        const safeContent = sanitizeResponse(payload.content ?? '');
        saveManifest({ title: safeContent.substring(0, 30), items: [safeContent.substring(0, 100)], cachedAt: new Date().toISOString() });
        setIslandState({ mode: 'OFFLINE_TICKET', payload: { items: [safeContent.substring(0, 50) + '...'] } });

        // Use dynamic suggestions from payload, or generate contextual ones
        const lastUserMsg = '';
        const dynSuggestions = payload.suggestions?.length
          ? payload.suggestions
          : getDynamicSuggestions(currentView ?? 'landing', user, lastUserMsg, safeContent);

        const newAiMsg: Message = {
          id: Date.now().toString(),
          role: 'assistant',
          content: safeContent,
          timestamp: new Date(),
          suggestions: dynSuggestions,
        };
        setMessages(prev => [...prev, newAiMsg]);
        speak(safeContent);
        break;
      }

      case 'TOOL_RESULT': {
        if (payload.tool === 'navigate_to' && payload.target) {
          executeAction({ type: 'navigate_to', target: payload.target });
        }
        if (payload.actionChip) {
          setSuggestedActions([{ label: `Track Job ${payload.actionChip.jobId?.substring(0, 8)}`, icon: 'zap', action: { type: 'scroll_to', target: 'logs' } }]);
        }
        if (payload.confirmationCard) {
          const card = payload.confirmationCard;
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'assistant',
            content: `I have prepared a confirmation for you. **${card.label}**: ${card.description}\n\nThis action is ${card.destructive ? 'destructive and cannot be undone' : 'reversible'}. Please click the confirmation chip below to proceed. This token expires in 5 minutes.`,
            timestamp: new Date(),
            confirmationCard: card,
          }]);
        }
        if (payload.tool === 'list_backups' && Array.isArray(payload.data)) {
          const backupList = payload.data.length > 0
            ? payload.data.map((b: any) => `• ${b.id?.substring(0, 8)} — ${b.status} — ${new Date(b.created_at).toLocaleString()}`).join('\n')
            : 'No backups found for this organisation.';
          setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: `**Backup History:**\n${backupList}`, timestamp: new Date() }]);
        }
        if (payload.authRequired) {
          if (onOpenAuthModal) onOpenAuthModal();
          setMessages(prev => [...prev, {
            id: Date.now().toString(), role: 'assistant',
            content: 'You must sign in or create an account before triggering vital database actions. Please claim your free account to proceed.',
            timestamp: new Date(),
            suggestions: getDynamicSuggestions('landing', null),
          }]);
        }
        if (payload.planRequired) {
          setMessages(prev => [...prev, {
            id: Date.now().toString(), role: 'assistant',
            content: `This action requires the **${payload.planRequired.toUpperCase()} plan**. Upgrade your subscription to unlock it.`,
            timestamp: new Date(),
            suggestions: getDynamicSuggestions(currentView ?? 'console', user, '', 'upgrade plan billing'),
          }]);
        }
        break;
      }

      case 'AUTH_REQUIRED': {
        if (onOpenAuthModal) onOpenAuthModal();
        setMessages(prev => [...prev, {
          id: Date.now().toString(), role: 'assistant',
          content: payload.message ?? 'Account required to perform this action.',
          timestamp: new Date(),
          suggestions: getDynamicSuggestions('landing', null),
        }]);
        setIsTyping(false);
        break;
      }

      case 'DEGRADED_MODE': {
        setIsDegradedMode(true);
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: payload.message ?? "I'm having trouble connecting right now. Your message has been saved and I'll respond when connectivity is restored.", timestamp: new Date() }]);
        setIsTyping(false);
        break;
      }

      case 'ERROR': {
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: payload.message ?? 'A brief error occurred. Please try again.', timestamp: new Date() }]);
        setIsTyping(false);
        break;
      }
    }
  }, [speak, executeAction, onOpenAuthModal, saveManifest, currentView, user]);

  // ─── Two-trigger confirmation token send ─────────────────────────────────────
  const handleConfirmationChip = useCallback((token: string) => {
    if (!agentWsRef.current || agentWsRef.current.readyState !== WebSocket.OPEN) return;
    agentWsRef.current.send(JSON.stringify({ type: 'CONFIRM_ACTION', payload: { token } }));
    setIsTyping(true);
  }, []);

  // ─── Unified sendMessage ─────────────────────────────────────────────────────
  const sendMessage = async (text: string) => {
    if (!text.trim()) return;

    const lowerText = text.toLowerCase();
    const isActionQuery = ACTION_TRIGGER_KEYWORDS.some(kw => lowerText.includes(kw));

    // Handle slash commands that resolve to page navigation
    const slashNavMatch = text.match(/^\[([^\]]+)\]\(([^)]+)\)\s*$/);
    if (slashNavMatch) {
      const target = slashNavMatch[2];
      const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text, timestamp: new Date() };
      const navMsg: Message = {
        id: (Date.now() + 1).toString(), role: 'assistant',
        content: `Navigating to **${slashNavMatch[1]}**...`,
        timestamp: new Date(),
        suggestions: getDynamicSuggestions(currentView ?? 'landing', user),
      };
      setMessages(prev => [...prev, userMsg, navMsg]);
      setInputValue('');
      setTimeout(() => handleNavigation(target), 400);
      return;
    }

    // Client-layer auth gate for action keywords
    if (user?.is_anonymous && isActionQuery) {
      if (onOpenAuthModal) onOpenAuthModal();
      setMessages(prev => [...prev,
        { id: (Date.now() - 1).toString(), role: 'user', content: text, timestamp: new Date() },
        {
          id: Date.now().toString(), role: 'assistant',
          content: 'You must sign in or create an account before triggering vital database actions like running manual backups or restores. Please claim your free account to proceed.',
          timestamp: new Date(),
          suggestions: getDynamicSuggestions('landing', null),
        }
      ]);
      setInputValue('');
      return;
    }

    const newUserMsg: Message = { id: Date.now().toString(), role: 'user', content: text, timestamp: new Date() };
    setMessages(prev => [...prev, newUserMsg]);
    setInputValue('');
    setSlashSearch(null);
    setIsTyping(true);

    if (isListening) setIslandState({ mode: 'LIVE_WAVEFORM', payload: null });

    // Route to Agent WebSocket when enabled and connected
    if (AGENT_ENABLED && agentWsRef.current && agentWsRef.current.readyState === WebSocket.OPEN) {
      agentWsRef.current.send(JSON.stringify({ type: 'CHAT_MESSAGE', payload: { text, currentView } }));
      return;
    }

    // ─── Legacy Groq fallback ────────────────────────────────────────────────
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SB_GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            {
              role: 'system',
              content: `You are SUPERB AI, an expert Postgres, Supabase, and Cloudflare disaster recovery architect. Current page context: ${currentView ?? 'landing'}.

KNOWLEDGE BASE:
${SUPERBASER_KNOWLEDGE_BASE}

NAVIGATION DICTIONARY (when user asks to go somewhere, embed the link using markdown [label](target) syntax where target is one of the values below):
${Object.entries(PAGE_DICTIONARY).map(([k, v]) => `  "${k}" → ${v}`).join('\n')}

RULES:
1. Provide warm, concise, direct answers without emojis.
2. When mentioning any navigable page (dashboard, billing, backups, etc.), wrap it as a markdown link: [dashboard](console#dashboard), [billing](console#billing), etc.
3. If user asks to navigate somewhere, respond with the navigation markdown link prominently AND output a JSON block at the end: {"action": {"type": "navigate_to", "target": "console#dashboard"}, "suggestedActions": [...]}
4. Always output a "suggestions" JSON key with 3-5 contextually relevant follow-up prompt strings based on the conversation.
5. JSON block format at end of message (when needed): {"action": {...}, "suggestedActions": [...], "suggestions": [{"id":"s1","label":"Label","prompt":"Full prompt text","icon":"zap"}]}`
            },
            ...messages.filter(m => m.role !== 'system').map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: text }
          ]
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(`Groq API Error: ${response.status} - ${JSON.stringify(errData)}`);
      }

      const data = await response.json();
      let rawContent = data.choices[0].message.content;

      let parsedAction = null;
      let parsedSuggestedActions: any[] = [];
      let parsedIslandTrigger = null;
      let parsedSuggestions: any[] = [];

      try {
        const jsonMatch = rawContent.match(/\{[\s\S]*"(?:action|suggestions|suggestedActions)"[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.action) parsedAction = parsed.action;
          if (parsed.suggestedActions) parsedSuggestedActions = parsed.suggestedActions;
          if (parsed.islandTrigger) parsedIslandTrigger = parsed.islandTrigger;
          if (parsed.suggestions) parsedSuggestions = parsed.suggestions;
          rawContent = rawContent.replace(jsonMatch[0], '').trim();
        }
      } catch (e) {}

      const safeContent = sanitizeResponse(rawContent);

      saveManifest({ title: text.substring(0, 30), items: [safeContent.substring(0, 100)], cachedAt: new Date().toISOString() });

      if (parsedIslandTrigger) {
        setIslandState({ mode: parsedIslandTrigger.mode, payload: parsedIslandTrigger.payload });
      } else {
        setIslandState({ mode: 'OFFLINE_TICKET', payload: { items: [safeContent.substring(0, 50) + '...'] } });
      }

      if (parsedSuggestedActions.length > 0) {
        setSuggestedActions(parsedSuggestedActions);
      } else {
        setSuggestedActions([]);
      }

      // Use LLM-generated suggestions if present, otherwise compute dynamically
      const finalSuggestions = parsedSuggestions.length > 0
        ? parsedSuggestions
        : getDynamicSuggestions(currentView ?? 'landing', user, text, safeContent);

      const newAiMsg: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: safeContent,
        timestamp: new Date(),
        suggestions: finalSuggestions,
      };

      setMessages(prev => [...prev, newAiMsg]);
      speak(safeContent);

      if (parsedAction) {
        setTimeout(() => executeAction(parsedAction), 1500);
      }
    } catch (error: any) {
      console.error(error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(), role: 'assistant',
        content: `I encountered a brief issue connecting to my engine: ${error.message}. Please try asking again!`,
        timestamp: new Date(),
        suggestions: getDynamicSuggestions(currentView ?? 'landing', user),
      }]);
    } finally {
      setIsTyping(false);
      setIsListening(false);
    }
  };

  // ─── Keyboard handlers ───────────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (slashSearch !== null && activeSlashSuggestions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSlashIndex(prev => (prev + 1) % activeSlashSuggestions.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSlashIndex(prev => (prev - 1 + activeSlashSuggestions.length) % activeSlashSuggestions.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertSlashSuggestion(activeSlashSuggestions[slashIndex]); return; }
      if (e.key === 'Escape') { e.preventDefault(); setSlashSearch(null); return; }
    }
  };

  const insertSlashSuggestion = (suggestion: { name: string; path: string }) => {
    const match = inputValue.match(/(?:^|\s)\/([a-z0-9_-]*)$/i);
    if (match) {
      const before = inputValue.substring(0, match.index! + (inputValue[match.index!] === ' ' ? 1 : 0));
      setInputValue(before + `[${suggestion.name}](${suggestion.path}) `);
      setSlashSearch(null);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    const match = val.match(/(?:^|\s)\/([a-z0-9_-]*)$/i);
    if (match) { setSlashSearch(match[1].toLowerCase()); setSlashIndex(0); }
    else setSlashSearch(null);
  };

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 99999 }}
            className="w-16 h-16 bg-acid text-ink rounded-full shadow-[6px_6px_0_#171714] border-2 border-ink flex items-center justify-center cursor-pointer transition-colors hover:bg-orange p-1"
          >
            <Lottie animationData={aiChatData} loop={true} />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95, filter: 'blur(4px)' }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 99999 }}
            className="w-[420px] max-w-[calc(100vw-48px)] h-[600px] max-h-[calc(100vh-48px)] bg-paper/95 backdrop-blur-xl border-2 border-ink shadow-[12px_12px_0_#171714] flex flex-col rounded-xl overflow-hidden font-mono relative"
          >
            {/* Header */}
            <div className="bg-ink text-white p-4 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8"><Lottie animationData={aiChatData} loop={true} /></div>
                <div>
                  <h3 className="font-display font-bold text-lg uppercase tracking-wider m-0 leading-none">SUPERB AI</h3>
                  <p className="text-[0.62rem] text-[#aaa99f] uppercase tracking-widest mt-1">Disaster Recovery Assistant</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {isDegradedMode && (
                  <div className="flex items-center gap-1 text-[0.60rem] font-mono uppercase bg-orange/20 px-2 py-0.5 rounded-full border border-orange/40">
                    <AlertTriangle className="w-3 h-3 text-orange" />
                    <span className="text-orange">Degraded</span>
                  </div>
                )}
                {AGENT_ENABLED && (
                  <div className={`flex items-center gap-1 text-[0.60rem] font-mono uppercase px-2 py-0.5 rounded-full border ${agentConnected ? 'bg-neon/10 border-neon/40 text-neon' : 'bg-white/10 border-white/20 text-white/50'}`}>
                    <span>{agentConnected ? 'Agent' : 'Agent ↻'}</span>
                  </div>
                )}
                <div className="flex items-center gap-1 text-[0.65rem] font-mono uppercase bg-white/10 px-2 py-0.5 rounded-full border border-white/20">
                  {isOnline ? <Wifi className="w-3 h-3 text-[#d8ff37]" /> : <WifiOff className="w-3 h-3 text-orange" />}
                  <span>{isOnline ? (isLowBandwidth ? 'Low BW' : 'Online') : 'Offline'}</span>
                </div>
                <button onClick={() => setIsMuted(!isMuted)} className={`${!isMuted ? 'text-neon' : 'text-white/60'} hover:text-white transition-colors`} title={isMuted ? 'Unmute TTS' : 'Mute TTS'}>
                  <Mic className="w-4 h-4" />
                </button>
                <button onClick={() => setIsOpen(false)} className="text-white/60 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Security bar */}
            <div className="bg-panel border-b border-line px-3 py-2 flex items-center justify-between text-[0.68rem] font-mono text-muted shrink-0">
              <div className="flex items-center gap-1.5 text-ink font-bold">
                <Lock className="w-3.5 h-3.5 text-[#347000]" />
                <span>TLS 1.3 End-to-End Encrypted</span>
              </div>
              <div className="text-[0.65rem] uppercase font-bold text-neon bg-ink px-2 py-0.5">Local Session Only</div>
            </div>

            <LiquidGlassIsland
              island={islandState}
              onDismiss={() => setIslandState({ mode: 'IDLE', payload: null })}
              isFullscreen={isMapFullscreen}
              onToggleFullscreen={() => setIsMapFullscreen(!isMapFullscreen)}
            />

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 relative">
              {messages.map((msg, index) => (
                <div key={msg.id} className="space-y-2">
                  <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`max-w-[88%] p-3.5 text-xs font-mono leading-relaxed ${msg.role === 'user'
                        ? 'bg-ink text-white border border-ink shadow-[3px_3px_0_#d8ff37] rounded-br-sm'
                        : 'bg-paper border-2 border-ink text-ink shadow-[3px_3px_0_#171714] rounded-bl-sm'
                      }`}
                    >
                      {msg.role === 'assistant' ? (
                        <div className="prose-assistant text-xs font-mono leading-relaxed text-ink">
                          {renderAssistantContent(msg.content, user, handleNavigation)}
                        </div>
                      ) : (
                        <span className="text-xs font-mono leading-relaxed">
                          {parseMessageContent(msg.content, user, undefined, true)}
                        </span>
                      )}
                    </motion.div>
                  </div>

                  {msg.role === 'assistant' && msg.suggestions && index === messages.length - 1 && (
                    <DynamicSuggestions suggestions={msg.suggestions} onSelect={sendMessage} />
                  )}
                  {msg.role === 'assistant' && suggestedActions.length > 0 && index === messages.length - 1 && (
                    <ActionChips actions={suggestedActions} onAction={executeAction} />
                  )}
                  {msg.role === 'assistant' && msg.confirmationCard && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      className="flex flex-col gap-1.5 px-1 mt-1"
                    >
                      <div className="flex items-center gap-1.5 text-[10px] font-mono text-ink/60 uppercase tracking-widest">
                        <AlertTriangle className="w-3 h-3 text-orange" />
                        <span>Destructive action — click below to confirm</span>
                      </div>
                      <button
                        onClick={() => handleConfirmationChip(msg.confirmationCard!.token)}
                        className="flex items-center gap-1.5 bg-orange/10 hover:bg-orange/30 active:scale-95 border-2 border-orange rounded-full px-3 py-1.5 text-[11px] text-ink font-bold transition-all whitespace-nowrap shadow-[1px_1px_0_#171714] self-start"
                      >
                        <AlertTriangle className="w-3 h-3 text-orange flex-shrink-0" />
                        <span>{msg.confirmationCard.label}</span>
                      </button>
                      <p className="text-[10px] text-ink/50 font-mono px-1">{msg.confirmationCard.description}</p>
                    </motion.div>
                  )}
                </div>
              ))}

              {user?.is_anonymous && (
                <div className="flex justify-center pt-2">
                  <button
                    onClick={onOpenAuthModal}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-ink/10 border border-ink/20 text-ink text-[0.68rem] font-bold uppercase hover:bg-acid hover:border-ink transition-colors"
                  >
                    <UserCheck className="w-3 h-3 text-neon" />
                    Sign in to save your chat history
                  </button>
                </div>
              )}

              {isTyping && (
                <div className="flex justify-start">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-panel border border-line text-ink rounded-2xl rounded-bl-sm p-3 shadow-[2px_2px_0_#171714] flex gap-1 items-center"
                  >
                    <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} className="w-1.5 h-1.5 bg-ink rounded-full" />
                    <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} className="w-1.5 h-1.5 bg-ink rounded-full" />
                    <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} className="w-1.5 h-1.5 bg-ink rounded-full" />
                  </motion.div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Toast */}
            <AnimatePresence>
              {activeToast && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  className="mx-4 mb-2 bg-acid border-2 border-ink text-ink p-2.5 rounded-lg shadow-[4px_4px_0_#171714] font-mono text-[0.7rem] font-bold flex items-start gap-2 z-40 shrink-0"
                >
                  <ShieldCheck className="w-4 h-4 text-[#347000] shrink-0 mt-0.5" />
                  <div className="flex-1 leading-snug">{activeToast}</div>
                  <button onClick={() => setActiveToast(null)} className="text-ink/60 hover:text-ink"><X className="w-3.5 h-3.5" /></button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Slash command autocomplete */}
            {slashSearch !== null && activeSlashSuggestions.length > 0 && (
              <div className="absolute bottom-[72px] left-4 right-4 bg-paper border-2 border-ink shadow-[4px_4px_0_#171714] rounded-lg overflow-hidden z-50 font-mono text-sm">
                {activeSlashSuggestions.map((s, i) => (
                  <div
                    key={s.name}
                    onClick={() => insertSlashSuggestion(s)}
                    className={`px-3 py-2 cursor-pointer border-b border-line last:border-b-0 ${i === slashIndex ? 'bg-acid font-bold' : 'hover:bg-panel'}`}
                  >
                    /{s.name} <span className="text-muted text-xs opacity-60">→ {s.path}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="p-4 bg-paper border-t border-line shrink-0">
              <form
                onSubmit={e => { e.preventDefault(); sendMessage(inputValue); }}
                className="relative flex items-center"
              >
                <button
                  type="button"
                  onClick={() => setIsListening(!isListening)}
                  className={`absolute left-2 w-10 h-10 flex items-center justify-center rounded-full transition-colors ${isListening ? 'text-neon' : 'text-muted hover:text-ink'}`}
                >
                  {isListening ? (
                    <Lottie animationData={fireMicData} loop={true} style={{ width: 40, height: 40 }} />
                  ) : (
                    <Mic className="w-5 h-5" />
                  )}
                </button>
                <input
                  type="text"
                  ref={inputRef}
                  value={inputValue || ''}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask SUPERB AI... (type / to navigate)"
                  className="w-full h-12 pl-12 pr-12 bg-white border-2 border-ink rounded-full outline-none focus:shadow-[4px_4px_0_#171714] focus:-translate-y-0.5 transition-all font-mono text-sm"
                />
                <button
                  type="submit"
                  disabled={!inputValue.trim()}
                  className="absolute right-2 w-8 h-8 bg-ink text-white rounded-full flex items-center justify-center disabled:opacity-50 disabled:bg-muted hover:bg-orange transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
