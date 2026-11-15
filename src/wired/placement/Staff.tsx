import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BrainCircuit, Check, Clock, ListChecks, Loader2, Plus, RotateCcw, Save, SquarePen, Trash2 } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { isAcademicLead } from '../../lib/nav';
import { supabase } from '../../lib/supabase';
import { fmtDateTime, useData } from '../../lib/db';
import { DemoNotice, Field, Modal, Page, PageHero, Spinner, StatusPill, btnPrimary, inputCls, toast } from '../../components/ui';
import EntityGrid from '../admin/EntityGrid';
import { notify } from '../admin/AdminEnrollments';

type T = { id: number; title: string; description: string | null; duration_min: number; is_active: boolean; placement_questions: { count: number }[] };
const base = (role: string) => (role === 'admin' || role === 'academic' ? '/admin-placement-tests' : '/instructor/placement-tests');

export function PlacementTestsAdmin() {
  const user = useAuth((s) => s.user)!;
  const nav = useNavigate();
  return (
    <EntityGrid<T> table="placement_tests" select="*, placement_questions(count)" badge="Placement" badgeTone="indigo" title="Placement Tests" illus="exam" addLabel="Create Test"
      subtitle="Online tests students take to find their level. They are graded automatically and mapped to a level using the score bands."
      defaults={{ duration_min: 30, is_active: true }} searchText={(r) => r.title}
      fields={[{ k: 'title', label: 'Title', required: true }, { k: 'description', label: 'Instructions for students', type: 'textarea' }, { k: 'duration_min', label: 'Time limit (minutes)', type: 'number', half: true, required: true }, { k: 'is_active', label: 'Open to students', type: 'checkbox' }]}
      toRow={(f) => ({ ...f, duration_min: Number(f.duration_min) })}
      card={(r) => (
        <>
          <div className="flex justify-between items-start mb-3"><span className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 grid place-items-center"><BrainCircuit size={22} /></span><StatusPill status={r.is_active ? 'active' : 'cancelled'} /></div>
          <h3 className="text-lg font-bold text-slate-900">{r.title}</h3>
          <p className="text-xs text-slate-500 flex gap-3 mt-1"><span className="flex items-center gap-1"><Clock size={12} />{r.duration_min} min</span><span className="flex items-center gap-1"><ListChecks size={12} />{r.placement_questions?.[0]?.count ?? 0} questions</span></p>
          <button onClick={() => nav(`${base(user.role)}/${r.id}/manage`)} className="mt-4 w-full py-2.5 rounded-xl bg-slate-900 hover:bg-orange-500 text-white text-xs font-bold">Manage Questions</button>
        </>
      )} />
  );
}

type Q = { id: number; test_id: number; section: string; passage: string | null; audio_url: string | null; prompt: string; options: string[]; correct_index: number; points: number; sort_order: number };
const SECTIONS = ['grammar', 'vocabulary', 'reading', 'listening'];

