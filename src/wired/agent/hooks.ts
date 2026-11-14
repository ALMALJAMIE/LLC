import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useData } from '../../lib/db';

export type AgentProfile = {
  id: string; company: string | null; country: string | null; address: string | null; registration_no: string | null; status: string; review_note: string | null;
  contract_version: number | null; contract_signed_at: string | null; signature_name: string | null; payout_currency: string; paypal_email: string | null;
  bank_name: string | null; bank_account_name: string | null; bank_account_no: string | null; swift: string | null; iban: string | null; bank_address: string | null; created_at: string;
};
export type Earning = { id: number; amount: number; currency: string; status: string; created_at: string; payout_id: number | null; enrollment: { status: string; student: { full_name: string } | null; course: { title: string } | null } | null };
export type Referral = { id: number; student_name: string; student_email: string; student_phone: string | null; student_country: string | null; course_id: number; documents: Record<string, string>; status: string; review_note: string | null; created_at: string; enrollment_id: number | null; course: { title: string; price: number } | null; enrollment: { status: string } | null };

export function useAgentProfile() {
  const user = useAuth((s) => s.user);
  return useData<AgentProfile>(() => supabase.from('agent_profiles').select('*').eq('id', user!.id).maybeSingle());
}
export function useEarnings() {
  const user = useAuth((s) => s.user);
  return useData<Earning[]>(() => supabase.from('agent_earnings').select('id,amount,currency,status,created_at,payout_id, enrollment:enrollments(status, student:profiles!enrollments_student_id_fkey(full_name), course:courses(title))').eq('agent_id', user!.id).order('created_at', { ascending: false }));
}
export function useReferrals() {
  const user = useAuth((s) => s.user);
  return useData<Referral[]>(() => supabase.from('agent_referrals').select('*, course:courses(title,price), enrollment:enrollments(status)').eq('agent_id', user!.id).order('created_at', { ascending: false }));
}
export const sum = (xs: { amount: number }[]) => xs.reduce((a, x) => a + Number(x.amount), 0);
