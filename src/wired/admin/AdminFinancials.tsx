import { useMemo, useState } from 'react';
import { Banknote, Check, Clock, FileText, Search, TrendingUp, X } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { fmtDateTime, money, useData } from '../../lib/db';
import { DemoNotice, Page, PageHero, Spinner, StatusPill, toast } from '../../components/ui';
import { notify } from './AdminEnrollments';

type P = { id: number; amount: number; currency: string; status: string; method: string | null; reference: string | null; receipt_url: string | null; invoice_no: string; description: string | null; kind: string; discount: number; tax: number; refunded_amount: number; paid_at: string | null; created_at: string; enrollment_id: number | null;
  student: { id: string; full_name: string; email: string } | null; enrollment: { course: { title: string } | null } | null };

export default function AdminFinancials() {
  const user = useAuth((s) => s.user);
  const [q, setQ] = useState('');
  const [st, setSt] = useState('all');
  const { data, loading, reload } = useData<P[]>(() => supabase.from('payments').select('*, student:profiles!payments_student_id_fkey(id,full_name,email), enrollment:enrollments(course:courses(title))').order('created_at', { ascending: false }));
  const list = (data ?? []).filter((p) => (st === 'all' || p.status === st) && `${p.student?.full_name} ${p.student?.email} ${p.invoice_no} ${p.reference ?? ''} ${p.description ?? ''}`.toLowerCase().includes(q.toLowerCase()));
  const stats = useMemo(() => {
    const d = data ?? []; const month = new Date().toISOString().slice(0, 7);
    const sum = (f: (p: P) => boolean) => d.filter(f).reduce((a, p) => a + Number(p.amount) - Number(p.refunded_amount ?? 0), 0);
    return [
      { l: 'Total Revenue', v: money(sum((p) => p.status === 'paid')), icon: Banknote, c: 'bg-emerald-50 text-emerald-600' },
      { l: 'This Month', v: money(sum((p) => p.status === 'paid' && (p.paid_at ?? '').startsWith(month))), icon: TrendingUp, c: 'bg-indigo-50 text-indigo-600' },
      { l: 'Pending Verification', v: `${d.filter((p) => p.status === 'pending').length}`, icon: Clock, c: 'bg-orange-50 text-orange-600' },
      { l: 'Pending Amount', v: money(sum((p) => p.status === 'pending')), icon: FileText, c: 'bg-slate-100 text-slate-700' },
    ];
  }, [data]);
  const receipt = async (p: string) => { const { data } = await supabase.storage.from('uploads').createSignedUrl(p, 300); if (data) window.open(data.signedUrl, '_blank'); };
  const verify = async (p: P, ok: boolean) => {
    const { error } = await supabase.from('payments').update(ok ? { status: 'paid', paid_at: new Date().toISOString() } : { status: 'failed' }).eq('id', p.id);
    if (error) return toast.err(error.message);
    if (p.student) await notify(p.student.id, ok ? 'Payment confirmed' : 'Payment could not be verified', `${p.description ?? p.enrollment?.course?.title ?? ''} · ${money(p.amount, p.currency)}`, '/student/finances');
    toast.ok(ok ? 'Payment marked as paid' : 'Payment rejected'); reload();
  };
  return (
    <Page wide>
      {user?.demo && <DemoNotice />}
      <PageHero badge="Finance" badgeColor="green" title="Financial Overview" illus="finance" subtitle="Verify student transfers, track revenue and download records.">
        <div className="flex flex-col sm:flex-row gap-3 max-w-lg">
          <div className="relative flex-1"><Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search student, invoice, reference..." className="w-full pl-10 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none" /></div>
          <select value={st} onChange={(e) => setSt(e.target.value)} className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"><option value="all">All</option>{['pending', 'paid', 'failed', 'refunded', 'cancelled'].map((s) => <option key={s}>{s}</option>)}</select>
        </div>
      </PageHero>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {stats.map(({ l, v, icon: I, c }) => (
          <div key={l} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5"><span className={`w-11 h-11 rounded-xl grid place-items-center mb-3 ${c}`}><I size={20} /></span><p className="text-2xl font-black text-slate-900">{v}</p><p className="text-xs font-bold text-slate-500">{l}</p></div>
        ))}
      </div>
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-x-auto">
        <table className="w-full text-left text-sm min-w-[900px]">
          <thead className="bg-slate-50 border-b border-slate-100 text-[11px] font-extrabold uppercase text-slate-500 tracking-wider">
            <tr><th className="px-4 py-3">Student</th><th className="px-3 py-3">Course / Invoice</th><th className="px-3 py-3">Date</th><th className="px-3 py-3">Reference</th><th className="px-3 py-3">Amount</th><th className="px-3 py-3">Status</th><th className="px-3 py-3 text-right">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? <tr><td colSpan={7}><Spinner /></td></tr> : list.length === 0 ? <tr><td colSpan={7} className="p-8 text-center text-slate-400 text-xs">No payments found.</td></tr> : list.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50/60">
                <td className="px-4 py-3"><p className="font-bold text-slate-800">{p.student?.full_name}</p><p className="text-[11px] text-slate-400">{p.student?.email}</p></td>
                <td className="px-3 py-3"><p className="font-semibold text-slate-700">{p.description ?? p.enrollment?.course?.title ?? '—'} {p.kind !== 'course' && <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600">{p.kind}</span>}</p><p className="text-[11px] font-mono text-slate-400">{p.invoice_no}</p></td>
                <td className="px-3 py-3 text-slate-600 text-xs">{fmtDateTime(p.paid_at ?? p.created_at)}</td>
                <td className="px-3 py-3 text-xs font-mono text-slate-500">{p.reference ?? '—'}</td>
                <td className="px-3 py-3 font-bold">{money(p.amount, p.currency)}{Number(p.discount) > 0 && <p className="text-[10px] font-semibold text-emerald-600">{`−${money(p.discount, p.currency)} discount`}</p>}{Number(p.refunded_amount) > 0 && <p className="text-[10px] font-semibold text-red-500">{`${money(p.refunded_amount, p.currency)} refunded`}</p>}</td>
                <td className="px-3 py-3"><StatusPill status={p.status} /></td>
                <td className="px-3 py-3 text-right whitespace-nowrap">
                  {p.receipt_url && <button onClick={() => receipt(p.receipt_url!)} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600" title="Receipt"><FileText size={16} /></button>}
                  {p.status === 'pending' && <><button onClick={() => verify(p, true)} className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-50" title="Mark paid"><Check size={16} /></button>
                    <button onClick={() => verify(p, false)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50" title="Reject"><X size={16} /></button></>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Page>
  );
}
