import { useMemo, useState } from 'react';
import { CalendarOff, Check, CheckCircle2, Clock, DoorOpen, Loader2, Plus, Save, ShieldCheck, Trash2, X } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { isAcademicLead } from '../../lib/nav';
import { supabase } from '../../lib/supabase';
import { fmtDate, fmtDateTime, useData } from '../../lib/db';
import { gradeOf } from '../../lib/grading';
import { DemoNotice, Field, Modal, Page, PageHero, Spinner, StatusPill, btnGhost, btnPrimary, inputCls, toast } from '../../components/ui';
import { askConfirm, askText } from '../../components/dialogs';
import EntityGrid from '../admin/EntityGrid';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const hm = (t: string) => t.slice(0, 5);

// ---------------------------------------------------------------- rooms
type Room = { id: number; name: string; capacity: number | null; location: string | null; is_active: boolean };
export function Rooms() {
  return (
    <EntityGrid<Room> table="rooms" order="name" badge="Timetable" badgeTone="indigo" title="Rooms" illus="calendar" addLabel="Add Room"
      subtitle="Classrooms at the centre. The timetable refuses to book the same room, or the same instructor, twice at the same time."
      defaults={{ is_active: true }} searchText={(r) => `${r.name} ${r.location ?? ''}`}
      fields={[{ k: 'name', label: 'Room name', required: true, ph: 'e.g. Room 2' }, { k: 'capacity', label: 'Seats', type: 'number', half: true }, { k: 'location', label: 'Floor / location', half: true }, { k: 'is_active', label: 'In use', type: 'checkbox' }]}
      toRow={(f) => ({ ...f, capacity: f.capacity === '' || f.capacity == null ? null : Number(f.capacity) })}
      card={(r) => (
        <>
          <div className="flex justify-between items-start mb-3"><span className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 grid place-items-center"><DoorOpen size={22} /></span><StatusPill status={r.is_active ? 'active' : 'cancelled'} /></div>
          <h3 className="text-lg font-bold text-slate-900">{r.name}</h3>
          <p className="text-xs text-slate-500">{r.capacity ? `${r.capacity} seats` : 'Seats not set'}{r.location ? ` · ${r.location}` : ''}</p>
        </>
      )} />
  );
}

// ---------------------------------------------------------------- instructor: my availability, qualifications, leave
type IP = { id: string; qualifications: string | null; experience_years: number | null; level_ids: number[]; course_ids: number[]; max_hours_week: number | null };
type Avail = { id: number; instructor_id: string; weekday: number; start_time: string; end_time: string };
type Leave = { id: number; instructor_id: string; date_from: string; date_to: string; reason: string; status: string; review_note: string | null; created_at: string; instructor?: { full_name: string } | null };

