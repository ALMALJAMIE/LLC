import { useEffect, useMemo, useState } from 'react';
import { Crown, FilePlus2, Loader2, Percent, Plus, RotateCcw, Save, Settings, SquarePen, Ticket, Trash2, X } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { fmtDate, fmtDateTime, money, useData } from '../../lib/db';
import { BILLING_DEFAULTS, useSite, type Billing } from '../../lib/site';
import { DemoNotice, Field, Modal, Page, PageHero, SearchInput, Spinner, StatusPill, btnPrimary, inputCls, toast } from '../../components/ui';
import { askConfirm, askText } from '../../components/dialogs';
import { periodLabel, type Pack, type Plan } from '../student/StudentPlans';

const Tabs = ({ tabs, value, onChange }: { tabs: [string, string][]; value: string; onChange: (v: string) => void }) => (
  <div className="inline-flex flex-wrap bg-slate-50 p-1 rounded-xl border border-slate-200">{tabs.map(([k, l]) => <button key={k} onClick={() => onChange(k)} className={`px-3 py-2 rounded-lg text-xs font-bold ${value === k ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>{l}</button>)}</div>
);
const Empty = () => <p className="text-center text-slate-400 py-12">Nothing here.</p>;
const card = 'bg-white rounded-3xl border border-slate-200 shadow-sm';

// ---------------------------------------------------------------- discount codes
type Code = { id: number; code: string; description: string | null; percent_off: number | null; amount_off: number | null; applies_to: string; course_id: number | null; min_amount: number; max_uses: number | null; max_per_user: number; valid_from: string | null; valid_until: string | null; is_active: boolean; created_at: string; course?: { title: string } | null };
export function DiscountCodes() {
  const user = useAuth((s) => s.user)!;
  const { data, loading, reload } = useData<Code[]>(() => supabase.from('discount_codes').select('*, course:courses(title)').order('created_at', { ascending: false }));
  const uses = useData<{ discount_code_id: number; status: string; discount: number }[]>(() => supabase.from('payments').select('discount_code_id,status,discount').not('discount_code_id', 'is', null));
  const [edit, setEdit] = useState<Partial<Code> | null>(null);
  const count = (id: number) => (uses.data ?? []).filter((u) => u.discount_code_id === id && !['failed', 'cancelled'].includes(u.status));
  const toggle = async (c: Code) => { const { error } = await supabase.from('discount_codes').update({ is_active: !c.is_active }).eq('id', c.id); if (error) toast.err(error.message); else reload(); };
  return (
    <Page wide>
      {user.demo && <DemoNotice />}
      <PageHero badge="Finance" badgeColor="green" title="Discount Codes" illus="payment" subtitle="Codes students type at checkout. A code takes a percentage or a fixed amount off, for everything or one course, plan or package.">
        <button onClick={() => setEdit({ applies_to: 'all', max_per_user: 1, min_amount: 0, is_active: true })} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-orange-500 text-white text-sm font-bold"><Plus size={16} /> New Code</button>
      </PageHero>
      {loading ? <Spinner /> : !(data ?? []).length ? <Empty /> : (
        <div className={`${card} divide-y divide-slate-100`}>{(data ?? []).map((c) => {
          const u = count(c.id);
          const expired = c.valid_until && new Date(c.valid_until) < new Date();
          return (
            <div key={c.id} className="px-5 py-4 flex flex-wrap items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 grid place-items-center"><Percent size={18} /></span>
              <div className="flex-1 min-w-56">
                <p className="font-black font-mono text-slate-800" data-no-i18n>{c.code} <span className="font-sans text-sm font-bold text-emerald-600">{c.percent_off ? `−${Number(c.percent_off)}%` : `−${money(c.amount_off)}`}</span></p>
                <p className="text-[11px] text-slate-400">{c.course?.title ?? (c.applies_to === 'all' ? 'Everything' : c.applies_to)}{c.valid_until ? <> · {`until ${fmtDate(c.valid_until)}`}</> : ''} · {`used ${u.length}${c.max_uses ? ` of ${c.max_uses}` : ''}`} · {`saved ${money(u.reduce((a, x) => a + Number(x.discount), 0))}`}</p>
                {c.description && <p className="text-xs text-slate-500">{c.description}</p>}
              </div>
              <StatusPill status={expired ? 'expired' : c.is_active ? 'active' : 'inactive'} />
              <button onClick={() => toggle(c)} className="text-xs font-bold text-slate-500">{c.is_active ? 'Turn off' : 'Turn on'}</button>
              <button onClick={() => setEdit(c)} className="p-1.5 text-slate-400 hover:text-blue-600"><SquarePen size={16} /></button>
            </div>
          );
        })}</div>
      )}
      {edit && <CodeForm c={edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); reload(); }} />}
    </Page>
  );
}
function CodeForm({ c, onClose, onDone }: { c: Partial<Code>; onClose: () => void; onDone: () => void }) {
  const courses = useData<{ id: number; title: string }[]>(() => supabase.from('courses').select('id,title').order('title'));
  const [f, setF] = useState({ code: c.code ?? '', description: c.description ?? '', type: c.amount_off ? 'amount' : 'percent', value: String(c.percent_off ?? c.amount_off ?? ''), applies_to: c.applies_to ?? 'all', course_id: c.course_id ? String(c.course_id) : '', min_amount: String(c.min_amount ?? 0), max_uses: c.max_uses ? String(c.max_uses) : '', max_per_user: String(c.max_per_user ?? 1), valid_from: c.valid_from?.slice(0, 10) ?? '', valid_until: c.valid_until?.slice(0, 10) ?? '' });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const code = f.code.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,30}$/.test(code)) return toast.err('The code uses 3–30 English capital letters, numbers, - or _.');
    const v = Number(f.value);
    if (!(v > 0) || (f.type === 'percent' && v > 100)) return toast.err('Enter a valid discount.');
    setBusy(true);
    const row = { code, description: f.description.trim() || null, percent_off: f.type === 'percent' ? v : null, amount_off: f.type === 'amount' ? v : null,
      applies_to: f.course_id ? 'course' : f.applies_to, course_id: f.course_id ? Number(f.course_id) : null, min_amount: Number(f.min_amount) || 0,
      max_uses: f.max_uses ? Number(f.max_uses) : null, max_per_user: Number(f.max_per_user) || 1,
      valid_from: f.valid_from ? new Date(f.valid_from).toISOString() : null, valid_until: f.valid_until ? new Date(f.valid_until + 'T23:59:59').toISOString() : null };
    const { error } = c.id ? await supabase.from('discount_codes').update(row).eq('id', c.id) : await supabase.from('discount_codes').insert(row);
    setBusy(false);
    if (error) toast.err(error.code === '23505' ? 'This code already exists.' : error.message); else { toast.ok('Saved'); onDone(); }
  };
  return (
    <Modal open onClose={onClose} title={c.id ? 'Edit Code' : 'New Discount Code'}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Code"><input className={`${inputCls} font-mono uppercase`} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} placeholder="WELCOME10" data-no-i18n /></Field>
          <Field label="Discount"><div className="flex gap-2"><input type="number" className={inputCls} value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} /><select className="px-2 rounded-xl border border-slate-200" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}><option value="percent">%</option><option value="amount">USD</option></select></div></Field>
        </div>
        <Field label="Note (for the team)"><input className={inputCls} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Can be used for"><select className={inputCls} value={f.course_id ? 'course' : f.applies_to} onChange={(e) => setF({ ...f, applies_to: e.target.value, course_id: e.target.value === 'course' ? f.course_id : '' })}><option value="all">Everything</option><option value="course">Courses</option><option value="plan">Plans</option><option value="package">Session packages</option></select></Field>
          <Field label="Only this course (optional)"><select className={inputCls} value={f.course_id} onChange={(e) => setF({ ...f, course_id: e.target.value })}><option value="">Any</option>{(courses.data ?? []).map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}</select></Field>
          <Field label="Total uses (empty = no limit)"><input type="number" className={inputCls} value={f.max_uses} onChange={(e) => setF({ ...f, max_uses: e.target.value })} /></Field>
          <Field label="Uses per student"><input type="number" className={inputCls} value={f.max_per_user} onChange={(e) => setF({ ...f, max_per_user: e.target.value })} /></Field>
          <Field label="Starts"><input type="date" className={inputCls} value={f.valid_from} onChange={(e) => setF({ ...f, valid_from: e.target.value })} /></Field>
          <Field label="Ends"><input type="date" className={inputCls} value={f.valid_until} onChange={(e) => setF({ ...f, valid_until: e.target.value })} /></Field>
          <Field label="Minimum price (USD)"><input type="number" className={inputCls} value={f.min_amount} onChange={(e) => setF({ ...f, min_amount: e.target.value })} /></Field>
        </div>
        <button disabled={busy} onClick={save} className={`${btnPrimary} w-full`}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save</button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- refunds
type RefundRow = { id: number; payment_id: number; amount: number; reason: string; status: string; revoke_access: boolean; response: string | null; refund_reference: string | null; created_at: string; decided_at: string | null;
  student: { full_name: string; email: string } | null; payment: { invoice_no: string; description: string | null; amount: number; currency: string; refunded_amount: number; method: string | null; paid_at: string | null; kind: string } | null };
export function Refunds() {
  const user = useAuth((s) => s.user)!;
  const { data, loading, reload } = useData<RefundRow[]>(() => supabase.from('refund_requests').select('*, student:profiles!refund_requests_student_id_fkey(full_name,email), payment:payments(invoice_no,description,amount,currency,refunded_amount,method,paid_at,kind)').order('created_at', { ascending: false }));
  const [tab, setTab] = useState('requested');
  const [act, setAct] = useState<{ r: RefundRow; to: string } | null>(null);
  const list = (data ?? []).filter((r) => tab === 'all' || r.status === tab);
  const n = (s: string) => (data ?? []).filter((r) => r.status === s).length;
  return (
    <Page wide>
      {user.demo && <DemoNotice />}
      <PageHero badge="Finance" badgeColor="green" title="Refunds" illus="payment" subtitle="Approve or decline refund requests, then mark them as sent once the money is returned. Sending a refund closes the course, plan or package it paid for.">
        <Tabs value={tab} onChange={setTab} tabs={[['requested', `New (${n('requested')})`], ['approved', `To send (${n('approved')})`], ['processed', 'Sent'], ['rejected', 'Declined'], ['all', 'All']]} />
      </PageHero>
      {loading ? <Spinner /> : !list.length ? <Empty /> : (
        <div className={`${card} divide-y divide-slate-100`}>{list.map((r) => (
          <div key={r.id} className="px-5 py-4 flex flex-wrap items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-red-50 text-red-500 grid place-items-center"><RotateCcw size={18} /></span>
            <div className="flex-1 min-w-64">
              <p className="font-bold text-slate-800">{r.student?.full_name} · {money(r.amount, r.payment?.currency)}</p>
              <p className="text-[11px] text-slate-400">{r.payment?.description ?? r.payment?.invoice_no} · {`paid ${money(r.payment?.amount, r.payment?.currency)}`} {r.payment?.paid_at ? `on ${fmtDate(r.payment.paid_at)}` : ''} · {r.payment?.method?.replace('_', ' ')} · {`asked ${fmtDateTime(r.created_at)}`}</p>
              <p className="text-sm text-slate-600 mt-1">“{r.reason}”</p>
              {r.response && <p className="text-xs text-slate-500 mt-1">{`Answer: ${r.response}`}{r.refund_reference ? ` · Ref ${r.refund_reference}` : ''}</p>}
            </div>
            <StatusPill status={r.status} />
            {r.status === 'requested' && <>
              <button onClick={() => setAct({ r, to: 'approved' })} className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold">Approve</button>
              <button onClick={() => setAct({ r, to: 'rejected' })} className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold">Decline</button></>}
            {r.status === 'approved' && <button onClick={() => setAct({ r, to: 'processed' })} className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold">Mark as sent</button>}
          </div>
        ))}</div>
      )}
      {act && <RefundDecision {...act} onClose={() => setAct(null)} onDone={() => { setAct(null); reload(); }} />}
    </Page>
  );
}
function RefundDecision({ r, to, onClose, onDone }: { r: RefundRow; to: string; onClose: () => void; onDone: () => void }) {
  const max = Number(r.payment?.amount ?? 0) - Number(r.payment?.refunded_amount ?? 0);
  const [f, setF] = useState({ amount: String(r.amount), response: '', ref: '', revoke: r.revoke_access });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const a = Number(f.amount);
    if (!(a > 0) || a > max) return toast.err(`The amount must be between 0 and ${max}.`);
    if (to === 'rejected' && f.response.trim().length < 3) return toast.err('Please write the reason for the student.');
    setBusy(true);
    const { error } = await supabase.from('refund_requests').update({ status: to, amount: a, response: f.response.trim() || null, refund_reference: f.ref.trim() || null, revoke_access: f.revoke }).eq('id', r.id);
    setBusy(false);
    if (error) toast.err(error.message); else { toast.ok('Saved — the student was notified'); onDone(); }
  };
  return (
    <Modal open onClose={onClose} title={{ approved: 'Approve refund', rejected: 'Decline refund', processed: 'Refund sent' }[to]}>
      <div className="space-y-3">
        {to !== 'rejected' && <Field label={`Amount (paid ${money(r.payment?.amount, r.payment?.currency)}, up to ${money(max, r.payment?.currency)})`}><input type="number" className={inputCls} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>}
        {to === 'processed' && <Field label="Transfer reference"><input className={inputCls} value={f.ref} onChange={(e) => setF({ ...f, ref: e.target.value })} /></Field>}
        {to !== 'rejected' && <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 accent-orange-500" checked={f.revoke} onChange={(e) => setF({ ...f, revoke: e.target.checked })} />Close what this payment opened (the course, plan or unused sessions) when the refund is sent</label>}
        <Field label="Message to the student"><textarea rows={3} className={inputCls} value={f.response} onChange={(e) => setF({ ...f, response: e.target.value })} /></Field>
        <button disabled={busy} onClick={save} className={`${btnPrimary} w-full`}>{busy && <Loader2 size={16} className="animate-spin" />} Save</button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- custom invoices
type Inv = { id: number; invoice_no: string; description: string | null; amount: number; currency: string; status: string; due_at: string | null; created_at: string; paid_at: string | null; receipt_url: string | null; student: { full_name: string; email: string } | null };
type Line = { description: string; qty: string; unit: string };
export function Invoices() {
  const user = useAuth((s) => s.user)!;
  const { data, loading, reload } = useData<Inv[]>(() => supabase.from('payments').select('id,invoice_no,description,amount,currency,status,due_at,created_at,paid_at,receipt_url, student:profiles!payments_student_id_fkey(full_name,email)').eq('kind', 'custom').order('created_at', { ascending: false }));
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const list = (data ?? []).filter((p) => `${p.invoice_no} ${p.description} ${p.student?.full_name} ${p.student?.email}`.toLowerCase().includes(q.toLowerCase()));
  const cancel = async (p: Inv) => { if (!(await askConfirm(`Cancel invoice ${p.invoice_no}?`))) return; const { error } = await supabase.from('payments').update({ status: 'cancelled' }).eq('id', p.id); if (error) toast.err(error.message); else reload(); };
  return (
    <Page wide>
      {user.demo && <DemoNotice />}
      <PageHero badge="Finance" badgeColor="green" title="Invoices" illus="payment" subtitle="Bill a student or an institution for anything outside the shop: exam fees, books, a group contract. They pay from their Payment History; you confirm it in Financial Overview.">
        <div className="flex flex-wrap gap-2"><SearchInput value={q} onChange={setQ} placeholder="Search invoices..." />
          <button onClick={() => setOpen(true)} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-orange-500 text-white text-sm font-bold"><FilePlus2 size={16} /> New Invoice</button></div>
      </PageHero>
      {loading ? <Spinner /> : !list.length ? <Empty /> : (
        <div className={`${card} divide-y divide-slate-100`}>{list.map((p) => {
          const overdue = p.status === 'pending' && p.due_at && new Date(p.due_at) < new Date();
          return (
            <div key={p.id} className="px-5 py-4 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-56"><p className="font-bold text-slate-800">{p.student?.full_name} · {p.description}</p><p className="text-[11px] text-slate-400"><span className="font-mono" data-no-i18n>{p.invoice_no}</span> · {fmtDate(p.created_at)}{p.due_at ? <> · {`due ${fmtDate(p.due_at)}`}</> : ''}</p>
                {overdue && <p className="text-xs font-bold text-red-500">Overdue</p>}{p.status === 'pending' && p.receipt_url && <p className="text-xs font-bold text-orange-600">Receipt received — confirm it in Financial Overview</p>}</div>
              <p className="font-bold">{money(p.amount, p.currency)}</p>
              <StatusPill status={p.status} />
              {p.status === 'pending' && <button onClick={() => cancel(p)} className="p-1.5 text-slate-400 hover:text-red-500" title="Cancel"><X size={16} /></button>}
            </div>
          );
        })}</div>
      )}
      {open && <InvoiceForm onClose={() => setOpen(false)} onDone={() => { setOpen(false); reload(); }} />}
    </Page>
  );
}
function InvoiceForm({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const tax = useSite((s) => s.billing);
  const people = useData<{ id: string; full_name: string; email: string; role: string }[]>(() => supabase.from('profiles').select('id,full_name,email,role').in('role', ['student', 'institution']).order('full_name'));
  const [who, setWho] = useState('');
  const [find, setFind] = useState('');
  const [lines, setLines] = useState<Line[]>([{ description: '', qty: '1', unit: '' }]);
  const [due, setDue] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const sub = lines.reduce((a, l) => a + (Number(l.qty) || 0) * (Number(l.unit) || 0), 0);
  const matches = (people.data ?? []).filter((p) => find && `${p.full_name} ${p.email}`.toLowerCase().includes(find.toLowerCase())).slice(0, 6);
  const chosen = people.data?.find((p) => p.id === who);
  const save = async () => {
    if (!who) return toast.err('Choose who the invoice is for.');
    setBusy(true);
    const { error } = await supabase.rpc('create_invoice', { p_student: who, p_lines: lines.filter((l) => l.description.trim()).map((l) => ({ description: l.description.trim(), qty: Number(l.qty), unit: Number(l.unit) })), p_due: due || null, p_note: note || null });
    setBusy(false);
    if (error) toast.err(error.message); else { toast.ok('Invoice sent — the person was notified'); onDone(); }
  };
  return (
    <Modal open onClose={onClose} title="New Invoice" wide>
      <div className="space-y-4">
        <Field label="Bill to">{chosen ? <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-200"><span className="flex-1 text-sm"><b>{chosen.full_name}</b> · {chosen.email} <span className="text-[10px] uppercase text-slate-400">{chosen.role}</span></span><button onClick={() => setWho('')} className="text-xs font-bold text-slate-400">Change</button></div> : <>
          <input className={inputCls} value={find} onChange={(e) => setFind(e.target.value)} placeholder="Type a name or email..." />
          {matches.length > 0 && <div className="mt-1 border border-slate-100 rounded-xl divide-y divide-slate-100">{matches.map((p) => <button key={p.id} onClick={() => { setWho(p.id); setFind(''); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">{p.full_name} · <span className="text-slate-400">{p.email}</span></button>)}</div>}</>}
        </Field>
        <div className="space-y-2">{lines.map((l, i) => (
          <div key={i} className="grid grid-cols-12 gap-2">
            <input className={`${inputCls} col-span-7`} placeholder="Description" value={l.description} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} />
            <input type="number" className={`${inputCls} col-span-2`} placeholder="Qty" value={l.qty} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, qty: e.target.value } : x))} />
            <input type="number" className={`${inputCls} col-span-2`} placeholder="USD" value={l.unit} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, unit: e.target.value } : x))} />
            <button onClick={() => setLines(lines.filter((_, j) => j !== i))} disabled={lines.length === 1} className="col-span-1 text-slate-400 hover:text-red-500 disabled:opacity-30"><Trash2 size={16} /></button>
          </div>
        ))}
          <button onClick={() => setLines([...lines, { description: '', qty: '1', unit: '' }])} className="text-xs font-bold text-indigo-600">+ Add line</button></div>
        <div className="text-right text-sm text-slate-600" data-no-i18n>{money(sub)}{tax.taxRate ? ` + ${tax.taxLabel} ${tax.taxRate}% = ${money(sub * (1 + tax.taxRate / 100))}` : ''}</div>
        <div className="grid grid-cols-2 gap-3"><Field label="Due date"><input type="date" className={inputCls} value={due} onChange={(e) => setDue(e.target.value)} /></Field><Field label="Note"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} /></Field></div>
        <button disabled={busy} onClick={save} className={`${btnPrimary} w-full`}>{busy && <Loader2 size={16} className="animate-spin" />} Send invoice</button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- plans, packages, subscriptions, credits
type SubRow = { id: number; status: string; starts_at: string; ends_at: string; student: { full_name: string; email: string } | null; plan: { name: string } | null };
type GrantRow = { id: number; source: string; total: number; used: number; expires_at: string; note: string | null; created_at: string; student: { full_name: string } | null };
export function PlansAdmin() {
  const user = useAuth((s) => s.user)!;
  const [tab, setTab] = useState('plans');
  const plans = useData<Plan[]>(() => supabase.from('plans').select('*').order('sort_order').order('price'));
  const packs = useData<Pack[]>(() => supabase.from('session_packages').select('*').order('sort_order').order('sessions'));
  const subs = useData<SubRow[]>(() => supabase.from('subscriptions').select('*, student:profiles!subscriptions_student_id_fkey(full_name,email), plan:plans(name)').order('created_at', { ascending: false }));
  const grants = useData<GrantRow[]>(() => supabase.from('credit_grants').select('*, student:profiles!credit_grants_student_id_fkey(full_name)').order('created_at', { ascending: false }).limit(200));
  const courses = useData<{ id: number; title: string }[]>(() => supabase.from('courses').select('id,title').order('title'));
  const [ep, setEp] = useState<Partial<Plan> | null>(null);
  const [ek, setEk] = useState<Partial<Pack> | null>(null);
  const [grant, setGrant] = useState(false);
  useEffect(() => { if (!user.demo) supabase.rpc('expire_subscriptions').then(() => subs.reload()); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const cancelSub = async (s: SubRow) => {
    const why = await askText(`End ${s.student?.full_name}'s plan now? Write a short reason (shown in the record):`);
    if (why === null) return;
    const { error } = await supabase.from('subscriptions').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', s.id);
    if (error) return toast.err(error.message);
    await supabase.rpc('expire_subscriptions'); toast.ok('Plan ended'); subs.reload();
  };
  return (
    <Page wide>
      {user.demo && <DemoNotice />}
      <PageHero badge="Finance" badgeColor="green" title="Plans & Packages" illus="payment" subtitle="Monthly plans open courses and include private sessions; session packages sell one-to-one sessions. Students buy them from Plans & Packages.">
        <Tabs value={tab} onChange={setTab} tabs={[['plans', 'Plans'], ['packages', 'Session packages'], ['subs', 'Subscribers'], ['credits', 'Session credits']]} />
      </PageHero>
      {tab === 'plans' && <>
        <button onClick={() => setEp({ period_months: 1, private_credits: 0, course_ids: [], is_active: true, sort_order: 0 })} className={`${btnPrimary} mb-4`}><Plus size={16} /> New Plan</button>
        {plans.loading ? <Spinner /> : !(plans.data ?? []).length ? <Empty /> : <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{(plans.data ?? []).map((p) => (
          <div key={p.id} className={`${card} p-5`}>
            <div className="flex items-start gap-2"><Crown size={18} className="text-indigo-500 mt-1" /><p className="flex-1 font-extrabold text-slate-900">{p.name}</p><StatusPill status={p.is_active ? 'active' : 'inactive'} /><button onClick={() => setEp(p)} className="p-1 text-slate-400 hover:text-blue-600"><SquarePen size={16} /></button></div>
            <p className="text-2xl font-black mt-2">{money(p.price)} <span className="text-xs font-semibold text-slate-400">{periodLabel(p.period_months)}</span></p>
            <p className="text-xs text-slate-500 mt-1">{`${p.private_credits} private sessions · ${p.course_ids.length} courses`} · {`${(subs.data ?? []).filter((s) => s.status === 'active' && s.plan?.name === p.name).length} active`}</p>
          </div>
        ))}</div>}
      </>}
      {tab === 'packages' && <>
        <button onClick={() => setEk({ sessions: 5, valid_days: 90, is_active: true, sort_order: 0 })} className={`${btnPrimary} mb-4`}><Plus size={16} /> New Package</button>
        {packs.loading ? <Spinner /> : !(packs.data ?? []).length ? <Empty /> : <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">{(packs.data ?? []).map((k) => (
          <div key={k.id} className={`${card} p-5`}>
            <div className="flex items-start gap-2"><Ticket size={18} className="text-orange-500 mt-1" /><p className="flex-1 font-extrabold text-slate-900">{k.name}</p><button onClick={() => setEk(k)} className="p-1 text-slate-400 hover:text-blue-600"><SquarePen size={16} /></button></div>
            <p className="text-2xl font-black mt-2">{money(k.price)}</p>
            <p className="text-xs text-slate-500 mt-1">{`${k.sessions} sessions · ${k.valid_days} days`}</p><div className="mt-2"><StatusPill status={k.is_active ? 'active' : 'inactive'} /></div>
          </div>
        ))}</div>}
        <p className="text-xs text-slate-500 mt-4">Whether booking a private session needs a credit is set in Billing Settings.</p>
      </>}
      {tab === 'subs' && (subs.loading ? <Spinner /> : !(subs.data ?? []).length ? <Empty /> : (
        <div className={`${card} divide-y divide-slate-100`}>{(subs.data ?? []).map((s) => (
          <div key={s.id} className="px-5 py-3 flex flex-wrap items-center gap-3 text-sm">
            <div className="flex-1 min-w-56"><p className="font-bold text-slate-800">{s.student?.full_name} · {s.plan?.name}</p><p className="text-[11px] text-slate-400">{s.student?.email} · {fmtDate(s.starts_at)} – {fmtDate(s.ends_at)}</p></div>
            <StatusPill status={s.status} />
            {s.status === 'active' && <button onClick={() => cancelSub(s)} className="text-xs font-bold text-red-500">End now</button>}
          </div>
        ))}</div>
      ))}
      {tab === 'credits' && <>
        <button onClick={() => setGrant(true)} className={`${btnPrimary} mb-4`}><Plus size={16} /> Give sessions</button>
        {grants.loading ? <Spinner /> : !(grants.data ?? []).length ? <Empty /> : (
          <div className={`${card} divide-y divide-slate-100`}>{(grants.data ?? []).map((g) => (
            <div key={g.id} className="px-5 py-3 flex flex-wrap items-center gap-3 text-sm">
              <div className="flex-1 min-w-56"><p className="font-bold text-slate-800">{g.student?.full_name} · {`${g.used} of ${g.total} used`}</p><p className="text-[11px] text-slate-400"><span className="capitalize">{g.source}</span>{g.note ? ` · ${g.note}` : ''} · {`until ${fmtDate(g.expires_at)}`}</p></div>
              {new Date(g.expires_at) < new Date() && <StatusPill status="expired" />}
            </div>
          ))}</div>
        )}
      </>}
      {ep && <PlanForm p={ep} courses={courses.data ?? []} onClose={() => setEp(null)} onDone={() => { setEp(null); plans.reload(); }} />}
      {ek && <PackForm k={ek} onClose={() => setEk(null)} onDone={() => { setEk(null); packs.reload(); }} />}
      {grant && <GrantForm onClose={() => setGrant(false)} onDone={() => { setGrant(false); grants.reload(); }} />}
    </Page>
  );
}
function PlanForm({ p, courses, onClose, onDone }: { p: Partial<Plan>; courses: { id: number; title: string }[]; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ name: p.name ?? '', description: p.description ?? '', price: String(p.price ?? ''), period_months: String(p.period_months ?? 1), private_credits: String(p.private_credits ?? 0), course_ids: p.course_ids ?? [], features: p.features ?? '', is_active: p.is_active ?? true, sort_order: String(p.sort_order ?? 0) });
  const save = async () => {
    if (!f.name.trim() || !(Number(f.price) >= 0) || f.price === '') return toast.err('Name and price are required.');
    const row = { name: f.name.trim(), description: f.description.trim() || null, price: Number(f.price), period_months: Number(f.period_months), private_credits: Number(f.private_credits) || 0, course_ids: f.course_ids, features: f.features.trim() || null, is_active: f.is_active, sort_order: Number(f.sort_order) || 0 };
    const { error } = p.id ? await supabase.from('plans').update(row).eq('id', p.id) : await supabase.from('plans').insert(row);
    if (error) toast.err(error.message); else { toast.ok('Saved'); onDone(); }
  };
  return (
    <Modal open onClose={onClose} title={p.id ? 'Edit Plan' : 'New Plan'} wide>
      <div className="space-y-3">
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2"><Field label="Name"><input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field></div>
          <Field label="Price (USD)"><input type="number" className={inputCls} value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></Field>
          <Field label="Length"><select className={inputCls} value={f.period_months} onChange={(e) => setF({ ...f, period_months: e.target.value })}>{[1, 3, 6, 12].map((m) => <option key={m} value={m}>{periodLabel(m)}</option>)}</select></Field>
          <Field label="Private sessions included each time"><input type="number" className={inputCls} value={f.private_credits} onChange={(e) => setF({ ...f, private_credits: e.target.value })} /></Field>
          <Field label="Order"><input type="number" className={inputCls} value={f.sort_order} onChange={(e) => setF({ ...f, sort_order: e.target.value })} /></Field>
        </div>
        <Field label="Short description"><input className={inputCls} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <Field label="Courses opened while the plan is active"><div className="max-h-40 overflow-y-auto grid sm:grid-cols-2 gap-1 p-2 rounded-xl border border-slate-200">{courses.map((c) => <label key={c.id} className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-orange-500" checked={f.course_ids.includes(c.id)} onChange={(e) => setF({ ...f, course_ids: e.target.checked ? [...f.course_ids, c.id] : f.course_ids.filter((x) => x !== c.id) })} />{c.title}</label>)}</div></Field>
        <Field label="Other benefits (one per line)"><textarea rows={3} className={inputCls} value={f.features} onChange={(e) => setF({ ...f, features: e.target.value })} /></Field>
        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="accent-orange-500" checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} />Offered to students</label>
        <button onClick={save} className={`${btnPrimary} w-full`}><Save size={16} /> Save</button>
      </div>
    </Modal>
  );
}
function PackForm({ k, onClose, onDone }: { k: Partial<Pack>; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ name: k.name ?? '', description: k.description ?? '', sessions: String(k.sessions ?? 5), price: String(k.price ?? ''), valid_days: String(k.valid_days ?? 90), is_active: k.is_active ?? true, sort_order: String(k.sort_order ?? 0) });
  const save = async () => {
    if (!f.name.trim() || f.price === '' || !(Number(f.sessions) > 0)) return toast.err('Name, sessions and price are required.');
    const row = { name: f.name.trim(), description: f.description.trim() || null, sessions: Number(f.sessions), price: Number(f.price), valid_days: Number(f.valid_days) || 90, is_active: f.is_active, sort_order: Number(f.sort_order) || 0 };
    const { error } = k.id ? await supabase.from('session_packages').update(row).eq('id', k.id) : await supabase.from('session_packages').insert(row);
    if (error) toast.err(error.message); else { toast.ok('Saved'); onDone(); }
  };
  return (
    <Modal open onClose={onClose} title={k.id ? 'Edit Package' : 'New Package'}>
      <div className="space-y-3">
        <Field label="Name"><input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. 5 speaking sessions" /></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Sessions"><input type="number" className={inputCls} value={f.sessions} onChange={(e) => setF({ ...f, sessions: e.target.value })} /></Field>
          <Field label="Price (USD)"><input type="number" className={inputCls} value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></Field>
          <Field label="Use within (days)"><input type="number" className={inputCls} value={f.valid_days} onChange={(e) => setF({ ...f, valid_days: e.target.value })} /></Field>
        </div>
        <Field label="Short description"><input className={inputCls} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="accent-orange-500" checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} />Offered to students</label>
        <button onClick={save} className={`${btnPrimary} w-full`}><Save size={16} /> Save</button>
      </div>
    </Modal>
  );
}
function GrantForm({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const students = useData<{ id: string; full_name: string; email: string }[]>(() => supabase.from('profiles').select('id,full_name,email').eq('role', 'student').order('full_name'));
  const [find, setFind] = useState('');
  const [who, setWho] = useState<{ id: string; full_name: string } | null>(null);
  const [f, setF] = useState({ total: '1', days: '60', note: '' });
  const matches = useMemo(() => (students.data ?? []).filter((p) => find && `${p.full_name} ${p.email}`.toLowerCase().includes(find.toLowerCase())).slice(0, 6), [students.data, find]);
  const save = async () => {
    if (!who || !(Number(f.total) > 0)) return toast.err('Choose a student and the number of sessions.');
    const { error } = await supabase.from('credit_grants').insert({ student_id: who.id, source: 'manual', total: Number(f.total), expires_at: new Date(Date.now() + Number(f.days) * 86400000).toISOString(), note: f.note.trim() || null });
    if (error) toast.err(error.message); else { toast.ok('Sessions added'); onDone(); }
  };
  return (
    <Modal open onClose={onClose} title="Give private sessions">
      <div className="space-y-3">
        <Field label="Student">{who ? <div className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 text-sm"><b className="flex-1">{who.full_name}</b><button onClick={() => setWho(null)} className="text-xs text-slate-400 font-bold">Change</button></div> : <>
          <input className={inputCls} value={find} onChange={(e) => setFind(e.target.value)} placeholder="Type a name or email..." />
          {matches.map((p) => <button key={p.id} onClick={() => setWho(p)} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">{p.full_name} · <span className="text-slate-400">{p.email}</span></button>)}</>}</Field>
        <div className="grid grid-cols-2 gap-3"><Field label="Sessions"><input type="number" className={inputCls} value={f.total} onChange={(e) => setF({ ...f, total: e.target.value })} /></Field><Field label="Use within (days)"><input type="number" className={inputCls} value={f.days} onChange={(e) => setF({ ...f, days: e.target.value })} /></Field></div>
        <Field label="Reason"><input className={inputCls} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="e.g. Make-up for a cancelled class" /></Field>
        <button onClick={save} className={`${btnPrimary} w-full`}><Save size={16} /> Save</button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- billing settings
export function BillingSettings() {
  const user = useAuth((s) => s.user)!;
  const load = useSite((s) => s.load);
  const [b, setB] = useState<Billing | null>(null);
  const [fx, setFx] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    supabase.from('site_settings').select('value').eq('key', 'billing').maybeSingle().then(({ data }) => {
      const v = { ...BILLING_DEFAULTS, ...((data?.value as object) ?? {}) } as Billing;
      setB(v); setFx(Object.entries(v.fx).map(([k, r]) => `${k}=${r}`).join('\n'));
    });
  }, []);
  if (!b) return <Page><Spinner /></Page>;
  const save = async () => {
    const rates: Record<string, number> = {};
    for (const line of fx.split('\n').map((l) => l.trim()).filter(Boolean)) {
      const m = line.match(/^([A-Za-z]{3})\s*=\s*([\d.]+)$/);
      if (!m || !(Number(m[2]) > 0)) return toast.err(`Check this exchange rate line: ${line}`);
      rates[m[1].toUpperCase()] = Number(m[2]);
    }
    if (b.taxRate < 0 || b.taxRate > 50) return toast.err('Tax rate must be between 0 and 50.');
    setBusy(true);
    const { error } = await supabase.from('site_settings').upsert({ key: 'billing', value: { ...b, fx: rates }, updated_at: new Date().toISOString() });
    setBusy(false);
    if (error) toast.err(error.message); else { toast.ok('Saved'); load(); }
  };
  const set = (k: keyof Billing, v: unknown) => setB({ ...b, [k]: v });
  return (
    <Page>
      {user.demo && <DemoNotice />}
      <PageHero badge="Finance" badgeColor="green" title="Billing Settings" illus="finance" subtitle="Company details printed on invoices, tax, the refund window, exchange rates for showing local prices, and private-session rules. Prices are always charged in US dollars." />
      <div className={`${card} p-6 space-y-5`}>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Company name on invoices"><input className={inputCls} value={b.companyName} onChange={(e) => set('companyName', e.target.value)} /></Field>
          <Field label="Registration number"><input className={inputCls} value={b.registrationNo} onChange={(e) => set('registrationNo', e.target.value)} /></Field>
          <div className="sm:col-span-2"><Field label="Address on invoices"><input className={inputCls} value={b.address} onChange={(e) => set('address', e.target.value)} /></Field></div>
          <Field label="Tax name (e.g. SST)"><input className={inputCls} value={b.taxLabel} onChange={(e) => set('taxLabel', e.target.value)} /></Field>
          <Field label="Tax rate %" hint="0 = no tax. Added on top of prices at checkout."><input type="number" className={inputCls} value={b.taxRate} onChange={(e) => set('taxRate', Number(e.target.value))} /></Field>
          <Field label="Refund window (days)" hint="Students can ask for a refund within this many days of paying."><input type="number" className={inputCls} value={b.refundDays} onChange={(e) => set('refundDays', Number(e.target.value))} /></Field>
          <Field label="Exchange rates (1 USD =)" hint="One per line, e.g. MYR=4.45. Used only to show approximate local prices."><textarea rows={6} className={`${inputCls} font-mono`} value={fx} onChange={(e) => setFx(e.target.value)} data-no-i18n /></Field>
        </div>
        <label className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100 text-sm"><input type="checkbox" className="mt-1 accent-orange-500" checked={b.privateNeedsCredit} onChange={(e) => set('privateNeedsCredit', e.target.checked)} /><span><b>Private sessions need a credit</b><br /><span className="text-slate-500">When on, each private-session booking uses one session from a package or plan. When off, students with an active course book for free.</span></span></label>
        <button disabled={busy} onClick={save} className={btnPrimary}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Settings size={16} />} Save settings</button>
        <p className="text-xs text-slate-400">The refund policy text itself is a page under Website Pages → Legal (refunds).</p>
      </div>
    </Page>
  );
}
