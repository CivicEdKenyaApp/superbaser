import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Mail, Lock, Loader2, User } from 'lucide-react';

interface AuthModalProps {
  initialEmail?: string;
  initialName?: string;
  initialOrgName?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AuthModal({ initialEmail = '', initialName = '', initialOrgName = '', onClose, onSuccess }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(false); // Default to sign up if coming from form
  const [email, setEmail] = useState(initialEmail);
  const [name, setName] = useState(initialName);
  const [orgName, setOrgName] = useState(initialOrgName);
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialEmail) setEmail(initialEmail);
    if (initialName) setName(initialName);
    if (initialOrgName) setOrgName(initialOrgName);
  }, [initialEmail, initialName, initialOrgName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentSession = sessionData?.session;

      // If user is currently anonymous, convert them to a permanent identity
      if (currentSession?.user?.is_anonymous && !isLogin) {
        const { error } = await supabase.auth.updateUser({
          email,
          password,
          data: {
            full_name: name,
            org_name: orgName,
          },
        });
        if (error) throw error;
      } else if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name,
              org_name: orgName,
            },
          },
        });
        if (error) throw error;

        // Auto-login fallback if signUp returns session: null (guarantees session state for instant redirect)
        if (!data.session) {
          try {
            await supabase.auth.signInWithPassword({ email, password });
          } catch (loginErr) {
            // Ignore if email confirmation is required by Supabase policy
          }
        }
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="relative w-full max-w-md bg-paper border-2 border-ink shadow-[12px_12px_0_#171714] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-line bg-panel">
          <h2 className="font-display font-bold text-xl tracking-tight uppercase">
            {isLogin ? 'Operations Login' : 'Create Account'}
          </h2>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-ink hover:text-paper transition-colors duration-200 border border-transparent hover:border-ink"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Content */}
        <div className="p-6">
          <p className="font-mono text-[0.7rem] uppercase tracking-widest text-muted mb-6">
            Authenticate to securely manage project backups and DR pipelines.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block font-mono text-[0.7rem] font-bold uppercase tracking-widest">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-9 pr-4 py-3 bg-white border border-ink font-mono text-sm focus:border-orange focus:ring-1 focus:ring-orange outline-none transition-all"
                      placeholder="Ada Lovelace"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block font-mono text-[0.7rem] font-bold uppercase tracking-widest">
                    Organization Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                    <input
                      type="text"
                      required
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      className="w-full pl-9 pr-4 py-3 bg-white border border-ink font-mono text-sm focus:border-orange focus:ring-1 focus:ring-orange outline-none transition-all"
                      placeholder="Acme Corp"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block font-mono text-[0.7rem] font-bold uppercase tracking-widest">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-4 py-3 bg-white border border-ink font-mono text-sm focus:border-orange focus:ring-1 focus:ring-orange outline-none transition-all"
                  placeholder="admin@company.com"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block font-mono text-[0.7rem] font-bold uppercase tracking-widest">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-4 py-3 bg-white border border-ink font-mono text-sm focus:border-orange focus:ring-1 focus:ring-orange outline-none transition-all"
                  placeholder="••••••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500 text-red-600 font-mono text-xs">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 button flex items-center justify-center min-h-[50px] border border-ink bg-ink text-white font-mono font-bold text-xs uppercase tracking-widest hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[5px_5px_0_#c6f806] transition-all duration-200 disabled:opacity-70 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-none"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (isLogin ? 'Sign In ↗' : 'Sign Up ↗')}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-line text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="font-mono text-xs text-ink hover:text-orange underline decoration-ink/30 underline-offset-4"
            >
              {isLogin ? "Need an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