export function MyAvailability() {
  const user = useAuth((s) => s.user)!;
  const ip = useData<IP>(() => supabase.from('instructor_profiles').select('*').eq('id', user.id).maybeSingle());
  const levels = useData<{ id: number; name: string }[]>(() => supabase.from('levels').select('id,name').order('sort_order'));
  const courses = useData<{ id: number; title: string; code: string }[]>(() => supabase.from('courses').select('id,title,code').order('code'));
  const av = useData<Avail[]>(() => supabase.from('instructor_availability').select('*').eq('instructor_id', user.id).order('weekday').order('start_time'));
  const leave = useData<Leave[]>(() => supabase.from('instructor_leave').select('*').eq('instructor_id', user.id).order('date_from', { ascending: false }));
  const [f, setF] = useState<IP | null>(null);
  const cur = f ?? ip.data ?? { id: user.id, qualifications: '', experience_years: null, level_ids: [], course_ids: [], max_hours_week: null };
  const [slot, setSlot] = useState({ weekday: 1, start: '09:00', end: '13:00' });
  const [lv, setLv] = useState({ from: '', to: '', reason: '' });
  const [busy, setBusy] = useState(false);
  const saveProfile = async () => {
    setBusy(true);
    const { error } = await supabase.from('instructor_profiles').upsert({ ...cur, id: user.id, updated_at: new Date().toISOString() });
    setBusy(false);
    if (error) toast.err(error.message); else { toast.ok('Teaching profile saved'); setF(null); ip.reload(); }
  };
  const addSlot = async () => {
    if (slot.end <= slot.start) return toast.err('The end time must be after the start time.');
    const { error } = await supabase.from('instructor_availability').insert({ instructor_id: user.id, weekday: slot.weekday, start_time: slot.start, end_time: slot.end });
    if (error) toast.err(error.message); else av.reload();
  };
  const delSlot = async (id: number) => { const { error } = await supabase.from('instructor_availability').delete().eq('id', id); if (error) toast.err(error.message); else av.reload(); };
  const askLeave = async () => {
    if (!lv.from || !lv.to || lv.reason.trim().length < 3) return toast.err('Choose the dates and write the reason.');
    if (lv.to < lv.from) return toast.err('End date must be after start date.');
    const { error } = await supabase.from('instructor_leave').insert({ instructor_id: user.id, date_from: lv.from, date_to: lv.to, reason: lv.reason.trim() });
    if (error) toast.err(error.message); else { toast.ok('Leave request sent to the academic team'); setLv({ from: '', to: '', reason: '' }); leave.reload(); }
  };
  const withdraw = async (l: Leave) => { if (!(await askConfirm('Withdraw this leave request?'))) return; const { error } = await supabase.from('instructor_leave').delete().eq('id', l.id); if (error) toast.err(error.message); else leave.reload(); };
  const toggle = (k: 'level_ids' | 'course_ids', id: number) => setF({ ...cur, [k]: cur[k].includes(id) ? cur[k].filter((x) => x !== id) : [...cur[k], id] });
  return (
    <Page>
      {user.demo && <DemoNotice />}
      <PageHero badge="Teaching" badgeColor="indigo" title="Availability & Leave" illus="calendar" subtitle="Tell the academic team what you can teach and when you are free, and request leave. Approved leave helps them arrange a substitute in time." />
      {ip.loading ? <Spinner /> : (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-4xl border border-slate-100 shadow-sm p-6 space-y-4">
            <h2 className="font-extrabold text-slate-900 flex items-center gap-2"><ShieldCheck size={18} className="text-indigo-600" />Teaching profile</h2>
            <Field label="Qualifications and certificates"><textarea rows={3} className={inputCls} value={cur.qualifications ?? ''} onChange={(e) => setF({ ...cur, qualifications: e.target.value })} placeholder="e.g. CELTA, BA English Literature" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Years of experience"><input type="number" className={inputCls} value={cur.experience_years ?? ''} onChange={(e) => setF({ ...cur, experience_years: e.target.value === '' ? null : Number(e.target.value) })} /></Field>
              <Field label="Most hours per week"><input type="number" className={inputCls} value={cur.max_hours_week ?? ''} onChange={(e) => setF({ ...cur, max_hours_week: e.target.value === '' ? null : Number(e.target.value) })} /></Field>
            </div>
            <Field label="Levels I can teach"><div className="flex flex-wrap gap-2">{(levels.data ?? []).map((l) => <button key={l.id} type="button" onClick={() => toggle('level_ids', l.id)} className={`px-3 py-1.5 rounded-full border text-xs font-bold ${cur.level_ids.includes(l.id) ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500'}`}>{l.name}</button>)}</div></Field>
            <Field label="Courses I can teach"><div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">{(courses.data ?? []).map((c) => <button key={c.id} type="button" onClick={() => toggle('course_ids', c.id)} className={`px-3 py-1.5 rounded-full border text-xs font-bold ${cur.course_ids.includes(c.id) ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500'}`}>{c.code}</button>)}</div></Field>
            <button disabled={busy || !f} onClick={saveProfile} className={btnPrimary}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save</button>
          </div>
          <div className="space-y-6">
            <div className="bg-white rounded-4xl border border-slate-100 shadow-sm p-6">
              <h2 className="font-extrabold text-slate-900 flex items-center gap-2 mb-3"><Clock size={18} className="text-indigo-600" />When I am free to teach</h2>
              <div className="space-y-1.5 mb-4">{(av.data ?? []).map((a) => (
                <div key={a.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-50 text-sm"><b className="w-28">{DAYS[a.weekday]}</b><span className="flex-1">{hm(a.start_time)} – {hm(a.end_time)}</span><button onClick={() => delSlot(a.id)} className="text-slate-400 hover:text-red-500"><X size={15} /></button></div>
              ))}{!(av.data ?? []).length && <p className="text-xs text-slate-400">No times added yet.</p>}</div>
              <div className="flex flex-wrap gap-2 items-end">
                <select className={`${inputCls} w-36`} value={slot.weekday} onChange={(e) => setSlot({ ...slot, weekday: Number(e.target.value) })}>{DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select>
                <input type="time" className={`${inputCls} w-28`} value={slot.start} onChange={(e) => setSlot({ ...slot, start: e.target.value })} />
                <input type="time" className={`${inputCls} w-28`} value={slot.end} onChange={(e) => setSlot({ ...slot, end: e.target.value })} />
                <button onClick={addSlot} className={btnGhost}><Plus size={15} />Add</button>
              </div>
            </div>
            <div className="bg-white rounded-4xl border border-slate-100 shadow-sm p-6">
              <h2 className="font-extrabold text-slate-900 flex items-center gap-2 mb-3"><CalendarOff size={18} className="text-indigo-600" />Leave requests</h2>
              <div className="grid grid-cols-2 gap-2"><input type="date" className={inputCls} value={lv.from} onChange={(e) => setLv({ ...lv, from: e.target.value })} /><input type="date" className={inputCls} value={lv.to} onChange={(e) => setLv({ ...lv, to: e.target.value })} /></div>
              <textarea rows={2} className={`${inputCls} mt-2`} value={lv.reason} onChange={(e) => setLv({ ...lv, reason: e.target.value })} placeholder="Reason" />
              <button onClick={askLeave} className={`${btnPrimary} mt-2`}><CalendarOff size={15} />Request leave</button>
              <div className="divide-y divide-slate-100 mt-4">{(leave.data ?? []).map((l) => (
                <div key={l.id} className="py-2.5 flex items-center gap-3 text-sm"><div className="flex-1"><p className="font-bold">{fmtDate(l.date_from)} – {fmtDate(l.date_to)}</p><p className="text-xs text-slate-500">{l.reason}{l.review_note ? ` · ${l.review_note}` : ''}</p></div><StatusPill status={l.status} />
                  {l.status === 'pending' && <button onClick={() => withdraw(l)} className="text-slate-400 hover:text-red-500"><Trash2 size={15} /></button>}</div>
              ))}</div>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}

// ---------------------------------------------------------------- academic: instructors overview and leave approvals
export function InstructorsOverview() {
  const user = useAuth((s) => s.user)!;
  const teachers = useData<{ id: string; full_name: string; email: string; phone: string | null }[]>(() => supabase.from('profiles').select('id,full_name,email,phone').eq('role', 'instructor').eq('is_active', true).order('full_name'));
  const ips = useData<IP[]>(() => supabase.from('instructor_profiles').select('*'));
  const av = useData<Avail[]>(() => supabase.from('instructor_availability').select('*').order('weekday').order('start_time'));
  const leave = useData<Leave[]>(() => supabase.from('instructor_leave').select('*, instructor:profiles!instructor_leave_instructor_id_fkey(full_name)').order('date_from', { ascending: false }));
  const levels = useData<{ id: number; name: string }[]>(() => supabase.from('levels').select('id,name').order('sort_order'));
  const week = useMemo(() => { const s = new Date(); s.setHours(0, 0, 0, 0); const e = new Date(s.getTime() + 7 * 86400000); return [s.toISOString(), e.toISOString()]; }, []);
  const sessions = useData<{ starts_at: string; ends_at: string; substitute_id: string | null; batch: { instructor_id: string | null } | null }[]>(() => supabase.from('class_sessions').select('starts_at,ends_at,substitute_id, batch:batches(instructor_id)').gte('starts_at', week[0]).lt('starts_at', week[1]));
  const allSessions = useData<{ starts_at: string; substitute_id: string | null; batch: { instructor_id: string | null } | null }[]>(() => supabase.from('class_sessions').select('starts_at,substitute_id, batch:batches(instructor_id)').gte('starts_at', new Date().toISOString()));
  const hours = (id: string) => Math.round((sessions.data ?? []).filter((s) => (s.substitute_id ?? s.batch?.instructor_id) === id).reduce((a, s) => a + (new Date(s.ends_at).getTime() - new Date(s.starts_at).getTime()) / 3600000, 0) * 10) / 10;
  const affected = (l: Leave) => (allSessions.data ?? []).filter((s) => (s.substitute_id ?? s.batch?.instructor_id) === l.instructor_id && s.starts_at.slice(0, 10) >= l.date_from && s.starts_at.slice(0, 10) <= l.date_to).length;
  const decide = async (l: Leave, status: 'approved' | 'rejected') => {
    const note = await askText(status === 'approved' ? 'Note to the instructor (optional):' : 'Reason (shown to the instructor):');
    if (note === null) return;
    const { error } = await supabase.from('instructor_leave').update({ status, review_note: note || null }).eq('id', l.id);
    if (error) toast.err(error.message); else { toast.ok(status === 'approved' ? 'Leave approved — arrange substitutes for the affected classes' : 'Leave request declined'); leave.reload(); }
  };
  const pending = (leave.data ?? []).filter((l) => l.status === 'pending');
  const lvName = (ids: number[]) => ids.map((i) => levels.data?.find((l) => l.id === i)?.name).filter(Boolean).join(', ');
  return (
    <Page wide>
      {user.demo && <DemoNotice />}
      <PageHero badge="Academic" badgeColor="indigo" title="Instructors" illus="users" subtitle="What each instructor can teach, when they are free, their teaching hours this week and their leave requests." />
      {pending.length > 0 && (
        <div className="mb-8"><h2 className="text-xs font-black uppercase tracking-wider text-amber-600 mb-3">Leave requests waiting · {pending.length}</h2>
          <div className="space-y-2">{pending.map((l) => (
            <div key={l.id} className="bg-white rounded-2xl border border-amber-100 p-4 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-56"><p className="font-bold text-slate-800">{l.instructor?.full_name} · {fmtDate(l.date_from)} – {fmtDate(l.date_to)}</p><p className="text-xs text-slate-500">{l.reason}</p>
                {affected(l) > 0 && <p className="text-xs font-bold text-red-500 mt-0.5">{affected(l)} classes in this period will need a substitute</p>}</div>
              <button onClick={() => decide(l, 'approved')} className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-1"><Check size={14} />Approve</button>
              <button onClick={() => decide(l, 'rejected')} className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold">Decline</button>
            </div>
          ))}</div></div>
      )}
      {teachers.loading ? <Spinner /> : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">{(teachers.data ?? []).map((t) => {
          const p = ips.data?.find((x) => x.id === t.id);
          const a = (av.data ?? []).filter((x) => x.instructor_id === t.id);
          const onLeave = (leave.data ?? []).filter((l) => l.instructor_id === t.id && l.status === 'approved' && l.date_to >= new Date().toISOString().slice(0, 10));
          const h = hours(t.id);
          return (
            <div key={t.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
              <div className="flex items-start gap-3"><span className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-700 grid place-items-center font-black">{t.full_name[0]}</span>
                <div className="flex-1 min-w-0"><p className="font-bold text-slate-900">{t.full_name}</p><p className="text-[11px] text-slate-400 truncate">{t.email}</p></div>
                <div className="text-right"><p className={`text-lg font-black ${p?.max_hours_week && h > p.max_hours_week ? 'text-red-500' : 'text-slate-800'}`}>{h}h</p><p className="text-[10px] font-bold uppercase text-slate-400">next 7 days{p?.max_hours_week ? ` / ${p.max_hours_week}` : ''}</p></div></div>
              <p className="text-xs text-slate-600 mt-3">{p?.qualifications || <span className="text-slate-400">No qualifications entered</span>}{p?.experience_years ? ` · ${p.experience_years} years` : ''}</p>
              {p?.level_ids?.length ? <p className="text-[11px] text-indigo-600 font-bold mt-1">{lvName(p.level_ids)}</p> : null}
              <div className="mt-3 text-[11px] text-slate-500 space-y-0.5">{a.length ? a.map((x) => <p key={x.id}>{DAYS[x.weekday]} {hm(x.start_time)}–{hm(x.end_time)}</p>) : <p className="text-slate-400">Availability not entered</p>}</div>
              {onLeave.map((l) => <p key={l.id} className="mt-2 text-[11px] font-bold text-amber-600">On leave {fmtDate(l.date_from)} – {fmtDate(l.date_to)}</p>)}
            </div>
          );
        })}</div>
      )}
    </Page>
  );
}

// ---------------------------------------------------------------- attendance corrections
type Corr = { id: number; session_id: number; student_id: string; requested_status: string; reason: string; status: string; review_note: string | null; created_at: string;
  student: { full_name: string } | null; session: { title: string; starts_at: string; batch: { name: string } | null } | null };
export function AttendanceCorrections() {
  const user = useAuth((s) => s.user)!;
  const [tab, setTab] = useState('pending');
  const { data, loading, reload } = useData<Corr[]>(() => supabase.from('attendance_corrections').select('*, student:profiles!attendance_corrections_student_id_fkey(full_name), session:class_sessions(title,starts_at, batch:batches(name))').order('created_at', { ascending: false }));
  const list = (data ?? []).filter((c) => tab === 'all' || c.status === tab);
  const decide = async (c: Corr, status: 'approved' | 'rejected') => {
    const note = status === 'rejected' ? await askText('Reason (shown to the student):') : '';
    if (note === null) return;
    const { error } = await supabase.from('attendance_corrections').update({ status, review_note: note || null }).eq('id', c.id);
    if (error) toast.err(error.message); else { toast.ok(status === 'approved' ? 'Attendance updated' : 'Request declined'); reload(); }
  };
  return (
    <Page wide>
      {user.demo && <DemoNotice />}
      <PageHero badge="Attendance" badgeColor="indigo" title="Attendance Corrections" illus="attendance" subtitle="Students ask for a correction when their attendance was recorded wrongly (for example the QR scan failed). Approving updates the record.">
        <div className="inline-flex bg-slate-50 p-1 rounded-xl border border-slate-200">{['pending', 'approved', 'rejected', 'all'].map((t) => <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-xs font-bold capitalize ${tab === t ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>{t}</button>)}</div>
      </PageHero>
      {loading ? <Spinner /> : !list.length ? <p className="text-center text-slate-400 py-12">Nothing here.</p> : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm divide-y divide-slate-100">{list.map((c) => (
          <div key={c.id} className="px-5 py-4 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-56"><p className="font-bold text-slate-800">{c.student?.full_name}</p>
              <p className="text-[11px] text-slate-400">{c.session?.title} · {c.session?.batch?.name} · {fmtDateTime(c.session?.starts_at)}</p>
              <p className="text-sm text-slate-600 mt-1">“{c.reason}”</p>{c.review_note && <p className="text-xs text-slate-500">Note: {c.review_note}</p>}</div>
            <span className="text-xs font-bold text-slate-500">Asks for: <StatusPill status={c.requested_status} /></span>
            {c.status === 'pending' ? <>
              <button onClick={() => decide(c, 'approved')} className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-1"><Check size={14} />Approve</button>
              <button onClick={() => decide(c, 'rejected')} className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold">Decline</button>
            </> : <StatusPill status={c.status} />}
          </div>
        ))}</div>
      )}
    </Page>
  );
}

