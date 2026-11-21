import { askConfirm, askText } from '../../components/dialogs';
import { useState } from 'react';
import { BookOpen, Calendar, Check, ChevronLeft, ChevronRight, FileText, Filter, Loader2, Search, Trash2, User, X } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { fmtDate, money, useData } from '../../lib/db';
import { Illus } from '../../components/media';
import { DemoNotice, Field, Modal, Spinner, StatusPill, btnGhost, btnPrimary, inputCls, toast } from '../../components/ui';

export type AdmEnrollment = {
  id: number; status: string; progress: number; source: string; note: string | null; created_at: string; course_id: number; batch_id: number | null;
  student: { id: string; full_name: string; email: string; student_no: string | null; phone: string | null } | null;
  course: { title: string; code: string; price: number } | null; batch: { name: string } | null; option?: { name: string } | null;
  payments: { id: number; amount: number; currency: string; status: string; receipt_url: string | null; reference: string | null; method?: string | null }[];
};

export const ENROLL_SELECT = 'id,status,progress,source,note,created_at,course_id,batch_id, student:profiles!enrollments_student_id_fkey(id,full_name,email,student_no,phone), course:courses(title,code,price), batch:batches(name), option:course_options(name), payments(id,amount,currency,status,receipt_url,reference,method)';

export async function notify(user_id: string, title: string, body?: string, link?: string) {
  await supabase.from('notifications').insert({ user_id, title, body: body ?? null, link: link ?? null });
}

