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

function EyeShowIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fillRule="evenodd" clipRule="evenodd" d="M12.0001 5.25C9.22586 5.25 6.79699 6.91121 5.12801 8.44832C4.28012 9.22922 3.59626 10.0078 3.12442 10.5906C2.88804 10.8825 2.70368 11.1268 2.57736 11.2997C2.51417 11.3862 2.46542 11.4549 2.43187 11.5029C2.41509 11.5269 2.4021 11.5457 2.393 11.559L2.38227 11.5747L2.37911 11.5794L2.10547 12.0132L2.37809 12.4191L2.37911 12.4206L2.38227 12.4253L2.393 12.441C2.4021 12.4543 2.41509 12.4731 2.43187 12.4971C2.46542 12.5451 2.51417 12.6138 2.57736 12.7003C2.70368 12.8732 2.88804 13.1175 3.12442 13.4094C3.59626 13.9922 4.28012 14.7708 5.12801 15.5517C6.79699 17.0888 9.22586 18.75 12.0001 18.75C14.7743 18.75 17.2031 17.0888 18.8721 15.5517C19.72 14.7708 20.4039 13.9922 20.8757 13.4094C21.1121 13.1175 21.2964 12.8732 21.4228 12.7003C21.4859 12.6138 21.5347 12.5451 21.5682 12.4971C21.585 12.4731 21.598 12.4543 21.6071 12.441L21.6178 12.4253L21.621 12.4206L21.6224 12.4186L21.9035 12L21.622 11.5809L21.621 11.5794L21.6178 11.5747L21.6071 11.559C21.598 11.5457 21.585 11.5269 21.5682 11.5029C21.5347 11.4549 21.4859 11.3862 21.4228 11.2997C21.2964 11.1268 21.1121 10.8825 20.8757 10.5906C20.4039 10.0078 19.72 9.22922 18.8721 8.44832C17.2031 6.91121 14.7743 5.25 12.0001 5.25ZM4.29022 12.4656C4.14684 12.2885 4.02478 12.1311 3.92575 12C4.02478 11.8689 4.14684 11.7115 4.29022 11.5344C4.72924 10.9922 5.36339 10.2708 6.14419 9.55168C7.73256 8.08879 9.80369 6.75 12.0001 6.75C14.1964 6.75 16.2676 8.08879 17.8559 9.55168C18.6367 10.2708 19.2709 10.9922 19.7099 11.5344C19.8533 11.7115 19.9753 11.8689 20.0744 12C19.9753 12.1311 19.8533 12.2885 19.7099 12.4656C19.2709 13.0078 18.6367 13.7292 17.8559 14.4483C16.2676 15.9112 14.1964 17.25 12.0001 17.25C9.80369 17.25 7.73256 15.9112 6.14419 14.4483C5.36339 13.7292 4.72924 13.0078 4.29022 12.4656ZM14.25 12C14.25 13.2426 13.2427 14.25 12 14.25C10.7574 14.25 9.75005 13.2426 9.75005 12C9.75005 10.7574 10.7574 9.75 12 9.75C13.2427 9.75 14.25 10.7574 14.25 12ZM15.75 12C15.75 14.0711 14.0711 15.75 12 15.75C9.92898 15.75 8.25005 14.0711 8.25005 12C8.25005 9.92893 9.92898 8.25 12 8.25C14.0711 8.25 15.75 9.92893 15.75 12Z" fill="currentColor"/>
    </svg>
  );
}

function EyeHideIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fillRule="evenodd" clipRule="evenodd" d="M15.5778 13.6334C16.2396 12.1831 15.9738 10.4133 14.7803 9.21976C13.5868 8.02628 11.817 7.76042 10.3667 8.4222L11.5537 9.60918C12.315 9.46778 13.1307 9.69153 13.7196 10.2804C14.3085 10.8693 14.5323 11.6851 14.3909 12.4464L15.5778 13.6334Z" fill="currentColor"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M5.86339 7.80781C5.60443 8.02054 5.35893 8.23562 5.12798 8.44832C4.28009 9.22922 3.59623 10.0078 3.1244 10.5906C2.88801 10.8825 2.70365 11.1268 2.57733 11.2997C2.51414 11.3862 2.46539 11.4549 2.43184 11.5029C2.41506 11.5269 2.40207 11.5457 2.39297 11.559L2.38224 11.5747L2.37908 11.5794L2.37806 11.5809L2.09656 12L2.37741 12.4181L2.37806 12.4191L2.37908 12.4206L2.38224 12.4253L2.39297 12.441C2.40207 12.4543 2.41506 12.4731 2.43184 12.4971C2.46539 12.5451 2.51414 12.6138 2.57733 12.7003C2.70365 12.8732 2.88801 13.1175 3.1244 13.4094C3.59623 13.9922 4.28009 14.7708 5.12798 15.5517C6.79696 17.0888 9.22583 18.75 12 18.75C13.3694 18.75 14.6547 18.3452 15.806 17.7504L14.6832 16.6277C13.8289 17.0123 12.9256 17.25 12 17.25C9.80366 17.25 7.73254 15.9112 6.14416 14.4483C5.36337 13.7292 4.72921 13.0078 4.29019 12.4656C4.14681 12.2885 4.02475 12.1311 3.92572 12C4.02475 11.8689 4.14681 11.7115 4.29019 11.5344C4.72921 10.9922 5.36337 10.2708 6.14416 9.55168C6.39447 9.32114 6.65677 9.09369 6.92965 8.87408L5.86339 7.80781ZM17.0705 15.1258C17.3434 14.9063 17.6056 14.6788 17.8559 14.4483C18.6367 13.7292 19.2708 13.0078 19.7099 12.4656C19.8532 12.2885 19.9753 12.1311 20.0743 12C19.9753 11.8689 19.8532 11.7115 19.7099 11.5344C19.2708 10.9922 18.6367 10.2708 17.8559 9.55168C16.2675 8.08879 14.1964 6.75 12 6.75C11.0745 6.75 10.1712 6.98772 9.31694 7.37228L8.1942 6.24954C9.34544 5.65475 10.6307 5.25 12 5.25C14.7742 5.25 17.2031 6.91121 18.8721 8.44832C19.72 9.22922 20.4038 10.0078 20.8757 10.5906C21.112 10.8825 21.2964 11.1268 21.4227 11.2997C21.4859 11.3862 21.5347 11.4549 21.5682 11.5029C21.585 11.5269 21.598 11.5457 21.6071 11.559L21.6178 11.5747L21.621 11.5794L21.622 11.5809L21.9035 12L21.6224 12.4186L21.621 12.4206L21.6178 12.4253L21.6071 12.441C21.598 12.4543 21.585 12.4731 21.5682 12.4971C21.5347 12.5451 21.4859 12.6138 21.4227 12.7003C21.2964 12.8732 21.112 13.1175 20.8757 13.4094C20.4038 13.9922 19.72 14.7708 18.8721 15.5517C18.6412 15.7644 18.3957 15.9794 18.1368 16.1921L17.0705 15.1258Z" fill="currentColor"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M18.75 19.8107L3.75 4.81066L4.81066 3.75L19.8107 18.75L18.75 19.8107Z" fill="currentColor"/>
    </svg>
  );
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
  const [otpToken, setOtpToken] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<HCaptcha>(null);

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpToken.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otpToken.trim(),
        type: 'signup',
      });
      if (error) {
        const { error: err2 } = await supabase.auth.verifyOtp({
          email,
          token: otpToken.trim(),
          type: 'email',
        });
        if (err2) throw error;
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Invalid or expired verification code.');
    } finally {
      setIsLoading(false);
    }
  };

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

    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
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
          {mode === 'check_email' ? (
            <div className="text-center space-y-4 py-2">
              <div className="w-14 h-14 bg-acid/20 border-2 border-acid text-ink rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7 text-neon" />
              </div>
              <h3 className="font-display font-bold text-base uppercase">Verification Email Sent</h3>
              <p className="font-mono text-xs leading-relaxed text-muted">
                We sent a verification link & code to <strong className="text-ink">{email}</strong>.
              </p>

              {/* OTP Form */}
              <form onSubmit={handleVerifyOtp} className="space-y-3 pt-2">
                <div className="space-y-1 text-left">
                  <label className="block font-mono text-[0.68rem] font-bold uppercase tracking-widest text-ink">
                    Enter Verification Code (OTP)
                  </label>
                  <input
                    type="text"
                    required
                    value={otpToken}
                    onChange={(e) => setOtpToken(e.target.value)}
                    placeholder="e.g. 67784134"
                    className="w-full px-4 py-2.5 bg-white border border-ink font-mono text-center text-base tracking-widest uppercase focus:border-orange focus:ring-1 focus:ring-orange outline-none"
                  />
                </div>
                {error && (
                  <div className="p-2 bg-red-500/10 border border-red-500 text-red-600 font-mono text-xs text-left">
                    {error}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={isLoading || !otpToken.trim()}
                  className="w-full py-2.5 border border-ink bg-ink text-white font-mono font-bold text-xs uppercase tracking-widest hover:bg-neon hover:text-ink transition-all shadow-[3px_3px_0_#c6f806] disabled:opacity-50"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Verify Code ↗'}
                </button>
              </form>

              <div className="relative my-4 text-center">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-line"></div></div>
                <span className="relative px-2 bg-paper font-mono text-[0.65rem] uppercase text-muted">OR CLICK EMAIL LINK</span>
              </div>

              <div className="p-3 bg-panel border border-ink text-left font-mono text-[0.72rem] space-y-1">
                <p className="font-bold text-ink uppercase">Alternative Method:</p>
                <p className="text-muted">Open your inbox and click the <strong>Confirm Account</strong> button inside the email.</p>
              </div>

              <button
                type="button"
                onClick={() => setMode('login')}
                className="w-full mt-2 py-2 border border-ink bg-paper text-ink font-mono font-bold text-xs uppercase tracking-wider hover:bg-panel transition-all"
              >
                Return to Sign In ↗
              </button>
            </div>
          ) : (
            <>
              <p className="font-mono text-[0.7rem] uppercase tracking-widest text-muted mb-6">
                Authenticate to securely manage project backups and DR pipelines.
              </p>

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
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoComplete={mode === 'login' ? "current-password" : "new-password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-9 pr-10 py-3 bg-white border border-ink font-mono text-sm focus:border-orange focus:ring-1 focus:ring-orange outline-none transition-all"
                        placeholder="••••••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition-colors p-1"
                        title={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeHideIcon className="w-5 h-5 text-ink" /> : <EyeShowIcon className="w-5 h-5 text-muted" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Confirm Password field for both Sign Up AND Reset Password modes */}
                {(mode === 'signup' || mode === 'reset_password') && (
                  <div className="space-y-1.5">
                    <label className="block font-mono text-[0.7rem] font-bold uppercase tracking-widest">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full pl-9 pr-10 py-3 bg-white border border-ink font-mono text-sm focus:border-orange focus:ring-1 focus:ring-orange outline-none transition-all"
                        placeholder="••••••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition-colors p-1"
                        title={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                      >
                        {showConfirmPassword ? <EyeHideIcon className="w-5 h-5 text-ink" /> : <EyeShowIcon className="w-5 h-5 text-muted" />}
                      </button>
                    </div>
                  </div>
                )}

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