// ---------------------------------------------------------------- grade moderation
type MExam = { id: number; title: string; kind: string; total_marks: number; starts_at: string | null; results_released: boolean; moderation_note: string | null; batch: { name: string } | null; course: { title: string } | null };
type MRes = { id: number; exam_id: number; student_id: string; score: number | null; grade: string | null; feedback: string | null; status: string; student: { full_name: string } | null };
export function GradeModeration() {
  const user = useAuth((s) => s.user)!;
  const lead = isAcademicLead(user.role);
  const [tab, setTab] = useState<'waiting' | 'released'>('waiting');
  const exams = useData<MExam[]>(() => supabase.from('exams').select('id,title,kind,total_marks,starts_at,results_released,moderation_note, batch:batches(name), course:courses(title)').in('kind', ['midterm', 'final']).order('starts_at', { ascending: false }));
  const res = useData<MRes[]>(() => supabase.from('exam_results').select('id,exam_id,student_id,score,grade,feedback,status, student:profiles!exam_results_student_id_fkey(full_name)').eq('status', 'graded'));
  const [open, setOpen] = useState<MExam | null>(null);
  const list = (exams.data ?? []).filter((x) => (tab === 'waiting' ? !x.results_released : x.results_released));
  const stats = (x: MExam) => {
    const r = (res.data ?? []).filter((y) => y.exam_id === x.id && y.score != null);
    const pcts = r.map((y) => (Number(y.score) / Number(x.total_marks)) * 100);
    return { n: r.length, avg: pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : 0, pass: pcts.length ? Math.round((pcts.filter((p) => p >= 50).length / pcts.length) * 100) : 0 };
  };
  return (
    <Page wide>
      {user.demo && <DemoNotice />}
      <PageHero badge="Assessment" badgeColor="indigo" title="Grade Moderation" illus="grading" subtitle="Mid-term and final marks reach students only after the academic team checks them. Review the spread of marks, adjust if needed, then release.">
        <div className="inline-flex bg-slate-50 p-1 rounded-xl border border-slate-200">{(['waiting', 'released'] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-xs font-bold capitalize ${tab === t ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>{t === 'waiting' ? 'Waiting for release' : 'Released'}</button>)}</div>
      </PageHero>
      {exams.loading || res.loading ? <Spinner /> : !list.length ? <p className="text-center text-slate-400 py-12">Nothing here.</p> : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">{list.map((x) => {
          const s = stats(x);
          return (
            <button key={x.id} onClick={() => setOpen(x)} className="text-left bg-white rounded-3xl border border-slate-100 shadow-sm p-6 hover:shadow-lg">
              <div className="flex justify-between"><span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{x.kind}</span>{x.results_released ? <StatusPill status="published" /> : <StatusPill status="pending" />}</div>
              <p className="text-lg font-extrabold text-slate-900 mt-3">{x.title}</p><p className="text-xs text-slate-500">{x.course?.title} · {x.batch?.name}</p>
              <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                <div className="p-2 rounded-xl bg-slate-50"><p className="font-black">{s.n}</p><p className="text-[10px] uppercase font-bold text-slate-400">Marked</p></div>
                <div className="p-2 rounded-xl bg-slate-50"><p className="font-black">{s.avg}%</p><p className="text-[10px] uppercase font-bold text-slate-400">Average</p></div>
                <div className="p-2 rounded-xl bg-slate-50"><p className="font-black">{s.pass}%</p><p className="text-[10px] uppercase font-bold text-slate-400">Pass rate</p></div>
              </div>
            </button>
          );
        })}</div>
      )}
      {open && <ModerateModal x={open} rows={(res.data ?? []).filter((r) => r.exam_id === open.id)} canRelease={lead} onClose={() => setOpen(null)} onDone={() => { setOpen(null); exams.reload(); res.reload(); }} />}
    </Page>
  );
}

