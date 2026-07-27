import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

let expiryToastCallback: ((message: string) => void) | null = null;

export function onSessionExpired(callback: (message: string) => void) {
  expiryToastCallback = callback;
}

supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT' && !session) {
    const lastEvent = localStorage.getItem('sb-last-auth-event');
    if (lastEvent && lastEvent !== 'SIGNED_OUT') {
      expiryToastCallback?.('Your session expired. Please log in again.');
    }
  }
  if (event === 'TOKEN_REFRESHED') localStorage.setItem('sb-last-auth-event', 'TOKEN_REFRESHED');
  if (event === 'SIGNED_IN') localStorage.setItem('sb-last-auth-event', 'SIGNED_IN');
  if (event === 'SIGNED_OUT') localStorage.setItem('sb-last-auth-event', 'SIGNED_OUT');
});

export async function isSessionValid(): Promise<boolean> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) return false;
  const expiresAt = data.session.expires_at;
  if (!expiresAt) return false;
  const now = Math.floor(Date.now() / 1000);
  return expiresAt > now;
}

export async function forceLogout(message: string = 'Your session has expired. Please log in again.') {
  await supabase.auth.signOut();
  expiryToastCallback?.(message);
}
