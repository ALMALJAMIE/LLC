import { useMemo, useState } from 'react';
import { CalendarClock, CheckCircle2, ClipboardList, Download, FileText, Loader2, Paperclip, Plus, Save, Send, SquarePen, Trash2, Upload } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { isAcademicLead } from '../../lib/nav';
import { supabase } from '../../lib/supabase';
import { fmtDateTime, useData } from '../../lib/db';
import { uploadMedia } from '../../lib/media';
import { usePlacementDone } from '../../lib/placement';
import { DemoNotice, Field, Modal, Page, PageHero, Spinner, StatusPill, btnAccent, btnGhost, btnPrimary, inputCls, toast } from '../../components/ui';
import { askConfirm } from '../../components/dialogs';
import PlacementRequired from '../../components/PlacementRequired';
import { notify } from '../admin/AdminEnrollments';

type Assignment = { id: number; batch_id: number; title: string; instructions: string | null; attachment_url: string | null; due_at: string | null; max_points: number; created_at: string; batch?: { name: string; course: { title: string } | null } | null };
type Sub = { id: number; assignment_id: number; student_id: string; body: string | null; file_path: string | null; status: string; score: number | null; feedback: string | null; submitted_at: string; graded_at: string | null };

const toLocal = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');
const overdue = (a: Assignment) => !!a.due_at && new Date(a.due_at) < new Date();
async function openFile(path: string) {
  const { data, error } = await supabase.storage.from('uploads').createSignedUrl(path, 600);
  if (error) return toast.err(error.message);
  window.open(data.signedUrl, '_blank');
}

