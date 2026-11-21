import PlacementRequired from '../../components/PlacementRequired';
import { usePlacementDone } from '../../lib/placement';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Calendar, CircleCheck, CirclePlay, Clock, Globe, MapPin, XCircle } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { useData } from '../../lib/db';
import { CoverImg } from '../../components/media';
import { DemoNotice, Empty, PageHero, SearchInput, Spinner, btnAccent } from '../../components/ui';
import type { Enrollment } from './types';

const BADGE: Record<string, { cls: string; label: string; icon: typeof BookOpen }> = {
  active: { cls: 'bg-emerald-100 text-emerald-700', label: 'Active', icon: BookOpen },
  pending: { cls: 'bg-amber-100 text-amber-700', label: 'Awaiting approval', icon: Clock },
  completed: { cls: 'bg-indigo-100 text-indigo-700', label: 'Completed', icon: CircleCheck },
  rejected: { cls: 'bg-red-100 text-red-700', label: 'Rejected', icon: XCircle },
  cancelled: { cls: 'bg-slate-100 text-slate-500', label: 'Cancelled', icon: XCircle },
};

export default function StudentMyLearning() {
  const placed = usePlacementDone();
  const user = useAuth((s) => s.user);
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const { data, loading } = useData<Enrollment[]>(() =>
    supabase.from('enrollments').select('*, course:courses(*), batch:batches(*)').eq('student_id', user!.id).order('created_at', { ascending: false }));
  const list = useMemo(() => (data ?? []).filter((e) => (e.course?.title ?? '').toLowerCase().includes(q.toLowerCase())), [data, q]);

  return (
    <div className="w-full bg-[#fafafa] text-[#1e293b] font-sans min-h-screen pb-20 overflow-x-hidden">
      <main className="max-w-7xl mx-auto px-6 py-8">
        {user?.demo && <DemoNotice />}
        <PageHero badge="Student Portal" badgeColor="indigo" title="My Learning" illus="courses" subtitle="Access your enrolled courses, check your schedules, and continue your progress.">
          <SearchInput value={q} onChange={setQ} placeholder="Search your courses..." />
        </PageHero>
        {placed === false && <div className="mb-6"><PlacementRequired /></div>}
        {loading ? <Spinner /> : list.length === 0 ? (
          <Empty icon={<BookOpen size={28} />} title="No courses yet" text="Browse the catalog and request your first course." action={<button onClick={() => nav('/student/courses')} className={btnAccent}>Browse Courses</button>} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {list.map((e) => {
              const b = BADGE[e.status] ?? BADGE.pending;
              const BI = b.icon;
              const mode = e.batch?.mode ?? e.course?.delivery ?? 'online';
              return (
                <div key={e.id} className="group bg-white rounded-4xl p-4 shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100 flex flex-col h-full">
                  <div className="relative h-44 rounded-3xl overflow-hidden mb-5 bg-slate-100">
                    <CoverImg className="w-full h-full" alt={e.course?.title} />
                    <div className="absolute top-3 left-3 flex gap-2">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm flex items-center gap-1.5 uppercase tracking-wide backdrop-blur-md ${b.cls}`}><BI size={12} /> {b.label}</span>
                    </div>
                  </div>
                  <div className="px-2 flex-1 flex flex-col">
                    <h3 className="text-xl font-extrabold text-slate-900 mb-2 line-clamp-2 leading-snug">{e.course?.title}</h3>
                    <div className="flex items-center gap-3 mb-4 text-xs font-medium text-slate-500 flex-wrap">
                      <div className="flex items-center gap-1 truncate border-r border-slate-200 pr-3"><Calendar size={14} className="text-slate-400 shrink-0" /><span className="truncate">{e.batch?.name ?? 'Batch to be assigned'}</span></div>
                      <div className="flex items-center gap-1 capitalize">
                        {mode === 'face_to_face' ? <MapPin size={14} className="text-orange-500" /> : <Globe size={14} className="text-sky-500" />}
                        <span className={`font-bold ${mode === 'face_to_face' ? 'text-orange-600' : 'text-sky-600'}`}>{mode.replace(/_/g, ' ')}</span>
                      </div>
                    </div>
                    <div className="mb-5">
                      <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1"><span>Progress</span><span>{e.progress}%</span></div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 rounded-full transition-all duration-1000" style={{ width: `${e.progress}%` }} /></div>
                    </div>
                    <div className="mt-auto">
                      <button disabled={e.status !== 'active'} onClick={() => nav(`/student/course/${e.course_id}`)}
                        className="w-full py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200 shadow-lg disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none disabled:cursor-not-allowed">
                        {e.status === 'active' ? <>Enter Classroom <CirclePlay size={16} /></> : e.status === 'pending' ? 'Awaiting approval' : b.label}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
