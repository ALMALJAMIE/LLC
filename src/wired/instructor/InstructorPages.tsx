import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { Check, ChevronDown, ChevronUp, Clock, Globe, Loader2, Mail, MapPin, MessageCircle, Plus, QrCode, Send, Trash2, Users, Video } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { fmtDate, fmtDateTime, useData } from '../../lib/db';
import { gradeOf, useScale } from '../../lib/grading';
import { DemoNotice, Field, Modal, Page, PageHero, Spinner, StatusPill, btnPrimary, inputCls, toast } from '../../components/ui';
import { notify } from '../admin/AdminEnrollments';
import { useRoster, useTeaching, type Roster, type TBatch } from './hooks';

const hm = (s: string) => new Date(s).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
type Sess = { id: number; batch_id: number; title: string; starts_at: string; ends_at: string; mode: string; room: string | null; meeting_url: string | null; qr_token: string | null; substitute_id?: string | null; batch?: { name: string } | null };

// ---------------- My Batches ----------------
export function InstructorBatches() {
  const user = useAuth((s) => s.user);
  const batches = useTeaching(['upcoming', 'active', 'completed']);
  const roster = useRoster((batches.data ?? []).map((b) => b.id));
  const [open, setOpen] = useState<number | null>(null);
  return (
    <Page>
      {user?.demo && <DemoNotice />}
      <PageHero badge="Instructor Portal" badgeColor="indigo" title="My Batches" illus="my_batches" subtitle="Your assigned classes and the students enrolled in each one." />
      {batches.loading ? <Spinner /> : !batches.data?.length ? <p className="text-center text-slate-400 py-16">No batches assigned to you yet.</p> : (
        <div className="space-y-5">
          {batches.data.map((b) => {
            const list = (roster.data ?? []).filter((r) => r.batch_id === b.id);
            const isOpen = open === b.id;
            return (
              <div key={b.id} className="bg-white rounded-4xl border border-slate-100 shadow-sm overflow-hidden">
                <button onClick={() => setOpen(isOpen ? null : b.id)} className="w-full p-6 flex flex-wrap items-center gap-4 text-left">
                  <span className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 grid place-items-center"><Users size={22} /></span>
                  <div className="flex-1 min-w-48"><p className="text-[10px] font-black uppercase text-slate-400">{b.code} · {b.course?.title}</p><p className="text-lg font-extrabold text-slate-900">{b.name}</p><p className="text-xs text-slate-500">{fmtDate(b.start_date)} – {fmtDate(b.end_date)} · {b.mode.replace(/_/g, ' ')}</p></div>
                  <StatusPill status={b.status} />
                  <span className="text-sm font-black text-slate-700">{list.length}/{b.capacity}</span>
                  {isOpen ? <ChevronUp className="text-slate-400" /> : <ChevronDown className="text-slate-400" />}
                </button>
                {isOpen && (
                  <div className="border-t border-slate-100">
                    {!list.length ? <p className="p-6 text-sm text-slate-400">No active students yet.</p> : list.map((r) => (
                      <div key={r.id} className="flex flex-wrap items-center gap-3 px-6 py-3 border-b border-slate-50 last:border-0">
                        <span className="w-9 h-9 rounded-full bg-slate-100 grid place-items-center font-bold text-slate-500">{r.student?.full_name?.[0]}</span>
                        <div className="flex-1 min-w-40"><p className="font-bold text-sm text-slate-800">{r.student?.full_name}</p><p className="text-[11px] font-mono text-slate-400">{r.student?.student_no}</p></div>
                        <a href={`mailto:${r.student?.email}`} className="p-2 rounded-lg text-slate-400 hover:text-indigo-600"><Mail size={16} /></a>
                        {r.student?.phone && <a href={`https://wa.me/${r.student.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="p-2 rounded-lg text-slate-400 hover:text-emerald-600"><MessageCircle size={16} /></a>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Page>
  );
}

// ---------------- My Timetable (read-only week view) ----------------
export function InstructorTimetable() {
  const user = useAuth((s) => s.user);
  const batches = useTeaching();
  const ids = (batches.data ?? []).map((b) => b.id);
  const { data, loading } = useData<Sess[]>(() => supabase.from('class_sessions').select('*, batch:batches(name)').or(`batch_id.in.(${ids.length ? ids.join(',') : 0}),substitute_id.eq.${user?.id}`).gte('ends_at', new Date().toISOString()).order('starts_at').limit(120), [ids.join(',')]);
  const subs = useData<{ session_id: number; status: string }[]>(() => supabase.from('substitute_requests').select('session_id,status').eq('requested_by', user?.id ?? ''));
  const [cover, setCover] = useState<Sess | null>(null);
  const subOf = (id: number) => subs.data?.find((r) => r.session_id === id)?.status;
  const days = useMemo(() => {
    const m = new Map<string, Sess[]>();
    (data ?? []).forEach((s) => { const k = new Date(s.starts_at).toDateString(); m.set(k, [...(m.get(k) ?? []), s]); });
    return [...m.entries()];
  }, [data]);
  return (
    <Page>
      {user?.demo && <DemoNotice />}
      <PageHero badge="Schedule" badgeColor="indigo" title="My Timetable" illus="calendar" subtitle="Your upcoming classes across all batches, day by day." />
      {loading ? <Spinner /> : !days.length ? <p className="text-center text-slate-400 py-16">No upcoming classes. Create them from “Schedule Classes”.</p> : (
        <div className="space-y-6">{days.map(([d, list]) => (
          <div key={d}>
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-500 mb-3">{new Date(d).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{list.map((s) => (
              <div key={s.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5">
                <p className="text-xs font-black text-slate-500 flex items-center gap-1"><Clock size={12} />{hm(s.starts_at)} – {hm(s.ends_at)}</p>
                <p className="font-extrabold text-slate-900 mt-1">{s.title}</p>
                <p className="text-xs text-slate-500 truncate">{s.batch?.name}</p>
                <p className={`text-[10px] font-bold uppercase mt-2 flex items-center gap-1 ${s.mode === 'online' ? 'text-sky-600' : 'text-orange-600'}`}>{s.mode === 'online' ? <><Globe size={12} />Online</> : <><MapPin size={12} />{s.room ?? 'On campus'}</>}</p>
                {s.substitute_id === user?.id && <p className="mt-2 text-[10px] font-black uppercase text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full w-fit">You are covering</p>}
                <div className="mt-3 flex items-center gap-3">
                  {s.meeting_url && <a href={s.meeting_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600"><Video size={12} />Start meeting</a>}
                  {s.substitute_id !== user?.id && (subOf(s.id) ? <span className="ml-auto text-[10px] font-black uppercase text-slate-500">Cover {subOf(s.id)}</span>
                    : <button disabled={user?.demo} onClick={() => setCover(s)} className="ml-auto text-xs font-bold text-slate-400 hover:text-orange-600">Request cover</button>)}
                </div>
              </div>
            ))}</div>
          </div>
        ))}</div>
      )}
      {cover && <CoverRequest s={cover} onClose={() => setCover(null)} onDone={() => { setCover(null); subs.reload(); }} />}
    </Page>
  );
}

function CoverRequest({ s, onClose, onDone }: { s: Sess; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!reason.trim()) return toast.err('Please write the reason.');
    setBusy(true);
    const { error } = await supabase.from('substitute_requests').insert({ session_id: s.id, reason: reason.trim() });
    setBusy(false);
    if (error) toast.err(error.message); else { toast.ok('Request sent to the admin'); onDone(); }
  };
  return (
    <Modal open onClose={onClose} title="Request a substitute">
      <div className="space-y-4">
        <p className="text-sm text-slate-600"><b>{s.title}</b> · {s.batch?.name}<br />{new Date(s.starts_at).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
        <Field label="Reason"><textarea rows={3} className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Medical appointment" /></Field>
        <button disabled={busy} onClick={send} className={`${btnPrimary} w-full`}>{busy && <Loader2 size={16} className="animate-spin" />}Send request</button>
      </div>
    </Modal>
  );
}

// ---------------- Live attendance (QR) ----------------
export function InstructorLiveAttendance() {
  const user = useAuth((s) => s.user);
  const batches = useTeaching();
  const ids = (batches.data ?? []).map((b) => b.id);
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  const sessions = useData<Sess[]>(() => supabase.from('class_sessions').select('*, batch:batches(name)').or(`batch_id.in.(${ids.length ? ids.join(',') : 0}),substitute_id.eq.${user?.id}`).gte('starts_at', start.toISOString()).lt('starts_at', end.toISOString()).order('starts_at'), [ids.join(',')]);
  const [open, setOpen] = useState<Sess | null>(null);
  return (
    <Page>
      {user?.demo && <DemoNotice />}
      <PageHero badge="Face to Face Classes" badgeColor="indigo" title="Live Attendance" illus="attendance" subtitle="Open today's class, show the QR code on the screen, and watch students check in. You can also mark attendance by hand." />
      {sessions.loading ? <Spinner /> : !sessions.data?.length ? <p className="text-center text-slate-400 py-16">No classes scheduled for today.</p> : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">{sessions.data.map((s) => (
          <button key={s.id} onClick={() => setOpen(s)} className="text-left bg-white rounded-3xl border border-slate-100 shadow-sm p-6 hover:shadow-lg transition-all">
            <p className="text-[10px] font-black uppercase text-indigo-600 truncate">{s.batch?.name}</p>
            <p className="text-lg font-extrabold text-slate-900">{s.title}</p>
            <p className="text-sm text-slate-500">{hm(s.starts_at)} – {hm(s.ends_at)} · {s.mode === 'online' ? 'Online' : s.room ?? 'On campus'}</p>
            <span className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"><QrCode size={14} />Open attendance</span>
          </button>
        ))}</div>
      )}
      {open && <AttendanceSheet s={open} onClose={() => setOpen(null)} />}
    </Page>
  );
}

function AttendanceSheet({ s, onClose }: { s: Sess; onClose: () => void }) {
  const roster = useRoster([s.batch_id]);
  const att = useData<{ student_id: string; status: string }[]>(() => supabase.from('attendance').select('student_id,status').eq('session_id', s.id));
  const [img, setImg] = useState('');
  const url = `${location.origin}${import.meta.env.BASE_URL}student/live-attendance?code=${s.qr_token}`;
  useEffect(() => { QRCode.toDataURL(url, { width: 480, margin: 1, color: { dark: '#0b1a3a' } }).then(setImg); }, [url]);
  useEffect(() => { const t = setInterval(att.reload, 8000); return () => clearInterval(t); }, [att.reload]);
  const mark = async (sid: string, status: string) => {
    const { error } = await supabase.from('attendance').upsert({ session_id: s.id, student_id: sid, status }, { onConflict: 'session_id,student_id' });
    if (error) toast.err(error.message); else att.reload();
  };
  const present = (att.data ?? []).filter((a) => a.status !== 'absent').length;
  return (
    <Modal open onClose={onClose} title={`${s.title} · ${hm(s.starts_at)}`} wide>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="text-center">
          {img && <img src={img} alt="QR" className="mx-auto w-60 h-60 rounded-2xl border border-slate-100" />}
          <p className="text-3xl font-black tracking-[0.3em] font-mono mt-3">{s.qr_token}</p>
          <p className="text-xs text-slate-400 mt-2">Students scan or type this code. It works from 15 min before the class until it ends.</p>
          <p className="mt-4 text-sm font-bold text-emerald-600">{present} / {roster.data?.length ?? 0} checked in</p>
        </div>
        <div className="max-h-96 overflow-y-auto custom-scrollbar divide-y divide-slate-100 border border-slate-100 rounded-2xl">
          {(roster.data ?? []).map((r: Roster) => {
            const st = att.data?.find((a) => a.student_id === r.student?.id)?.status;
            return (
              <div key={r.id} className="flex items-center gap-2 px-3 py-2.5">
                <span className="flex-1 text-sm font-semibold text-slate-700 truncate">{r.student?.full_name}</span>
                {['present', 'late', 'absent', 'excused'].map((k) => (
                  <button key={k} onClick={() => mark(r.student!.id, k)} className={`px-2 py-1 rounded-md text-[10px] font-black uppercase ${st === k ? { present: 'bg-emerald-500 text-white', late: 'bg-amber-500 text-white', absent: 'bg-red-500 text-white', excused: 'bg-sky-500 text-white' }[k] : 'bg-slate-100 text-slate-400'}`}>{k[0]}</button>
                ))}
              </div>
            );
          })}
          {!roster.data?.length && <p className="p-6 text-center text-sm text-slate-400">No students in this batch.</p>}
        </div>
      </div>
    </Modal>
  );
}

// ---------------- Manage exams ----------------
type Exam = { id: number; title: string; kind: string; starts_at: string | null; duration_min: number; total_marks: number; status: string; batch_id: number | null; batch: { name: string } | null };
export function InstructorExams() {
  const user = useAuth((s) => s.user);
  const batches = useTeaching(['upcoming', 'active', 'completed']);
  const ids = (batches.data ?? []).map((b) => b.id);
  const { data, loading, reload } = useData<Exam[]>(() => supabase.from('exams').select('*, batch:batches(name)').in('batch_id', ids.length ? ids : [0]).order('starts_at', { ascending: false }), [ids.join(',')]);
  const [edit, setEdit] = useState<Partial<Exam> | null>(null);
  const del = async (x: Exam) => { if (!confirm(`Delete "${x.title}" and its results?`)) return; const { error } = await supabase.from('exams').delete().eq('id', x.id); if (error) toast.err(error.message); else reload(); };
  return (
    <Page>
      {user?.demo && <DemoNotice />}
      <PageHero badge="Assessments" title="Manage Exams" illus="exam" subtitle="Schedule quizzes, mid-terms and finals for your batches. Students see them in “My Exams”.">
        <button disabled={user?.demo} onClick={() => setEdit({ kind: 'quiz', duration_min: 60, total_marks: 100, status: 'scheduled' })} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-900 hover:bg-orange-500 text-white font-bold disabled:opacity-50"><Plus size={18} /> Create Exam</button>
      </PageHero>
      {loading ? <Spinner /> : !data?.length ? <p className="text-center text-slate-400 py-16">No exams yet.</p> : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">{data.map((x) => (
          <div key={x.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
            <div className="flex justify-between"><span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">{x.kind}</span><StatusPill status={x.status} /></div>
            <h3 className="text-lg font-extrabold text-slate-900 mt-3">{x.title}</h3>
            <p className="text-xs text-slate-500 truncate">{x.batch?.name}</p>
            <p className="text-xs text-slate-500 mt-2">{x.starts_at ? fmtDateTime(x.starts_at) : 'Date TBA'} · {x.duration_min} min · {x.total_marks} marks</p>
            <div className="flex justify-end gap-1 mt-4"><button onClick={() => setEdit(x)} className="px-3 py-1.5 rounded-lg bg-slate-100 text-xs font-bold">Edit</button><button onClick={() => del(x)} className="p-1.5 text-slate-300 hover:text-red-500"><Trash2 size={16} /></button></div>
          </div>
        ))}</div>
      )}
      {edit && <ExamForm exam={edit} batches={batches.data ?? []} onClose={() => setEdit(null)} onDone={() => { setEdit(null); reload(); }} />}
    </Page>
  );
}
function ExamForm({ exam, batches, onClose, onDone }: { exam: Partial<Exam>; batches: TBatch[]; onClose: () => void; onDone: () => void }) {
  const user = useAuth((s) => s.user)!;
  const [f, setF] = useState({ title: exam.title ?? '', kind: exam.kind ?? 'quiz', batch_id: exam.batch_id ? String(exam.batch_id) : '', starts_at: exam.starts_at ? new Date(new Date(exam.starts_at).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '', duration_min: String(exam.duration_min ?? 60), total_marks: String(exam.total_marks ?? 100), status: exam.status ?? 'scheduled' });
  const [busy, setBusy] = useState(false);
  const tpl = useData<{ id: number; name: string; kind: string; duration_min: number; total_marks: number }[]>(() => supabase.from('exam_templates').select('id,name,kind,duration_min,total_marks').order('name'));
  const applyTpl = (id: string) => { const t = tpl.data?.find((x) => String(x.id) === id); if (t) setF({ ...f, title: f.title || t.name, kind: t.kind, duration_min: String(t.duration_min), total_marks: String(t.total_marks) }); };
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    const b = batches.find((x) => String(x.id) === f.batch_id);
    const row = { title: f.title, kind: f.kind, batch_id: Number(f.batch_id), course_id: b?.course_id ?? null, starts_at: f.starts_at ? new Date(f.starts_at).toISOString() : null, duration_min: Number(f.duration_min), total_marks: Number(f.total_marks), status: f.status, created_by: user.id };
    const { error } = exam.id ? await supabase.from('exams').update(row).eq('id', exam.id) : await supabase.from('exams').insert(row);
    setBusy(false);
    if (error) toast.err(error.message); else { toast.ok('Exam saved'); onDone(); }
  };
  return (
    <Modal open onClose={onClose} title={exam.id ? 'Edit Exam' : 'Create Exam'}>
      <form onSubmit={save} className="grid grid-cols-2 gap-4">
        {!exam.id && !!tpl.data?.length && <div className="col-span-2"><Field label="Start from a template (optional)"><select className={inputCls} defaultValue="" onChange={(e) => applyTpl(e.target.value)}><option value="">— Blank exam —</option>{tpl.data.map((t) => <option key={t.id} value={t.id}>{t.name} · {t.kind} · {t.duration_min} min</option>)}</select></Field></div>}
        <div className="col-span-2"><Field label="Title"><input required className={inputCls} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field></div>
        <div className="col-span-2"><Field label="Batch"><select required className={inputCls} value={f.batch_id} onChange={(e) => setF({ ...f, batch_id: e.target.value })}><option value="">— Select —</option>{batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field></div>
        <Field label="Type"><select className={inputCls} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{['quiz', 'midterm', 'final'].map((k) => <option key={k}>{k}</option>)}</select></Field>
        <Field label="Status"><select className={inputCls} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{['draft', 'scheduled', 'open', 'closed'].map((k) => <option key={k}>{k}</option>)}</select></Field>
        <div className="col-span-2"><Field label="Date & time"><input type="datetime-local" className={inputCls} value={f.starts_at} onChange={(e) => setF({ ...f, starts_at: e.target.value })} /></Field></div>
        <Field label="Duration (min)"><input type="number" className={inputCls} value={f.duration_min} onChange={(e) => setF({ ...f, duration_min: e.target.value })} /></Field>
        <Field label="Total marks"><input type="number" className={inputCls} value={f.total_marks} onChange={(e) => setF({ ...f, total_marks: e.target.value })} /></Field>
        <button disabled={busy} className={`${btnPrimary} col-span-2`}>{busy && <Loader2 size={16} className="animate-spin" />} Save</button>
      </form>
    </Modal>
  );
}

// ---------------- Grading console ----------------
export function InstructorGrading() {
  const user = useAuth((s) => s.user);
  useEffect(() => { useScale.getState().load(); }, []);
  const batches = useTeaching(['active', 'completed']);
  const ids = (batches.data ?? []).map((b) => b.id);
  const exams = useData<Exam[]>(() => supabase.from('exams').select('*, batch:batches(name)').in('batch_id', ids.length ? ids : [0]).neq('status', 'draft').order('starts_at', { ascending: false }), [ids.join(',')]);
  const [open, setOpen] = useState<Exam | null>(null);
  return (
    <Page>
      {user?.demo && <DemoNotice />}
      <div className="bg-white rounded-4xl border border-slate-100 shadow-sm p-8 mb-8">
        <h1 className="text-4xl font-extrabold text-slate-900 mb-2 tracking-tight">Instructor Console</h1>
        <p className="text-slate-500 max-w-xl">Enter scores and feedback for each exam, then publish. Students see their results and grade instantly.</p>
      </div>
      {exams.loading ? <Spinner /> : !exams.data?.length ? <p className="text-center text-slate-400 py-16">No exams to grade yet.</p> : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">{exams.data.map((x) => (
          <button key={x.id} onClick={() => setOpen(x)} className="text-left bg-white rounded-3xl border border-slate-100 shadow-sm p-6 hover:shadow-lg transition-all">
            <div className="flex justify-between"><span className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 grid place-items-center"><Check size={18} /></span><span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full h-fit">Grade Exam</span></div>
            <p className="text-lg font-extrabold text-slate-900 mt-3">{x.title}</p>
            <p className="text-xs text-slate-500 truncate">Batch: {x.batch?.name}</p>
          </button>
        ))}</div>
      )}
      {open && <GradeSheet exam={open} onClose={() => setOpen(null)} />}
    </Page>
  );
}
function GradeSheet({ exam, onClose }: { exam: Exam; onClose: () => void }) {
  const user = useAuth((s) => s.user)!;
  const roster = useRoster(exam.batch_id ? [exam.batch_id] : []);
  const res = useData<{ student_id: string; score: number | null; feedback: string | null; status: string }[]>(() => supabase.from('exam_results').select('student_id,score,feedback,status').eq('exam_id', exam.id));
  const [rows, setRows] = useState<Record<string, { score: string; feedback: string }>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { setRows(Object.fromEntries((res.data ?? []).map((r) => [r.student_id, { score: r.score == null ? '' : String(r.score), feedback: r.feedback ?? '' }]))); }, [res.data]);
  const publish = async () => {
    const out = Object.entries(rows).filter(([, v]) => v.score !== '').map(([sid, v]) => {
      const pct = (Number(v.score) / Number(exam.total_marks)) * 100;
      return { exam_id: exam.id, student_id: sid, score: Number(v.score), grade: gradeOf(pct), feedback: v.feedback || null, status: 'graded', graded_by: user.id, graded_at: new Date().toISOString() };
    });
    if (out.some((r) => r.score < 0 || r.score > Number(exam.total_marks))) return toast.err(`Scores must be between 0 and ${exam.total_marks}.`);
    if (!out.length) return toast.err('Enter at least one score.');
    setBusy(true);
    const { error } = await supabase.from('exam_results').upsert(out, { onConflict: 'exam_id,student_id' });
    if (!error) await Promise.all(out.map((r) => notify(r.student_id, 'New result published', `${exam.title}: ${r.score}/${exam.total_marks} (${r.grade})`, '/student/exam-results')));
    setBusy(false);
    if (error) toast.err(error.message); else { toast.ok(`${out.length} results published`); res.reload(); }
  };
  return (
    <Modal open onClose={onClose} title={`${exam.title} · out of ${exam.total_marks}`} wide>
      {roster.loading ? <Spinner /> : !roster.data?.length ? <p className="text-center text-slate-400 py-8">No students in this batch.</p> : (
        <>
          <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl">
            {roster.data.map((r) => {
              const sid = r.student!.id; const v = rows[sid] ?? { score: '', feedback: '' };
              const pct = v.score === '' ? null : (Number(v.score) / Number(exam.total_marks)) * 100;
              return (
                <div key={r.id} className="grid grid-cols-12 gap-2 items-center px-3 py-2.5">
                  <span className="col-span-4 text-sm font-semibold text-slate-700 truncate">{r.student?.full_name}</span>
                  <input type="number" min={0} max={exam.total_marks} className="col-span-2 px-2 py-2 rounded-lg border border-slate-200 text-sm text-center" value={v.score} onChange={(e) => setRows({ ...rows, [sid]: { ...v, score: e.target.value } })} />
                  <span className="col-span-1 text-sm font-black text-orange-500 text-center">{pct == null ? '' : gradeOf(pct)}</span>
                  <input className="col-span-5 px-3 py-2 rounded-lg border border-slate-200 text-sm" placeholder="Feedback (optional)" value={v.feedback} onChange={(e) => setRows({ ...rows, [sid]: { ...v, feedback: e.target.value } })} />
                </div>
              );
            })}
          </div>
          <button disabled={busy} onClick={publish} className={`${btnPrimary} w-full mt-5`}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Publish Results</button>
        </>
      )}
    </Modal>
  );
}

// ---------------- Class reports ----------------
export function InstructorReports() {
  const user = useAuth((s) => s.user);
  const batches = useTeaching(['active', 'completed']);
  const [bid, setBid] = useState<number | null>(null);
  const roster = useRoster(bid ? [bid] : []);
  const sess = useData<{ id: number }[]>(() => supabase.from('class_sessions').select('id').eq('batch_id', bid ?? 0).lte('starts_at', new Date().toISOString()), [bid]);
  const att = useData<{ student_id: string; status: string }[]>(() => supabase.from('attendance').select('student_id,status').in('session_id', (sess.data ?? []).map((s) => s.id).concat(0)), [sess.data?.length]);
  const res = useData<{ student_id: string; score: number; exam: { total_marks: number; batch_id: number } | null }[]>(() => supabase.from('exam_results').select('student_id,score, exam:exams!inner(total_marks,batch_id)').eq('exam.batch_id', bid ?? 0).eq('status', 'graded'), [bid]);
  const held = sess.data?.length ?? 0;
  return (
    <Page>
      {user?.demo && <DemoNotice />}
      <PageHero badge="Analytics" badgeColor="indigo" title="Class Reports" illus="reports" subtitle="Attendance and exam performance for every student in a batch.">
        <select value={bid ?? ''} onChange={(e) => setBid(e.target.value ? Number(e.target.value) : null)} className="w-full max-w-md px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none"><option value="">— Select a batch —</option>{(batches.data ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
      </PageHero>
      {bid && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[640px]"><thead className="bg-slate-50 text-[11px] font-extrabold uppercase text-slate-500"><tr><th className="px-4 py-3">Student</th><th className="px-3 py-3">Attendance ({held} classes)</th><th className="px-3 py-3">Avg score</th><th className="px-3 py-3">Exams graded</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{(roster.data ?? []).map((r) => {
              const mine = (att.data ?? []).filter((a) => a.student_id === r.student?.id && a.status !== 'absent').length;
              const pct = held ? Math.round((mine / held) * 100) : 100;
              const rs = (res.data ?? []).filter((x) => x.student_id === r.student?.id);
              const avg = rs.length ? Math.round(rs.reduce((a, x) => a + (Number(x.score) / Number(x.exam?.total_marks || 100)) * 100, 0) / rs.length) : null;
              return (
                <tr key={r.id}><td className="px-4 py-3 font-bold">{r.student?.full_name}</td>
                  <td className="px-3 py-3"><div className="flex items-center gap-2"><div className="w-28 h-2 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full ${pct >= 80 ? 'bg-emerald-500' : 'bg-red-400'}`} style={{ width: `${pct}%` }} /></div><span className="text-xs font-bold">{pct}%</span></div></td>
                  <td className="px-3 py-3 font-bold">{avg == null ? '—' : `${avg}%`}</td><td className="px-3 py-3 text-xs">{rs.length}</td></tr>
              );
            })}{!roster.data?.length && <tr><td colSpan={4} className="p-8 text-center text-slate-400 text-xs">No students.</td></tr>}</tbody></table>
        </div>
      )}
    </Page>
  );
}

// ---------------- New students in my batches ----------------
export function InstructorNewStudents() {
  const user = useAuth((s) => s.user);
  const batches = useTeaching();
  const roster = useRoster((batches.data ?? []).map((b) => b.id));
  const recent = (roster.data ?? []).filter((r) => Date.now() - new Date(r.created_at).getTime() < 14 * 864e5);
  return (
    <Page>
      {user?.demo && <DemoNotice />}
      <PageHero badge="Admissions" badgeColor="green" title="New Students" illus="new" subtitle="Students who joined your batches in the last 14 days. Say hello and help them settle in." />
      {roster.loading ? <Spinner /> : !recent.length ? <p className="text-center text-slate-400 py-16">No new students in the last 14 days.</p> : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">{recent.map((r) => (
          <div key={r.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 flex items-center gap-3">
            <span className="w-11 h-11 rounded-full bg-emerald-50 text-emerald-600 grid place-items-center font-bold">{r.student?.full_name?.[0]}</span>
            <div className="flex-1 min-w-0"><p className="font-bold text-slate-800 truncate">{r.student?.full_name}</p><p className="text-xs text-slate-400 truncate">{(batches.data ?? []).find((b) => b.id === r.batch_id)?.name} · {fmtDate(r.created_at)}</p></div>
            {r.student?.phone && <a href={`https://wa.me/${r.student.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="p-2 rounded-lg text-emerald-600 bg-emerald-50"><MessageCircle size={16} /></a>}
          </div>
        ))}</div>
      )}
    </Page>
  );
}