// ---------------------------------------------------------------- staff
export function StaffHomework() {
  const user = useAuth((s) => s.user)!;
  const lead = isAcademicLead(user.role);
  const batches = useData<{ id: number; name: string; course: { title: string } | null }[]>(() => {
    const q = supabase.from('batches').select('id,name, course:courses(title)').in('status', ['upcoming', 'active']).order('name');
    return lead ? q : q.eq('instructor_id', user.id);
  });
  const [bid, setBid] = useState<number | null>(null);
  const batch = bid ?? batches.data?.[0]?.id ?? null;
  const list = useData<Assignment[]>(() => supabase.from('assignments').select('*').eq('batch_id', batch ?? 0).order('due_at', { ascending: false, nullsFirst: true }), [batch]);
  const students = useData<{ student: { id: string; full_name: string; student_no: string | null } | null }[]>(() => supabase.from('enrollments').select('student:profiles!enrollments_student_id_fkey(id,full_name,student_no)').eq('batch_id', batch ?? 0).eq('status', 'active'), [batch]);
  const subs = useData<Sub[]>(() => supabase.from('assignment_submissions').select('*, assignment:assignments!inner(batch_id)').eq('assignment.batch_id', batch ?? 0), [batch]);
  const [edit, setEdit] = useState<Partial<Assignment> | null>(null);
  const [open, setOpen] = useState<Assignment | null>(null);
  const del = async (a: Assignment) => {
    if (!(await askConfirm(`Delete "${a.title}" and all its submissions?`))) return;
    const { error } = await supabase.from('assignments').delete().eq('id', a.id); if (error) toast.err(error.message); else list.reload();
  };
  const roster = (students.data ?? []).map((s) => s.student).filter(Boolean) as { id: string; full_name: string; student_no: string | null }[];
  return (
    <Page wide>
      {user.demo && <DemoNotice />}
      <PageHero badge="Teaching" badgeColor="indigo" title="Homework" illus="grading" subtitle="Give homework to a batch, collect the students' work and send back marks and feedback. Students are notified when you post it.">
        <div className="flex flex-wrap gap-2">
          <select value={batch ?? ''} onChange={(e) => setBid(Number(e.target.value))} className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold min-w-64">
            {!(batches.data ?? []).length && <option value="">No batches</option>}
            {(batches.data ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}{b.course ? ` · ${b.course.title}` : ''}</option>)}
          </select>
          {batch && <button onClick={() => setEdit({ batch_id: batch, max_points: 10 })} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-orange-500 text-white text-sm font-bold"><Plus size={16} /> New Homework</button>}
        </div>
      </PageHero>
      {list.loading ? <Spinner /> : !batch ? <p className="text-center text-slate-400 py-12">No batches assigned to you yet.</p> : !(list.data ?? []).length ? <p className="text-center text-slate-400 py-12">No homework for this batch yet.</p> : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">{(list.data ?? []).map((a) => {
          const s = (subs.data ?? []).filter((x) => x.assignment_id === a.id);
          const toGrade = s.filter((x) => x.status === 'submitted').length;
          return (
            <div key={a.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 flex flex-col">
              <div className="flex items-start gap-2"><h3 className="flex-1 text-lg font-bold text-slate-900">{a.title}</h3>
                <button onClick={() => setEdit(a)} className="p-1.5 text-slate-400 hover:text-blue-600"><SquarePen size={16} /></button><button onClick={() => del(a)} className="p-1.5 text-slate-400 hover:text-red-500"><Trash2 size={16} /></button></div>
              <p className={`text-xs font-bold flex items-center gap-1 mt-1 ${overdue(a) ? 'text-red-500' : 'text-slate-500'}`}><CalendarClock size={13} />{a.due_at ? `Due ${fmtDateTime(a.due_at)}` : 'No due date'} · {a.max_points} marks</p>
              {a.instructions && <p className="text-sm text-slate-500 mt-2 line-clamp-3 flex-1 whitespace-pre-line">{a.instructions}</p>}
              <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                <div className="p-2 rounded-xl bg-slate-50"><p className="text-lg font-black">{s.length}/{roster.length}</p><p className="text-[10px] font-bold uppercase text-slate-400">Handed in</p></div>
                <div className="p-2 rounded-xl bg-amber-50"><p className="text-lg font-black text-amber-700">{toGrade}</p><p className="text-[10px] font-bold uppercase text-amber-600">To mark</p></div>
                <div className="p-2 rounded-xl bg-emerald-50"><p className="text-lg font-black text-emerald-700">{s.length - toGrade}</p><p className="text-[10px] font-bold uppercase text-emerald-600">Marked</p></div>
              </div>
              <button onClick={() => setOpen(a)} className="mt-4 py-2.5 rounded-xl bg-slate-900 hover:bg-orange-500 text-white text-xs font-bold">View Submissions</button>
            </div>
          );
        })}</div>
      )}
      {edit && <AssignmentForm a={edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); list.reload(); }} />}
      {open && <Submissions a={open} roster={roster} subs={(subs.data ?? []).filter((x) => x.assignment_id === open.id)} onClose={() => setOpen(null)} onChanged={subs.reload} />}
    </Page>
  );
}

