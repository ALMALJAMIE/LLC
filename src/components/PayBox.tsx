import { useEffect, useState } from 'react';
import { Loader2, Tag, Upload } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { fmtDateTime, money } from '../lib/db';
import { useBilling, useCenter } from '../lib/site';
import { useApprox } from '../lib/price';
import { payOnline } from '../lib/stripe';
import { btnAccent, btnGhost, inputCls, toast } from './ui';

type Quote = { description: string; subtotal: number; discount: number; tax: number; total: number; currency: string; code_error: string | null };

/** Upload a payment receipt into the student's own folder; returns the storage path. */
export async function uploadReceipt(userId: string, file: File): Promise<string | null> {
  const path = `${userId}/receipts/${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`;
  const up = await supabase.storage.from('uploads').upload(path, file);
  if (up.error) { toast.err(up.error.message); return null; }
  return path;
}

export function BankDetails() {
  const CENTER = useCenter();
  return (
    <div className="text-sm text-slate-600 grid grid-cols-3 gap-y-1"><span className="text-slate-400">Bank</span><span className="col-span-2 font-semibold">{CENTER.bank.bankName}</span><span className="text-slate-400">Account name</span><span className="col-span-2 font-semibold">{CENTER.bank.accountName}</span><span className="text-slate-400">Account no.</span><span className="col-span-2 font-semibold" data-no-i18n>{CENTER.bank.accountNo}</span>
      {CENTER.bank.note && <p className="col-span-3 text-xs text-slate-500 mt-1">{CENTER.bank.note}</p>}</div>
  );
}

export function ReceiptPicker({ file, onFile }: { file: File | null; onFile: (f: File | null) => void }) {
  return (
    <label className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-slate-300 bg-white cursor-pointer hover:border-orange-400 text-sm text-slate-600">
      <Upload size={18} className="text-slate-400" /> {file ? file.name : 'Attach payment receipt (image or PDF)'}
      <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
    </label>
  );
}

