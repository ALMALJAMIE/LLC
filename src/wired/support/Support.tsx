import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Award, BrainCircuit, CalendarCheck, ClipboardList, Inbox, Loader2, Mail, MessageSquare, PenTool, Phone, Search, Send, Target, UserPlus, Users } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { fmtDate, useData } from '../../lib/db';
import { DemoNotice, Field, Modal, Page, PageHero, Spinner, StatusPill, btnPrimary, inputCls, toast } from '../../components/ui';

type Stu = { id: string; full_name: string; email: string; phone: string | null; country: string | null; student_no: string | null; created_at: string; is_active: boolean;
  enrollments: { id: number; status: string; progress: number; course: { title: string } | null; batch: { name: string } | null }[] };
const wa = (p: string) => `https://wa.me/${p.replace(/\D/g, '')}`;

// ---------------- Dashboard ----------------
type D = { students: number; newWeek: number; notEnrolled: number; responsesWeek: number; mcPending: number; recent: Stu[] };
async function load() {
  const week = new Date(Date.now() - 7 * 864e5).toISOString();
  const c = (t: string, f: (q: any) => any) => f(supabase.from(t).select('id', { count: 'exact', head: true })); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [s, nw, fr, mc, recent] = await Promise.all([
    c('profiles', (q) => q.eq('role', 'student')), c('profiles', (q) => q.eq('role', 'student').gte('created_at', week)),
    c('form_responses', (q) => q.gte('created_at', week)), c('absence_requests', (q) => q.eq('status', 'pending')),
    supabase.from('profiles').select('id,full_name,email,phone,country,student_no,created_at,is_active, enrollments!enrollments_student_id_fkey(id,status,progress, course:courses(title), batch:batches(name))').eq('role', 'student').order('created_at', { ascending: false }).limit(8),
  ]);
  const rec = (recent.data ?? []) as unknown as Stu[];
  return { data: { students: s.count ?? 0, newWeek: nw.count ?? 0, responsesWeek: fr.count ?? 0, mcPending: mc.count ?? 0, notEnrolled: rec.filter((x) => !(x.enrollments ?? []).length).length, recent: rec } as D, error: null };
}

export function SupportDashboard() {
  const user = useAuth((s) => s.user)!;
  const nav = useNavigate();
  const { data } = useData<D>(load);
  const STATS = [
    { v: data?.students ?? 0, l: 'Students', icon: Users, tint: 'text-indigo-600', bg: 'bg-indigo-50', to: '/support/students' },
    { v: data?.newWeek ?? 0, l: 'New this week', icon: UserPlus, tint: 'text-emerald-600', bg: 'bg-emerald-50', to: '/admin/new-students' },
    { v: data?.responsesWeek ?? 0, l: 'Form responses this week', icon: Inbox, tint: 'text-[#e9a823]', bg: 'bg-orange-50', to: '/admin/forms' },
    { v: data?.mcPending ?? 0, l: 'Medical leave pending', icon: CalendarCheck, tint: 'text-slate-800', bg: 'bg-slate-100', to: '/support/students' },
  ];
  return (
    <div className="w-full bg-[#fafafa] font-sans min-h-screen pb-20">
      <main className="w-full px-6 lg:px-8 py-8">
        {user.demo && <DemoNotice />}
        <div className="bg-white rounded-4xl border border-slate-100 shadow-sm p-8 mb-10 flex flex-col lg:flex-row items-center justify-between">
          <div className="w-full lg:w-1/2">
            <span className="inline-flex items-center gap-2 px-3 py-1 bg-sky-50 text-sky-700 rounded-full text-xs font-bold uppercase tracking-wider mb-4 border border-sky-100 shadow-sm"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />Student Support</span>
            <h1 className="text-4xl font-extrabold text-slate-900 mb-3 tracking-tight">Hello, {user.name.split(' ')[0]}! <span className="inline-block animate-wave origin-bottom-right">👋</span></h1>
            <p className="text-slate-500 text-lg leading-relaxed max-w-md">Find any student, see where they stand, and get back to them.</p>
          </div>
          <div className="w-full lg:w-1/2 flex gap-3 flex-wrap justify-start lg:justify-end mt-6 lg:mt-0">
            <button onClick={() => nav('/support/students')} className="bg-slate-900 text-white px-6 py-4 rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:bg-orange-500 transition-all flex items-center gap-2"><Search size={16} /> Find a student</button>
            <button onClick={() => nav('/support/toolkit')} className="bg-white text-slate-800 px-6 py-4 rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:shadow-xl transition-all shadow-sm border border-slate-200 flex items-center gap-2"><PenTool size={16} className="text-[#e9a823]" /> Toolkit</button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {STATS.map(({ v, l, icon: I, tint, bg, to }) => (
            <button key={l} onClick={() => nav(to)} className="text-left bg-white rounded-4xl p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-slate-100 relative overflow-hidden group">
              <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 ${tint}`}><I size={100} className="rotate-12 translate-x-4 -translate-y-4" /></div>
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 ${bg}`}><I size={24} className={tint} /></div>
              <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-1">{v}</h3><p className="text-sm font-bold text-slate-500">{l}</p>
            </button>
          ))}
        </div>
        <div className="bg-white rounded-4xl p-6 lg:p-8 border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-extrabold text-slate-900">Latest registrations</h2><button onClick={() => nav('/admin/new-students')} className="text-[10px] font-extrabold uppercase tracking-widest text-[#e9a823] hover:underline">View All</button></div>
          <div className="divide-y divide-slate-100">
            {(data?.recent ?? []).map((s) => (
              <div key={s.id} className="flex flex-wrap items-center gap-4 py-3">
                <span className="w-10 h-10 rounded-full bg-slate-100 grid place-items-center font-bold text-slate-500">{s.full_name?.[0]}</span>
                <div className="flex-1 min-w-40"><p className="font-bold text-sm text-slate-800">{s.full_name}</p><p className="text-xs text-slate-400">{s.email}</p></div>
                {s.phone && <a href={wa(s.phone)} target="_blank" rel="noreferrer" className="text-xs font-bold text-emerald-600">WhatsApp</a>}
                <span className="text-xs text-slate-400">{fmtDate(s.created_at)}</span>
                {(s.enrollments ?? []).length ? <StatusPill status={s.enrollments![0].status} /> : <span className="text-[10px] font-black uppercase text-red-500">Not enrolled</span>}
              </div>
            ))}
            {!data?.recent.length && <p className="text-sm text-slate-400 py-6 text-center">No students yet.</p>}
          </div>
        </div>
      </main>
    </div>
  );
}

