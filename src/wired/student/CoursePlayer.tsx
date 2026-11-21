import PlacementRequired from '../../components/PlacementRequired';
import { usePlacementDone } from '../../lib/placement';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, CircleCheck, Circle, Loader2, Lock } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { useData } from '../../lib/db';
import { Spinner, toast } from '../../components/ui';
import { LessonView } from '../shared/LessonView';
import { kindIcon, type Lesson } from '../shared/Curriculum';

type Unit = { id: number; title: string; sort_order: number; summary: string | null; topics: string[] | null; pages: string | null; lessons: Lesson[] };

export default function CoursePlayer() {
  const placed = usePlacementDone();
  const { id } = useParams();
  const cid = Number(id);
  const user = useAuth((s) => s.user)!;
  const nav = useNavigate();
  const course = useData<{ title: string; code: string }>(() => supabase.from('courses').select('title,code').eq('id', cid).maybeSingle(), [cid]);
  const units = useData<Unit[]>(() => supabase.from('course_units').select('id,title,sort_order,summary,topics,pages, lessons(*)').eq('course_id', cid).order('sort_order').order('id'), [cid]);
  const done = useData<{ lesson_id: number }[]>(() => supabase.from('lesson_progress').select('lesson_id').eq('student_id', user.id));
  const flat = useMemo(() => (units.data ?? []).flatMap((u) => [...u.lessons].filter((l) => l.status === 'approved').sort((a, b) => a.sort_order - b.sort_order || a.id - b.id).map((l) => ({ ...l, unitTitle: u.title, unit: u }))), [units.data]);
  const [cur, setCur] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const doneSet = new Set((done.data ?? []).map((d) => d.lesson_id));
  useEffect(() => { if (cur == null && flat.length) setCur((flat.find((l) => !doneSet.has(l.id)) ?? flat[0]).id); }, [flat, done.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const idx = flat.findIndex((l) => l.id === cur);
  const lesson = flat[idx];
  const pct = flat.length ? Math.round((flat.filter((l) => doneSet.has(l.id)).length / flat.length) * 100) : 0;

  const toggle = async () => {
    if (!lesson) return;
    setBusy(true);
    const { error } = await supabase.rpc('complete_lesson', { p_lesson: lesson.id, p_done: !doneSet.has(lesson.id) });
    setBusy(false);
    if (error) return toast.err(error.message);
    await done.reload();
    if (!doneSet.has(lesson.id) && flat[idx + 1]) setCur(flat[idx + 1].id);
  };

  if (placed === false) return <div className="max-w-3xl mx-auto p-6"><PlacementRequired /></div>;
  if (units.loading) return <Spinner />;
  return (
    <div className="w-full bg-[#fafafa] min-h-screen">
      <div className="bg-[#0b1a3a] text-white px-6 py-5 flex flex-wrap items-center gap-4">
        <button onClick={() => nav('/student/my-learning')} className="w-9 h-9 rounded-full bg-white/10 grid place-items-center"><ArrowLeft size={18} /></button>
        <div className="flex-1 min-w-48"><p className="text-[10px] font-black uppercase tracking-widest text-orange-400">{course.data?.code}</p><h1 className="text-xl font-extrabold">{course.data?.title}</h1></div>
        <div className="w-56"><div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-1"><span>Progress</span><span>{pct}%</span></div><div className="h-2 bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${pct}%` }} /></div></div>
      </div>
      {!flat.length ? (
        <div className="max-w-xl mx-auto text-center py-20"><Lock size={36} className="mx-auto text-slate-300 mb-3" /><h3 className="font-bold text-slate-800">No lessons available yet</h3><p className="text-sm text-slate-500">Your instructor is preparing the course content. Check back soon.</p></div>
      ) : (
        <div className="grid lg:grid-cols-12 gap-6 p-6 max-w-[1500px] mx-auto">
          <aside className="lg:col-span-4 xl:col-span-3 bg-white rounded-3xl border border-slate-100 shadow-sm p-4 h-fit lg:sticky lg:top-24 max-h-[80vh] overflow-y-auto custom-scrollbar">
            {(units.data ?? []).map((u) => {
              const ls = flat.filter((l) => l.unit_id === u.id);
              if (!ls.length) return null;
              return (
                <div key={u.id} className="mb-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-2 mb-2">{u.title}</p>
                  {ls.map((l) => (
                    <button key={l.id} onClick={() => setCur(l.id)} className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-sm transition-colors ${l.id === cur ? 'bg-orange-50 text-orange-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>
                      {doneSet.has(l.id) ? <CircleCheck size={16} className="text-emerald-500 shrink-0" /> : <Circle size={16} className="text-slate-300 shrink-0" />}
                      <span className="flex-1 truncate">{l.title}</span>{(() => { const I = kindIcon(l.kind ?? 'text'); return l.kind && l.kind !== 'text' ? <I size={13} className="text-slate-300" /> : null; })()}
                    </button>
                  ))}
                </div>
              );
            })}
          </aside>
          <main className="lg:col-span-8 xl:col-span-9 bg-white rounded-4xl border border-slate-100 shadow-sm p-6 sm:p-10">
            {lesson && <>
              <p className="text-[11px] font-black uppercase tracking-wider text-indigo-600 mb-1">{lesson.unitTitle}</p>
              <h2 className="text-3xl font-extrabold text-slate-900 mb-4">{lesson.title}</h2>
              {flat[idx - 1]?.unit_id !== lesson.unit_id && (lesson.unit.summary || !!lesson.unit.topics?.length) && (
                <div className="mb-6 p-4 rounded-2xl bg-slate-50 border border-slate-100 text-sm text-slate-600">
                  {lesson.unit.summary && <p>{lesson.unit.summary}</p>}
                  {!!lesson.unit.topics?.length && <div className="flex flex-wrap gap-1.5 mt-2">{lesson.unit.topics.map((t, i) => <span key={i} className="px-2.5 py-1 rounded-full bg-white border border-slate-200 text-[11px] font-bold">{t}</span>)}</div>}
                </div>
              )}
              <LessonView key={lesson.id} lesson={lesson} quizMode="take" />
              <div className="flex flex-wrap items-center gap-3 mt-10 pt-6 border-t border-slate-100">
                <button disabled={idx <= 0} onClick={() => setCur(flat[idx - 1].id)} className="flex items-center gap-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 disabled:opacity-40"><ChevronLeft size={16} />Previous</button>
                <button disabled={busy} onClick={toggle} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold ${doneSet.has(lesson.id) ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'}`}>
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <CircleCheck size={16} />} {doneSet.has(lesson.id) ? 'Completed — click to undo' : 'Mark as complete'}</button>
                <button disabled={idx >= flat.length - 1} onClick={() => setCur(flat[idx + 1].id)} className="flex items-center gap-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 disabled:opacity-40">Next<ChevronRight size={16} /></button>
              </div>
            </>}
          </main>
        </div>
      )}
    </div>
  );
}
