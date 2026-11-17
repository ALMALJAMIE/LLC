import { create } from 'zustand';
import { supabase } from './supabase';

/** Default centre details; the admin can override them from CMS (site_settings table). */
const DEFAULTS = {
  name: 'Language Leap Center',
  short: 'LLC',
  tagline: 'Your leap to fluent English',
  phone: '+60 11-1167 8407',
  whatsapp: '601111678407',
  email: 'llcent.mgmt@gmail.com',
  instagram: 'https://instagram.com/languageleapcentre',
  snapchat: 'https://snapchat.com/add/llc_center',
  address: 'Kuala Lumpur, Malaysia',
  heroTitle: '',
  heroSubtitle: 'Structured courses from beginner to advanced, small classes with qualified teachers, and an online platform that keeps your lessons, timetable and progress in one place.',
  banner: '',
  bank: { bankName: 'To be announced', accountName: 'Language Leap Center', accountNo: '—', note: '', onlinePay: false },
};
export type Center = typeof DEFAULTS;

export const useSite = create<{ c: Center; loaded: boolean; load: () => Promise<void> }>((set) => ({
  c: DEFAULTS,
  loaded: false,
  load: async () => {
    const { data } = await supabase.from('site_settings').select('key,value');
    const o = Object.fromEntries((data ?? []).map((r: { key: string; value: unknown }) => [r.key, r.value]));
    set({ c: { ...DEFAULTS, ...(o.center as object ?? {}), bank: { ...DEFAULTS.bank, ...(o.bank as object ?? {}) } }, loaded: true });
  },
}));
useSite.getState().load();

/** Live centre details (re-renders when CMS settings load). */
export const useCenter = () => useSite((s) => s.c);

/** Static access for non-React code (e.g. printable invoices). */
export const CENTER = new Proxy({} as Center, { get: (_t, k: string) => (useSite.getState().c as Record<string, unknown>)[k] });
