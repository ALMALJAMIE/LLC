import { useEffect } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth';

const KEY = 'llc-ref';
/** Remember an agent's referral code from the link the visitor arrived with (/r/CODE or ?ref=CODE). */
export function rememberReferral(code: string | null | undefined) {
  if (!code || !/^[A-Za-z0-9]{4,12}$/.test(code)) return;
  try { localStorage.setItem(KEY, JSON.stringify({ code: code.toUpperCase(), at: Date.now() })); } catch { /* private mode */ }
}
/** After a student signs in, link their new account to the agent once. */
export function useClaimReferral() {
  const user = useAuth((s) => s.user);
  useEffect(() => {
    if (!user || user.demo || user.role !== 'student') return;
    let saved: { code: string; at: number } | null = null;
    try { saved = JSON.parse(localStorage.getItem(KEY) ?? 'null'); } catch { /* ignore */ }
    if (!saved) return;
    if (Date.now() - saved.at > 30 * 86400000) { localStorage.removeItem(KEY); return; }
    supabase.rpc('claim_referral', { p_code: saved.code }).then(() => localStorage.removeItem(KEY));
  }, [user]);
}