export function QuestionBank() {
  const { id } = useParams();
  const tid = Number(id);
  const user = useAuth((s) => s.user)!;
  const nav = useNavigate();
  const test = useData<{ title: string }>(() => supabase.from('placement_tests').select('title').eq('id', tid).maybeSingle(), [tid]);
  const qs = useData<Q[]>(() => supabase.from('placement_questions').select('*').eq('test_id', tid).order('section').order('sort_order').order('id'), [tid]);
  const [edit, setEdit] = useState<Partial<Q> | null>(null);
  const del = async (q: Q) => { if (!confirm('Delete this question?')) return; const { error } = await supabase.from('placement_questions').delete().eq('id', q.id); if (error) toast.err(error.message); else qs.reload(); };
  return (
    <Page>
      {user.demo && <DemoNotice />}
      <div className="flex items-center gap-3 mb-6"><button onClick={() => nav(base(user.role))} className="w-10 h-10 rounded-full bg-white border border-slate-200 grid place-items-center"><ArrowLeft size={18} /></button>
        <div className="flex-1"><p className="text-[10px] font-black uppercase text-indigo-600">Question Bank</p><h1 className="text-2xl font-extrabold text-slate-900">{test.data?.title}</h1></div>
        <button onClick={() => setEdit({ test_id: tid, section: 'grammar', options: ['', '', '', ''], correct_index: 0, points: 1, sort_order: (qs.data?.length ?? 0) + 1 })} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-orange-500 text-white text-sm font-bold"><Plus size={16} /> Add Question</button></div>
      {qs.loading ? <Spinner /> : SECTIONS.map((sec) => {
        const list = (qs.data ?? []).filter((q) => q.section === sec);
        if (!list.length) return null;
        return (
          <div key={sec} className="mb-8">
            <h2 className="text-xs font-black uppercase tracking-[0.25em] text-orange-500 mb-3">{sec} · {list.length}</h2>
            <div className="space-y-3">{list.map((q) => (
              <div key={q.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5">
                <div className="flex gap-3"><p className="flex-1 font-bold text-slate-900">{q.prompt}</p>
                  <button onClick={() => setEdit(q)} className="p-1.5 text-slate-400 hover:text-blue-600"><SquarePen size={16} /></button><button onClick={() => del(q)} className="p-1.5 text-slate-400 hover:text-red-500"><Trash2 size={16} /></button></div>
                {q.passage && <p className="text-xs text-slate-400 line-clamp-1 mt-1">Passage: {q.passage}</p>}
                <div className="grid sm:grid-cols-2 gap-2 mt-3">{q.options.map((o, i) => <span key={i} className={`px-3 py-2 rounded-xl text-sm border ${i === q.correct_index ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-bold' : 'border-slate-100 text-slate-600'}`}>{String.fromCharCode(65 + i)}. {o} {i === q.correct_index && <Check size={14} className="inline" />}</span>)}</div>
              </div>
            ))}</div>
          </div>
        );
      })}
      {!qs.loading && !qs.data?.length && <p className="text-center text-slate-400 py-12">No questions yet.</p>}
      {edit && <QForm q={edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); qs.reload(); }} />}
    </Page>
  );
}

function QForm({ q, onClose, onDone }: { q: Partial<Q>; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ section: q.section ?? 'grammar', passage: q.passage ?? '', audio_url: q.audio_url ?? '', prompt: q.prompt ?? '', options: q.options ?? ['', '', '', ''], correct_index: q.correct_index ?? 0, points: q.points ?? 1 });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const opts = f.options.map((o) => o.trim()).filter(Boolean);
    if (!f.prompt.trim() || opts.length < 2) return toast.err('Write the question and at least two options.');
    if (f.correct_index >= opts.length) return toast.err('Choose which option is correct.');
    setBusy(true);
    const row = { test_id: q.test_id, section: f.section, passage: f.passage || null, audio_url: f.audio_url || null, prompt: f.prompt.trim(), options: opts, correct_index: f.correct_index, points: Number(f.points) || 1, sort_order: q.sort_order ?? 0 };
    const { error } = q.id ? await supabase.from('placement_questions').update(row).eq('id', q.id) : await supabase.from('placement_questions').insert(row);
    setBusy(false);
    if (error) toast.err(error.message); else { toast.ok('Question saved'); onDone(); }
  };
  return (
    <Modal open onClose={onClose} title={q.id ? 'Edit Question' : 'Add Question'} wide>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3"><Field label="Section"><select className={inputCls} value={f.section} onChange={(e) => setF({ ...f, section: e.target.value })}>{SECTIONS.map((s) => <option key={s}>{s}</option>)}</select></Field>
          <Field label="Points"><input type="number" className={inputCls} value={f.points} onChange={(e) => setF({ ...f, points: Number(e.target.value) })} /></Field></div>
        {(f.section === 'reading' || f.passage) && <Field label="Reading passage (shared by questions with the same text)"><textarea rows={4} className={inputCls} value={f.passage} onChange={(e) => setF({ ...f, passage: e.target.value })} /></Field>}
        {f.section === 'listening' && <Field label="Audio link (mp3)"><input className={inputCls} value={f.audio_url} onChange={(e) => setF({ ...f, audio_url: e.target.value })} /></Field>}
        <Field label="Question"><input className={inputCls} value={f.prompt} onChange={(e) => setF({ ...f, prompt: e.target.value })} placeholder="She ___ a teacher." /></Field>
        <Field label="Options — tick the correct one">
          <div className="space-y-2">{f.options.map((o, i) => (
            <div key={i} className="flex items-center gap-2"><input type="radio" checked={f.correct_index === i} onChange={() => setF({ ...f, correct_index: i })} className="accent-emerald-600 w-4 h-4" />
              <span className="font-black text-slate-400 w-4">{String.fromCharCode(65 + i)}</span><input className={inputCls} value={o} onChange={(e) => { const op = [...f.options]; op[i] = e.target.value; setF({ ...f, options: op }); }} /></div>
          ))}{f.options.length < 6 && <button type="button" onClick={() => setF({ ...f, options: [...f.options, ''] })} className="text-xs font-bold text-orange-500">+ Add option</button>}</div>
        </Field>
        <button disabled={busy} onClick={save} className={`${btnPrimary} w-full`}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save Question</button>
      </div>
    </Modal>
  );
}

