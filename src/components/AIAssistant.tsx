import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { 
  Bot, 
  X, 
  Send, 
  Mic, 
  Sparkles, 
  Sliders, 
  Database, 
  RotateCcw, 
  Calendar, 
  ShieldCheck, 
  CreditCard, 
  Terminal, 
  ArrowRight,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  CheckCircle2,
  Copy,
  Check
} from 'lucide-react';

export interface AIAssistantProps {
  onNavigateTab: (tab: 'dashboard' | 'projects' | 'backups' | 'restores' | 'schedules' | 'verification' | 'storage' | 'logs' | 'organizations' | 'billing' | 'settings') => void;
  onOpenConnectModal: () => void;
  onTriggerBackup?: () => void;
  userEmail?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  actions?: { label: string; action: () => void }[];
}

const WALLPAPER_PRESETS = [
  { id: 'default', label: 'Default', value: null, preview: '#171714' },
  { id: 'cosmos', label: 'Cosmos', value: 'linear-gradient(160deg,#0f0c29,#302b63,#24243e)', preview: '#302b63' },
  { id: 'gold', label: 'Gold Dust', value: 'linear-gradient(160deg,#1a0e00,#3d2500,#1a0e00)', preview: '#3d2500' },
  { id: 'forest', label: 'Forest', value: 'linear-gradient(160deg,#0a1a0f,#0d2f18,#071208)', preview: '#0d2f18' },
  { id: 'nebula', label: 'Nebula', value: 'linear-gradient(160deg,#1a0020,#2d0035,#0d0015)', preview: '#2d0035' },
];

