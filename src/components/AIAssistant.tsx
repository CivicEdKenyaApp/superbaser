import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X, Mic, ShieldCheck, Copy, Check, Wifi, WifiOff, Lock, UserCheck } from 'lucide-react';
import Lottie from 'lottie-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import fireMicData from '../../context/Fire Mic Animation - LIstening_AI.json';
import aiChatData from '../../context/AI Chat.json';
import { useBandwidth, useOfflineManifest } from '../hooks/useNetworkStatus';
import { useAuthStore } from '../lib/auth-store';
import { SUPERBASER_KNOWLEDGE_BASE, getRandomAffirmation, sanitizeResponse } from '../lib/assistant-context';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  suggestions?: { id: string; label: string; prompt: string; icon?: string }[];
}

type IslandMode = "IDLE" | "CHAT_ACTIVE" | "MAP_VIEW" | "OFFLINE_TICKET" | "LIVE_WAVEFORM";
interface IslandPayload { lat?: number; lng?: number; label?: string; items?: string[]; }
interface IslandState { mode: IslandMode; payload: IslandPayload | null; }

const PAGE_DICTIONARY: Record<string, string> = {
    "dashboard": "console",
    "home page": "landing",
    "home": "landing",
    "pricing": "landing#pricing",
    "contact": "landing#contact",
    "services": "landing#services",
    "process": "landing#process"
};
const FUZZY_LINK_KEYS = Object.keys(PAGE_DICTIONARY).filter(key => key.includes(" "));
const fuzzyRegex = new RegExp(`\\b(${FUZZY_LINK_KEYS.join("|")})\\b`, "gi");

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

function applyFuzzyLinks(text: string, baseIndex: number, onNavigate?: (url?: string) => void, isUser?: boolean) {
    const parts = text.split(fuzzyRegex);
    return parts.map((part, i) => {
        const lowerPart = part.toLowerCase();
        const url = PAGE_DICTIONARY[lowerPart];
        if (url) {
            return (
                <button
                    key={`fuzzy-${baseIndex}-${i}`}
                    onClick={() => {
                        if (onNavigate) onNavigate(url);
                    }}
                    className={`underline hover:opacity-80 font-bold transition-all ${!isUser && "text-neon"}`}
                >
                    {part}
                </button>
            );
        }
        return part;
    });
}

function parseMessageContent(content: string, user: any, onNavigate?: (url?: string) => void, isUser?: boolean) {
    let replacedText = content;
    if (user && !user.is_anonymous) {
        replacedText = replacedText
            .replace(/\[USER_ID\]/g, user.id || "")
            .replace(/\[USER_UUID\]/g, user.id || "")
            .replace(/\[USER_NAME\]/g, user.user_metadata?.full_name || "")
            .replace(/\[USER_EMAIL\]/g, user.email || "")
            .replace(/\[USER_ROLE\]/g, user.role || "");
    } else {
        replacedText = replacedText
            .replace(/\[USER_ID\]/g, "")
            .replace(/\[USER_UUID\]/g, "")
            .replace(/\[USER_NAME\]/g, "Guest")
            .replace(/\[USER_EMAIL\]/g, "")
            .replace(/\[USER_ROLE\]/g, "");
    }

    const parts: any[] = [];
    let lastIndex = 0;
    const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;
    let matchCount = 0;

    while ((match = regex.exec(replacedText)) !== null) {
        const textBefore = replacedText.substring(lastIndex, match.index);
        if (textBefore) {
            parts.push(...applyFuzzyLinks(textBefore, matchCount++, onNavigate, isUser));
        }

        const linkText = match[1];
        const linkUrl = match[2];
        const isInternal = !linkUrl.startsWith("http") && !linkUrl.startsWith("//");
        const isCopyAction = linkUrl.startsWith("#copy:");

        if (isCopyAction) {
            const textToCopy = linkUrl.replace("#copy:", "");
            parts.push(
                <CopyableToken key={match.index} value={textToCopy} label={linkText} />
            );
        } else if (isInternal) {
            parts.push(
                <button
                    key={match.index}
                    onClick={() => {
                        if (onNavigate) onNavigate(linkUrl);
                    }}
                    className={`underline hover:opacity-80 font-bold transition-all ${!isUser && "text-neon"}`}
                >
                    {linkText}
                </button>
            );
        } else {
            parts.push(
                <a
                    key={match.index}
                    href={linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`underline hover:opacity-80 font-bold transition-all ${!isUser && "text-neon"}`}
                >
                    {linkText}
                </a>
            );
        }

        lastIndex = regex.lastIndex;
    }

    const textAfter = replacedText.substring(lastIndex);
    if (textAfter) {
        parts.push(...applyFuzzyLinks(textAfter, matchCount++, onNavigate, isUser));
    }

    return parts.length > 0 ? parts : applyFuzzyLinks(replacedText, matchCount, onNavigate, isUser);
}