// ---------------- Student directory ----------------
export function StudentDirectory() {
  const user = useAuth((s) => s.user);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Stu | null>(null);
  const { data, loading } = useData<Stu[]>(() => supabase.from('profiles').select('id,full_name,email,phone,country,student_no,created_at,is_active, enrollments!enrollments_student_id_fkey(id,status,progress, course:courses(title), batch:batches(name))').eq('role', 'student').order('full_name'));
  const list = useMemo(() => (data ?? []).filter((s) => `${s.full_name} ${s.email} ${s.phone ?? ''} ${s.student_no ?? ''}`.toLowerCase().includes(q.toLowerCase())), [data, q]);
  return (
    <Page>
      {user?.demo && <DemoNotice />}
      <PageHero badge="Student Support" badgeColor="indigo" title="Student Directory" illus="students" subtitle="Search any student by name, email, phone or student number. Open a file to see their courses, attendance and results, and send them a message.">
        <div className="relative max-w-md"><Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search students..." className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-orange-200" /></div>
      </PageHero>
      {loading ? <Spinner /> : !list.length ? <p className="text-center text-slate-400 py-16">No students found.</p> : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[760px]"><thead className="bg-slate-50 text-[11px] font-extrabold uppercase text-slate-500"><tr><th className="px-4 py-3">Student</th><th className="px-3 py-3">Contact</th><th className="px-3 py-3">Courses</th><th className="px-3 py-3">Joined</th><th /></tr></thead>
            <tbody className="divide-y divide-slate-100">{list.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50/60">
                <td className="px-4 py-3"><p className="font-bold text-slate-800">{s.full_name}</p><p className="text-[11px] font-mono text-slate-400">{s.student_no}{!s.is_active && <span className="ml-2 text-red-500 font-sans font-bold">Inactive</span>}</p></td>
                <td className="px-3 py-3 text-xs"><p>{s.email}</p>{s.phone && <a className="text-emerald-600 font-bold" href={wa(s.phone)} target="_blank" rel="noreferrer">WhatsApp {s.phone}</a>}</td>
                <td className="px-3 py-3 text-xs">{(s.enrollments ?? []).length ? (s.enrollments ?? []).map((e) => <p key={e.id}>{e.course?.title} <span className="uppercase text-[10px] font-black text-slate-400">· {e.status}</span></p>) : <span className="text-[10px] font-black uppercase text-red-500">Not enrolled</span>}</td>
                <td className="px-3 py-3 text-xs text-slate-500">{fmtDate(s.created_at)}</td>
                <td className="px-3 py-3"><button onClick={() => setOpen(s)} className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-orange-500 text-white text-xs font-bold">Open file</button></td>
              </tr>
            ))}</tbody></table>
        </div>
      )}
      {open && <StudentFile s={open} onClose={() => setOpen(null)} />}
    </Page>
  );
}

