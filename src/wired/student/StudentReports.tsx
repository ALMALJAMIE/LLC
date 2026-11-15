import { useEffect, useMemo, useState } from 'react';
import { Award, BookOpen, CalendarCheck, ChevronDown, FileText, MessageSquareQuote, Printer, Target } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { fmtDate, useData } from '../../lib/db';
import { scaleOf, useScale } from '../../lib/grading';
import { DemoNotice, Page, PageHero, Spinner } from '../../components/ui';

type En = { id: number; status: string; progress: number; batch_id: number | null; course: { id: number; title: string; code: string; level: { name: string } | null } | null; batch: { name: string; instructor: { full_name: string } | null } | null };
type Res = { id: number; score: number | null; grade: string | null; feedback: string | null; status: string; graded_at: string | null; exam: { id: number; title: string; kind: string; total_marks: number; batch_id: number | null; course_id: number | null; starts_at: string | null } | null };
type Att = { status: string; session: { batch_id: number } | null };

/** Everything a student's reports need, loaded once. */
function useReportData() {
  const user = useAuth((s) => s.user);
  const scale = useScale((s) => s.scale);
  useEffect(() => { useScale.getState().load(); }, []);
  const en = useData<En[]>(() => supabase.from('enrollments').select('id,status,progress,batch_id, course:courses(id,title,code, level:levels(name)), batch:batches(name, instructor:profiles(full_name))').eq('student_id', user?.id ?? '').in('status', ['active', 'completed']).order('created_at', { ascending: false }));
  const res = useData<Res[]>(() => supabase.from('exam_results').select('id,score,grade,feedback,status,graded_at, exam:exams(id,title,kind,total_marks,batch_id,course_id,starts_at)').eq('student_id', user?.id ?? '').eq('status', 'graded'));
  const att = useData<Att[]>(() => supabase.from('attendance').select('status, session:class_sessions(batch_id)').eq('student_id', user?.id ?? ''));
  const rows = useMemo(() => (en.data ?? []).map((e) => {
    const results = (res.data ?? []).filter((r) => r.exam && ((e.batch_id && r.exam.batch_id === e.batch_id) || (!r.exam.batch_id && r.exam.course_id === e.course?.id)));
    const pcts = results.filter((r) => r.score != null).map((r) => (Number(r.score) / Number(r.exam!.total_marks || 100)) * 100);
    const avg = pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : null;
    const a = (att.data ?? []).filter((x) => x.session?.batch_id === e.batch_id);
    const attended = a.filter((x) => x.status === 'present' || x.status === 'late' || x.status === 'excused').length;
    const attPct = a.length ? (attended / a.length) * 100 : null;
    const final = results.find((r) => r.exam?.kind === 'final');
    const finalPct = final?.score != null ? (Number(final.score) / Number(final.exam!.total_marks || 100)) * 100 : null;
    const overall = finalPct != null && avg != null ? finalPct * 0.6 + avg * 0.4 : null;
    return { e, results, avg, attPct, sessions: a.length, attended, final, overall, grade: overall != null ? scaleOf(overall, scale) : null };
  }), [en.data, res.data, att.data, scale]);
  return { user, loading: en.loading || res.loading || att.loading, rows };
}

const pct = (n: number | null) => (n == null ? 'N/A' : `${Math.round(n)}%`);
const KIND: Record<string, string> = { quiz: 'bg-sky-50 text-sky-700', midterm: 'bg-indigo-50 text-indigo-700', final: 'bg-orange-50 text-orange-700', placement: 'bg-purple-50 text-purple-700' };

