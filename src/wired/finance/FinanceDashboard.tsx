import { useNavigate } from 'react-router-dom';
import { Banknote, ClipboardCheck, HandCoins, PenTool, Receipt, TrendingUp, Wallet } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { fmtDate, money, useData } from '../../lib/db';
import { DemoNotice, StatusPill } from '../../components/ui';

type Pay = { id: number; amount: number; currency: string; status: string; created_at: string; paid_at: string | null; student: { full_name: string } | null; enrollment: { course: { title: string } | null } | null };
type D = { paid: { amount: number; paid_at: string | null }[]; pending: { amount: number }[]; enrollPending: number; commissionsDue: { amount: number }[]; payoutsRequested: { amount: number }[]; recent: Pay[] };

async function load() {
  const [paid, pending, ep, due, req, recent] = await Promise.all([
    supabase.from('payments').select('amount,paid_at').eq('status', 'paid'),
    supabase.from('payments').select('amount').eq('status', 'pending'),
    supabase.from('enrollments').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('agent_earnings').select('amount').eq('status', 'pending'),
    supabase.from('agent_payouts').select('amount').eq('status', 'requested'),
    supabase.from('payments').select('id,amount,currency,status,created_at,paid_at, student:profiles!payments_student_id_fkey(full_name), enrollment:enrollments(course:courses(title))').order('created_at', { ascending: false }).limit(8),
  ]);
  return { data: { paid: paid.data ?? [], pending: pending.data ?? [], enrollPending: ep.count ?? 0, commissionsDue: due.data ?? [], payoutsRequested: req.data ?? [], recent: recent.data ?? [] } as unknown as D, error: null };
}
const sum = (l: { amount: number }[] = []) => l.reduce((a, x) => a + Number(x.amount), 0);

