import { useState, useEffect, ReactNode } from 'react';
import { supabase, isSessionValid, forceLogout, onSessionExpired } from '../lib/supabase';

interface SessionGuardProps {
  children: ReactNode;
  onSessionLost: () => void;
}

export function SessionGuard({ children, onSessionLost }: SessionGuardProps) {
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    let mounted = true;

    onSessionExpired((message) => {
      if (mounted) { setSessionExpired(true); onSessionLost(); }
    });

    const initSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (data.session) {
        const valid = await isSessionValid();
        if (!valid) { await forceLogout('Your session has expired. Please log in again.'); setSessionExpired(true); onSessionLost(); }
      }
      setLoading(false);
    };

    initSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      if (event === 'SIGNED_OUT' && !session) {
        const { data: currentSession } = await supabase.auth.getSession();
        if (!currentSession.session) { setSessionExpired(true); onSessionLost(); }
      }
      if (event === 'TOKEN_REFRESHED') setSessionExpired(false);
    });

    return () => { mounted = false; authListener.subscription.unsubscribe(); };
  }, [onSessionLost]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="flex flex-col items-center gap-3">
          <svg className="h-8 w-8 animate-spin text-blue-600" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading SuperBaser...</p>
        </div>
      </div>
    );
  }

  if (sessionExpired) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
            <svg className="h-6 w-6 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <h2 className="mb-2 text-xl font-bold text-gray-900 dark:text-white">Session Expired</h2>
          <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">Your session has expired. Please log in again to continue.</p>
          <button onClick={() => window.location.reload()} className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700">Log In</button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
