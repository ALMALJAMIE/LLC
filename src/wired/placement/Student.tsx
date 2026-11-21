import { askConfirm, askText } from '../../components/dialogs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BrainCircuit, CircleCheck, Clock, Loader2, PlayCircle, Send, Trophy } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { fmtDateTime, useData } from '../../lib/db';
import { DemoNotice, Page, PageHero, Spinner, btnAccent, toast } from '../../components/ui';
import { RichText } from '../shared/LessonView';

type Test = { id: number; title: string; description: string | null; duration_min: number; config: string; course: { title: string } | null };
type Att = { id: number; test_id: number; status: string; pct: number | null; needs_marking: boolean; submitted_at: string | null; started_at: string; review_note: string | null; section_scores: Record<string, { score: number; total: number }> | null;
  suggested: { name: string; cefr: string | null } | null; final: { id: number; name: string; cefr: string | null } | null; test: { title: string } | null };

export function StudentPlacement() {
  const user = useAuth((s) => s.user)!;
  const nav = useNavigate();
  const tests = useData<Test[]>(() => supabase.from('placement_tests').select('id,title,description,duration_min,config, course:courses(title)').eq('is_active', true).eq('approval', 'approved').neq('config', 'interview').order('priority', { ascending: false }).order('id'));
  const atts = useData<Att[]>(() => supabase.from('placement_attempts').select('id,test_id,status,pct,needs_marking,submitted_at,started_at,review_note,section_scores, suggested:levels!placement_attempts_suggested_level_id_fkey(name,cefr), final:levels!placement_attempts_final_level_id_fkey(id,name,cefr), test:placement_tests(title)').eq('student_id', user.id).order('started_at', { ascending: false }));
  const [busy, setBusy] = useState<number | null>(null);
  const start = async (t: Test) => {
    if (user.demo) return toast.err('Sign in with a real account to take the test.');
    setBusy(t.id);
    const { data, error } = await supabase.rpc('start_placement', { p_test: t.id });
    setBusy(null);
    if (error) return toast.err(error.message);
    nav(`/student/placement/${data}`);
  };
  const done = (atts.data ?? []).filter((a) => a.status !== 'in_progress');
  return (
    <Page>
      {user.demo && <DemoNotice />}
      <PageHero badge="Placement" badgeColor="indigo" title="Placement Tests Dashboard" illus="exam" subtitle="Find your English level. Your result helps us place you in the right course and batch." />
      {done.length > 0 && (
        <div className="grid md:grid-cols-2 gap-5 mb-8">{done.map((a) => {
          const lvl = a.final ?? a.suggested;
          return (
            <div key={a.id} className="bg-[#0b1a3a] rounded-4xl p-6 text-white relative overflow-hidden">
              <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-orange-500/20" />
              <p className="text-[10px] font-black uppercase tracking-widest text-orange-400">{a.test?.title}</p>
              <div className="flex items-end gap-4 mt-3"><Trophy className="text-orange-400" size={36} /><div><p className="text-3xl font-black">{lvl?.name ?? '—'} {lvl?.cefr && <span className="text-base text-slate-300">({lvl.cefr})</span>}</p><p className="text-xs text-slate-300">{a.final ? 'Confirmed level' : a.needs_marking ? 'Your written answers are being marked' : 'Suggested level — awaiting review'}{!a.needs_marking || a.final ? ` · score ${a.pct}%` : ''}</p></div></div>
              {a.section_scores && <div className="grid grid-cols-3 gap-2 mt-5">{Object.entries(a.section_scores).map(([k, v]) => <div key={k} className="p-2.5 rounded-xl bg-white/5 text-center"><p className="text-[10px] uppercase font-bold text-slate-400">{k}</p><p className="font-black">{v.score}/{v.total}</p></div>)}</div>}
              {a.review_note && <p className="text-xs text-slate-300 mt-4">“{a.review_note}”</p>}
              <button onClick={() => nav('/student/courses')} className="mt-5 px-4 py-2 rounded-xl bg-orange-500 text-xs font-bold">Find a course at my level →</button>
            </div>
          );
        })}</div>
      )}
      {tests.loading ? <Spinner /> : !tests.data?.length ? <p className="text-center text-slate-400 py-12">No placement test is open right now.</p> : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">{tests.data.map((t) => {
          const a = (atts.data ?? []).find((x) => x.test_id === t.id);
          return (
            <div key={t.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 flex flex-col">
              <span className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 grid place-items-center mb-4"><BrainCircuit size={22} /></span>
              <h3 className="text-lg font-extrabold text-slate-900">{t.title}</h3>
              <p className="text-sm text-slate-500 flex-1 mt-1">{t.description}</p>
              <p className="text-xs font-bold text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-1 mt-3"><span className="flex items-center gap-1"><Clock size={12} />{t.duration_min} minutes</span>{t.course && <span>{t.course.title}</span>}{t.config === 'both' && <span>Written + Interview</span>}</p>
              {a && a.status !== 'in_progress' ? <div className="mt-4 py-3 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-bold text-center flex items-center justify-center gap-2"><CircleCheck size={16} />Completed {fmtDateTime(a.submitted_at)}</div>
                : <button disabled={busy === t.id} onClick={() => start(t)} className={`${btnAccent} mt-4`}>{busy === t.id ? <Loader2 size={16} className="animate-spin" /> : <PlayCircle size={16} />}{a ? 'Resume Test' : 'Start Test'}</button>}
            </div>
          );
        })}</div>
      )}
    </Page>
  );
}