/** Home of the finance officer: money in, money out, what waits for a decision. */
export default function FinanceDashboard() {
  const user = useAuth((s) => s.user)!;
  const nav = useNavigate();
  const { data } = useData<D>(load);
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const thisMonth = sum((data?.paid ?? []).filter((p) => p.paid_at && new Date(p.paid_at) >= monthStart));
  const STATS = [
    { v: money(thisMonth), l: 'Collected this month', icon: TrendingUp, tint: 'text-emerald-600', bg: 'bg-emerald-50', to: '/admin-financials' },
    { v: money(sum(data?.paid)), l: 'Collected in total', icon: Banknote, tint: 'text-indigo-600', bg: 'bg-indigo-50', to: '/admin-financials' },
    { v: money(sum(data?.pending)), l: 'Awaiting verification', icon: Receipt, tint: 'text-[#e9a823]', bg: 'bg-orange-50', to: '/admin-financials' },
    { v: money(sum(data?.payoutsRequested)), l: 'Agent payouts requested', icon: Wallet, tint: 'text-slate-800', bg: 'bg-slate-100', to: '/admin/agent-payouts' },
  ];
  const TODO = [
    { n: data?.pending.length ?? 0, l: 'Payments to verify', icon: Receipt, to: '/admin-financials' },
    { n: data?.enrollPending ?? 0, l: 'Enrollments to approve', icon: ClipboardCheck, to: '/admin-enrollments' },
    { n: data?.commissionsDue.length ?? 0, l: 'Agent commissions to approve', icon: HandCoins, to: '/admin/agent-earnings' },
    { n: data?.payoutsRequested.length ?? 0, l: 'Payout requests', icon: Wallet, to: '/admin/agent-payouts' },
  ];
  return (
    <div className="w-full bg-[#fafafa] font-sans min-h-screen pb-20">
      <main className="w-full px-6 lg:px-8 py-8">
        {user.demo && <DemoNotice />}
        <div className="bg-white rounded-4xl border border-slate-100 shadow-sm p-8 mb-10 flex flex-col lg:flex-row items-center justify-between">
          <div className="w-full lg:w-1/2">
            <span className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold uppercase tracking-wider mb-4 border border-emerald-100 shadow-sm"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />Finance Office</span>
            <h1 className="text-4xl font-extrabold text-slate-900 mb-3 tracking-tight">Hello, {user.name.split(' ')[0]}! <span className="inline-block animate-wave origin-bottom-right">👋</span></h1>
            <p className="text-slate-500 text-lg leading-relaxed max-w-md">You have <span className="font-extrabold text-slate-800">{TODO.reduce((a, t) => a + t.n, 0)} items</span> waiting for your review.</p>
          </div>
          <div className="w-full lg:w-1/2 flex gap-3 flex-wrap justify-start lg:justify-end mt-6 lg:mt-0">
            <button onClick={() => nav('/admin-financials')} className="bg-slate-900 text-white px-6 py-4 rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:bg-orange-500 transition-all flex items-center gap-2"><Receipt size={16} /> Payments</button>
            <button onClick={() => nav('/finance/toolkit')} className="bg-white text-slate-800 px-6 py-4 rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:shadow-xl transition-all shadow-sm border border-slate-200 flex items-center gap-2"><PenTool size={16} className="text-[#e9a823]" /> Toolkit</button>
          </div>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          <div className="xl:col-span-8 space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {STATS.map(({ v, l, icon: I, tint, bg, to }) => (
                <button key={l} onClick={() => nav(to)} className="text-left bg-white rounded-4xl p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-slate-100 relative overflow-hidden group">
                  <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 ${tint}`}><I size={100} className="rotate-12 translate-x-4 -translate-y-4" /></div>
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 ${bg}`}><I size={24} className={tint} /></div>
                  <h3 className="text-xl font-extrabold text-slate-900 tracking-tight mb-1">{v}</h3><p className="text-sm font-bold text-slate-500">{l}</p>
                </button>
              ))}
            </div>
            <div className="bg-white rounded-4xl p-6 lg:p-8 border border-slate-100 shadow-sm">
              <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-extrabold text-slate-900">Recent Payments</h2><button onClick={() => nav('/admin-financials')} className="text-[10px] font-extrabold uppercase tracking-widest text-[#e9a823] hover:underline">View All</button></div>
              <div className="divide-y divide-slate-100">
                {(data?.recent ?? []).map((p) => (
                  <div key={p.id} className="flex items-center gap-4 py-3">
                    <span className="w-10 h-10 rounded-full bg-slate-100 grid place-items-center font-bold text-slate-500">{p.student?.full_name?.[0]}</span>
                    <div className="flex-1 min-w-0"><p className="font-bold text-sm text-slate-800 truncate">{p.student?.full_name}</p><p className="text-xs text-slate-400 truncate">{p.enrollment?.course?.title ?? '—'}</p></div>
                    <span className="text-sm font-black text-slate-800">{money(Number(p.amount), p.currency)}</span>
                    <span className="text-xs text-slate-400 w-20 text-right">{fmtDate(p.paid_at ?? p.created_at)}</span><StatusPill status={p.status} />
                  </div>
                ))}
                {!data?.recent.length && <p className="text-sm text-slate-400 py-6 text-center">No payments yet.</p>}
              </div>
            </div>
          </div>
          <div className="xl:col-span-4 space-y-8">
            <div className="bg-[#0b1a3a] rounded-4xl p-6 lg:p-8 text-white">
              <h3 className="text-lg font-extrabold mb-5">Needs your attention</h3>
              <div className="space-y-2">
                {TODO.map(({ n, l, icon: I, to }) => (
                  <button key={l} onClick={() => nav(to)} className="w-full flex items-center gap-3 p-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors text-left">
                    <span className="w-9 h-9 rounded-xl bg-white/10 grid place-items-center text-orange-400"><I size={18} /></span>
                    <span className="flex-1 text-sm font-semibold text-slate-200">{l}</span>
                    <span className={`min-w-7 h-7 px-2 rounded-full grid place-items-center text-xs font-black ${n ? 'bg-orange-500 text-white' : 'bg-white/10 text-slate-400'}`}>{n}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-4xl p-6 border border-slate-100 shadow-sm flex items-center gap-4"><span className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 grid place-items-center"><HandCoins size={22} /></span><div><p className="text-2xl font-black">{money(sum(data?.commissionsDue))}</p><p className="text-xs font-bold text-slate-500">Agent commissions awaiting approval</p></div></div>
          </div>
        </div>
      </main>
    </div>
  );
}
