import { useEffect, useState } from 'react';
import { Check, Crown, Ticket } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { fmtDate, useData } from '../../lib/db';
import { CurrencyPicker, Price } from '../../lib/price';
import { usePlacementDone } from '../../lib/placement';
import PlacementRequired from '../../components/PlacementRequired';
import PayBox from '../../components/PayBox';
import { DemoNotice, Modal, Page, PageHero, Spinner, StatusPill } from '../../components/ui';

export type Plan = { id: number; name: string; description: string | null; price: number; period_months: number; private_credits: number; course_ids: number[]; features: string | null; is_active: boolean; sort_order: number };
export type Pack = { id: number; name: string; description: string | null; sessions: number; price: number; valid_days: number; is_active: boolean; sort_order: number };
type Sub = { id: number; plan_id: number; status: string; starts_at: string; ends_at: string; plan: { name: string } | null };
type Grant = { id: number; source: string; total: number; used: number; expires_at: string; note: string | null };

export const periodLabel = (m: number) => (m === 1 ? 'per month' : m === 12 ? 'per year' : `every ${m} months`);

export default function StudentPlans() {
  const user = useAuth((s) => s.user)!;
  const placed = usePlacementDone();
  const plans = useData<Plan[]>(() => supabase.from('plans').select('*').eq('is_active', true).order('sort_order').order('price'));
  const packs = useData<Pack[]>(() => supabase.from('session_packages').select('*').eq('is_active', true).order('sort_order').order('sessions'));
  const courses = useData<{ id: number; title: string }[]>(() => supabase.from('courses').select('id,title'));
  const subs = useData<Sub[]>(() => supabase.from('subscriptions').select('*, plan:plans(name)').eq('student_id', user.id).order('created_at', { ascending: false }));
  const grants = useData<Grant[]>(() => supabase.from('credit_grants').select('*').eq('student_id', user.id).gt('expires_at', new Date().toISOString()).order('expires_at'));
  const [buy, setBuy] = useState<{ kind: 'plan' | 'package'; id: number; name: string } | null>(null);
  useEffect(() => { if (!user.demo) supabase.rpc('expire_subscriptions').then(() => subs.reload()); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const title = (id: number) => courses.data?.find((c) => c.id === id)?.title;
  const left = (grants.data ?? []).reduce((a, g) => a + g.total - g.used, 0);
  const active = (subs.data ?? []).filter((s) => s.status === 'active');
  const done = () => { setBuy(null); subs.reload(); grants.reload(); };

  return (
    <Page wide>
      {user.demo && <DemoNotice />}
      <PageHero badge="Plans" badgeColor="indigo" title="Plans & Packages" illus="payment" subtitle="A monthly plan opens courses and includes private sessions. A session package gives you one-to-one sessions to book when you like.">
        <CurrencyPicker />
      </PageHero>
      {placed === false ? <PlacementRequired /> : <>
        {(active.length > 0 || left > 0) && (
          <div className="grid md:grid-cols-2 gap-4 mb-8">
            {active.map((s) => (
              <div key={s.id} className="p-5 rounded-3xl bg-gradient-to-br from-indigo-600 to-indigo-800 text-white">
                <p className="text-[11px] font-black uppercase tracking-wider text-indigo-200 flex items-center gap-1"><Crown size={14} />My plan</p>
                <p className="text-xl font-extrabold mt-1">{s.plan?.name}</p>
                <p className="text-sm text-indigo-100 mt-1">{`Active until ${fmtDate(s.ends_at)}`}</p>
              </div>
            ))}
            {left > 0 && (
              <div className="p-5 rounded-3xl bg-white border border-slate-100 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1"><Ticket size={14} />Private sessions</p>
                <p className="text-3xl font-black text-slate-900 mt-1">{left}</p>
                <div className="text-xs text-slate-500 mt-1 space-y-0.5">{(grants.data ?? []).filter((g) => g.total > g.used).map((g) => <p key={g.id}>{`${g.total - g.used} from ${g.note ?? g.source} · use before ${fmtDate(g.expires_at)}`}</p>)}</div>
              </div>
            )}
          </div>
        )}

        <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3">Plans</h2>
        {plans.loading ? <Spinner /> : !(plans.data ?? []).length ? <p className="text-slate-400 text-sm mb-8">No plans are offered at the moment.</p> : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5 mb-10">{(plans.data ?? []).map((p) => {
            const mine = active.find((s) => s.plan_id === p.id);
            return (
              <div key={p.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 flex flex-col">
                <p className="text-lg font-extrabold text-slate-900">{p.name}</p>
                {p.description && <p className="text-sm text-slate-500 mt-1">{p.description}</p>}
                <div className="mt-4 flex items-end gap-2"><Price className="text-3xl font-black text-slate-900" amount={p.price} /><span className="text-xs text-slate-400 mb-1">{periodLabel(p.period_months)}</span></div>
                <ul className="mt-4 space-y-2 text-sm text-slate-600 flex-1">
                  {p.private_credits > 0 && <li className="flex gap-2"><Check size={16} className="text-emerald-500 shrink-0" />{`${p.private_credits} private sessions included`}</li>}
                  {p.course_ids.map((id) => title(id) && <li key={id} className="flex gap-2"><Check size={16} className="text-emerald-500 shrink-0" />{title(id)}</li>)}
                  {(p.features ?? '').split('\n').filter(Boolean).map((f, i) => <li key={i} className="flex gap-2"><Check size={16} className="text-emerald-500 shrink-0" />{f}</li>)}
                </ul>
                <button onClick={() => setBuy({ kind: 'plan', id: p.id, name: p.name })} className="mt-5 w-full py-3 rounded-xl bg-slate-900 hover:bg-orange-500 text-white text-sm font-bold">{mine ? 'Renew' : 'Choose this plan'}</button>
              </div>
            );
          })}</div>
        )}

        <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3">Private-session packages</h2>
        {packs.loading ? <Spinner /> : !(packs.data ?? []).length ? <p className="text-slate-400 text-sm">No packages are offered at the moment.</p> : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-10">{(packs.data ?? []).map((k) => (
            <div key={k.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 flex flex-col">
              <span className="w-11 h-11 rounded-xl bg-orange-50 text-orange-600 grid place-items-center"><Ticket size={20} /></span>
              <p className="font-extrabold text-slate-900 mt-3">{k.name}</p>
              <p className="text-xs text-slate-500 mt-1 flex-1">{`${k.sessions} one-to-one sessions · use within ${k.valid_days} days`}{k.description ? ` · ${k.description}` : ''}</p>
              <Price className="text-2xl font-black text-slate-900 mt-3" amount={k.price} />
              <button onClick={() => setBuy({ kind: 'package', id: k.id, name: k.name })} className="mt-4 w-full py-2.5 rounded-xl border border-slate-200 hover:border-orange-400 text-sm font-bold">Buy</button>
            </div>
          ))}</div>
        )}

        {(subs.data ?? []).some((s) => s.status !== 'active') && <>
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3">Earlier plans</h2>
          <div className="bg-white rounded-3xl border border-slate-100 divide-y divide-slate-100">{(subs.data ?? []).filter((s) => s.status !== 'active').map((s) => (
            <div key={s.id} className="px-5 py-3 flex items-center gap-3 text-sm"><span className="flex-1">{s.plan?.name} · {fmtDate(s.starts_at)} – {fmtDate(s.ends_at)}</span><StatusPill status={s.status} /></div>
          ))}</div>
        </>}
      </>}
      {buy && <Modal open onClose={() => setBuy(null)} title={buy.name}><PayBox kind={buy.kind} item={buy.id} onCancel={() => setBuy(null)} onDone={done} /></Modal>}
    </Page>
  );
}