type File = { att: { status: string }[]; res: { score: number | null; grade: string | null; exam: { title: string; total_marks: number } | null }[]; pl: { pct: number | null; status: string; submitted_at: string | null; final: { name: string } | null }[]; certs: { title: string; serial: string }[]; mc: { status: string; date_from: string; reason: string }[] };
function StudentFile({ s, onClose }: { s: Stu; onClose: () => void }) {
  const user = useAuth((x) => x.user);
  const [msg, setMsg] = useState('');
  const [title, setTitle] = useState('Message from LLC Student Support');
  const [busy, setBusy] = useState(false);
  const { data, loading } = useData<File>(async () => {
    const [att, res, pl, certs, mc] = await Promise.all([
      supabase.from('attendance').select('status').eq('student_id', s.id),
      supabase.from('exam_results').select('score,grade, exam:exams(title,total_marks)').eq('student_id', s.id).eq('status', 'graded'),
      supabase.from('placement_attempts').select('pct,status,submitted_at, final:levels!placement_attempts_final_level_id_fkey(name)').eq('student_id', s.id).order('id', { ascending: false }),
      supabase.from('certificates').select('title,serial').eq('student_id', s.id),
      supabase.from('absence_requests').select('status,date_from,reason').eq('student_id', s.id).order('date_from', { ascending: false }).limit(5),
    ]);
    return { data: { att: att.data ?? [], res: res.data ?? [], pl: pl.data ?? [], certs: certs.data ?? [], mc: mc.data ?? [] } as unknown as File, error: null };
  }, [s.id]);
  const attPct = data?.att.length ? Math.round((data.att.filter((a) => a.status !== 'absent').length / data.att.length) * 100) : null;
  const avg = data?.res.length ? Math.round(data.res.reduce((a, r) => a + (Number(r.score) / Number(r.exam?.total_marks || 100)) * 100, 0) / data.res.length) : null;
  const send = async () => {
    if (!msg.trim()) return toast.err('Write the message first.');
    setBusy(true);
    const { error } = await supabase.from('notifications').insert({ user_id: s.id, title: title.trim() || 'Message from LLC', body: msg.trim() });
    if (error) toast.err(error.message); else { toast.ok('Message sent to the student'); setMsg(''); }
    setBusy(false);
  };
  const tile = (icon: React.ReactNode, label: string, value: string) => <div className="rounded-2xl border border-slate-100 p-3"><span className="text-slate-400">{icon}</span><p className="text-[10px] font-black uppercase text-slate-400 mt-1">{label}</p><p className="text-lg font-extrabold text-slate-900">{value}</p></div>;
  return (
    <Modal open onClose={onClose} title={`${s.full_name} · ${s.student_no ?? ''}`} wide>
      <div className="space-y-5">
        <div className="flex flex-wrap gap-3 text-sm">
          <a href={`mailto:${s.email}`} className="flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-50 font-bold text-slate-700"><Mail size={14} />{s.email}</a>
          {s.phone && <a href={wa(s.phone)} target="_blank" rel="noreferrer" className="flex items-center gap-1 px-3 py-2 rounded-xl bg-emerald-50 font-bold text-emerald-700"><Phone size={14} />WhatsApp {s.phone}</a>}
          {s.country && <span className="px-3 py-2 rounded-xl bg-slate-50 text-slate-600">{s.country}</span>}
        </div>
        {loading ? <Spinner /> : (<>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {tile(<CalendarCheck size={16} />, 'Attendance', attPct == null ? 'N/A' : `${attPct}%`)}
            {tile(<Target size={16} />, 'Exam average', avg == null ? 'N/A' : `${avg}%`)}
            {tile(<BrainCircuit size={16} />, 'Placement', data?.pl[0] ? (data.pl[0].final?.name ?? (data.pl[0].pct != null ? `${data.pl[0].pct}% (to confirm)` : data.pl[0].status)) : 'Not taken')}
            {tile(<Award size={16} />, 'Certificates', String(data?.certs.length ?? 0))}
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Courses</h3>
            {(s.enrollments ?? []).length ? <div className="space-y-2">{(s.enrollments ?? []).map((e) => (
              <div key={e.id} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 text-sm"><ClipboardList size={16} className="text-indigo-500" /><div className="flex-1"><b>{e.course?.title}</b><p className="text-xs text-slate-500">{e.batch?.name ?? 'No batch yet'} · progress {e.progress}%</p></div><StatusPill status={e.status} /></div>
            ))}</div> : <p className="text-sm text-slate-400">Not enrolled in any course yet.</p>}
          </div>
          {!!data?.mc.length && <div><h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Medical leave</h3>{data.mc.map((m, i) => <p key={i} className="text-sm text-slate-600">{fmtDate(m.date_from)} — {m.reason} <span className="uppercase text-[10px] font-black text-slate-400">· {m.status}</span></p>)}</div>}
        </>)}
        <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2"><MessageSquare size={16} className="text-orange-500" />Send a message</h3>
          <p className="text-xs text-slate-500">It appears under the bell in the student's portal.</p>
          <Field label="Title"><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
          <Field label="Message"><textarea rows={3} className={inputCls} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="e.g. Your class link has changed — check your timetable." /></Field>
          <button disabled={busy || user?.demo} onClick={send} className={`${btnPrimary} w-full`}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}Send</button>
        </div>
      </div>
    </Modal>
  );
}