/** Price breakdown, discount code, payment method and receipt — then one server call that creates the payment. */
export default function PayBox({ kind, item, batch, option, onDone, onCancel, label }: {
  kind: 'course' | 'plan' | 'package'; item: number; batch?: number | null; option?: number | null; onDone: () => void; onCancel: () => void; label?: string;
}) {
  const user = useAuth((s) => s.user)!;
  const CENTER = useCenter();
  const billing = useBilling();
  const approx = useApprox();
  const [code, setCode] = useState('');
  const [applied, setApplied] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [method, setMethod] = useState<'card' | 'bank'>(CENTER.bank.onlinePay ? 'card' : 'bank');
  const [ref, setRef] = useState('');
  const [receipt, setReceipt] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async (c: string) => {
    const { data, error } = await supabase.rpc('price_quote', { p_kind: kind, p_item: item, p_code: c || null, p_option: option ?? null });
    if (error) return toast.err(error.message);
    const q = (data as Quote[])[0];
    if (c && q.code_error) { toast.err(q.code_error); return; }
    setQuote(q); setApplied(c);
    if (c) toast.ok('Discount applied');
  };
  useEffect(() => { if (!user.demo) load(''); }, [kind, item, option]); // eslint-disable-line react-hooks/exhaustive-deps

  const free = quote ? Number(quote.total) === 0 : false;
  const online = !!CENTER.bank.onlinePay && !free;
  const byCard = online && method === 'card';

  const submit = async () => {
    if (user.demo) return toast.err('Sign in with a real account to continue.');
    setBusy(true);
    const path = !free && !byCard && receipt ? await uploadReceipt(user.id, receipt) : null;
    if (!free && !byCard && receipt && !path) { setBusy(false); return; }
    const { data, error } = await supabase.rpc('checkout', {
      p_kind: kind, p_item: item, p_code: applied || null, p_method: byCard ? 'card' : 'bank_transfer', p_reference: ref || null, p_receipt: path, p_batch: batch ?? null, p_option: option ?? null,
    });
    if (error) { setBusy(false); return toast.err(error.code === '23505' ? 'You already requested this course.' : error.message); }
    const r = data as { payment_id: number; status: string; due_at: string | null };
    if (byCard) {
      const err = await payOnline(r.payment_id);
      setBusy(false);
      if (err) { toast.err(err); onDone(); }
      return;
    }
    setBusy(false);
    if (r.status === 'pending' && !path && r.due_at) toast.ok(`Order placed. Pay and send your receipt from Payment History before ${fmtDateTime(r.due_at)} — your seat is held until then.`);
    else toast.ok(r.status === 'paid' ? 'Done! It is ready for you.' : kind === 'course' ? 'Enrollment request sent. We will confirm it shortly.' : 'Payment sent. We will confirm it shortly.');
    onDone();
  };

  const row = (l: string, v: string, cls = '') => <div className={`flex justify-between ${cls}`}><span>{l}</span><span data-no-i18n>{v}</span></div>;
  return (
    <div className="space-y-4">
      {quote && (
        <div className="p-4 rounded-2xl border border-slate-100 bg-white text-sm space-y-1.5">
          {row('Price', money(quote.subtotal, quote.currency), 'text-slate-600')}
          {Number(quote.discount) > 0 && row(`Discount (${applied})`, `− ${money(quote.discount, quote.currency)}`, 'text-emerald-600 font-semibold')}
          {Number(quote.tax) > 0 && row(`${billing.taxLabel} ${billing.taxRate}%`, money(quote.tax, quote.currency), 'text-slate-600')}
          <div className="flex justify-between pt-2 border-t border-slate-100 font-extrabold text-slate-900 text-base"><span>Total</span>
            <span className="text-right" data-no-i18n>{free ? 'Free' : money(quote.total, quote.currency)}{approx(quote.total, quote.currency) && <span className="block text-[11px] font-semibold text-slate-400">≈ {approx(quote.total, quote.currency)}</span>}</span></div>
          {!free && <div className="flex gap-2 pt-2">
            <div className="relative flex-1"><Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Discount code" className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-200 text-sm font-mono" /></div>
            <button type="button" onClick={() => load(code.trim())} disabled={!code.trim()} className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold disabled:opacity-40">Apply</button>
            {applied && <button type="button" onClick={() => { setCode(''); load(''); }} className="px-2 text-xs font-bold text-slate-400">Remove</button>}
          </div>}
        </div>
      )}
      {online && (
        <div className="grid grid-cols-2 gap-2">
          {([['card', 'Pay online', 'Card / FPX'], ['bank', 'Bank transfer', 'Upload receipt']] as const).map(([k, l, d]) => (
            <button key={k} type="button" onClick={() => setMethod(k)} className={`p-3 rounded-xl border text-left transition-all ${method === k ? 'border-orange-400 bg-orange-50' : 'border-slate-200 hover:border-slate-300'}`}>
              <p className="text-sm font-bold text-slate-800">{l}</p><p className="text-[11px] text-slate-500">{d}</p>
            </button>
          ))}
        </div>
      )}
      {byCard && <p className="text-xs text-slate-500 p-3 rounded-xl bg-indigo-50 border border-indigo-100">You will go to a secure Stripe page to pay.</p>}
      {quote && !free && !byCard && (
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Pay by bank transfer</p>
          <BankDetails />
          <input className={inputCls} placeholder="Transfer reference (optional)" value={ref} onChange={(e) => setRef(e.target.value)} />
          <ReceiptPicker file={receipt} onFile={setReceipt} />
          {!receipt && <p className="text-[11px] text-slate-500">{`No receipt yet? Place the order now and send the receipt from Payment History within ${billing.paymentWindowHours ?? 72} hours. Your seat is held until then.`}</p>}
        </div>
      )}
      <div className="flex gap-3 justify-end">
        <button onClick={onCancel} className={btnGhost}>Cancel</button>
        <button onClick={submit} disabled={busy || !quote} className={btnAccent}>{busy && <Loader2 size={16} className="animate-spin" />} {free ? (label ?? 'Confirm') : byCard ? 'Continue to payment' : receipt ? 'Submit payment' : 'Place order'}</button>
      </div>
    </div>
  );
}
