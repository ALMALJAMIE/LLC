import { useState } from 'react';
import { Check, FileText, Paperclip, X } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { fmtDate, useData } from '../../lib/db';
import { DemoNotice, Page, PageHero, Spinner, StatusPill, toast } from '../../components/ui';
import { notify } from '../admin/AdminEnrollments';

type R = { id: number; batch_id: number | null; date_from: string; date_to: string; reason: string; attachment_url: string | null; status: string; review_note: string | null; created_at: string; student: { id: string; full_name: string; student_no: string | null } | null; batch: { name: string; instructor_id: string | null } | null };

export default function AbsenceApprovals() {
  const user = useAuth((s) => s.user)!;
  const [tab, setTab] = useState('pending');
  const { data, loading, reload } = useData<R[]>(() => supabase.from('absence_requests').select('*, student:profiles!absence_requests_student_id_fkey(id,full_name,student_no), batch:batches(name,instructor_id)').order('created_at', { ascending: false }));
  const list = (data ?? []).filter((r) => (tab === 'all' || r.status === tab) && (user.role === 'admin' || !r.batch || r.batch.instructor_id === user.id));
  const view = async (p: string) => { const { data } = await supabase.storage.from('uploads').createSignedUrl(p, 300); if (data) window.open(data.signedUrl, '_blank'); };
  const decide = async (r: R, status: 'approved' | 'rejected') => {
    const note = status === 'rejected' ? prompt('Reason for rejection (shown to the student):') ?? '' : '';
    const { error } = await supabase.from('absence_requests').update({ status, reviewed_by: user.id, review_note: note || null }).eq('id', r.id);
    if (error) return toast.err(error.message);
    if (status === 'approved' && r.student) {
      // mark the student's missed classes in that period as excused
      let ids = r.batch_id ? [r.batch_id] : [];
      if (!ids.length) {
        const en = await supabase.from('enrollments').select('batch_id').eq('student_id', r.student.id).eq('status', 'active');
        ids = (en.data ?? []).map((x) => x.batch_id).filter(Boolean) as number[];
      }
      const ss = await supabase.from('class_sessions').select('id').in('batch_id', ids.length ? ids : [0]).gte('starts_at', r.date_from).lte('starts_at', `${r.date_to}T23:59:59`);
      const rows = (ss.data ?? []).map((s) => ({ session_id: s.id, student_id: r.student!.id, status: 'excused' }));
      if (rows.length) await supabase.from('attendance').upsert(rows, { onConflict: 'session_id,student_id', ignoreDuplicates: true });
    }
    if (r.student) await notify(r.student.id, `Medical leave ${status}`, `${fmtDate(r.date_from)} – ${fmtDate(r.date_to)}${note ? ` · ${note}` : ''}`, '/student/absence-excuse');
    toast.ok(`Request ${status}`); reload();
  };
  return (
    <Page>
      {user.demo && <DemoNotice />}
      <PageHero badge="Attendance" badgeColor="indigo" title="Medical Leave & MC" illus="documents" subtitle="Review medical certificates and excuses. Approved dates are marked as excused in attendance.">
        <div className="inline-flex bg-slate-50 p-1 rounded-xl border border-slate-200">
          {['pending', 'approved', 'rejected', 'all'].map((t) => <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-xs font-bold capitalize ${tab === t ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>{t}</button>)}
        </div>
      </PageHero>
      {loading ? <Spinner /> : list.length === 0 ? <p className="text-center text-slate-400 py-16">No {tab === 'all' ? '' : tab} requests.</p> : (
        <div className="space-y-4">
          {list.map((r) => (
            <div key={r.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 flex flex-col md:flex-row md:items-center gap-4">
              <span className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 grid place-items-center shrink-0"><FileText size={22} /></span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800">{r.student?.full_name} <span className="text-xs font-mono text-slate-400">{r.student?.student_no}</span></p>
                <p className="text-sm text-slate-600">{fmtDate(r.date_from)}{r.date_to !== r.date_from && ` – ${fmtDate(r.date_to)}`} · {r.batch?.name ?? 'All classes'}</p>
                <p className="text-sm text-slate-500 line-clamp-2">{r.reason}</p>
              </div>
              {r.attachment_url && <button onClick={() => view(r.attachment_url!)} className="flex items-center gap-1 text-xs font-bold text-indigo-600"><Paperclip size={14} /> Certificate</button>}
              {r.status === 'pending' ? (
                <div className="flex gap-2"><button onClick={() => decide(r, 'approved')} className="flex items-center gap-1 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold"><Check size={14} />Approve</button>
                  <button onClick={() => decide(r, 'rejected')} className="flex items-center gap-1 px-4 py-2 rounded-xl border border-red-100 text-red-600 text-xs font-bold"><X size={14} />Reject</button></div>
              ) : <StatusPill status={r.status} />}
            </div>
          ))}
        </div>
      )}
    </Page>
  );
}
