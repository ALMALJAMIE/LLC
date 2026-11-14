import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useData } from '../../lib/db';

export type TBatch = { id: number; code: string; name: string; start_date: string | null; end_date: string | null; capacity: number; mode: string; status: string; course_id: number; course: { title: string; code: string } | null };
export type Roster = { id: number; status: string; progress: number; created_at: string; batch_id: number; student: { id: string; full_name: string; email: string; phone: string | null; student_no: string | null } | null };

/** Batches taught by the signed-in instructor (admins see all). */
export function useTeaching(statuses = ['upcoming', 'active']) {
  const user = useAuth((s) => s.user);
  return useData<TBatch[]>(() => {
    let q = supabase.from('batches').select('id,code,name,start_date,end_date,capacity,mode,status,course_id, course:courses(title,code)').in('status', statuses).order('start_date', { ascending: false });
    if (user?.role !== 'admin') q = q.eq('instructor_id', user!.id);
    return q;
  });
}

export function useRoster(batchIds: number[]) {
  return useData<Roster[]>(() => supabase.from('enrollments')
    .select('id,status,progress,created_at,batch_id, student:profiles!enrollments_student_id_fkey(id,full_name,email,phone,student_no)')
    .in('batch_id', batchIds.length ? batchIds : [0]).eq('status', 'active').order('created_at', { ascending: false }), [batchIds.join(',')]);
}