// ---------------- Class progress report ----------------
export function StudentClassReport() {
  const { user, loading, rows } = useReportData();
  const [open, setOpen] = useState<number | null>(null);
  return (
    <Page>
      {user?.demo && <DemoNotice />}
      <PageHero badge="Academic Record" badgeColor="indigo" title="Class Progress Report" illus="reports" subtitle="View your attendance, exam averages, and detailed performance for all your courses." />
      {loading ? <Spinner /> : !rows.length ? <p className="text-center text-slate-400 py-16">No active courses yet. Your report appears once you are enrolled in a class.</p> : (
        <div className="space-y-5">{rows.map(({ e, results, avg, attPct, sessions, attended, overall, grade }) => {
          const isOpen = open === e.id || rows.length === 1;
          return (
            <div key={e.id} className="bg-white rounded-4xl border border-slate-100 shadow-sm overflow-hidden">
              <button onClick={() => setOpen(isOpen ? null : e.id)} className="w-full p-6 flex flex-wrap items-center gap-4 text-left">
                <span className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 grid place-items-center"><BookOpen /></span>
                <div className="flex-1 min-w-48"><p className="text-lg font-extrabold text-slate-900">{e.course?.title}</p><p className="text-xs text-slate-500">{e.batch?.name ?? 'No batch yet'}{e.batch?.instructor && ` · ${e.batch.instructor.full_name}`}</p></div>
                <span className={`text-sm font-black px-3 py-1 rounded-full ${grade ? (grade.is_pass ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600') : 'bg-slate-100 text-slate-500'}`}>{grade?.grade ?? 'Pending'}</span>
                <ChevronDown className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              {isOpen && (
                <div className="px-6 pb-6 border-t border-slate-100 pt-6">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <Stat icon={<CalendarCheck size={18} />} label="Overall Attendance" value={pct(attPct)} sub={sessions ? `${attended} of ${sessions} classes` : 'No classes recorded'} tone="emerald" />
                    <Stat icon={<Target size={18} />} label="Exam Average" value={pct(avg)} sub={results.length ? `${results.length} graded` : 'No exams yet'} tone="indigo" />
                    <Stat icon={<FileText size={18} />} label="Total Exams Taken" value={String(results.length)} tone="sky" />
                    <Stat icon={<BookOpen size={18} />} label="Lessons Completed" value={`${e.progress}%`} tone="orange" />
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-500 mb-3">Exam Performance Log</h3>
                  {!results.length ? <p className="text-sm text-slate-400 mb-6">No exams completed yet.</p> : (
                    <div className="overflow-x-auto border border-slate-100 rounded-2xl mb-6"><table className="w-full text-sm"><thead className="bg-slate-50 text-[11px] uppercase text-slate-500"><tr><th className="text-left px-4 py-2">Exam</th><th className="text-left px-3">Type</th><th className="text-left px-3">Date</th><th className="text-right px-3">Score</th><th className="text-right px-4">Grade</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">{results.map((r) => (
                        <tr key={r.id}><td className="px-4 py-2.5 font-semibold text-slate-800">{r.exam?.title}</td><td className="px-3"><span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${KIND[r.exam?.kind ?? ''] ?? ''}`}>{r.exam?.kind}</span></td>
                          <td className="px-3 text-xs text-slate-500">{fmtDate(r.exam?.starts_at ?? r.graded_at)}</td><td className="px-3 text-right">{r.score} / {r.exam?.total_marks}</td><td className="px-4 text-right font-black text-orange-500">{r.grade}</td></tr>
                      ))}</tbody></table></div>
                  )}
                  <div className={`rounded-3xl p-5 flex items-center gap-4 ${grade ? 'bg-gradient-to-r from-indigo-600 to-indigo-800 text-white' : 'bg-slate-50'}`}>
                    <Award size={32} className={grade ? 'text-orange-300' : 'text-slate-300'} />
                    <div className="flex-1"><p className={`text-xs font-black uppercase ${grade ? 'text-indigo-200' : 'text-slate-400'}`}>Final Course Grade</p>
                      {grade ? <p className="text-2xl font-extrabold">{grade.grade} <span className="text-base font-semibold text-indigo-200">· {pct(overall)} · {grade.label}</span></p>
                        : <><p className="text-xl font-extrabold text-slate-700">Pending</p><p className="text-xs text-slate-500">Complete all required course components (including the final exam) to receive your final grade.</p></>}
                    </div>
                  </div>
                  {grade && <p className="text-[11px] text-slate-400 mt-2">Final grade = final exam 60% + average of all exams 40%.</p>}
                </div>
              )}
            </div>
          );
        })}</div>
      )}
    </Page>
  );
}
function Stat({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: string; sub?: string; tone: string }) {
  const t = { emerald: 'bg-emerald-50 text-emerald-600', indigo: 'bg-indigo-50 text-indigo-600', sky: 'bg-sky-50 text-sky-600', orange: 'bg-orange-50 text-orange-600' }[tone];
  return <div className="rounded-3xl border border-slate-100 p-4"><span className={`w-9 h-9 rounded-xl grid place-items-center ${t}`}>{icon}</span><p className="text-[11px] font-black uppercase text-slate-400 mt-3">{label}</p><p className="text-2xl font-extrabold text-slate-900">{value}</p>{sub && <p className="text-xs text-slate-500">{sub}</p>}</div>;
}

// ---------------- Language course report (transcript) ----------------
export function StudentLanguageReport() {
  const { user, loading, rows } = useReportData();
  return (
    <Page>
      {user?.demo && <DemoNotice />}
      <PageHero badge="Academic Transcript" badgeColor="orange" title="Language Course Progress Reports" illus="certificate" subtitle="Access your detailed performance analytics and teacher evaluations.">
        {!!rows.length && <button onClick={() => window.print()} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-orange-500 text-white text-sm font-bold print:hidden"><Printer size={16} />Print / Save PDF</button>}
      </PageHero>
      {loading ? <Spinner /> : !rows.length ? <p className="text-center text-slate-400 py-16">No courses yet.</p> : (
        <div className="space-y-6">{rows.map(({ e, results, avg, attPct, grade, overall }) => {
          const feedback = results.filter((r) => r.feedback);
          return (
            <div key={e.id} className="bg-white rounded-4xl border border-slate-100 shadow-sm p-6 sm:p-8 break-inside-avoid">
              <div className="flex flex-wrap justify-between gap-4 pb-5 border-b border-slate-100">
                <div><p className="text-[11px] font-black uppercase text-orange-500">{e.course?.code}{e.course?.level && ` · ${e.course.level.name}`}</p><h2 className="text-2xl font-extrabold text-slate-900">{e.course?.title}</h2>
                  <p className="text-sm text-slate-500">{e.batch?.name}{e.batch?.instructor && ` · Teacher: ${e.batch.instructor.full_name}`}</p></div>
                <div className="text-right"><p className="text-[11px] font-black uppercase text-slate-400">Status</p><p className="font-extrabold capitalize text-slate-800">{e.status}</p></div>
              </div>
              {!results.length && attPct == null ? <p className="text-sm text-slate-400 pt-5">Records are currently being processed for this course.</p> : (<>
                <div className="grid sm:grid-cols-4 gap-4 py-5">
                  {[['Course progress', `${e.progress}%`], ['Attendance', pct(attPct)], ['Exam average', pct(avg)], ['Overall grade', grade ? `${grade.grade} (${pct(overall)})` : 'Pending']].map(([l, v]) => (
                    <div key={l}><p className="text-[11px] font-black uppercase text-slate-400">{l}</p><p className="text-xl font-extrabold text-slate-900">{v}</p>
                      {l === 'Course progress' && <div className="h-1.5 bg-slate-100 rounded-full mt-2"><div className="h-full bg-orange-500 rounded-full" style={{ width: `${e.progress}%` }} /></div>}</div>
                  ))}
                </div>
                {!!results.length && <div className="space-y-2 mb-5">{results.map((r) => {
                  const p = r.score != null ? (Number(r.score) / Number(r.exam?.total_marks || 100)) * 100 : 0;
                  return <div key={r.id} className="flex items-center gap-3 text-sm"><span className="w-44 truncate text-slate-600">{r.exam?.title}</span><div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 rounded-full" style={{ width: `${p}%` }} /></div><b className="w-20 text-right text-slate-800">{Math.round(p)}% {r.grade}</b></div>;
                })}</div>}
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2"><MessageSquareQuote size={16} />Teacher evaluations</h3>
                {!feedback.length ? <p className="text-sm text-slate-400">No written feedback yet.</p> : <div className="grid md:grid-cols-2 gap-3">{feedback.map((r) => <blockquote key={r.id} className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700"><p className="text-[11px] font-black uppercase text-slate-400 mb-1">{r.exam?.title}</p>“{r.feedback}”</blockquote>)}</div>}
              </>)}
            </div>
          );
        })}</div>
      )}
    </Page>
  );
}