function AssignmentForm({ a, onClose, onDone }: { a: Partial<Assignment>; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ title: a.title ?? '', instructions: a.instructions ?? '', attachment_url: a.attachment_url ?? '', due_at: toLocal(a.due_at ?? null), max_points: String(a.max_points ?? 10) });
  const [busy, setBusy] = useState(false);
  const [up, setUp] = useState(false);
  const upload = async (file?: File) => {
    if (!file) return; setUp(true);
    const r = await uploadMedia(file, `homework/${a.batch_id}`); setUp(false);
    if (r.error) toast.err(r.error); else setF((p) => ({ ...p, attachment_url: r.url! }));
  };
  const save = async () => {
    if (f.title.trim().length < 2) return toast.err('Title is required');
    if (!(Number(f.max_points) > 0)) return toast.err('Marks must be more than 0.');
    setBusy(true);
    const row = { batch_id: a.batch_id, title: f.title.trim(), instructions: f.instructions.trim() || null, attachment_url: f.attachment_url || null, due_at: f.due_at ? new Date(f.due_at).toISOString() : null, max_points: Number(f.max_points) };
    const { error } = a.id ? await supabase.from('assignments').update(row).eq('id', a.id) : await supabase.from('assignments').insert(row);
    setBusy(false);
    if (error) toast.err(error.message); else { toast.ok(a.id ? 'Homework updated' : 'Homework posted — students were notified'); onDone(); }
  };
  return (
    <Modal open onClose={onClose} title={a.id ? 'Edit Homework' : 'New Homework'} wide>
      <div className="space-y-4">
        <Field label="Title"><input className={inputCls} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Write about your weekend (80 words)" /></Field>
        <Field label="Instructions"><textarea rows={5} className={inputCls} value={f.instructions} onChange={(e) => setF({ ...f, instructions: e.target.value })} /></Field>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Due date (optional)"><input type="datetime-local" className={inputCls} value={f.due_at} onChange={(e) => setF({ ...f, due_at: e.target.value })} /></Field>
          <Field label="Out of (marks)"><input type="number" className={inputCls} value={f.max_points} onChange={(e) => setF({ ...f, max_points: e.target.value })} /></Field>
        </div>
        <Field label="Worksheet / attachment (optional)">
          <div className="flex gap-2"><input className={inputCls} value={f.attachment_url} onChange={(e) => setF({ ...f, attachment_url: e.target.value })} placeholder="Paste a link or upload →" />
            <label className={`${btnGhost} cursor-pointer whitespace-nowrap`}>{up ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} Upload<input type="file" className="hidden" onChange={(e) => upload(e.target.files?.[0])} /></label></div>
        </Field>
        <button disabled={busy || up} onClick={save} className={`${btnPrimary} w-full`}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {a.id ? 'Save Changes' : 'Post Homework'}</button>
      </div>
    </Modal>
  );
}

function Submissions({ a, roster, subs, onClose, onChanged }: { a: Assignment; roster: { id: string; full_name: string; student_no: string | null }[]; subs: Sub[]; onClose: () => void; onChanged: () => void }) {
  const [grade, setGrade] = useState<{ s: Sub; name: string } | null>(null);
  return (
    <Modal open onClose={onClose} title={`Submissions · ${a.title}`} wide>
      <div className="divide-y divide-slate-100">
        {roster.map((st) => {
          const s = subs.find((x) => x.student_id === st.id);
          return (
            <div key={st.id} className="py-3 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-40"><p className="font-bold text-slate-800">{st.full_name}</p><p className="text-[11px] text-slate-400">{st.student_no ?? ''}{s ? ` · handed in ${fmtDateTime(s.submitted_at)}` : ''}{s && a.due_at && new Date(s.submitted_at) > new Date(a.due_at) ? ' · late' : ''}</p></div>
              {!s ? <span className="text-xs font-bold text-slate-400">Not handed in</span> : <>
                {s.score != null && <span className="font-black">{s.score}/{a.max_points}</span>}
                <StatusPill status={s.status} />
                <button onClick={() => setGrade({ s, name: st.full_name })} className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold">{s.status === 'graded' ? 'Edit mark' : 'Mark'}</button>
              </>}
            </div>
          );
        })}
        {!roster.length && <p className="py-6 text-center text-slate-400 text-sm">No active students in this batch.</p>}
      </div>
      {grade && <GradeModal a={a} s={grade.s} name={grade.name} onClose={() => setGrade(null)} onDone={() => { setGrade(null); onChanged(); }} />}
    </Modal>
  );
}

