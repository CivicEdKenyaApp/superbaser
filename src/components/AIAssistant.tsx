import React, { useState, useRef, useEffect } from 'react';
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
  suggestions?: { id: string; label: string; prompt: string }[];
}

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

const DEFAULT_SUGGESTIONS = [
  { id: '1', label: 'Run Instant Backup', prompt: 'How do I trigger an immediate pg_dump snapshot?' },
  { id: '2', label: 'Setup Cron Pipeline', prompt: 'How do automated hourly backup schedules work?' },
  { id: '3', label: 'Compare Billing Tiers', prompt: 'What are the differences between Pro and Enterprise tiers?' },
  { id: '4', label: 'Security & Privacy Info', prompt: 'How are my database passwords and connection keys secured?' }
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, activeToast]);

  // Once-per-session Security Affirmation Pop-up Toast
  useEffect(() => {
    if (isOpen) {
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

  const handleSend = async (text: string) => {
    if (!text.trim()) return;

    const lowerText = text.toLowerCase();
    const isActionQuery = ACTION_TRIGGER_KEYWORDS.some(kw => lowerText.includes(kw));

    // STRICT AUTH GATE FOR VITAL ACTIONS IN CHAT
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
    setIsTyping(true);

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
              content: `You are SUPERB AI, an expert Postgres, Supabase, and Cloudflare disaster recovery architect.\n\nKNOWLEDGE BASE:\n${SUPERBASER_KNOWLEDGE_BASE}\n\nRULES: Provide warm, concise, and direct answers without emojis.`
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
      const rawContent = data.choices[0].message.content;
      const safeContent = sanitizeResponse(rawContent);

      // Save logistical manifest offline if present
      saveManifest({
        title: text.substring(0, 30),
        items: [safeContent.substring(0, 100)],
        cachedAt: new Date().toISOString()
      });

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
            style={{
              position: 'fixed',
              bottom: '24px',
              right: '24px',
              zIndex: 99999
            }}
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
            style={{
              position: 'fixed',
              bottom: '24px',
              right: '24px',
              zIndex: 99999
            }}
            className="w-[420px] max-w-[calc(100vw-48px)] h-[600px] max-h-[calc(100vh-48px)] bg-paper/95 backdrop-blur-xl border-2 border-ink shadow-[12px_12px_0_#171714] flex flex-col rounded-xl overflow-hidden font-mono relative"
          >
            {/* Header */}
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
                <button onClick={() => setIsOpen(false)} className="text-white/60 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Sub-Header Bar */}
            <div className="bg-panel border-b border-line px-3 py-2 flex items-center justify-between text-[0.68rem] font-mono text-muted shrink-0">
              <div className="flex items-center gap-1.5 text-ink font-bold">
                <Lock className="w-3.5 h-3.5 text-[#347000]" />
                <span>TLS 1.3 End-to-End Encrypted</span>
              </div>
              <div className="text-[0.65rem] uppercase font-bold text-neon bg-ink px-2 py-0.5">
                Local Session Only
              </div>
            </div>

            {/* Messages Stream */}
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
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        msg.content
                      )}
                    </motion.div>
                  </div>

                  {/* FLUSH SUGGESTION CHIPS BELOW LATEST ASSISTANT MESSAGE */}
                  {msg.role === 'assistant' && msg.suggestions && index === messages.length - 1 && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 }}
                      className="flex flex-wrap gap-1.5 pt-1 pl-1"
                    >
                      {msg.suggestions.map((chip) => (
                        <button
                          key={chip.id}
                          onClick={() => handleSend(chip.prompt)}
                          className="bg-white hover:bg-acid active:scale-95 border-2 border-ink shadow-[2px_2px_0_#171714] px-2.5 py-1 text-[0.68rem] text-ink font-bold uppercase transition-all cursor-pointer whitespace-nowrap"
                        >
                          {chip.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </div>
              ))}

              {/* ANONYMOUS SIGN-IN HISTORY PILL */}
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

            {/* ONCE-PER-SESSION FRIENDLY SECURITY TOAST POPUP (NON-OVERLAPPING) */}
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

            {/* Input Form */}
            <div className="p-4 bg-paper border-t border-line shrink-0">
              <form
                onSubmit={e => {
                  e.preventDefault();
                  handleSend(inputValue);
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
                  value={inputValue || ''}
                  onChange={e => setInputValue(e.target.value)}
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
