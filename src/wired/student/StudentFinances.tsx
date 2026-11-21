import { useEffect, useMemo, useState } from 'react';
import { payOnline } from '../../lib/stripe';
import { useBilling, useCenter } from '../../lib/site';
import { CreditCard, Download, FileText, Loader2, RotateCcw } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { fmtDate, fmtDateTime, money, useData } from '../../lib/db';
import { DemoNotice, Modal, Page, PageHero, SearchInput, StatusPill, btnPrimary, inputCls, toast } from '../../components/ui';
import { askText } from '../../components/dialogs';
import { BankDetails, ReceiptPicker, uploadReceipt } from '../../components/PayBox';
import { printInvoice, type InvoiceData } from '../../lib/invoice';

type Payment = InvoiceData & { id: number; receipt_url: string | null; discount_code?: { code: string } | null };
type Refund = { id: number; payment_id: number; amount: number; reason: string; status: string; response: string | null; created_at: string };

export const titleOf = (p: Pick<Payment, 'description' | 'enrollment' | 'kind'>) => p.description ?? p.enrollment?.course?.title ?? (p.kind === 'custom' ? 'Invoice' : 'Payment');

export default function StudentFinances() {
  const user = useAuth((s) => s.user);
  const profile = useAuth((s) => s.profile);
  const CENTER = useCenter();
  const billing = useBilling();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [paying, setPaying] = useState<Payment | null>(null);
  useEffect(() => {
    const u = new URLSearchParams(location.search);
    if (u.get('paid')) toast.ok('Thank you! Your payment is being confirmed.');
    if (u.get('cancelled')) toast.err('Payment cancelled. You can pay later from this page.');
    if (u.get('paid') || u.get('cancelled')) history.replaceState(null, '', location.pathname);
  }, []);
  const { data, loading, reload } = useData<Payment[]>(async () => {
    await supabase.rpc('expire_unpaid');
    return supabase.from('payments').select('*, enrollment:enrollments(course:courses(title,code)), discount_code:discount_codes(code)').eq('student_id', user!.id).order('created_at', { ascending: false });
  });
  const refunds = useData<Refund[]>(() => supabase.from('refund_requests').select('*').eq('student_id', user!.id).order('created_at', { ascending: false }));
  const list = useMemo(() => (data ?? []).filter((p) =>
    `${titleOf(p)} ${p.invoice_no} ${p.amount}`.toLowerCase().includes(q.toLowerCase())), [data, q]);
  const pages = Math.max(1, Math.ceil(list.length / 10));
  const rows = list.slice((page - 1) * 10, page * 10);

  const receipt = async (path: string) => {
    const { data, error } = await supabase.storage.from('uploads').createSignedUrl(path, 300);
    if (error) return toast.err(error.message);
    window.open(data.signedUrl, '_blank');
  };
  const canRefund = (p: Payment) => p.status === 'paid' && Number(p.amount) - Number(p.refunded_amount ?? 0) > 0 && !!p.paid_at
    && Date.now() - new Date(p.paid_at).getTime() < billing.refundDays * 86400000
    && !(refunds.data ?? []).some((r) => r.payment_id === p.id && ['requested', 'approved'].includes(r.status));
  const refund = async (p: Payment) => {
    const reason = await askText(`Ask for a refund of ${money(Number(p.amount) - Number(p.refunded_amount ?? 0), p.currency)} for "${titleOf(p)}". Why do you want a refund?`);
    if (reason === null) return;
    const { error } = await supabase.rpc('request_refund', { p_payment: p.id, p_reason: reason });
    if (error) toast.err(error.message); else { toast.ok('Refund request sent. The finance team will answer you.'); refunds.reload(); }
  };

  return (
    <Page>
      {user?.demo && <DemoNotice />}
      <PageHero badge="Financials" badgeColor="green" title="Payment History" illus="payment" subtitle="Your payments, invoices from the office, receipts and refunds.">
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
          <table className="w-full table-fixed text-left text-xs sm:text-sm min-w-[760px]">
            <thead className="bg-slate-50 border-b border-slate-100 text-[11px] font-extrabold uppercase text-slate-500 tracking-wider">
              <tr>
                <th className="w-[30%] px-3 sm:px-4 py-3">Item / Invoice</th><th className="w-[17%] px-2 sm:px-3 py-3">Date &amp; Time</th>
                <th className="w-[17%] px-2 sm:px-3 py-3">Amount</th>
                <th className="w-[12%] px-2 sm:px-3 py-3">Status</th><th className="w-[24%] px-2 sm:px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? <tr><td colSpan={5} className="p-8 text-center text-slate-400 text-xs">Loading…</td></tr> :
                rows.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-slate-400 text-xs">No payment history found.</td></tr> :
                rows.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/60">
                    <td className="px-3 sm:px-4 py-3"><p className="font-bold text-slate-800 truncate">{titleOf(p)}</p><p className="text-[11px] text-slate-400 font-mono">{p.invoice_no}</p>
                      {p.status === 'pending' && p.due_at && <p className="text-[11px] font-bold text-orange-600">{`Due ${fmtDate(p.due_at)}`}</p>}</td>
                    <td className="px-2 sm:px-3 py-3 text-slate-600">{fmtDateTime(p.paid_at ?? p.created_at)}</td>
                    <td className="px-2 sm:px-3 py-3"><p className="font-bold text-slate-800">{money(p.amount, p.currency)}</p>
                      {Number(p.discount) > 0 && <p className="text-[11px] text-emerald-600 font-semibold">{`Saved ${money(p.discount, p.currency)}`}{p.discount_code ? ` · ${p.discount_code.code}` : ''}</p>}
                      {Number(p.refunded_amount) > 0 && <p className="text-[11px] text-red-500 font-semibold">{`Refunded ${money(p.refunded_amount, p.currency)}`}</p>}
                      {canRefund(p) && p.paid_at && <p className="text-[11px] text-slate-400">{`Refund possible until ${fmtDate(new Date(new Date(p.paid_at).getTime() + billing.refundDays * 86400000).toISOString())}`}</p>}</td>
                    <td className="px-2 sm:px-3 py-3"><StatusPill status={p.status} />{p.status === 'pending' && p.receipt_url && <p className="text-[10px] text-slate-400 mt-1">Being checked</p>}</td>
                    <td className="px-2 sm:px-3 py-3 text-right space-x-1 whitespace-nowrap">
                      {p.status === 'pending' && !p.receipt_url && <button onClick={() => setPaying(p)} className="px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-[11px] font-bold">Pay now</button>}
                      {canRefund(p) && <button title="Ask for a refund" onClick={() => refund(p)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50"><RotateCcw size={16} /></button>}
                      {p.receipt_url && <button title="Receipt" onClick={() => receipt(p.receipt_url!)} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"><FileText size={16} /></button>}
                      {p.status !== 'failed' && p.status !== 'cancelled' && <button title={p.status === 'pending' ? 'Invoice' : 'Receipt PDF'} onClick={() => printInvoice(p, profile)} className="p-1.5 rounded-lg text-slate-400 hover:text-orange-600 hover:bg-orange-50"><Download size={16} /></button>}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      {!!(refunds.data ?? []).length && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 mt-6">
          <h2 className="font-bold text-slate-800 flex items-center gap-2 mb-3"><RotateCcw size={18} className="text-slate-500" />Refund requests</h2>
          <div className="divide-y divide-slate-100">{(refunds.data ?? []).map((r) => {
            const p = (data ?? []).find((x) => x.id === r.payment_id);
            return (
              <div key={r.id} className="py-3 flex flex-wrap items-center gap-3 text-sm">
                <div className="flex-1 min-w-48"><p className="font-semibold text-slate-700">{p ? titleOf(p) : `#${r.payment_id}`} · {money(r.amount, p?.currency)}</p><p className="text-[11px] text-slate-400">{fmtDateTime(r.created_at)}{r.response ? ` — ${r.response}` : ''}</p></div>
                <StatusPill status={r.status} />
              </div>
            );
          })}</div>
        </div>
      )}
      <p className="text-xs text-slate-400 mt-4">{`Refunds can be requested within ${billing.refundDays} days of payment.`} <a href={`${import.meta.env.BASE_URL}legal/refunds`} target="_blank" rel="noreferrer" className="font-bold text-indigo-600">Refund policy</a></p>
      {paying && <PayPending p={paying} online={!!CENTER.bank.onlinePay} onClose={() => setPaying(null)} onDone={() => { setPaying(null); reload(); }} />}
    </Page>
  );
}

function PayPending({ p, online, onClose, onDone }: { p: Payment; online: boolean; onClose: () => void; onDone: () => void }) {
  const user = useAuth((s) => s.user)!;
  const [file, setFile] = useState<File | null>(null);
  const [ref, setRef] = useState('');
  const [busy, setBusy] = useState(false);
  const card = async () => { setBusy(true); const e = await payOnline(p.id); setBusy(false); if (e) toast.err(e); };
  const send = async () => {
    if (!file) return toast.err('Please attach your payment receipt.');
    setBusy(true);
    const path = await uploadReceipt(user.id, file);
    if (!path) return setBusy(false);
    const { error } = await supabase.rpc('submit_receipt', { p_payment: p.id, p_receipt: path, p_reference: ref || null });
    setBusy(false);
    if (error) toast.err(error.message); else { toast.ok('Receipt sent. We will confirm your payment shortly.'); onDone(); }
  };
  return (
    <Modal open onClose={onClose} title={`${titleOf(p)} · ${money(p.amount, p.currency)}`}>
      <div className="space-y-4">
        {p.lines && p.lines.length > 0 && <div className="text-sm divide-y divide-slate-100 border border-slate-100 rounded-xl">{p.lines.map((l, i) => <div key={i} className="flex justify-between px-3 py-2"><span>{l.description}</span><span data-no-i18n>{l.qty} × {money(l.unit, p.currency)}</span></div>)}</div>}
        {online && <button disabled={busy} onClick={card} className={`${btnPrimary} w-full`}>{busy ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />} Pay online (card)</button>}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Pay by bank transfer</p>
          <BankDetails />
          <input className={inputCls} placeholder={`Transfer reference (e.g. ${p.invoice_no})`} value={ref} onChange={(e) => setRef(e.target.value)} />
          <ReceiptPicker file={file} onFile={setFile} />
          <button disabled={busy} onClick={send} className={`${btnPrimary} w-full`}>{busy && <Loader2 size={16} className="animate-spin" />} Send receipt</button>
        </div>
      </div>
    </Modal>
  );
}