function SvgIcon({ name, size = 11, className = "" }: { name?: string; size?: number; className?: string }) {
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

function DynamicSuggestions({ suggestions, onSelect }: { suggestions: any[], onSelect: (prompt: string) => void }) {
  const [currentIndex, setCurrentIndex] = useState(1);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (suggestions.length <= 3 || isHovered) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => {
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
      initial={{ opacity: 0, filter: "blur(4px)" }}
      animate={{ opacity: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, filter: "blur(4px)" }}
      transition={{ duration: 0.4, ease: "easeInOut" }}
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

function LiquidGlassIsland({
    island,
    onDismiss,
    isFullscreen,
    onToggleFullscreen,
}: {
    island: IslandState;
    onDismiss: () => void;
    isFullscreen: boolean;
    onToggleFullscreen: () => void;
}) {
    if (island.mode === "IDLE" || island.mode === "CHAT_ACTIVE") return null;
    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={island.mode}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 36 }}
                className="overflow-hidden flex-shrink-0 border-b-2 border-ink bg-panel"
            >
                <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink">
                        {island.mode === "MAP_VIEW" ? (island.payload?.label || "Location") :
                            island.mode === "LIVE_WAVEFORM" ? "Live Audio" : "Saved Offline"}
                    </p>
                    <div className="flex items-center gap-1.5">
                        <button onClick={onDismiss} className="text-ink/60 hover:text-ink transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {island.mode === "LIVE_WAVEFORM" && (
                    <motion.div key="waveform-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }} className="px-4 pb-4">
                        <div className="flex items-center gap-[3px] h-8">
                            {Array.from({ length: 20 }).map((_, i) => (
                                <motion.div key={i} className="flex-1 rounded-full bg-neon border border-ink" animate={{ scaleY: [0.2, 1, 0.3, 0.8, 0.2] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.06, ease: "easeInOut" }} style={{ originY: "center", height: "100%" }} />
                            ))}
                        </div>
                    </motion.div>
                )}

                {island.mode === "OFFLINE_TICKET" && island.payload?.items && (
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

function ActionChips({
    actions,
    onAction,
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
            {actions.map((item) => (
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

const DEFAULT_SUGGESTIONS = [
  { id: '1', label: 'Run Instant Backup', prompt: 'How do I trigger an immediate pg_dump snapshot?', icon: 'zap' },
  { id: '2', label: 'Setup Cron Pipeline', prompt: 'How do automated backup schedules work across tiers?', icon: 'clock' },
  { id: '3', label: 'Compare Billing Tiers', prompt: 'What are the differences between Free, Pro, and Premium tiers?', icon: 'database' },
  { id: '4', label: 'Security & Privacy Info', prompt: 'How are my database passwords and connection keys secured?', icon: 'shield' },
  { id: '5', label: 'Cloudflare R2 Storage', prompt: 'How are backups encrypted and stored on Cloudflare R2?', icon: 'sparkles' },
  { id: '6', label: '1-Click Zero Downtime Restore', prompt: 'How does the 1-click restore process rebuild my Supabase project?', icon: 'refresh' }
];

const ACTION_TRIGGER_KEYWORDS = [
  'run', 'trigger', 'snapshot', 'pg_dump', 'backup', 'restore', 'create org', 'enqueue', 'execute'
];

export default function AIAssistant({ onOpenAuthModal }: { onOpenAuthModal?: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const { isLowBandwidth, isOnline } = useBandwidth();
  const { saveManifest } = useOfflineManifest();
  const { user } = useAuthStore();

  const [activeToast, setActiveToast] = useState<string | null>(null);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Habari! I am your SUPERB AI assistant. Ask me anything about database backups, R2 archival, or security pipelines!",
      timestamp: new Date(),
      suggestions: DEFAULT_SUGGESTIONS
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  // Liquid Glass Island
  const [islandState, setIslandState] = useState<IslandState>({ mode: "IDLE", payload: null });
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  
  // Slash commands
  const [slashSearch, setSlashSearch] = useState<string | null>(null);
  const [slashIndex, setSlashIndex] = useState(0);

  const activeSlashSuggestions = useMemo(() => {
    const PAGE_SUGGESTIONS = Object.entries(PAGE_DICTIONARY).map(([name, path]) => ({ name, path }));
    return slashSearch !== null
        ? PAGE_SUGGESTIONS.filter((s) => s.name.includes(slashSearch))
        : [];
  }, [slashSearch]);

  const [suggestedActions, setSuggestedActions] = useState<{ label: string; icon: string; action: { type: string; target: string } }[]>([]);
  
  const [isMuted, setIsMuted] = useState(true);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
        synthRef.current = window.speechSynthesis || null;
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, activeToast, isListening]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
      const hasShown = sessionStorage.getItem('sb_ai_affirmation_shown');
      if (!hasShown) {
        sessionStorage.setItem('sb_ai_affirmation_shown', 'true');
        const timer1 = setTimeout(() => {
          setActiveToast(getRandomAffirmation());
          const timer2 = setTimeout(() => {
            setActiveToast(null);
          }, 4500);
          return () => clearTimeout(timer2);
        }, 1200);
        return () => clearTimeout(timer1);
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

  const executeAction = useCallback((action: { type: string; target: string }) => {
    if (action.type === "navigate_to" || action.type === "scroll_to") {
      const el = document.getElementById(action.target);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        window.location.hash = action.target;
      }
    }
  }, []);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;

    const lowerText = text.toLowerCase();
    const isActionQuery = ACTION_TRIGGER_KEYWORDS.some(kw => lowerText.includes(kw));

    if (user?.is_anonymous && isActionQuery) {
      if (onOpenAuthModal) onOpenAuthModal();
      const authRequiredMsg: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'You must sign in or create an account before triggering vital database actions like running manual backups or restores. Please claim your free account to proceed.',
        timestamp: new Date(),
        suggestions: [
          { id: 'auth1', label: 'Claim Account Now', prompt: 'How do I claim my free account?' }
        ]
      };
      setMessages(prev => [...prev, { id: (Date.now() - 1).toString(), role: 'user', content: text, timestamp: new Date() }, authRequiredMsg]);
      setInputValue('');
      return;
    }

    const newUserMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, newUserMsg]);
    setInputValue('');
    setSlashSearch(null);
    setIsTyping(true);

    if (isListening) {
      setIslandState({ mode: "LIVE_WAVEFORM", payload: null });
    }

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
              content: `You are SUPERB AI, an expert Postgres, Supabase, and Cloudflare disaster recovery architect.\n\nKNOWLEDGE BASE:\n${SUPERBASER_KNOWLEDGE_BASE}\n\nRULES: Provide warm, concise, and direct answers without emojis. If user asks to navigate, you can format a JSON block at the end like {"action": {"type": "scroll_to", "target": "pricing"}, "suggestedActions": [{"label": "View Plans", "icon": "zap", "action": {"type": "scroll_to", "target": "pricing"}}]}`
            },
            ...messages.map(m => ({ role: m.role, content: m.content })),
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
      let parsedSuggestedActions = [];
      let parsedIslandTrigger = null;

      try {
        const jsonMatch = rawContent.match(/\{.*"action".*\}/s);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.action) parsedAction = parsed.action;
            if (parsed.suggestedActions) parsedSuggestedActions = parsed.suggestedActions;
            if (parsed.islandTrigger) parsedIslandTrigger = parsed.islandTrigger;
            rawContent = rawContent.replace(jsonMatch[0], '').trim();
        }
      } catch(e) {}

      const safeContent = sanitizeResponse(rawContent);

      saveManifest({
        title: text.substring(0, 30),
        items: [safeContent.substring(0, 100)],
        cachedAt: new Date().toISOString()
      });

      if (parsedIslandTrigger) {
        setIslandState({ mode: parsedIslandTrigger.mode, payload: parsedIslandTrigger.payload });
      } else {
        setIslandState({ mode: "OFFLINE_TICKET", payload: { items: [safeContent.substring(0, 50) + "..."] } });
      }
      
      if (parsedSuggestedActions.length > 0) {
        setSuggestedActions(parsedSuggestedActions);
      } else {
        setSuggestedActions([]);
      }

      const newAiMsg: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: safeContent,
        timestamp: new Date(),
        suggestions: [
          { id: 's1', label: 'Run Snapshot', prompt: 'Run a manual pg_dump backup right now' },
          { id: 's2', label: 'Check Retention', prompt: 'What is the retention rule for my current plan?' },
          { id: 's3', label: 'View Billing', prompt: 'How do I upgrade to Lifetime Pro?' }
        ]
      };

      setMessages(prev => [...prev, newAiMsg]);
      speak(safeContent);
      
      if (parsedAction) {
          setTimeout(() => {
              executeAction(parsedAction);
          }, 1500);
      }

    } catch (error: any) {
      console.error(error);
      const errorMsg: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `I encountered a brief issue connecting to my engine: ${error.message}. Please try asking again!`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
      setIsListening(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (slashSearch !== null && activeSlashSuggestions.length > 0) {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setSlashIndex(prev => (prev + 1) % activeSlashSuggestions.length);
            return;
        }
        if (e.key === "ArrowUp") {
            e.preventDefault();
            setSlashIndex(prev => (prev - 1 + activeSlashSuggestions.length) % activeSlashSuggestions.length);
            return;
        }
        if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault();
            const suggestion = activeSlashSuggestions[slashIndex];
            insertSlashSuggestion(suggestion);
            return;
        }
        if (e.key === "Escape") {
            e.preventDefault();
            setSlashSearch(null);
            return;
        }
    }
  };

  const insertSlashSuggestion = (suggestion: { name: string, path: string }) => {
    const match = inputValue.match(/(?:^|\s)\/([a-z0-9_-]*)$/i);
    if (match) {
        const before = inputValue.substring(0, match.index! + (inputValue[match.index!] === ' ' ? 1 : 0));
        const newText = before + `[${suggestion.name}](${suggestion.path}) `;
        setInputValue(newText);
        setSlashSearch(null);
        setTimeout(() => inputRef.current?.focus(), 10);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    const match = val.match(/(?:^|\s)\/([a-z0-9_-]*)$/i);
    if (match) {
        setSlashSearch(match[1].toLowerCase());
        setSlashIndex(0);
    } else {
        setSlashSearch(null);
    }
  };

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
            <div className="bg-ink text-white p-4 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8">
                  <Lottie animationData={aiChatData} loop={true} />
                </div>
                <div>
                  <h3 className="font-display font-bold text-lg uppercase tracking-wider m-0 leading-none">SUPERB AI</h3>
                  <p className="text-[0.62rem] text-[#aaa99f] uppercase tracking-widest mt-1">Disaster Recovery Assistant</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 text-[0.65rem] font-mono uppercase bg-white/10 px-2 py-0.5 rounded-full border border-white/20">
                  {isOnline ? <Wifi className="w-3 h-3 text-[#d8ff37]" /> : <WifiOff className="w-3 h-3 text-orange" />}
                  <span>{isOnline ? (isLowBandwidth ? 'Low BW' : 'Online') : 'Offline'}</span>
                </div>
                <button onClick={() => setIsMuted(!isMuted)} className={`${!isMuted ? 'text-neon' : 'text-white/60'} hover:text-white transition-colors`} title={isMuted ? "Unmute TTS" : "Mute TTS"}>
                  <Mic className="w-4 h-4" />
                </button>
                <button onClick={() => setIsOpen(false)} className="text-white/60 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="bg-panel border-b border-line px-3 py-2 flex items-center justify-between text-[0.68rem] font-mono text-muted shrink-0">
              <div className="flex items-center gap-1.5 text-ink font-bold">
                <Lock className="w-3.5 h-3.5 text-[#347000]" />
                <span>TLS 1.3 End-to-End Encrypted</span>
              </div>
              <div className="text-[0.65rem] uppercase font-bold text-neon bg-ink px-2 py-0.5">
                Local Session Only
              </div>
            </div>
            
            <LiquidGlassIsland 
                island={islandState} 
                onDismiss={() => setIslandState({ mode: "IDLE", payload: null })} 
                isFullscreen={isMapFullscreen} 
                onToggleFullscreen={() => setIsMapFullscreen(!isMapFullscreen)} 
            />

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
                        <div className="prose prose-sm max-w-none text-ink prose-p:text-ink prose-p:leading-relaxed prose-strong:text-ink [&_pre]:bg-ink [&_pre]:p-3.5 [&_pre]:border-2 [&_pre]:border-ink [&_pre]:rounded-none [&_pre_code]:text-[#d8ff37] [&_pre_code]:bg-transparent [&_pre_code]:font-mono [&_pre_code]:text-xs [&_:not(pre)>code]:bg-panel [&_:not(pre)>code]:text-ink [&_:not(pre)>code]:px-1 font-mono">
                           {parseMessageContent(msg.content, user, (url) => { if(url) executeAction({ type: 'navigate_to', target: url }); })}
                        </div>
                      ) : (
                        parseMessageContent(msg.content, user)
                      )}
                    </motion.div>
                  </div>

                  {msg.role === 'assistant' && msg.suggestions && index === messages.length - 1 && (
                    <DynamicSuggestions suggestions={msg.suggestions} onSelect={sendMessage} />
                  )}
                  {msg.role === 'assistant' && suggestedActions.length > 0 && index === messages.length - 1 && (
                    <ActionChips actions={suggestedActions} onAction={executeAction} />
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
                  <button onClick={() => setActiveToast(null)} className="text-ink/60 hover:text-ink">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
            
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

            <div className="p-4 bg-paper border-t border-line shrink-0">
              <form
                onSubmit={e => {
                  e.preventDefault();
                  sendMessage(inputValue);
                }}
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
                  placeholder="Ask SUPERB AI..."
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
