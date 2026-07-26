import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { X, Mail, Lock, Loader2, User, CheckCircle2, ArrowLeft } from 'lucide-react';
import HCaptcha from '@hcaptcha/react-hcaptcha';

export type AuthMode = 'login' | 'signup' | 'check_email' | 'forgot_password' | 'reset_password';

interface AuthModalProps {
  initialEmail?: string;
  initialName?: string;
  initialOrgName?: string;
  initialMode?: AuthMode;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AuthModal({
  initialEmail = '',
  initialName = '',
  initialOrgName = '',
  initialMode = 'signup',
  onClose,
  onSuccess
}: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState(initialEmail);
  const [name, setName] = useState(initialName);
  const [orgName, setOrgName] = useState(initialOrgName);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<HCaptcha>(null);

  useEffect(() => {
    if (initialEmail) setEmail(initialEmail);
    if (initialName) setName(initialName);
    if (initialOrgName) setOrgName(initialOrgName);

    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user;
      if (u) {
        const meta = u.user_metadata || {};
        if (!initialEmail && (u.email || meta.email)) setEmail(u.email || meta.email || '');
        if (!initialName && meta.full_name) setName(meta.full_name);
        if (!initialOrgName && meta.org_name) setOrgName(meta.org_name);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('reset_password');
      } else if (session?.user && !session.user.is_anonymous && mode !== 'reset_password') {
        onSuccess();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [initialEmail, initialName, initialOrgName, onSuccess, mode]);

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || 'Failed to initialize Google Sign In.');
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/#recovery`,
      });
      if (error) throw error;
      setSuccessMsg('Password reset instructions have been sent to your email.');
    } catch (err: any) {
      setError(err.message || 'Failed to send password reset email.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccessMsg('Password updated successfully! Redirecting...');
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to update password.');
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === 'forgot_password') {
      return handleForgotPassword(e);
    }

    if (mode === 'reset_password') {
      return handleResetPassword(e);
    }

    if (!captchaToken && mode !== 'check_email') {
      setError('Please complete the security verification.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentSession = sessionData?.session;

      if (currentSession?.user?.is_anonymous && mode === 'signup') {
        const { error } = await supabase.auth.updateUser({
          email,
          password,
          data: {
            full_name: name,
            org_name: orgName,
          },
        });
        if (error) throw error;
      } else if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
          options: {
            captchaToken: captchaToken || undefined,
          }
        });
        if (error) throw error;
        onSuccess();
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            captchaToken: captchaToken || undefined,
            data: {
              full_name: name,
              org_name: orgName,
            },
          },
        });
        if (error) throw error;

        // Step 1 FIX: If signUp requires email confirmation (no active session created), show Check Email state!
        if (!data.session) {
          setMode('check_email');
          setIsLoading(false);
          return;
        }
        onSuccess();
      }
    } catch (err: any) {
      if (captchaRef.current) {
        captchaRef.current.resetCaptcha();
      }
      setCaptchaToken(null);

      const msg = err.message || 'An error occurred during authentication.';
      if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('already exists') || msg.toLowerCase().includes('user_already_exists')) {
        setMode('login');
        setError('Account already registered! Switched to Sign In — enter password to continue.');
      } else {
        setError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm animate-in fade-in duration-300 overflow-y-auto py-8">
      <div className="relative w-full max-w-md bg-paper border-2 border-ink shadow-[12px_12px_0_#171714] max-h-[90vh] flex flex-col my-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-line bg-panel flex-shrink-0">
          <div className="flex items-center gap-2">
            {(mode === 'forgot_password' || mode === 'check_email') && (
              <button
                onClick={() => {
                  setMode('login');
                  setError(null);
                  setSuccessMsg(null);
                }}
                className="p-1 hover:bg-ink hover:text-paper transition-colors"
                title="Back to login"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h2 className="font-display font-bold text-xl tracking-tight uppercase">
              {mode === 'login' && 'Operations Login'}
              {mode === 'signup' && 'Create Account'}
              {mode === 'check_email' && 'Verify Your Email'}
              {mode === 'forgot_password' && 'Reset Password'}
              {mode === 'reset_password' && 'Set New Password'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-ink hover:text-paper transition-colors duration-200 border border-transparent hover:border-ink"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Content */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          {/* STEP 1: Check Email Success State */}
          {mode === 'check_email' ? (
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 bg-acid/20 border-2 border-acid text-ink rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-neon" />
              </div>
              <h3 className="font-display font-bold text-lg uppercase">Verification Email Sent</h3>
              <p className="font-mono text-xs leading-relaxed text-muted">
                We have sent a verification link to <strong className="text-ink">{email}</strong>.
              </p>
              <div className="p-3 bg-panel border border-ink text-left font-mono text-[0.75rem] space-y-1">
                <p className="font-bold text-ink uppercase">Action Required:</p>
                <p className="text-muted">1. Check your email inbox (and spam folder).</p>
                <p className="text-muted">2. Click the verification link inside.</p>
                <p className="text-muted">3. You will be logged in automatically.</p>
              </div>
              <button
                type="button"
                onClick={() => setMode('login')}
                className="w-full mt-4 py-3 border border-ink bg-ink text-white font-mono font-bold text-xs uppercase tracking-widest hover:bg-panel hover:text-ink transition-all"
              >
                Return to Sign In ↗
              </button>
            </div>
          ) : (
            <>
              <p className="font-mono text-[0.7rem] uppercase tracking-widest text-muted mb-6">
                Authenticate to securely manage project backups and DR pipelines.
              </p>

              {/* STEP 2: Google OAuth Button (available in login/signup) */}
              {(mode === 'login' || mode === 'signup') && (
                <>
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                    className="w-full mb-4 flex items-center justify-center gap-3 py-3 px-4 bg-white border border-ink font-mono text-xs font-bold uppercase tracking-wider hover:bg-panel hover:-translate-y-0.5 shadow-[3px_3px_0_#171714] transition-all disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                    </svg>
                    Continue with Google
                  </button>

                  <div className="relative my-4 text-center">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-line"></div></div>
                    <span className="relative px-2 bg-paper font-mono text-[0.65rem] uppercase text-muted">OR WITH EMAIL</span>
                  </div>
                </>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'signup' && (
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
                          placeholder="Your Name"
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
                          placeholder="Your Organization"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {mode !== 'reset_password' && (
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
                        placeholder="Your Email"
                      />
                    </div>
                  </div>
                )}

                {mode !== 'forgot_password' && (
                  <div className="space-y-1.5">
                    <label className="block font-mono text-[0.7rem] font-bold uppercase tracking-widest">
                      {mode === 'reset_password' ? 'New Password' : 'Password'}
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                      <input
                        type="password"
                        required
                        autoComplete={mode === 'login' ? "current-password" : "new-password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-9 pr-4 py-3 bg-white border border-ink font-mono text-sm focus:border-orange focus:ring-1 focus:ring-orange outline-none transition-all"
                        placeholder="••••••••••••"
                      />
                    </div>
                  </div>
                )}

                {mode === 'reset_password' && (
                  <div className="space-y-1.5">
                    <label className="block font-mono text-[0.7rem] font-bold uppercase tracking-widest">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                      <input
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full pl-9 pr-4 py-3 bg-white border border-ink font-mono text-sm focus:border-orange focus:ring-1 focus:ring-orange outline-none transition-all"
                        placeholder="••••••••••••"
                      />
                    </div>
                  </div>
                )}

                {/* STEP 3: Forgot Password Link in Login Mode */}
                {mode === 'login' && (
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot_password');
                        setError(null);
                        setSuccessMsg(null);
                      }}
                      className="font-mono text-[0.7rem] text-muted hover:text-ink underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500 text-red-600 font-mono text-xs">
                    {error}
                  </div>
                )}

                {successMsg && (
                  <div className="p-3 bg-green-500/10 border border-green-500 text-green-600 font-mono text-xs">
                    {successMsg}
                  </div>
                )}

                {(mode === 'login' || mode === 'signup') && (
                  <div className="flex justify-center pt-2 pb-2">
                    <HCaptcha
                      ref={captchaRef}
                      sitekey="4e508f3c-bc1a-47b8-ad16-c47643189a8a"
                      onVerify={(token) => {
                        setCaptchaToken(token);
                        setError(null);
                      }}
                      onExpire={() => setCaptchaToken(null)}
                      theme="light"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading || ((mode === 'login' || mode === 'signup') && !captchaToken)}
                  className="w-full mt-2 button flex items-center justify-center min-h-[50px] border border-ink bg-ink text-white font-mono font-bold text-xs uppercase tracking-widest hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[5px_5px_0_#c6f806] transition-all duration-200 disabled:opacity-70 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-none"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : mode === 'login' ? (
                    'Sign In ↗'
                  ) : mode === 'signup' ? (
                    'Sign Up ↗'
                  ) : mode === 'forgot_password' ? (
                    'Send Reset Link ↗'
                  ) : (
                    'Update Password ↗'
                  )}
                </button>
              </form>

              <div className="mt-6 pt-4 border-t border-line text-center">
                <button
                  type="button"
                  onClick={() => {
                    setMode(mode === 'login' ? 'signup' : 'login');
                    if (captchaRef.current) captchaRef.current.resetCaptcha();
                    setCaptchaToken(null);
                    setError(null);
                    setSuccessMsg(null);
                  }}
                  className="font-mono text-xs text-ink hover:text-neon underline decoration-ink/30 underline-offset-4"
                >
                  {mode === 'login' ? "Need an account? Sign up" : "Already have an account? Sign in"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