type Band = { id: number; level_id: number; min_pct: number; max_pct: number };
export function LevelConfig() {
  const user = useAuth((s) => s.user)!;
  const levels = useData<{ id: number; name: string; cefr: string | null; sort_order: number }[]>(() => supabase.from('levels').select('*').order('sort_order'));
  const bands = useData<Band[]>(() => supabase.from('placement_bands').select('*'));
  const [draft, setDraft] = useState<Record<number, { min: string; max: string }>>({});
  const [busy, setBusy] = useState(false);
  const val = (lid: number, k: 'min' | 'max') => draft[lid]?.[k] ?? String((bands.data ?? []).find((b) => b.level_id === lid)?.[k === 'min' ? 'min_pct' : 'max_pct'] ?? '');
  const save = async () => {
    setBusy(true);
    const rows = (levels.data ?? []).map((l) => ({ level_id: l.id, min_pct: Number(val(l.id, 'min')), max_pct: Number(val(l.id, 'max')) })).filter((r) => !Number.isNaN(r.min_pct) && !Number.isNaN(r.max_pct) && val(r.level_id, 'min') !== '');
    if (rows.some((r) => r.min_pct > r.max_pct)) { setBusy(false); return toast.err('Each "from" must be lower than "to".'); }
    const { error } = await supabase.from('placement_bands').upsert(rows, { onConflict: 'level_id' });
    setBusy(false);
    if (error) toast.err(error.message); else { toast.ok('Score bands saved'); setDraft({}); bands.reload(); }
  };
  return (
    <Page>
      {user.demo && <DemoNotice />}
      <PageHero badge="Placement" badgeColor="indigo" title="Test Level Config" illus="levels" subtitle="Set which score range (in %) places a student into each level." />
      <div className="bg-white rounded-4xl border border-slate-100 shadow-sm p-6 max-w-2xl">
        {(levels.data ?? []).map((l) => (
          <div key={l.id} className="grid grid-cols-12 gap-3 items-center py-3 border-b border-slate-50 last:border-0">
            <div className="col-span-6"><p className="font-bold text-slate-800">{l.name}</p><p className="text-[11px] text-slate-400">CEFR {l.cefr ?? '—'}</p></div>
            <input className={`${inputCls} col-span-2 text-center`} value={val(l.id, 'min')} onChange={(e) => setDraft({ ...draft, [l.id]: { min: e.target.value, max: val(l.id, 'max') } })} />
            <span className="col-span-1 text-center text-slate-400">–</span>
            <input className={`${inputCls} col-span-2 text-center`} value={val(l.id, 'max')} onChange={(e) => setDraft({ ...draft, [l.id]: { min: val(l.id, 'min'), max: e.target.value } })} />
            <span className="col-span-1 text-slate-400 text-sm">%</span>
          </div>
        ))}
        <button disabled={busy || !isAcademicLead(user.role)} onClick={save} className={`${btnPrimary} w-full mt-5`}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save Bands</button>
      </div>
    </Page>
  );
}

type R = { id: number; student_id: string; status: string; pct: number | null; late: boolean; submitted_at: string | null; review_note: string | null; final_level_id: number | null; section_scores: Record<string, { score: number; total: number }> | null;
  student: { full_name: string; email: string; phone: string | null } | null; test: { title: string } | null; suggested: { id: number; name: string } | null; final: { name: string } | null };