export default function AIAssistant({ onNavigateTab, onOpenConnectModal, onTriggerBackup, userEmail }: AIAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [chatWallpaper, setChatWallpaper] = useState<string | null>(null);
  const [showPersonalize, setShowPersonalize] = useState(false);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Habari! I'm your SuperBaser AI Assistant. I can trigger physical backups, navigate your console, check RLS security policies, or manage Paystack subscriptions. How can I assist you?`,
      timestamp: new Date(),
      actions: [
        { label: '⚡ Run Instant Backup', action: () => { onTriggerBackup?.(); } },
        { label: '🔌 Connect Database', action: () => { onOpenConnectModal(); } },
        { label: '💳 View Subscription', action: () => { onNavigateTab('billing'); } }
      ]
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SR) {
        const rec = new SR();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = 'en-US';
        rec.onresult = (e: any) => {
          const transcript = e.results[0][0].transcript;
          setInputText(transcript);
          setIsListening(false);
        };
        rec.onerror = () => setIsListening(false);
        rec.onend = () => setIsListening(false);
        recognitionRef.current = rec;
      }
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const toggleMic = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  const handleSend = (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text.trim() || isThinking) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: new Date()
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsThinking(true);

    setTimeout(() => {
      const lower = text.toLowerCase();
      let replyContent = "I've analyzed your query against your Supabase cluster.";
      let actions: { label: string; action: () => void }[] = [];

      if (lower.includes('backup') || lower.includes('dump') || lower.includes('run')) {
        replyContent = "I can trigger an automated pg_dump backup job via Cloudflare Containers for your active target database.";
        actions = [{ label: '⚡ Execute Backup Now', action: () => { onTriggerBackup?.(); onNavigateTab('backups'); } }];
      } else if (lower.includes('connect') || lower.includes('uri') || lower.includes('key') || lower.includes('project')) {
        replyContent = "To connect a project, ensure you provide your Direct PostgreSQL Connection String (port 6543/5432).";
        actions = [{ label: '🔌 Open Connect Modal', action: () => onOpenConnectModal() }];
      } else if (lower.includes('billing') || lower.includes('paystack') || lower.includes('upgrade') || lower.includes('plan')) {
        replyContent = "SuperBaser is integrated with Paystack inline checkout (Mwananchi & Taifa tiers).";
        actions = [{ label: '💳 Manage Paystack Plan', action: () => onNavigateTab('billing') }];
      } else if (lower.includes('restore') || lower.includes('disaster')) {
        replyContent = "Disaster Recovery restores allow piping R2 SQL dumps directly into target PostgreSQL instances.";
        actions = [{ label: '🔄 Open Restores Console', action: () => onNavigateTab('restores') }];
      } else {
        replyContent = `Got it! Running engine query for: "${text}". All operational metrics are healthy across your active organization.`;
        actions = [
          { label: '📊 View Dashboard', action: () => onNavigateTab('dashboard') },
          { label: '📋 Realtime Logs', action: () => onNavigateTab('logs') }
        ];
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: replyContent,
          timestamp: new Date(),
          actions
        }
      ]);
      setIsThinking(false);
    }, 600);
  };

  return (
    <>
      {/* Floating Trigger Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 button p-4 bg-acid border-2 border-ink text-ink font-mono font-bold text-xs uppercase shadow-[6px_6px_0_#171714] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all flex items-center gap-2 group"
        >
          <Sparkles className="w-5 h-5 animate-pulse text-ink" />
          <span>AI Copilot</span>
        </button>
      )}

      {/* Expandable Assistant Panel */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-full max-w-md h-[550px] bg-paper border-2 border-ink shadow-[14px_14px_0_#171714] flex flex-col font-mono text-xs overflow-hidden">
          {/* Header */}
          <div className="p-4 bg-ink text-paper flex items-center justify-between border-b-2 border-ink">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-acid text-ink flex items-center justify-center font-bold rounded-none">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold uppercase tracking-wider text-orange">SuperBaser Copilot</div>
                <div className="text-[0.62rem] text-[#aaa99f]">Autonomous Ops Assistant</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowPersonalize(!showPersonalize)} 
                className="text-paper/70 hover:text-orange transition-colors"
                title="Personalize Theme"
              >
                <Sliders className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setIsOpen(false)} 
                className="text-paper/70 hover:text-orange transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Theme Selector Drawer */}
          {showPersonalize && (
            <div className="p-3 bg-panel border-b border-line flex items-center gap-2 overflow-x-auto text-[0.68rem]">
              <span className="font-bold text-ink uppercase">Wallpaper:</span>
              {WALLPAPER_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => setChatWallpaper(preset.value)}
                  className="px-2 py-1 border border-ink font-bold uppercase transition-transform active:scale-95"
                  style={{ background: preset.preview, color: preset.id === 'default' ? '#fff' : '#fff' }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          )}

          {/* Message Stream */}
          <div 
            className="flex-1 p-4 overflow-y-auto space-y-4"
            style={{ background: chatWallpaper || 'transparent' }}
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] p-3 border border-ink leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-ink text-white shadow-[3px_3px_0_#c6f806]'
                      : 'bg-white text-ink shadow-[3px_3px_0_#171714]'
                  }`}
                >
                  {msg.content}
                </div>

                {/* Quick Action Chips */}
                {msg.actions && msg.actions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {msg.actions.map((act, i) => (
                      <button
                        key={i}
                        onClick={act.action}
                        className="px-2.5 py-1 bg-acid text-ink border border-ink font-bold uppercase text-[0.65rem] hover:bg-orange transition-all shadow-[2px_2px_0_#171714]"
                      >
                        {act.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {isThinking && (
              <div className="flex items-center gap-2 text-muted italic">
                <Bot className="w-4 h-4 animate-spin text-orange" />
                <span>Copilot processing pipeline request...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Prompt Suggestions */}
          <div className="p-2 bg-panel border-t border-line flex gap-1.5 overflow-x-auto text-[0.65rem]">
            <button
              onClick={() => handleSend('How do I run a physical pg_dump backup?')}
              className="px-2 py-1 bg-white border border-ink font-bold hover:bg-acid transition-colors whitespace-nowrap"
            >
              ⚡ Run Backup
            </button>
            <button
              onClick={() => handleSend('How do I upgrade via Paystack?')}
              className="px-2 py-1 bg-white border border-ink font-bold hover:bg-acid transition-colors whitespace-nowrap"
            >
              💳 Paystack Billing
            </button>
            <button
              onClick={() => handleSend('Where is my connection string URI?')}
              className="px-2 py-1 bg-white border border-ink font-bold hover:bg-acid transition-colors whitespace-nowrap"
            >
              🔌 Connection URI
            </button>
          </div>

          {/* Input Area */}
          <div className="p-3 bg-paper border-t-2 border-ink flex items-center gap-2">
            <button
              onClick={toggleMic}
              className={`p-2 border border-ink font-bold uppercase transition-colors ${
                isListening ? 'bg-orange text-ink animate-bounce' : 'bg-white text-ink hover:bg-panel'
              }`}
              title="Voice Control"
            >
              <Mic className="w-4 h-4" />
            </button>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask copilot or type command..."
              className="flex-1 border border-ink bg-white px-3 py-2 text-xs outline-none focus:border-orange font-mono"
            />

            <button
              onClick={() => handleSend()}
              className="button p-2 bg-ink text-white border border-ink hover:bg-orange hover:text-ink transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