function GradeModal({ a, s, name, onClose, onDone }: { a: Assignment; s: Sub; name: string; onClose: () => void; onDone: () => void }) {
  const [score, setScore] = useState(s.score != null ? String(s.score) : '');
  const [fb, setFb] = useState(s.feedback ?? '');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const n = Number(score);
    if (score === '' || Number.isNaN(n) || n < 0 || n > Number(a.max_points)) return toast.err(`Marks must be between 0 and ${a.max_points}.`);
    setBusy(true);
    const { error } = await supabase.from('assignment_submissions').update({ status: 'graded', score: n, feedback: fb.trim() || null }).eq('id', s.id);
    if (!error) await notify(s.student_id, 'Your homework was marked', `${a.title}: ${n}/${a.max_points}`, '/student/assignments');
    setBusy(false);
    if (error) toast.err(error.message); else { toast.ok('Mark sent to the student'); onDone(); }
  };
  return (
    <Modal open onClose={onClose} title={`${name} · ${a.title}`} wide>
      <div className="space-y-4">
        {s.body && <div className="p-4 rounded-2xl bg-slate-50 text-sm whitespace-pre-line max-h-80 overflow-y-auto">{s.body}</div>}
        {s.file_path && <button onClick={() => openFile(s.file_path!)} className={btnGhost}><Paperclip size={16} /> Open attached file</button>}
        <div className="grid sm:grid-cols-4 gap-3">
          <Field label={`Marks (out of ${a.max_points})`}><input type="number" className={inputCls} value={score} onChange={(e) => setScore(e.target.value)} /></Field>
          <div className="sm:col-span-3"><Field label="Feedback for the student"><textarea rows={4} className={inputCls} value={fb} onChange={(e) => setFb(e.target.value)} /></Field></div>
        </div>
        <button disabled={busy} onClick={save} className={`${btnPrimary} w-full`}>{busy ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Save Mark</button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- student
export function StudentHomework() {
  const user = useAuth((s) => s.user)!;
  const placed = usePlacementDone();
  const list = useData<Assignment[]>(() => supabase.from('assignments').select('*, batch:batches(name, course:courses(title))').order('due_at', { ascending: true, nullsFirst: false }));
  const subs = useData<Sub[]>(() => supabase.from('assignment_submissions').select('*').eq('student_id', user.id));
  const [tab, setTab] = useState<'todo' | 'done'>('todo');
  const [open, setOpen] = useState<Assignment | null>(null);
  const items = useMemo(() => (list.data ?? []).map((a) => ({ a, s: (subs.data ?? []).find((x) => x.assignment_id === a.id) })), [list.data, subs.data]);
  const shown = items.filter(({ s }) => (tab === 'todo' ? !s : !!s));
  return (
    <Page>
      {user.demo && <DemoNotice />}
      <PageHero badge="Learning" badgeColor="indigo" title="My Homework" illus="exam" subtitle="Homework from your teachers. Hand it in before the due date and see your marks and feedback here.">
        <div className="inline-flex bg-slate-50 p-1 rounded-xl border border-slate-200">
          <button onClick={() => setTab('todo')} className={`px-4 py-2 rounded-lg text-xs font-bold ${tab === 'todo' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>To do ({items.filter((x) => !x.s).length})</button>
          <button onClick={() => setTab('done')} className={`px-4 py-2 rounded-lg text-xs font-bold ${tab === 'done' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>Handed in ({items.filter((x) => x.s).length})</button>
        </div>
      </PageHero>
      {placed === false ? <PlacementRequired /> : list.loading ? <Spinner /> : !shown.length ? <p className="text-center text-slate-400 py-12">{tab === 'todo' ? 'No homework to do. Well done!' : 'Nothing handed in yet.'}</p> : (
        <div className="space-y-3">{shown.map(({ a, s }) => (
          <button key={a.id} onClick={() => setOpen(a)} className="w-full text-left bg-white rounded-3xl border border-slate-100 shadow-sm p-5 flex flex-wrap items-center gap-4 hover:border-orange-200">
            <span className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 grid place-items-center"><ClipboardList size={22} /></span>
            <div className="flex-1 min-w-48"><p className="font-bold text-slate-900">{a.title}</p><p className="text-xs text-slate-500">{a.batch?.course?.title ?? a.batch?.name}</p></div>
            <p className={`text-xs font-bold ${!s && overdue(a) ? 'text-red-500' : 'text-slate-500'}`}>{a.due_at ? `Due ${fmtDateTime(a.due_at)}` : 'No due date'}</p>
            {s ? (s.status === 'graded' ? <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-sm font-black">{s.score}/{a.max_points}</span> : <StatusPill status="submitted" />) : overdue(a) ? <span className="text-[10px] font-black uppercase text-red-500">Late</span> : null}
          </button>
        ))}</div>
      )}
      {open && <SubmitModal a={open} s={(subs.data ?? []).find((x) => x.assignment_id === open.id)} onClose={() => setOpen(null)} onDone={() => { setOpen(null); subs.reload(); }} />}
    </Page>
  );
}

function SubmitModal({ a, s, onClose, onDone }: { a: Assignment; s?: Sub; onClose: () => void; onDone: () => void }) {
  const user = useAuth((x) => x.user)!;
  const [body, setBody] = useState(s?.body ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const graded = s?.status === 'graded';
  const submit = async () => {
    if (user.demo) return toast.err('Sign in with a real account to submit.');
    if (!body.trim() && !file && !s?.file_path) return toast.err('Write your answer or attach a file.');
    if (file && file.size > 20 * 1024 * 1024) return toast.err('The file is larger than 20 MB.');
    setBusy(true);
    let file_path = s?.file_path ?? null;
    if (file) {
      file_path = `${user.id}/homework/${a.id}-${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`;
      const up = await supabase.storage.from('uploads').upload(file_path, file);
      if (up.error) { setBusy(false); return toast.err(up.error.message); }
    }
    const row = { assignment_id: a.id, student_id: user.id, body: body.trim() || null, file_path };
    const { error } = s ? await supabase.from('assignment_submissions').update(row).eq('id', s.id) : await supabase.from('assignment_submissions').insert(row);
    setBusy(false);
    if (error) toast.err(error.message); else { toast.ok('Homework handed in'); onDone(); }
  };
  return (
    <Modal open onClose={onClose} title={a.title} wide>
      <div className="space-y-4">
        <p className={`text-xs font-bold ${overdue(a) && !s ? 'text-red-500' : 'text-slate-500'}`}>{a.due_at ? `Due ${fmtDateTime(a.due_at)}` : 'No due date'} · out of {a.max_points}</p>
        {a.instructions && <p className="text-sm text-slate-700 whitespace-pre-line p-4 rounded-2xl bg-slate-50">{a.instructions}</p>}
        {a.attachment_url && <a href={a.attachment_url} target="_blank" rel="noreferrer" className={btnGhost}><Download size={16} /> Worksheet</a>}
        {graded && <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100"><p className="font-black text-emerald-800">Your mark: {s!.score}/{a.max_points}</p>{s!.feedback && <p className="text-sm text-slate-700 mt-1 whitespace-pre-line">{s!.feedback}</p>}</div>}
        <Field label="Your answer"><textarea rows={8} disabled={graded} className={inputCls} value={body} onChange={(e) => setBody(e.target.value)} /></Field>
        {s?.file_path && <button onClick={() => openFile(s.file_path!)} className="text-sm font-bold text-indigo-600 flex items-center gap-1"><FileText size={15} /> Your attached file</button>}
        {!graded && <>
          <label className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-slate-300 bg-white cursor-pointer hover:border-orange-400 text-sm text-slate-600">
            <Paperclip size={18} className="text-slate-400" /> {file ? file.name : s?.file_path ? 'Replace the attached file (optional)' : 'Attach a file (optional): photo of your work, PDF or Word'}
            <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <button disabled={busy} onClick={submit} className={`${btnAccent} w-full`}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} {s ? 'Hand in again' : 'Hand in'}</button>
        </>}
      </div>
    </Modal>
  );
}
