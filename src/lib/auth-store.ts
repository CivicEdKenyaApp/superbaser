import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface AuthState {
  session: Session | null;
  user: User | null;
  activeOrgId: string | null;
  organizations: any[];
  setSession: (session: Session | null) => void;
  setActiveOrgId: (orgId: string | null) => void;
  setOrganizations: (orgs: any[]) => void;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  activeOrgId: null,
  organizations: [],
  setSession: (session) => set({ session, user: session?.user ?? null }),
  setActiveOrgId: (orgId) => set({ activeOrgId: orgId }),
  setOrganizations: (orgs) => set({ organizations: orgs }),
  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null, activeOrgId: null, organizations: [] });
  },
}));
