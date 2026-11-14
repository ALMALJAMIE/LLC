import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Role } from './nav';

export type SessionUser = { id: string; name: string; email: string; role: Role };

/** Demo accounts used until the Supabase project for LLC is connected. */
export const DEMO_USERS: Record<Role, SessionUser> = {
  student: { id: 'demo-student', name: 'Alex', email: 'student@llc-demo.com', role: 'student' },
  instructor: { id: 'demo-instructor', name: 'Emily Carter', email: 'instructor@llc-demo.com', role: 'instructor' },
  agent: { id: 'demo-agent', name: 'Alex', email: 'agent@llc-demo.com', role: 'agent' },
  admin: { id: 'demo-admin', name: 'Alex', email: 'admin@llc-demo.com', role: 'admin' },
};

type AuthState = {
  user: SessionUser | null;
  signIn: (u: SessionUser) => void;
  signOut: () => void;
};

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      signIn: (user) => set({ user }),
      signOut: () => set({ user: null }),
    }),
    { name: 'llc-auth' },
  ),
);
