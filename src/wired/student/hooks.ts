import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useData } from '../../lib/db';

export type MyBatch = {
  id: number; status: string; progress: number; batch_id: number | null;
  course: { id: number; title: string; code: string; delivery: string } | null;
  batch: { id: number; code: string; name: string; start_date: string | null; end_date: string | null; mode: string; instructor: { full_name: string } | null } | null;
};

/** The student's enrollments with course, batch and instructor. */
export function useMyEnrollments(onlyActive = true) {
  const user = useAuth((s) => s.user);
  return useData<MyBatch[]>(() => {
    let q = supabase.from('enrollments')
      .select('id,status,progress,batch_id, course:courses(id,title,code,delivery), batch:batches(id,code,name,start_date,end_date,mode, instructor:profiles(full_name))')
      .eq('student_id', user!.id).order('created_at', { ascending: false });
    if (onlyActive) q = q.eq('status', 'active');
    return q;
  });
}

export type ClassSession = { id: number; batch_id: number; title: string; starts_at: string; ends_at: string; mode: string; meeting_url: string | null; room: string | null };

export const hhmm = (s: string) => new Date(s).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
export const dayName = (s: string) => new Date(s).toLocaleDateString('en-GB', { weekday: 'long' });
