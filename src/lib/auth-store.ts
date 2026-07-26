import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

export interface Profile {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string;
  is_superadmin?: boolean;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  activeOrgId: string | null;
  organizations: any[];
  setSession: (session: Session | null) => void;
  setActiveOrgId: (orgId: string | null) => void;
  setOrganizations: (orgs: any[]) => void;
  fetchProfile: (userId: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  activeOrgId: null,
  organizations: [],
  setSession: (session) => {
    set({ session, user: session?.user ?? null });
    if (session?.user && !session.user.is_anonymous) {
      get().fetchProfile(session.user.id);
    } else {
      set({ profile: null });
    }
  },
  setActiveOrgId: (orgId) => set({ activeOrgId: orgId }),
  setOrganizations: (orgs) => set({ organizations: orgs }),
  fetchProfile: async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (!error && data) {
      set({ profile: data });
    }
  },
  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null, profile: null, activeOrgId: null, organizations: [] });
  },
}));

// Step 5: Global Session Expiry & Refresh Token Listener
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
    useAuthStore.getState().setSession(null);
  } else if (session) {
    useAuthStore.getState().setSession(session);
  }
});
