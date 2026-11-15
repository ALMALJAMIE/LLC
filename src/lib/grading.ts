import { create } from 'zustand';
import { supabase } from './supabase';

export type Scale = { grade: string; min_pct: number; label: string | null; is_pass: boolean };
const FALLBACK: Scale[] = [
  { grade: 'A+', min_pct: 90, label: 'Outstanding', is_pass: true }, { grade: 'A', min_pct: 80, label: 'Excellent', is_pass: true },
  { grade: 'B', min_pct: 70, label: 'Very good', is_pass: true }, { grade: 'C', min_pct: 60, label: 'Good', is_pass: true },
  { grade: 'D', min_pct: 50, label: 'Pass', is_pass: true }, { grade: 'F', min_pct: 0, label: 'Fail', is_pass: false },
];

/** The admin-managed grading scale (Exam Grading Scales page), cached for the session. */
export const useScale = create<{ scale: Scale[]; load: () => Promise<void> }>((set) => ({
  scale: FALLBACK,
  load: async () => {
    const { data } = await supabase.from('grading_scales').select('grade,min_pct,label,is_pass').order('min_pct', { ascending: false });
    if (data?.length) set({ scale: data as Scale[] });
  },
}));

export function scaleOf(pct: number, scale: Scale[] = useScale.getState().scale): Scale {
  return [...scale].sort((a, b) => b.min_pct - a.min_pct).find((s) => pct >= s.min_pct) ?? scale[scale.length - 1] ?? FALLBACK[5];
}
export const gradeOf = (pct: number, scale?: Scale[]) => scaleOf(pct, scale).grade;
