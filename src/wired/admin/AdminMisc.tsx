import { useState } from 'react';
import { Award, Check, EyeOff, Loader2, Search, Star, UserPlus } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { fmtDate, useData } from '../../lib/db';
import { DemoNotice, Field, Modal, Page, PageHero, Spinner, StatusPill, btnPrimary, inputCls, toast } from '../../components/ui';
import { notify } from './AdminEnrollments';
import { useOptions } from './options';

// ---------------- Reviews moderation ----------------
type Rv = { id: number; rating: number; comment: string | null; status: string; created_at: string; student: { full_name: string } | null; course: { title: string } | null };
export function AdminReviews() {
  const user = useAuth((s) => s.user);
  const [tab, setTab] = useState('pending');
  const { data, loading, reload } = useData<Rv[]>(() => supabase.from('reviews').select('id,rating,comment,status,created_at, student:profiles!reviews_student_id_fkey(full_name), course:courses(title)').order('created_at', { ascending: false }));
  const list = (data ?? []).filter((r) => tab === 'all' || r.status === tab);
  const set = async (r: Rv, status: string) => { const { error } = await supabase.from('reviews').update({ status }).eq('id', r.id); if (error) toast.err(error.message); else reload(); };
  const avg = data?.length ? (data.reduce((a, r) => a + r.rating, 0) / data.length).toFixed(1) : '—';
  return (
    <Page>
      {user?.demo && <DemoNotice />}
      <PageHero badge="Student Feedback" title="Student Reviews" illus="review" subtitle={`Approve reviews before they are shown publicly. Average rating: ${avg} ★`}>
        <div className="inline-flex bg-slate-50 p-1 rounded-xl border border-slate-200">{['pending', 'approved', 'hidden', 'all'].map((t) => <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-xs font-bold capitalize ${tab === t ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>{t}</button>)}</div>
      </PageHero>
      {loading ? <Spinner /> : list.length === 0 ? <p className="text-center text-slate-400 py-16">No reviews here.</p> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {list.map((r) => (
            <div key={r.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
              <div className="flex justify-between"><div><p className="font-bold text-slate-800">{r.student?.full_name}</p><p className="text-xs text-slate-400">{r.course?.title ?? 'Center'} · {fmtDate(r.created_at)}</p></div><StatusPill status={r.status} /></div>
              <div className="flex gap-0.5 my-3">{[1, 2, 3, 4, 5].map((i) => <Star key={i} size={16} className={i <= r.rating ? 'fill-orange-400 text-orange-400' : 'text-slate-200'} />)}</div>
              {r.comment && <p className="text-sm text-slate-600 mb-4">{r.comment}</p>}
              <div className="flex gap-2">{r.status !== 'approved' && <button onClick={() => set(r, 'approved')} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold"><Check size={14} />Approve</button>}
                {r.status !== 'hidden' && <button onClick={() => set(r, 'hidden')} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold"><EyeOff size={14} />Hide</button>}</div>
            </div>
          ))}
        </div>
      )}
    </Page>
  );
}

// ---------------- Certificates ----------------
type Ce = { id: number; serial: string; title: string; issued_at: string; student: { full_name: string; email: string } | null };
export function AdminCertificates() {
  const user = useAuth((s) => s.user);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const { data, loading, reload } = useData<Ce[]>(() => supabase.from('certificates').select('id,serial,title,issued_at, student:profiles(full_name,email)').order('issued_at', { ascending: false }));
  const list = (data ?? []).filter((c) => `${c.student?.full_name} ${c.serial} ${c.title}`.toLowerCase().includes(q.toLowerCase()));
  const revoke = async (c: Ce) => { if (!confirm(`Revoke ${c.serial}?`)) return; const { error } = await supabase.from('certificates').delete().eq('id', c.id); if (error) toast.err(error.message); else reload(); };
  return (
    <Page>
      {user?.demo && <DemoNotice />}
      <PageHero badge="Academic Credentials" badgeColor="green" title="Certificates" illus="certificate" subtitle="Issue completion certificates. Students download them as PDF with the LLC design.">
        <div className="flex gap-3 max-w-lg"><div className="relative flex-1"><Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search student or serial..." className="w-full pl-10 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none" /></div>
          <button disabled={user?.demo} onClick={() => setOpen(true)} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-orange-500 text-white text-sm font-bold disabled:opacity-50"><Award size={16} />Issue</button></div>
      </PageHero>
      {loading ? <Spinner /> : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[640px]"><thead className="bg-slate-50 text-[11px] font-extrabold uppercase text-slate-500"><tr><th className="px-4 py-3">Student</th><th className="px-3 py-3">Certificate</th><th className="px-3 py-3">Serial</th><th className="px-3 py-3">Issued</th><th /></tr></thead>
            <tbody className="divide-y divide-slate-100">{list.map((c) => (
              <tr key={c.id}><td className="px-4 py-3"><p className="font-bold">{c.student?.full_name}</p><p className="text-[11px] text-slate-400">{c.student?.email}</p></td><td className="px-3 py-3">{c.title}</td><td className="px-3 py-3 font-mono text-xs">{c.serial}</td><td className="px-3 py-3 text-xs">{fmtDate(c.issued_at)}</td>
                <td className="px-3 py-3 text-right"><button onClick={() => revoke(c)} className="text-xs font-bold text-red-500">Revoke</button></td></tr>
            ))}{!list.length && <tr><td colSpan={5} className="p-8 text-center text-slate-400 text-xs">No certificates issued yet.</td></tr>}</tbody></table>
        </div>
      )}
      {open && <IssueCert onClose={() => setOpen(false)} onDone={() => { setOpen(false); reload(); }} />}
    </Page>
  );
}
function IssueCert({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const ens = useData<{ id: number; student_id: string; course_id: number; status: string; student: { full_name: string } | null; course: { title: string } | null }[]>(() =>
    supabase.from('enrollments').select('id,student_id,course_id,status, student:profiles!enrollments_student_id_fkey(full_name), course:courses(title)').in('status', ['active', 'completed']).order('created_at', { ascending: false }));
  const [eid, setEid] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const sel = (ens.data ?? []).find((e) => String(e.id) === eid);
  const save = async () => {
    if (!sel) return toast.err('Choose a student enrollment');
    setBusy(true);
    const { error } = await supabase.from('certificates').insert({ student_id: sel.student_id, course_id: sel.course_id, title: title || sel.course?.title || 'Course completion' });
    if (!error) { await supabase.from('enrollments').update({ status: 'completed', progress: 100 }).eq('id', sel.id); await notify(sel.student_id, 'Your certificate is ready 🎓', title || sel.course?.title, '/student/certificates'); }
    setBusy(false);
    if (error) toast.err(error.message); else { toast.ok('Certificate issued'); onDone(); }
  };
  return (
    <Modal open onClose={onClose} title="Issue Certificate">
      <div className="space-y-4">
        <Field label="Student & course"><select className={inputCls} value={eid} onChange={(e) => { setEid(e.target.value); setTitle(''); }}><option value="">— Select —</option>{(ens.data ?? []).map((e) => <option key={e.id} value={e.id}>{e.student?.full_name} — {e.course?.title} ({e.status})</option>)}</select></Field>
        <Field label="Certificate title" hint="Defaults to the course title."><input className={inputCls} value={title} placeholder={sel?.course?.title ?? ''} onChange={(e) => setTitle(e.target.value)} /></Field>
        <p className="text-xs text-slate-400">Issuing also marks the enrollment as completed.</p>
        <button disabled={busy} onClick={save} className={`${btnPrimary} w-full`}>{busy && <Loader2 size={16} className="animate-spin" />} Issue Certificate</button>
      </div>
    </Modal>
  );
}

// ---------------- Enroll student (manual) ----------------
export function AdminEnrollStudent() {
  const user = useAuth((s) => s.user);
  const students = useOptions('profiles', 'full_name', { eq: ['role', 'student'] });
  const courses = useOptions('courses', 'title', { eq: ['status', 'published'] });
  const [f, setF] = useState({ student: '', course: '', batch: '', paid: false, amount: '' });
  const batches = useData<{ id: number; name: string }[]>(() => supabase.from('batches').select('id,name').eq('course_id', Number(f.course) || 0).in('status', ['upcoming', 'active']), [f.course]);
  const [busy, setBusy] = useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    const { data: en, error } = await supabase.from('enrollments').insert({ student_id: f.student, course_id: Number(f.course), batch_id: f.batch ? Number(f.batch) : null, status: f.batch ? 'active' : 'pending', source: 'admin' }).select('id').single();
    if (!error && f.paid && Number(f.amount) > 0) await supabase.from('payments').insert({ student_id: f.student, enrollment_id: en.id, amount: Number(f.amount), method: 'cash', status: 'paid', paid_at: new Date().toISOString() });
    if (!error) await notify(f.student, 'You have been enrolled 🎉', courses.find((c) => String(c.value) === f.course)?.label, '/student/my-learning');
    setBusy(false);
    if (error) return toast.err(error.code === '23505' ? 'Student is already enrolled in this batch.' : error.message);
    toast.ok('Student enrolled'); setF({ student: '', course: '', batch: '', paid: false, amount: '' });
  };
  return (
    <Page>
      {user?.demo && <DemoNotice />}
      <PageHero badge="Admissions" badgeColor="indigo" title="Enroll Students" illus="new" subtitle="Register a student directly into a course and batch, and record an offline payment if any." />
      <form onSubmit={save} className="bg-white rounded-4xl border border-slate-100 shadow-sm p-8 grid sm:grid-cols-2 gap-5 max-w-3xl">
        <div className="sm:col-span-2"><Field label="Student"><select required className={inputCls} value={f.student} onChange={(e) => setF({ ...f, student: e.target.value })}><option value="">— Select student —</option>{students.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></Field></div>
        <Field label="Course"><select required className={inputCls} value={f.course} onChange={(e) => setF({ ...f, course: e.target.value, batch: '' })}><option value="">— Select course —</option>{courses.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></Field>
        <Field label="Batch (approves immediately)"><select className={inputCls} value={f.batch} onChange={(e) => setF({ ...f, batch: e.target.value })}><option value="">— Later —</option>{(batches.data ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
        <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold"><input type="checkbox" className="accent-orange-500 w-4 h-4" checked={f.paid} onChange={(e) => setF({ ...f, paid: e.target.checked })} /> Paid at the center</label>
        {f.paid && <Field label="Amount (MYR)"><input type="number" className={inputCls} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>}
        <button disabled={busy || user?.demo} className={`${btnPrimary} sm:col-span-2`}>{busy ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />} Enroll Student</button>
      </form>
    </Page>
  );
}

// ---------------- New students ----------------
type NS = { id: string; full_name: string; email: string; phone: string | null; country: string | null; student_no: string | null; created_at: string; enrollments: { status: string }[] };
export function AdminNewStudents() {
  const user = useAuth((s) => s.user);
  const [days, setDays] = useState(30);
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const { data, loading } = useData<NS[]>(() => supabase.from('profiles').select('id,full_name,email,phone,country,student_no,created_at, enrollments!enrollments_student_id_fkey(status)').eq('role', 'student').gte('created_at', since).order('created_at', { ascending: false }), [days]);
  return (
    <Page>
      {user?.demo && <DemoNotice />}
      <PageHero badge="Admissions" badgeColor="green" title="New Students" illus="new" subtitle="Recently registered students and whether they have enrolled yet — follow up with those who have not.">
        <div className="inline-flex bg-slate-50 p-1 rounded-xl border border-slate-200">{[7, 30, 90].map((d) => <button key={d} onClick={() => setDays(d)} className={`px-4 py-2 rounded-lg text-xs font-bold ${days === d ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>Last {d} days</button>)}</div>
      </PageHero>
      {loading ? <Spinner /> : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[720px]"><thead className="bg-slate-50 text-[11px] font-extrabold uppercase text-slate-500"><tr><th className="px-4 py-3">Student</th><th className="px-3 py-3">Contact</th><th className="px-3 py-3">Country</th><th className="px-3 py-3">Registered</th><th className="px-3 py-3">Enrollment</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{(data ?? []).map((s) => (
              <tr key={s.id}><td className="px-4 py-3"><p className="font-bold">{s.full_name}</p><p className="text-[11px] font-mono text-slate-400">{s.student_no}</p></td>
                <td className="px-3 py-3 text-xs"><p>{s.email}</p>{s.phone && <a className="text-emerald-600 font-bold" href={`https://wa.me/${s.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">WhatsApp {s.phone}</a>}</td>
                <td className="px-3 py-3 text-xs">{s.country ?? '—'}</td><td className="px-3 py-3 text-xs">{fmtDate(s.created_at)}</td>
                <td className="px-3 py-3">{s.enrollments?.length ? <StatusPill status={s.enrollments[0].status} /> : <span className="text-[10px] font-black uppercase text-red-500">Not enrolled</span>}</td></tr>
            ))}{!data?.length && <tr><td colSpan={5} className="p-8 text-center text-slate-400 text-xs">No new students in this period.</td></tr>}</tbody></table>
        </div>
      )}
    </Page>
  );
}
