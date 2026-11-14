import { useMemo, useState } from 'react';
import { CreditCard, Download, FileText } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { fmtDateTime, money, useData } from '../../lib/db';
import { DemoNotice, Page, PageHero, SearchInput, StatusPill, toast } from '../../components/ui';
import { printInvoice } from '../../lib/invoice';

type Payment = {
  id: number; amount: number; currency: string; method: string | null; reference: string | null; receipt_url: string | null;
  invoice_no: string; status: string; paid_at: string | null; created_at: string;
  enrollment: { course: { title: string; code: string } | null } | null;
};

export default function StudentFinances() {
  const user = useAuth((s) => s.user);
  const profile = useAuth((s) => s.profile);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const { data, loading } = useData<Payment[]>(() =>
    supabase.from('payments').select('*, enrollment:enrollments(course:courses(title,code))').eq('student_id', user!.id).order('created_at', { ascending: false }));
  const list = useMemo(() => (data ?? []).filter((p) =>
    `${p.enrollment?.course?.title ?? ''} ${p.invoice_no} ${p.amount}`.toLowerCase().includes(q.toLowerCase())), [data, q]);
  const pages = Math.max(1, Math.ceil(list.length / 10));
  const rows = list.slice((page - 1) * 10, page * 10);

  const receipt = async (path: string) => {
    const { data, error } = await supabase.storage.from('uploads').createSignedUrl(path, 300);
    if (error) return toast.err(error.message);
    window.open(data.signedUrl, '_blank');
  };

  return (
    <Page>
      {user?.demo && <DemoNotice />}
      <PageHero badge="Financials" badgeColor="green" title="Payment History" illus="payment" subtitle="View your transaction records and download official PDF tax invoices.">
        <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search by course, invoice ID, or amount..." />
      </PageHero>
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden w-full">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex justify-between items-center bg-white">
          <h2 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-2"><CreditCard size={18} className="text-slate-500" /> Transactions</h2>
          <div className="text-xs text-slate-400 font-medium flex items-center gap-2">
            {pages > 1 && <button disabled={page === 1} onClick={() => setPage(page - 1)} className="px-2 py-1 rounded border border-slate-200 disabled:opacity-40">‹</button>}
            Page {page} of {pages}
            {pages > 1 && <button disabled={page === pages} onClick={() => setPage(page + 1)} className="px-2 py-1 rounded border border-slate-200 disabled:opacity-40">›</button>}
          </div>
        </div>
        <div className="w-full overflow-x-auto">
          <table className="w-full table-fixed text-left text-xs sm:text-sm min-w-[720px]">
            <thead className="bg-slate-50 border-b border-slate-100 text-[11px] font-extrabold uppercase text-slate-500 tracking-wider">
              <tr>
                <th className="w-[30%] px-3 sm:px-4 py-3">Course / Invoice</th><th className="w-[18%] px-2 sm:px-3 py-3">Date &amp; Time</th>
                <th className="w-[18%] px-2 sm:px-3 py-3">Transaction ID</th><th className="w-[14%] px-2 sm:px-3 py-3">Amount</th>
                <th className="w-[12%] px-2 sm:px-3 py-3">Status</th><th className="w-[8%] px-2 sm:px-3 py-3 text-right">PDF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? <tr><td colSpan={6} className="p-8 text-center text-slate-400 text-xs">Loading…</td></tr> :
                rows.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-slate-400 text-xs">No payment history found.</td></tr> :
                rows.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/60">
                    <td className="px-3 sm:px-4 py-3"><p className="font-bold text-slate-800 truncate">{p.enrollment?.course?.title ?? 'Payment'}</p><p className="text-[11px] text-slate-400 font-mono">{p.invoice_no}</p></td>
                    <td className="px-2 sm:px-3 py-3 text-slate-600">{fmtDateTime(p.paid_at ?? p.created_at)}</td>
                    <td className="px-2 sm:px-3 py-3 text-slate-500 font-mono truncate">{p.reference ?? `TXN-${p.id}`}</td>
                    <td className="px-2 sm:px-3 py-3 font-bold text-slate-800">{money(p.amount, p.currency)}</td>
                    <td className="px-2 sm:px-3 py-3"><StatusPill status={p.status} /></td>
                    <td className="px-2 sm:px-3 py-3 text-right space-x-1">
                      {p.receipt_url && <button title="Receipt" onClick={() => receipt(p.receipt_url!)} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"><FileText size={16} /></button>}
                      {p.status === 'paid' && <button title="Invoice" onClick={() => printInvoice(p, profile)} className="p-1.5 rounded-lg text-slate-400 hover:text-orange-600 hover:bg-orange-50"><Download size={16} /></button>}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </Page>
  );
}