type Q = {
  id: number; section: string; section_id: number | null; section_title: string | null; section_desc: string | null; section_time: number | null; section_instructions: string[] | null; section_images: string[] | null;
  group_id: number | null; group_title: string | null; passage: string | null; audio_url: string | null; image_url: string | null;
  context: string | null; prompt: string; options: string[]; qtype: 'mcq' | 'short' | 'long'; points: number;
  title: string; duration_min: number; started_at: string; answers: Record<string, number | string>;
};

export function PlacementTake() {
  const { id } = useParams();
  const aid = Number(id);
  const nav = useNavigate();
  const paper = useData<Q[]>(() => supabase.rpc('placement_paper', { p_attempt: aid }), [aid]);
  const qs = paper.data ?? [];
  const [ans, setAns] = useState<Record<string, number | string>>({});
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ pct: number; level_name: string | null; needs_marking: boolean } | null>(null);
  const loaded = useRef(false);
  useEffect(() => { if (qs.length && !loaded.current) { loaded.current = true; setAns(qs[0].answers ?? {}); } }, [qs]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  // Autosave: 1.5 s after the last change, and when the tab is hidden or closed.
  // (A Supabase query only runs when awaited / .then() is called.)
  const latest = useRef(ans); latest.current = ans;
  const save = useCallback(() => { if (loaded.current && !result) supabase.rpc('save_placement', { p_attempt: aid, p_answers: latest.current }).then(() => {}); }, [aid, result]);
  useEffect(() => { if (!loaded.current) return; const t = setTimeout(save, 1500); return () => clearTimeout(t); }, [ans, save]);
  useEffect(() => {
    const h = () => { if (document.visibilityState === 'hidden') save(); };
    document.addEventListener('visibilitychange', h); window.addEventListener('pagehide', save);
    return () => { document.removeEventListener('visibilitychange', h); window.removeEventListener('pagehide', save); save(); };
  }, [save]);
  const deadline = qs[0] ? new Date(qs[0].started_at).getTime() + qs[0].duration_min * 60000 : 0;
  const left = Math.max(0, Math.floor((deadline - now) / 1000));
  const sections = useMemo(() => {
    const m = new Map<string, Q[]>();
    qs.forEach((q) => { const k = String(q.section_id ?? q.section); m.set(k, [...(m.get(k) ?? []), q]); });
    return [...m.values()];
  }, [qs]);
  const isAnswered = (q: Q) => { const v = ans[q.id]; return typeof v === 'number' || (typeof v === 'string' && v.trim() !== ''); };
  const answered = qs.filter(isAnswered).length;

  const submit = useCallback(async (auto = false) => {
    if (!auto && answered < qs.length && !await askConfirm(`You answered ${answered} of ${qs.length}. Submit anyway?`)) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('submit_placement', { p_attempt: aid, p_answers: ans });
    setBusy(false);
    if (error) return toast.err(error.message);
    setResult((data as { pct: number; level_name: string | null; needs_marking: boolean }[])[0]);
  }, [aid, ans, answered, qs.length]);
  useEffect(() => { if (qs.length && left === 0 && !result && !busy) submit(true); }, [left]); // eslint-disable-line react-hooks/exhaustive-deps

  if (result) return (
    <Page><div className="max-w-xl mx-auto bg-white rounded-4xl border border-slate-100 shadow-sm p-10 text-center mt-6">
      <Trophy size={48} className="mx-auto text-orange-500 mb-4" /><h1 className="text-3xl font-extrabold text-slate-900">Test submitted!</h1>
      {result.needs_marking ? <p className="text-slate-500 mt-3">Some of your answers are marked by our teachers. Your final score and level will appear on your placement dashboard after marking.</p> : <>
        <p className="text-slate-500 mt-2">Your score: <b>{result.pct}%</b></p>
        <p className="text-xl font-black text-indigo-700 mt-4">Suggested level: {result.level_name ?? 'to be confirmed'}</p></>}
      <p className="text-xs text-slate-400 mt-2">Our academic team will confirm your level shortly.</p>
      <button onClick={() => nav('/student/assessments')} className={`${btnAccent} mt-8`}>Back to Placement Dashboard</button>
    </div></Page>
  );
  if (paper.loading) return <Spinner />;
  if (!qs.length) return <Page><p className="text-center text-slate-400 py-16">This attempt is closed or not found.</p></Page>;
  let n = 0;
  return (
    <div className="w-full bg-[#fafafa] min-h-screen pb-24">
      <div className="sticky top-0 z-20 bg-[#0b1a3a] text-white px-6 py-4 flex flex-wrap items-center gap-4">
        <h1 className="flex-1 font-extrabold">{qs[0].title}</h1>
        <span className="text-xs text-slate-300">{answered}/{qs.length} answered</span>
        <span className={`px-3 py-1.5 rounded-xl font-mono font-black ${left < 120 ? 'bg-red-500' : 'bg-white/10'}`}><Clock size={14} className="inline mr-1" />{String(Math.floor(left / 60)).padStart(2, '0')}:{String(left % 60).padStart(2, '0')}</span>
        <button disabled={busy} onClick={() => submit()} className="px-4 py-2 rounded-xl bg-orange-500 text-sm font-bold flex items-center gap-2">{busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}Submit</button>
      </div>
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-10">
        {sections.map((list) => {
          const s = list[0];
          let lastGroup: number | string | null = null;
          return (
            <section key={String(s.section_id ?? s.section)}>
              <div className="mb-4">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-orange-500">{s.section}{s.section_time ? ` · about ${s.section_time} min` : ''}</p>
                <h2 className="text-xl font-extrabold text-slate-900">{s.section_title ?? s.section}</h2>
                {s.section_desc && <p className="text-sm text-slate-500 mt-1">{s.section_desc}</p>}
              </div>
              {!!s.section_instructions?.length && <ul className="mb-4 p-4 rounded-2xl bg-sky-50 border border-sky-100 text-sm text-sky-900 list-disc pl-8 space-y-1">{s.section_instructions.map((x, i) => <li key={i}>{x}</li>)}</ul>}
              {!!s.section_images?.length && <div className="flex flex-wrap gap-3 mb-4">{s.section_images.map((u) => <img key={u} src={u} alt="" className="max-h-64 rounded-2xl border border-slate-100" />)}</div>}
              <div className="space-y-4">{list.map((q) => {
                n += 1;
                const gkey = q.group_id ?? (q.passage ? `p:${q.passage}` : null);
                const showGroup = gkey != null && gkey !== lastGroup; lastGroup = gkey;
                return (
                  <div key={q.id}>
                    {showGroup && <div className="bg-indigo-50/60 border border-indigo-100 rounded-3xl p-5 mb-4 text-sm">
                      {q.group_title && <p className="font-extrabold text-slate-900 mb-2">{q.group_title}</p>}
                      {q.image_url && <img src={q.image_url} alt="" className="max-h-72 rounded-xl mb-3" />}
                      {q.audio_url && <audio controls src={q.audio_url} className="w-full mb-3" />}
                      {q.passage && <RichText text={q.passage} />}
                    </div>}
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5">
                      {q.context && <div className="mb-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-100 font-bold text-amber-900 text-center tracking-wide">{q.context}</div>}
                      <p className="font-bold text-slate-900 mb-3"><span className="text-slate-400 mr-2">{n}.</span>{q.prompt}<span className="text-[11px] font-semibold text-slate-400 ml-2">({q.points} pt{q.points > 1 ? 's' : ''})</span></p>
                      {q.qtype === 'mcq' ? (
                        <div className="grid sm:grid-cols-2 gap-2">{q.options.map((o, i) => (
                          <button key={i} onClick={() => setAns({ ...ans, [q.id]: i })} className={`text-left px-4 py-3 rounded-2xl border text-sm font-medium transition-all ${ans[q.id] === i ? 'border-orange-400 bg-orange-50 text-orange-800 ring-2 ring-orange-100' : 'border-slate-200 hover:border-slate-300 text-slate-700'}`}>
                            <span className="font-black mr-2 text-slate-400">{String.fromCharCode(65 + i)}</span>{o}</button>
                        ))}</div>
                      ) : q.qtype === 'short' ? (
                        <input className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm" value={typeof ans[q.id] === 'string' ? (ans[q.id] as string) : ''} onChange={(e) => setAns({ ...ans, [q.id]: e.target.value })} placeholder="Type your answer" />
                      ) : (
                        <textarea rows={6} className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm" value={typeof ans[q.id] === 'string' ? (ans[q.id] as string) : ''} onChange={(e) => setAns({ ...ans, [q.id]: e.target.value })} placeholder="Write your answer here" />
                      )}
                    </div>
                  </div>
                );
              })}</div>
            </section>
          );
        })}
        <button disabled={busy} onClick={() => submit()} className={`${btnAccent} w-full py-4`}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Submit Test</button>
      </div>
    </div>
  );
}