export function PlacementResults() {
  const user = useAuth((s) => s.user)!;
  const [tab, setTab] = useState('submitted');
  const { data, loading, reload } = useData<R[]>(() => supabase.from('placement_attempts').select('id,student_id,status,pct,late,submitted_at,review_note,final_level_id,section_scores, student:profiles!placement_attempts_student_id_fkey(full_name,email,phone), test:placement_tests(title), suggested:levels!placement_attempts_suggested_level_id_fkey(id,name), final:levels!placement_attempts_final_level_id_fkey(name)').neq('status', 'in_progress').order('submitted_at', { ascending: false }));
  const levels = useData<{ id: number; name: string }[]>(() => supabase.from('levels').select('id,name').order('sort_order'));
  const [open, setOpen] = useState<R | null>(null);
  const [lvl, setLvl] = useState('');
  const [note, setNote] = useState('');
  const list = (data ?? []).filter((r) => tab === 'all' || r.status === tab);
  const confirmLevel = async () => {
    if (!open || !lvl) return toast.err('Choose the final level.');
    const { error } = await supabase.from('placement_attempts').update({ final_level_id: Number(lvl), review_note: note || null, status: 'reviewed', reviewer_id: user.id }).eq('id', open.id);
    if (error) return toast.err(error.message);
    await notify(open.student_id, 'Your English level is confirmed', `${levels.data?.find((l) => String(l.id) === lvl)?.name}${note ? ` — ${note}` : ''}`, '/student/assessments');
    toast.ok('Level confirmed'); setOpen(null); reload();
  };
  const retake = async (r: R) => {
    if (!confirm(`Allow ${r.student?.full_name} to retake? Their current attempt will be deleted.`)) return;
    const { error } = await supabase.from('placement_attempts').delete().eq('id', r.id);
    if (error) toast.err(error.message); else reload();
  };
  return (
    <Page wide>
      {user.demo && <DemoNotice />}
      <PageHero badge="Placement" badgeColor="indigo" title="Placement Results" illus="results" subtitle="Auto-graded placement tests. Confirm or adjust each student's level; the student is notified.">
        <div className="inline-flex bg-slate-50 p-1 rounded-xl border border-slate-200">{['submitted', 'reviewed', 'all'].map((t) => <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-xs font-bold capitalize ${tab === t ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>{t === 'submitted' ? 'To review' : t}</button>)}</div>
      </PageHero>
      {loading ? <Spinner /> : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[860px]"><thead className="bg-slate-50 text-[11px] font-extrabold uppercase text-slate-500"><tr><th className="px-4 py-3">Student</th><th className="px-3 py-3">Test</th><th className="px-3 py-3">Score</th><th className="px-3 py-3">Sections</th><th className="px-3 py-3">Level</th><th className="px-3 py-3 text-right">Action</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{list.map((r) => (
              <tr key={r.id}><td className="px-4 py-3"><p className="font-bold">{r.student?.full_name}</p><p className="text-[11px] text-slate-400">{r.student?.email} · {fmtDateTime(r.submitted_at)}</p></td>
                <td className="px-3 py-3 text-xs">{r.test?.title}{r.late && <span className="ml-1 text-red-500 font-bold">(late)</span>}</td>
                <td className="px-3 py-3 font-black text-lg">{r.pct}%</td>
                <td className="px-3 py-3 text-[11px]">{r.section_scores && Object.entries(r.section_scores).map(([k, v]) => <span key={k} className="inline-block mr-2 capitalize">{k}: <b>{v.score}/{v.total}</b></span>)}</td>
                <td className="px-3 py-3">{r.final ? <span className="font-bold text-emerald-700">{r.final.name}</span> : <span className="text-slate-500">Suggested: <b>{r.suggested?.name ?? '—'}</b></span>}</td>
                <td className="px-3 py-3 text-right whitespace-nowrap"><button onClick={() => { setOpen(r); setLvl(String(r.final_level_id ?? r.suggested?.id ?? '')); setNote(r.review_note ?? ''); }} className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold">{r.status === 'reviewed' ? 'Edit' : 'Confirm'}</button>
                  <button title="Allow retake" onClick={() => retake(r)} className="ml-1 p-1.5 text-slate-400 hover:text-orange-500"><RotateCcw size={15} /></button></td></tr>
            ))}{!list.length && <tr><td colSpan={6} className="p-8 text-center text-slate-400 text-xs">Nothing here.</td></tr>}</tbody></table>
        </div>
      )}
      <Modal open={!!open} onClose={() => setOpen(null)} title={`Confirm level · ${open?.student?.full_name ?? ''}`}>
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Score {open?.pct}% · suggested <b>{open?.suggested?.name ?? '—'}</b></p>
          <Field label="Final level"><select className={inputCls} value={lvl} onChange={(e) => setLvl(e.target.value)}><option value="">— Select —</option>{(levels.data ?? []).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></Field>
          <Field label="Note to student (optional)"><textarea rows={3} className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Strong reading; practise past tenses." /></Field>
          <button onClick={confirmLevel} className={`${btnPrimary} w-full`}><Check size={16} /> Confirm Level</button>
        </div>
      </Modal>
    </Page>
  );
}
