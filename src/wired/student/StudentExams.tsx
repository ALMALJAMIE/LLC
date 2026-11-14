import { useState } from 'react';
import { Award, BookOpen, CalendarClock, Clock, Search, Timer } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { fmtDateTime, useData } from '../../lib/db';
import { DemoNotice, Page, Spinner, StatusPill } from '../../components/ui';
import { Illus } from '../../components/media';
import { useMyEnrollments } from './hooks';

type Exam = { id: number; title: string; kind: string; starts_at: string | null; duration_min: number; total_marks: number; status: string; batch_id: number | null; course_id: number | null; batch: { name: string } | null; course: { title: string } | null };
type Res = { exam_id: number; score: number | null; grade: string | null; status: string };

export default function StudentExams() {
  const user = useAuth((s) => s.user);
  const [q, setQ] = useState('');
  const [course, setCourse] = useState('all');
  const mine = useMyEnrollments();
  const exams = useData<Exam[]>(() => supabase.from('exams').select('*, batch:batches(name), course:courses(title)').neq('status', 'draft').order('starts_at', { ascending: true }));
  const res = useData<Res[]>(() => supabase.from('exam_results').select('exam_id,score,grade,status').eq('student_id', user!.id));
  const list = (exams.data ?? []).filter((x) => `${x.title} ${x.course?.title ?? ''} ${x.batch?.name ?? ''}`.toLowerCase().includes(q.toLowerCase())
    && (course === 'all' || String(x.course_id) === course || (mine.data ?? []).some((m) => String(m.course?.id) === course && m.batch_id === x.batch_id)));
  return (
    <Page>
      {user?.demo && <DemoNotice />}
      <div className="bg-white rounded-4xl border border-slate-100 shadow-sm p-6 sm:p-8 mb-8 flex flex-col-reverse lg:flex-row items-center justify-between relative overflow-hidden">
        <div className="z-10 w-full lg:w-1/2 mt-6 lg:mt-0">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3 border bg-orange-50 text-orange-600 border-orange-100">Student Portal</span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-2 tracking-tight">My Assessments</h1>
          <p className="text-slate-500 text-sm sm:text-base mb-6 leading-relaxed max-w-md">View upcoming exams, track your attendance eligibility, and review your graded performance.</p>
          <div className="flex flex-col sm:flex-row gap-3 max-w-lg">
            <div className="relative flex-1"><Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by exam or course..." className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-200" /></div>
            <div className="relative"><BookOpen size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <select value={course} onChange={(e) => setCourse(e.target.value)} className="pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none">
                <option value="all">All Registered Courses</option>{(mine.data ?? []).map((m) => m.course && <option key={m.id} value={m.course.id}>{m.course.title}</option>)}</select></div>
          </div>
        </div>
        <div className="w-full lg:w-1/2 flex justify-center lg:justify-end"><Illus name="exam" className="max-h-60 object-contain drop-shadow-xl" /></div>
      </div>
      {exams.loading ? <Spinner /> : list.length === 0 ? (
        <div className="bg-white rounded-4xl border border-slate-100 shadow-sm py-16 text-center"><Award size={36} className="mx-auto text-slate-300 mb-3" /><h3 className="font-bold text-slate-800">No assessments found</h3><p className="text-sm text-slate-400">Try adjusting your search term or course filter.</p></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {list.map((x) => {
            const r = res.data?.find((y) => y.exam_id === x.id);
            const upcoming = x.starts_at && new Date(x.starts_at) > new Date();
            return (
              <div key={x.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 flex flex-col">
                <div className="flex justify-between mb-3"><span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100">{x.kind}</span>
                  {r ? <StatusPill status={r.status} /> : <span className={`text-[10px] font-black uppercase ${upcoming ? 'text-orange-500' : 'text-slate-400'}`}>{upcoming ? 'Upcoming' : x.status}</span>}</div>
                <h3 className="text-lg font-extrabold text-slate-900">{x.title}</h3>
                <p className="text-xs text-slate-500">{x.course?.title ?? x.batch?.name}</p>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[11px]">
                  <div className="p-2 rounded-xl bg-slate-50"><CalendarClock size={14} className="mx-auto text-slate-400 mb-1" />{x.starts_at ? fmtDateTime(x.starts_at) : 'TBA'}</div>
                  <div className="p-2 rounded-xl bg-slate-50"><Timer size={14} className="mx-auto text-slate-400 mb-1" />{x.duration_min} min</div>
                  <div className="p-2 rounded-xl bg-slate-50"><Clock size={14} className="mx-auto text-slate-400 mb-1" />{x.total_marks} marks</div>
                </div>
                {r?.status === 'graded' && <div className="mt-4 p-3 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-bold text-center">Score: {r.score}/{x.total_marks}{r.grade && ` · ${r.grade}`}</div>}
              </div>
            );
          })}
        </div>
      )}
    </Page>
  );
}
