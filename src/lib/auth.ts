import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from './supabase';
import type { Role } from './nav';

export type SessionUser = { id: string; name: string; email: string; role: Role; demo?: boolean };

export type Profile = {
  id: string; full_name: string; email: string; phone: string | null; country: string | null;
  date_of_birth: string | null; gender: string | null; address: string | null; bio: string | null;
  city: string | null; state: string | null; postcode: string | null; nationality: string | null;
  education_level: string | null; occupation: string | null; learning_goals: string | null;
  avatar_url: string | null; student_no: string | null; role: Role; is_active: boolean; created_at: string;
};

/** Demo accounts let anyone preview a portal's layout without signing in (no data access). */
export const DEMO_USERS: Record<Role, SessionUser> = {
  student: { id: 'demo-student', name: 'Demo Student', email: 'student@llc-demo.com', role: 'student', demo: true },
  instructor: { id: 'demo-instructor', name: 'Demo Instructor', email: 'instructor@llc-demo.com', role: 'instructor', demo: true },
  agent: { id: 'demo-agent', name: 'Demo Agent', email: 'agent@llc-demo.com', role: 'agent', demo: true },
  admin: { id: 'demo-admin', name: 'Demo Admin', email: 'admin@llc-demo.com', role: 'admin', demo: true },
  support: { id: 'demo-support', name: 'Demo Support', email: 'support@llc-demo.com', role: 'support', demo: true },
  finance: { id: 'demo-finance', name: 'Demo Finance', email: 'finance@llc-demo.com', role: 'finance', demo: true },
  academic: { id: 'demo-academic', name: 'Demo Supervisor', email: 'academic@llc-demo.com', role: 'academic', demo: true },
  institution: { id: 'demo-institution', name: 'Demo Institution', email: 'institution@llc-demo.com', role: 'institution', demo: true },
};

type AuthState = {
  user: SessionUser | null;
  profile: Profile | null;
  ready: boolean;
  signIn: (u: SessionUser) => void; // demo only
  signOut: () => Promise<void>;
  loadProfile: () => Promise<void>;
};

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      profile: null,
      ready: false,
      signIn: (user) => set({ user, profile: null }),
      signOut: async () => {
        if (!get().user?.demo) await supabase.auth.signOut();
        set({ user: null, profile: null });
      },
      loadProfile: async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          // keep a demo session if one is active; otherwise signed out
          set((s) => ({ user: s.user?.demo ? s.user : null, profile: null, ready: true }));
          return;
        }
        const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
        const p = data as Profile | null;
        set({
          profile: p,
          user: {
            id: session.user.id,
            email: session.user.email ?? '',
            name: p?.full_name || session.user.email?.split('@')[0] || 'User',
            role: (p?.role ?? 'student') as Role,
          },
          ready: true,
        });
      },
    }),
    { name: 'llc-auth', partialize: (s) => ({ user: s.user?.demo ? s.user : null }) },
  ),
);

supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED' || event === 'INITIAL_SESSION') {
    setTimeout(() => useAuth.getState().loadProfile(), 0);
  }
});