function ModerateModal({ x, rows, canRelease, onClose, onDone }: { x: MExam; rows: MRes[]; canRelease: boolean; onClose: () => void; onDone: () => void }) {
  const [edit, setEdit] = useState<Record<number, string>>({});
  const [note, setNote] = useState(x.moderation_note ?? '');
  const [busy, setBusy] = useState(false);
  const dist = useMemo(() => { const m: Record<string, number> = {}; rows.forEach((r) => { const g = r.score == null ? '—' : gradeOf((Number(edit[r.id] ?? r.score) / Number(x.total_marks)) * 100); m[g] = (m[g] ?? 0) + 1; }); return Object.entries(m); }, [rows, edit, x.total_marks]);
  const save = async (release: boolean) => {
    for (const [id, v] of Object.entries(edit)) {
      const n = Number(v); if (v === '' || Number.isNaN(n) || n < 0 || n > Number(x.total_marks)) return toast.err(`Scores must be between 0 and ${x.total_marks}.`);
      const { error } = await supabase.from('exam_results').update({ score: n, grade: gradeOf((n / Number(x.total_marks)) * 100) }).eq('id', Number(id));
      if (error) return toast.err(error.message);
    }
    if (release && !(await askConfirm(`Release ${rows.length} results to the students now? They will be notified.`))) return;
    setBusy(true);
    const { error } = await supabase.from('exams').update({ moderation_note: note || null, ...(release ? { results_released: true } : {}) }).eq('id', x.id);
    setBusy(false);
    if (error) toast.err(error.message); else { toast.ok(release ? 'Results released — students were notified' : 'Changes saved'); onDone(); }
  };
  return (
    <Modal open onClose={onClose} title={`${x.title} · out of ${x.total_marks}`} wide>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">{dist.map(([g, n]) => <span key={g} className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-100 text-sm"><b>{g}</b> · {n}</span>)}</div>
        <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl max-h-96 overflow-y-auto">{rows.map((r) => (
          <div key={r.id} className="grid grid-cols-12 gap-2 items-center px-3 py-2">
            <span className="col-span-6 text-sm font-semibold truncate">{r.student?.full_name}</span>
            <input type="number" disabled={x.results_released} className="col-span-3 px-2 py-1.5 rounded-lg border border-slate-200 text-sm text-center" value={edit[r.id] ?? String(r.score ?? '')} onChange={(e) => setEdit({ ...edit, [r.id]: e.target.value })} />
            <span className="col-span-3 text-sm font-black text-orange-500 text-center">{r.score == null ? '' : gradeOf((Number(edit[r.id] ?? r.score) / Number(x.total_marks)) * 100)}</span>
          </div>
        ))}{!rows.length && <p className="p-6 text-center text-sm text-slate-400">No marks entered yet.</p>}</div>
        <Field label="Moderation note (internal)"><textarea rows={2} className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} disabled={x.results_released} /></Field>
        {!x.results_released && <div className="flex gap-2 justify-end">
          <button disabled={busy} onClick={() => save(false)} className={btnGhost}>Save changes</button>
          {canRelease && <button disabled={busy || !rows.length} onClick={() => save(true)} className={btnPrimary}>{busy ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Release results</button>}
        </div>}
      </div>
    </Modal>
  );
}
