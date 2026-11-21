import { askConfirm, askText } from '../../components/dialogs';
import { useEffect, useState } from 'react';
import { Check, Loader2, PenLine, RotateCcw, Save } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { isAcademicLead } from '../../lib/nav';
import { supabase } from '../../lib/supabase';
import { fmtDateTime, useData } from '../../lib/db';
import { DemoNotice, Field, Modal, Page, PageHero, Spinner, btnPrimary, inputCls, toast } from '../../components/ui';
import type { Question } from './Tests';
import { notify } from '../admin/AdminEnrollments';

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

type R = { id: number; test_id: number; student_id: string; status: string; answers: Record<string, number | string>; manual_scores: Record<string, number>; interview_score: number | null; interview_total: number | null; interview_note: string | null; needs_marking: boolean; score: number | null; total: number | null; pct: number | null; late: boolean; submitted_at: string | null; review_note: string | null; final_level_id: number | null; section_scores: Record<string, { score: number; total: number }> | null;
  student: { full_name: string; email: string; phone: string | null } | null; test: { title: string; config: string } | null; suggested: { id: number; name: string } | null; final: { name: string } | null };
export function PlacementResults() {
  const user = useAuth((s) => s.user)!;
  const [tab, setTab] = useState('submitted');
  const { data, loading, reload } = useData<R[]>(() => supabase.from('placement_attempts').select('id,test_id,student_id,status,pct,score,total,late,submitted_at,review_note,final_level_id,section_scores,answers,manual_scores,interview_score,interview_total,interview_note,needs_marking, student:profiles!placement_attempts_student_id_fkey(full_name,email,phone), test:placement_tests(title,config), suggested:levels!placement_attempts_suggested_level_id_fkey(id,name), final:levels!placement_attempts_final_level_id_fkey(name)').neq('status', 'in_progress').order('submitted_at', { ascending: false }));
  const levels = useData<{ id: number; name: string }[]>(() => supabase.from('levels').select('id,name').order('sort_order'));
  const [open, setOpen] = useState<R | null>(null);
  const [mark, setMark] = useState<R | null>(null);
  const [lvl, setLvl] = useState('');
  const [note, setNote] = useState('');
  const appeals = useData<{ id: number; attempt_id: number; reason: string; status: string; response: string | null; created_at: string }[]>(() => supabase.from('placement_appeals').select('*').order('created_at', { ascending: false }));
  const appealOf = (r: R) => appeals.data?.find((a) => a.attempt_id === r.id);
  const [appeal, setAppeal] = useState<R | null>(null);
  const list = (data ?? []).filter((r) => tab === 'all' || (tab === 'appeals' ? appealOf(r)?.status === 'pending' : r.status === tab));
  const confirmLevel = async () => {
    if (!open || !lvl) return toast.err('Choose the final level.');
    const { error } = await supabase.from('placement_attempts').update({ final_level_id: Number(lvl), review_note: note || null, status: 'reviewed', reviewer_id: user.id }).eq('id', open.id);
    if (error) return toast.err(error.message);
    await notify(open.student_id, 'Your English level is confirmed', `${levels.data?.find((l) => String(l.id) === lvl)?.name}${note ? ` — ${note}` : ''}`, '/student/assessments');
    toast.ok('Level confirmed'); setOpen(null); reload();
  };
  const retake = async (r: R) => {
    if (!await askConfirm(`Allow ${r.student?.full_name} to retake? Their current attempt will be deleted.`)) return;
    const { error } = await supabase.from('placement_attempts').delete().eq('id', r.id);
    if (error) toast.err(error.message); else reload();
  };
  return (
    <Page wide>
      {user.demo && <DemoNotice />}
      <PageHero badge="Placement" badgeColor="indigo" title="Placement Results" illus="results" subtitle="Auto-graded placement tests. Confirm or adjust each student's level; the student is notified.">
        <div className="inline-flex bg-slate-50 p-1 rounded-xl border border-slate-200">{['submitted', 'reviewed', 'appeals', 'all'].map((t) => <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-xs font-bold capitalize ${tab === t ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>{t === 'submitted' ? 'To review' : t}</button>)}</div>
      </PageHero>
      {loading ? <Spinner /> : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[860px]"><thead className="bg-slate-50 text-[11px] font-extrabold uppercase text-slate-500"><tr><th className="px-4 py-3">Student</th><th className="px-3 py-3">Test</th><th className="px-3 py-3">Score</th><th className="px-3 py-3">Sections</th><th className="px-3 py-3">Level</th><th className="px-3 py-3 text-right">Action</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{list.map((r) => (
              <tr key={r.id}><td className="px-4 py-3"><p className="font-bold">{r.student?.full_name}</p><p className="text-[11px] text-slate-400">{r.student?.email} · {fmtDateTime(r.submitted_at)}</p></td>
                <td className="px-3 py-3 text-xs">{r.test?.title}{r.late && <span className="ml-1 text-red-500 font-bold">(late)</span>}</td>
                <td className="px-3 py-3"><span className="font-black text-lg">{r.pct}%</span>{r.needs_marking && <span className="block text-[10px] font-bold text-amber-600 uppercase">Needs marking</span>}</td>
                <td className="px-3 py-3 text-[11px]">{r.section_scores && Object.entries(r.section_scores).map(([k, v]) => <span key={k} className="inline-block mr-2 capitalize">{k}: <b>{v.score}/{v.total}</b></span>)}</td>
                <td className="px-3 py-3">{r.final ? <span className="font-bold text-emerald-700">{r.final.name}</span> : <span className="text-slate-500">Suggested: <b>{r.suggested?.name ?? '—'}</b></span>}</td>
                <td className="px-3 py-3 text-right whitespace-nowrap"><button onClick={() => { setOpen(r); setLvl(String(r.final_level_id ?? r.suggested?.id ?? '')); setNote(r.review_note ?? ''); }} className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold">{r.status === 'reviewed' ? 'Edit' : 'Confirm'}</button>
                  <button title="Mark answers / interview" onClick={() => setMark(r)} className="ml-1 p-1.5 text-slate-400 hover:text-indigo-600"><PenLine size={15} /></button>
                  {appealOf(r) && <button onClick={() => setAppeal(r)} className={`ml-1 px-2 py-1 rounded-lg text-[10px] font-black uppercase ${appealOf(r)!.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>Appeal</button>}
                  <button title="Allow retake" onClick={() => retake(r)} className="ml-1 p-1.5 text-slate-400 hover:text-orange-500"><RotateCcw size={15} /></button></td></tr>
            ))}{!list.length && <tr><td colSpan={6} className="p-8 text-center text-slate-400 text-xs">Nothing here.</td></tr>}</tbody></table>
        </div>
      )}
      <Modal open={!!open} onClose={() => setOpen(null)} title={`Confirm level · ${open?.student?.full_name ?? ''}`}>
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Score {open?.pct}% · suggested <b>{open?.suggested?.name ?? '—'}</b></p>
          {open?.needs_marking && <p className="text-xs p-3 rounded-xl bg-amber-50 border border-amber-100 text-amber-800">Some written answers are not marked yet. Mark them first (pen icon) so the score and suggested level are complete.</p>}
          <Field label="Final level"><select className={inputCls} value={lvl} onChange={(e) => setLvl(e.target.value)}><option value="">— Select —</option>{(levels.data ?? []).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></Field>
          <Field label={open && lvl && open.suggested && String(open.suggested.id) !== lvl ? 'Reason for a different level than suggested (required)' : 'Note to student (optional)'}><textarea rows={3} className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Strong reading; practise past tenses." /></Field>
          <button onClick={confirmLevel} className={`${btnPrimary} w-full`}><Check size={16} /> Confirm Level</button>
        </div>
      </Modal>
      {appeal && appealOf(appeal) && <AppealModal r={appeal} a={appealOf(appeal)!} onClose={() => setAppeal(null)} onDone={() => { setAppeal(null); appeals.reload(); reload(); }} onChangeLevel={() => { const r = appeal; setAppeal(null); setOpen(r); setLvl(String(r.final_level_id ?? r.suggested?.id ?? '')); setNote(''); }} />}
      {mark && <MarkModal r={mark} onClose={() => setMark(null)} onDone={() => { setMark(null); reload(); }} />}
    </Page>
  );
}

/** Mark typed answers and record the interview; the server recalculates the score and suggested level. */
function MarkModal({ r, onClose, onDone }: { r: R; onClose: () => void; onDone: () => void }) {
  const qs = useData<Question[]>(() => supabase.from('placement_questions').select('*').eq('test_id', r.test_id).neq('qtype', 'mcq').order('sort_order').order('id'), [r.test_id]);
  const interview = r.test?.config !== 'written';
  const [m, setM] = useState<Record<string, string>>({});
  const [iv, setIv] = useState({ score: r.interview_score != null ? String(r.interview_score) : '', total: r.interview_total != null ? String(r.interview_total) : '', note: r.interview_note ?? '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => { setM(Object.fromEntries(Object.entries(r.manual_scores ?? {}).map(([k, v]) => [k, String(v)]))); }, [r]);
  const save = async () => {
    const manual: Record<string, number> = {};
    for (const q of qs.data ?? []) {
      const v = m[q.id]; if (v === undefined || v === '') continue;
      const n = Number(v); if (Number.isNaN(n) || n < 0 || n > q.points) return toast.err(`Marks for "${q.prompt.slice(0, 30)}…" must be between 0 and ${q.points}.`);
      manual[q.id] = n;
    }
    let isc: number | null = null, itot: number | null = null;
    if (interview && (iv.score !== '' || iv.total !== '')) {
      isc = Number(iv.score); itot = Number(iv.total);
      if (!(itot > 0) || Number.isNaN(isc) || isc < 0 || isc > itot) return toast.err('Interview score must be between 0 and the interview total.');
    }
    setBusy(true);
    const { error } = await supabase.rpc('mark_placement', { p_attempt: r.id, p_manual: manual, p_interview: isc, p_interview_total: itot, p_interview_note: iv.note });
    setBusy(false);
    if (error) toast.err(error.message); else { toast.ok('Marks saved — score updated'); onDone(); }
  };
  return (
    <Modal open onClose={onClose} title={`Mark · ${r.student?.full_name ?? ''}`} wide>
      {qs.loading ? <Spinner /> : (
        <div className="space-y-4">
          {!(qs.data ?? []).length && !interview && <p className="text-sm text-slate-400">This test has no written answers or interview to mark — it is graded automatically.</p>}
          {(qs.data ?? []).map((q) => (
            <div key={q.id} className="p-4 rounded-2xl border border-slate-100">
              {q.context && <p className="text-[11px] font-bold text-indigo-600">{q.context}</p>}
              <p className="font-semibold text-slate-800 text-sm">{q.prompt}</p>
              <p className="mt-2 p-3 rounded-xl bg-slate-50 text-sm whitespace-pre-line min-h-10">{String(r.answers?.[q.id] ?? '') || <span className="text-slate-400">No answer</span>}</p>
              <div className="flex items-center gap-2 mt-2"><span className="text-xs font-bold text-slate-500">Marks</span><input type="number" min={0} max={q.points} className={`${inputCls} w-24`} value={m[q.id] ?? ''} onChange={(e) => setM({ ...m, [q.id]: e.target.value })} /><span className="text-xs text-slate-400">/ {q.points}</span></div>
            </div>
          ))}
          {interview && (
            <div className="p-4 rounded-2xl border border-indigo-100 bg-indigo-50/40 space-y-3">
              <p className="text-xs font-black uppercase text-indigo-600">Interview</p>
              <div className="grid grid-cols-2 gap-3"><Field label="Score"><input type="number" className={inputCls} value={iv.score} onChange={(e) => setIv({ ...iv, score: e.target.value })} /></Field>
                <Field label="Out of"><input type="number" className={inputCls} value={iv.total} onChange={(e) => setIv({ ...iv, total: e.target.value })} placeholder="20" /></Field></div>
              <Field label="Interviewer notes"><textarea rows={2} className={inputCls} value={iv.note} onChange={(e) => setIv({ ...iv, note: e.target.value })} /></Field>
            </div>
          )}
          <button disabled={busy} onClick={save} className={`${btnPrimary} w-full`}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save Marks</button>
        </div>
      )}
    </Modal>
  );
}

function AppealModal({ r, a, onClose, onDone, onChangeLevel }: { r: { id: number; student?: { full_name: string } | null; final?: { name: string } | null }; a: { id: number; reason: string; status: string; response: string | null }; onClose: () => void; onDone: () => void; onChangeLevel: () => void }) {
  const [resp, setResp] = useState(a.response ?? '');
  const [busy, setBusy] = useState(false);
  const decide = async (status: 'accepted' | 'rejected') => {
    if (!resp.trim()) return toast.err('Write your answer to the student.');
    setBusy(true);
    const { error } = await supabase.from('placement_appeals').update({ status, response: resp.trim() }).eq('id', a.id);
    setBusy(false);
    if (error) toast.err(error.message); else { toast.ok('The student was notified'); onDone(); }
  };
  return (
    <Modal open onClose={onClose} title={`Appeal · ${r.student?.full_name ?? ''}`}>
      <div className="space-y-4">
        <p className="text-sm text-slate-500">Current level: <b>{r.final?.name ?? '—'}</b></p>
        <p className="p-4 rounded-2xl bg-amber-50 border border-amber-100 text-sm whitespace-pre-line">{a.reason}</p>
        {a.status === 'pending' ? <>
          <Field label="Answer to the student"><textarea rows={3} className={inputCls} value={resp} onChange={(e) => setResp(e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <button disabled={busy} onClick={() => decide('rejected')} className="py-2.5 rounded-xl border border-slate-200 text-sm font-bold">Keep the level</button>
            <button disabled={busy} onClick={() => decide('accepted')} className={btnPrimary}>Accept appeal</button>
          </div>
          <button onClick={onChangeLevel} className="text-xs font-bold text-indigo-600">Change the level first →</button>
        </> : <p className="text-sm"><b className="capitalize">{a.status}</b>: {a.response}</p>}
      </div>
    </Modal>
  );
}