export default function AdminEnrollments() {
  const user = useAuth((s) => s.user);
  const [q, setQ] = useState('');
  const [st, setSt] = useState('all');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<AdmEnrollment | null>(null);
  const { data, loading, reload } = useData<AdmEnrollment[]>(() => supabase.from('enrollments').select(ENROLL_SELECT).order('created_at', { ascending: false }));
  const list = (data ?? []).filter((e) => (st === 'all' || e.status === st) && `${e.student?.full_name} ${e.student?.email} ${e.student?.student_no} ${e.course?.title}`.toLowerCase().includes(q.toLowerCase()));
  const pages = Math.max(1, Math.ceil(list.length / 9));
  const del = async (e: AdmEnrollment) => {
    if (!await askConfirm('Delete this enrollment?')) return;
    const { error } = await supabase.from('enrollments').delete().eq('id', e.id);
    if (error) toast.err(error.message); else reload();
  };
  return (
    <div className="w-full bg-[#fafafa] font-sans min-h-screen pb-20">
      <main className="max-w-7xl mx-auto px-6 py-8">
        {user?.demo && <DemoNotice />}
        <div className="bg-white rounded-4xl border border-slate-100 shadow-sm p-8 mb-10 flex flex-col-reverse lg:flex-row items-center justify-between relative overflow-hidden">
          <div className="z-10 w-full lg:w-1/2 mt-6 lg:mt-0">
            <span className="inline-block px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-xs font-bold uppercase tracking-wider mb-4 border border-emerald-100">Student Management</span>
            <h1 className="text-4xl font-extrabold text-slate-900 mb-3 tracking-tight">Enrollments</h1>
            <p className="text-slate-500 text-base mb-8 leading-relaxed max-w-md">Track student applications, approve pending payments, review placement results, and manage active batch lists.</p>
            <div className="flex flex-col sm:flex-row gap-3 max-w-lg">
              <div className="relative flex-1"><Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search name, email, or #..." className="w-full pl-10 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-200" /></div>
              <div className="relative"><Filter size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <select value={st} onChange={(e) => { setSt(e.target.value); setPage(1); }} className="pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 outline-none">
                  <option value="all">All Statuses</option>{['pending', 'active', 'completed', 'rejected', 'cancelled'].map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
            </div>
          </div>
          <div className="w-full lg:w-1/2 flex justify-center lg:justify-end"><Illus name="enrollment" className="max-h-72 object-contain drop-shadow-xl" /></div>
        </div>
        {loading ? <Spinner /> : list.length === 0 ? <p className="text-center text-slate-400 py-16">No enrollments found.</p> : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {list.slice((page - 1) * 9, page * 9).map((e) => (
                <div key={e.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 flex flex-col">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 grid place-items-center font-bold shrink-0">{e.student?.full_name?.[0]?.toUpperCase() ?? <User size={16} />}</span>
                    <div className="min-w-0 flex-1"><p className="font-bold text-slate-900 truncate">{e.student?.full_name}</p><p className="text-[10px] font-mono text-slate-400 truncate">{e.student?.student_no} · #{e.id}</p></div>
                    <StatusPill status={e.status} />
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-1.5 text-xs">
                    <p className="font-bold text-slate-800 flex items-center gap-2"><BookOpen size={14} className="text-orange-500" />{e.course?.title}{e.option && <span className="text-[10px] font-black uppercase text-indigo-600">{e.option.name}</span>}</p>
                    <p className="text-slate-500 flex items-center gap-2"><Calendar size={14} />{e.batch?.name ?? 'No Batch Assigned'}</p>
                    <p className="text-slate-500 flex items-center justify-between"><span>Payment</span><span className="font-bold">{e.payments.length ? <StatusPill status={e.payments[0].status} /> : Number(e.course?.price) ? 'Not submitted' : 'Free'}</span></p>
                  </div>
                  <div className="flex items-center justify-between mt-4"><span className="text-xs text-slate-400">{fmtDate(e.created_at)}</span>
                    <div className="flex gap-1"><button onClick={() => setOpen(e)} className="px-4 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-900 hover:text-white text-xs font-bold text-slate-700 transition-colors">Manage</button>
                      <button onClick={() => del(e)} className="p-1.5 rounded-lg text-slate-300 hover:text-red-500"><Trash2 size={16} /></button></div></div>
                </div>
              ))}
            </div>
            {pages > 1 && <div className="flex justify-center items-center gap-2 mt-10">
              <button disabled={page === 1} onClick={() => setPage(page - 1)} className="w-9 h-9 rounded-xl bg-white border border-slate-200 grid place-items-center disabled:opacity-40"><ChevronLeft size={16} /></button>
              {Array.from({ length: pages }, (_, i) => <button key={i} onClick={() => setPage(i + 1)} className={`w-9 h-9 rounded-xl text-sm font-bold ${page === i + 1 ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200'}`}>{i + 1}</button>)}
              <button disabled={page === pages} onClick={() => setPage(page + 1)} className="w-9 h-9 rounded-xl bg-white border border-slate-200 grid place-items-center disabled:opacity-40"><ChevronRight size={16} /></button>
            </div>}
          </>
        )}
      </main>
      {open && <ManageEnrollment e={open} onClose={() => setOpen(null)} onDone={() => { setOpen(null); reload(); }} />}
    </div>
  );
}

export function ManageEnrollment({ e, onClose, onDone }: { e: AdmEnrollment; onClose: () => void; onDone: () => void }) {
  const [batch, setBatch] = useState<string>(e.batch_id ? String(e.batch_id) : '');
  const [note, setNote] = useState(e.note ?? '');
  const [busy, setBusy] = useState(false);
  const batches = useData<{ id: number; name: string; capacity: number; enrollments: { count: number }[] }[]>(() =>
    supabase.from('batches').select('id,name,capacity,enrollments(count)').eq('course_id', e.course_id).in('status', ['upcoming', 'active']));
  const pay = e.payments[0];
  const receipt = async () => { const { data } = await supabase.storage.from('uploads').createSignedUrl(pay.receipt_url!, 300); if (data) window.open(data.signedUrl, '_blank'); };

  const setStatus = async (status: string) => {
    if (status === 'active' && !batch) return toast.err('Assign a batch before approving.');
    setBusy(true);
    const { error } = await supabase.from('enrollments').update({ status, batch_id: batch ? Number(batch) : null, note: note || null }).eq('id', e.id);
    if (!error && pay && status === 'active' && pay.status === 'pending' && pay.method !== 'card') await supabase.from('payments').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', pay.id);
    if (!error && pay && status === 'rejected' && pay.status === 'pending') await supabase.from('payments').update({ status: 'failed' }).eq('id', pay.id);
    if (!error && e.student) {
      const t = { active: 'Enrollment approved 🎉', rejected: 'Enrollment not approved', completed: 'Course completed', cancelled: 'Enrollment cancelled', pending: 'Enrollment updated' }[status] ?? 'Enrollment updated';
      await notify(e.student.id, t, `${e.course?.title}${note ? ` — ${note}` : ''}`, '/student/my-learning');
    }
    setBusy(false);
    if (error) return toast.err(error.message);
    toast.ok(`Enrollment ${status}`); onDone();
  };

  return (
    <Modal open onClose={onClose} title="Manage Enrollment" wide>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <p className="text-[10px] font-bold uppercase text-slate-400">Student</p>
            <p className="font-bold text-slate-900">{e.student?.full_name}</p>
            <p className="text-xs text-slate-500">{e.student?.email} · {e.student?.phone ?? 'no phone'}</p>
            <p className="text-xs text-slate-400 font-mono">{e.student?.student_no}</p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <p className="text-[10px] font-bold uppercase text-slate-400">Course</p>
            <p className="font-bold text-slate-900">{e.course?.title} <span className="text-xs text-slate-400">({e.course?.code})</span>{e.option ? ` · ${e.option.name}` : ''}</p>
            <p className="text-xs text-slate-500">Requested {fmtDate(e.created_at)} · source: {e.source} · status: <StatusPill status={e.status} /></p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Payment</p>
            {pay ? (
              <div className="flex items-center justify-between gap-2"><div><p className="font-bold text-slate-900">{money(pay.amount, pay.currency)}</p><p className="text-xs text-slate-500">Ref: {pay.reference ?? '—'}</p></div>
                <div className="flex items-center gap-2"><StatusPill status={pay.status} />{pay.receipt_url && <button onClick={receipt} className="flex items-center gap-1 text-xs font-bold text-indigo-600"><FileText size={14} />Receipt</button>}</div></div>
            ) : <p className="text-sm text-slate-500">{Number(e.course?.price) ? 'No payment submitted.' : 'Free course — no payment needed.'}</p>}
          </div>
        </div>
        <div className="space-y-4">
          <Field label="Assign batch">
            <select className={inputCls} value={batch} onChange={(x) => setBatch(x.target.value)}>
              <option value="">— No batch —</option>
              {(batches.data ?? []).map((b) => <option key={b.id} value={b.id}>{b.name} ({b.enrollments?.[0]?.count ?? 0}/{b.capacity})</option>)}
            </select>
          </Field>
          <Field label="Note to student (optional)"><textarea rows={3} className={inputCls} value={note} onChange={(x) => setNote(x.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <button disabled={busy} onClick={() => setStatus('active')} className={`${btnPrimary} bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100`}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Approve</button>
            <button disabled={busy} onClick={() => setStatus('rejected')} className={`${btnGhost} text-red-600 border-red-100 hover:bg-red-50`}><X size={16} /> Reject</button>
            <button disabled={busy} onClick={() => setStatus('completed')} className={btnGhost}>Mark Completed</button>
            <button disabled={busy} onClick={() => setStatus('cancelled')} className={btnGhost}>Cancel</button>
          </div>
          <p className="text-[11px] text-slate-400">Approving marks a pending payment as paid and notifies the student.</p>
        </div>
      </div>
    </Modal>
  );
}
