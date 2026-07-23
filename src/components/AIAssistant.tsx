import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X, Mic, Terminal, Code, Database, Zap } from 'lucide-react';
import Lottie from 'lottie-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import fireMicData from '../../context/Fire Mic Animation - LIstening_AI.json';
import aiChatData from '../../context/AI Chat.json';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

const SUGGESTIONS = [
  { id: '1', icon: Terminal, label: 'Write Postgres Function', prompt: 'Write a Postgres function to automatically calculate MRR.' },
  { id: '2', icon: Database, label: 'Optimize Queries', prompt: 'Help me optimize my slow Supabase queries.' },
  { id: '3', icon: Code, label: 'Generate RLS Policies', prompt: 'Generate secure RLS policies for a multi-tenant app.' },
  { id: '4', icon: Zap, label: 'Setup Webhooks', prompt: 'How do I trigger an edge function on database insert?' }
];

export default function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I am your SUPERB AI. How can I help you architect, secure, or optimize your database today?',
      timestamp: new Date()
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
  }, [messages, isTyping]);

  const handleSend = async (text: string) => {
    if (!text.trim()) return;

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
            { role: 'system', content: 'You are SUPERB AI, an expert Postgres and Supabase database architect. Provide concise, direct answers with code.' },
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
      const newAiMsg: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: data.choices[0].message.content,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, newAiMsg]);
    } catch (error: any) {
      console.error(error);
      const errorMsg: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `I encountered an error connecting to my inference engine. Details: ${error.message}. Also, did you restart the dev server after the .env changes?`,
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
            className="fixed bottom-6 right-6 z-50 w-16 h-16 bg-acid text-ink rounded-full shadow-[6px_6px_0_#171714] border-2 border-ink flex items-center justify-center cursor-pointer transition-colors hover:bg-orange p-1"
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
            className="fixed bottom-6 right-6 z-50 w-[420px] max-w-[calc(100vw-48px)] h-[600px] max-h-[calc(100vh-48px)] bg-paper/95 backdrop-blur-xl border-2 border-ink shadow-[12px_12px_0_#171714] flex flex-col rounded-xl overflow-hidden font-mono"
          >
            {/* Header */}
            <div className="bg-ink text-white p-4 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8">
                  <Lottie animationData={aiChatData} loop={true} />
                </div>
                <h3 className="font-display font-bold text-lg uppercase tracking-wider m-0">SUPERB AI</h3>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-white/60 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Liquid Island Suggestions */}
            <div className="bg-ink/5 border-b border-line p-2 overflow-x-auto whitespace-nowrap scrollbar-hide flex gap-2 shrink-0" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {SUGGESTIONS.map(s => (
                <button
                  key={s.id}
                  onClick={() => handleSend(s.prompt)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-line text-[0.7rem] uppercase tracking-wider font-bold text-ink hover:bg-acid hover:border-ink hover:shadow-[2px_2px_0_#171714] transition-all cursor-pointer"
                >
                  <s.icon className="w-3 h-3" />
                  {s.label}
                </button>
              ))}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`max-w-[85%] p-3 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-ink text-white rounded-2xl rounded-br-sm'
                        : 'bg-panel border border-line text-ink rounded-2xl rounded-bl-sm shadow-[2px_2px_0_#171714]'
                    }`}
                  >
                    {msg.role === 'assistant' ? (
                      <div className="prose prose-sm prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-black/50 prose-pre:border prose-pre:border-white/10 prose-pre:text-xs">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      msg.content
                    )}
                  </motion.div>
                </div>
              ))}
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

            {/* Input */}
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
                  className={`absolute left-2 w-10 h-10 flex items-center justify-center rounded-full transition-colors ${isListening ? 'text-orange' : 'text-muted hover:text-ink'}`}
                >
                  {isListening ? (
                    <Lottie animationData={fireMicData} loop={true} style={{ width: 40, height: 40 }} />
                  ) : (
                    <Mic className="w-5 h-5" />
                  )}
                </button>
                <input
                  type="text"
                  value={inputValue}
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
