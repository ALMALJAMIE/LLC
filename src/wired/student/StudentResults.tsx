import { useState } from 'react';
import { Inbox, MessageSquareText } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { fmtDate, useData } from '../../lib/db';
import { DemoNotice, Modal, Page, PageHero, Spinner } from '../../components/ui';

type R = { id: number; score: number | null; grade: string | null; feedback: string | null; graded_at: string | null; exam: { title: string; kind: string; total_marks: number; course: { title: string } | null } | null };

export default function StudentResults() {
  const user = useAuth((s) => s.user);
  const [open, setOpen] = useState<R | null>(null);
  const { data, loading } = useData<R[]>(() => supabase.from('exam_results').select('id,score,grade,feedback,graded_at, exam:exams(title,kind,total_marks, course:courses(title))').eq('student_id', user!.id).eq('status', 'graded').order('graded_at', { ascending: false }));
  return (
    <Page>
      {user?.demo && <DemoNotice />}
      <PageHero badge="Evaluations" badgeColor="indigo" title="My Exam Results" illus="results" subtitle="Review your checked answer sheets and instructor feedback for individual exams." />
      {loading ? <Spinner /> : !data?.length ? (
        <div className="bg-white rounded-4xl border border-slate-100 shadow-sm py-16 text-center"><Inbox size={36} className="mx-auto text-slate-300 mb-3" /><h3 className="font-bold text-slate-800">No Results Published Yet</h3><p className="text-sm text-slate-400 max-w-xs mx-auto">When your instructor grades and publishes your exams, they will appear here.</p></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {data.map((r) => {
            const pct = r.exam && r.score != null ? Math.round((Number(r.score) / Number(r.exam.total_marks)) * 100) : 0;
            return (
              <div key={r.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
                <p className="text-[10px] font-bold uppercase text-indigo-600">{r.exam?.kind} · {r.exam?.course?.title}</p>
                <h3 className="text-lg font-extrabold text-slate-900 mb-4">{r.exam?.title}</h3>
                <div className="flex items-end justify-between">
                  <div><p className="text-4xl font-black text-slate-900">{r.score}<span className="text-base text-slate-400">/{r.exam?.total_marks}</span></p><p className="text-xs text-slate-400">Graded {fmtDate(r.graded_at)}</p></div>
                  {r.grade && <span className="text-2xl font-black text-orange-500">{r.grade}</span>}
                </div>
                <div className="h-2 bg-slate-100 rounded-full mt-4 overflow-hidden"><div className={`h-full rounded-full ${pct >= 50 ? 'bg-emerald-500' : 'bg-red-400'}`} style={{ width: `${pct}%` }} /></div>
                {r.feedback && <button onClick={() => setOpen(r)} className="mt-4 text-xs font-bold text-indigo-600 flex items-center gap-1"><MessageSquareText size={14} /> Instructor feedback</button>}
              </div>
            );
          })}
        </div>
      )}
      <Modal open={!!open} onClose={() => setOpen(null)} title={open?.exam?.title ?? ''}><p className="text-sm text-slate-600 whitespace-pre-line">{open?.feedback}</p></Modal>
    </Page>
  );
}
