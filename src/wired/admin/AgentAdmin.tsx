import { askConfirm, askText } from '../../components/dialogs';
import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Banknote, Check, FileSignature, FileText, Loader2, Paperclip, Percent, Save, X } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { SUPABASE_KEY, SUPABASE_URL, supabase } from '../../lib/supabase';
import { fmtDate, fmtDateTime, money, useData } from '../../lib/db';
import { DemoNotice, Field, Modal, Page, PageHero, Spinner, StatusPill, btnPrimary, inputCls, toast } from '../../components/ui';
import EntityGrid from './EntityGrid';
import { notify } from './AdminEnrollments';
import { useOptions } from './options';

const openFile = async (p: string) => { const { data } = await supabase.storage.from('uploads').createSignedUrl(p, 300); if (data) window.open(data.signedUrl, '_blank'); };
const Tabs = ({ tabs, v, set }: { tabs: string[]; v: string; set: (s: string) => void }) => (
  <div className="inline-flex bg-slate-50 p-1 rounded-xl border border-slate-200">{tabs.map((t) => <button key={t} onClick={() => set(t)} className={`px-4 py-2 rounded-lg text-xs font-bold capitalize ${v === t ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>{t}</button>)}</div>
);

// ---------------- Applications ----------------
type App = { id: string; company: string | null; country: string | null; status: string; review_note: string | null; contract_signed_at: string | null; created_at: string; profile: { full_name: string; email: string; phone: string | null } | null };
export function AdminAgentApplications() {
  const user = useAuth((s) => s.user);
  const [tab, setTab] = useState('pending');
  const { data, loading, reload } = useData<App[]>(() => supabase.from('agent_profiles').select('id,company,country,status,review_note,contract_signed_at,created_at, profile:profiles(full_name,email,phone)').order('created_at', { ascending: false }));
  const docs = useData<{ agent_id: string; file_url: string; status: string; id: number; req: { name: string } | null }[]>(() => supabase.from('agent_documents').select('id,agent_id,file_url,status, req:agent_doc_requirements(name)'));
  const list = (data ?? []).filter((a) => tab === 'all' || a.status === tab);
  const decide = async (a: App, status: string) => {
    const note = status === 'approved' ? '' : await askText('Note to the applicant (optional):') ?? '';
    const { error } = await supabase.from('agent_profiles').update({ status, review_note: note || null }).eq('id', a.id);
    if (error) return toast.err(error.message);
    if (status === 'approved') await supabase.from('agent_documents').update({ status: 'accepted' }).eq('agent_id', a.id).eq('status', 'submitted');
    await notify(a.id, `Agent application ${status}`, note || (status === 'approved' ? 'Welcome aboard! Sign in again to open your agent portal.' : undefined));
    toast.ok(`Application ${status}`); reload(); docs.reload();
  };
  return (
    <Page>
      {user?.demo && <DemoNotice />}
      <PageHero badge="Agent Management" title="Agent Applications" illus="applications" subtitle="Review people who applied to become LLC agents. Approving gives them access to the agent portal."><Tabs tabs={['pending', 'approved', 'rejected', 'suspended', 'all']} v={tab} set={setTab} /></PageHero>
      {loading ? <Spinner /> : !list.length ? <p className="text-center text-slate-400 py-16">No applications here.</p> : (
        <div className="grid md:grid-cols-2 gap-5">{list.map((a) => (
          <div key={a.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
            <div className="flex justify-between items-start"><div><p className="font-extrabold text-slate-900">{a.profile?.full_name}</p><p className="text-xs text-slate-500">{a.profile?.email} · {a.profile?.phone ?? 'no phone'}</p><p className="text-xs text-slate-400">{a.company ?? 'Individual'} · {a.country ?? '—'} · applied {fmtDate(a.created_at)}</p></div><StatusPill status={a.status} /></div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className={`px-2 py-1 rounded-md font-bold ${a.contract_signed_at ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}><FileSignature size={12} className="inline mr-1" />{a.contract_signed_at ? 'Contract signed' : 'Not signed'}</span>
              {(docs.data ?? []).filter((d) => d.agent_id === a.id).map((d) => <button key={d.id} onClick={() => openFile(d.file_url)} className="px-2 py-1 rounded-md bg-indigo-50 text-indigo-600 font-bold"><Paperclip size={12} className="inline mr-1" />{d.req?.name ?? 'Document'}</button>)}
            </div>
            {a.review_note && <p className="text-xs text-slate-500 mt-2">Note: {a.review_note}</p>}
            <div className="flex gap-2 mt-4">
              {a.status !== 'approved' && <button onClick={() => decide(a, 'approved')} className="flex items-center gap-1 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold"><Check size={14} />Approve</button>}
              {a.status === 'pending' && <button onClick={() => decide(a, 'rejected')} className="flex items-center gap-1 px-4 py-2 rounded-xl border border-red-100 text-red-600 text-xs font-bold"><X size={14} />Reject</button>}
              {a.status === 'approved' && <button onClick={() => decide(a, 'suspended')} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold">Suspend</button>}
            </div>
          </div>
        ))}</div>
      )}
    </Page>
  );
}

// ---------------- Contracts ----------------
type Tpl = { id: number; version: number; title: string; body: string; is_active: boolean; created_at: string };
export function AdminAgentContracts() {
  const user = useAuth((s) => s.user);
  const tpls = useData<Tpl[]>(() => supabase.from('contract_templates').select('*').order('version', { ascending: false }));
  const signed = useData<{ id: string; contract_version: number; contract_signed_at: string; signature_name: string; profile: { full_name: string; email: string } | null }[]>(() =>
    supabase.from('agent_profiles').select('id,contract_version,contract_signed_at,signature_name, profile:profiles(full_name,email)').not('contract_signed_at', 'is', null).order('contract_signed_at', { ascending: false }));
  const cur = tpls.data?.find((t) => t.is_active) ?? tpls.data?.[0];
  const [edit, setEdit] = useState<{ title: string; body: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const publish = async () => {
    if (!edit) return; setBusy(true);
    const v = (tpls.data?.[0]?.version ?? 0) + 1;
    await supabase.from('contract_templates').update({ is_active: false }).eq('is_active', true);
    const { error } = await supabase.from('contract_templates').insert({ version: v, title: edit.title, body: edit.body, is_active: true });
    setBusy(false);
    if (error) toast.err(error.message); else { toast.ok(`Version ${v} published — agents will be asked to sign again`); setEdit(null); tpls.reload(); }
  };
  return (
    <Page>
      {user?.demo && <DemoNotice />}
      <PageHero badge="Agent Management" title="Agent Contracts" illus="agreement" subtitle="Edit the agent agreement and see who has signed which version. Publishing a new version asks every agent to sign again.">
        <button disabled={user?.demo || !cur} onClick={() => setEdit({ title: cur!.title, body: cur!.body })} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-orange-500 text-white text-sm font-bold disabled:opacity-50"><FileSignature size={16} /> Edit Agreement</button>
      </PageHero>
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6"><h3 className="font-extrabold mb-1">{cur?.title} <span className="text-xs text-slate-400">v{cur?.version}</span></h3><p className="text-xs text-slate-400 mb-4">Published {fmtDate(cur?.created_at)}</p>
          <div className="text-sm text-slate-600 whitespace-pre-line max-h-96 overflow-y-auto custom-scrollbar">{cur?.body}</div></div>
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6"><h3 className="font-extrabold mb-4">Signed agreements</h3>
          {signed.loading ? <Spinner /> : !signed.data?.length ? <p className="text-sm text-slate-400">No signatures yet.</p> : signed.data.map((s) => (
            <div key={s.id} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0 text-sm"><div><p className="font-bold">{s.profile?.full_name}</p><p className="text-[11px] text-slate-400">{s.profile?.email}</p></div><div className="text-right"><p className="font-[cursive] text-indigo-900">{s.signature_name}</p><p className="text-[10px] text-slate-400">v{s.contract_version} · {fmtDateTime(s.contract_signed_at)}</p></div></div>
          ))}</div>
      </div>
      {edit && <Modal open onClose={() => setEdit(null)} title="Edit Agreement (new version)" wide>
        <div className="space-y-4"><Field label="Title"><input className={inputCls} value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
          <Field label="Agreement text"><textarea rows={16} className={inputCls} value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} /></Field>
          <button disabled={busy} onClick={publish} className={`${btnPrimary} w-full`}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Publish New Version</button></div>
      </Modal>}
    </Page>
  );
}

// ---------------- Document requirement lists ----------------
type Req = { id: number; name: string; description: string | null; required: boolean };
const reqCard = (r: Req) => (<><div className="flex justify-between items-start mb-2"><span className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 grid place-items-center"><FileText size={20} /></span>{r.required && <span className="text-[10px] font-black uppercase text-red-500 bg-red-50 px-2 py-0.5 rounded-full">Required</span>}</div><h3 className="text-lg font-bold text-slate-900">{r.name}</h3><p className="text-sm text-slate-500">{r.description || 'No description.'}</p></>);
const reqFields = [{ k: 'name', label: 'Document name', required: true }, { k: 'description', label: 'Instructions', type: 'textarea' as const }, { k: 'required', label: 'Required', type: 'checkbox' as const }];
export function AdminAgentDocs() {
  return <EntityGrid<Req> table="agent_doc_requirements" badge="Agent Management" title="Agent Application Documents" illus="documents" addLabel="Add Document" subtitle="Documents agents must upload before they are approved." fields={reqFields} defaults={{ required: true }} searchText={(r) => r.name} card={reqCard} />;
}
export function AdminStudentDocs() {
  return <EntityGrid<Req> table="student_doc_requirements" badge="Agent Management" title="Student Enrollment Documents" illus="documents" addLabel="Add Document" subtitle="Documents agents must attach when they enroll a student." fields={reqFields} defaults={{ required: true }} searchText={(r) => r.name} card={reqCard} />;
}

// ---------------- Commission rules ----------------
type CR = { id: number; name: string; course_id: number | null; kind: string; value: number; is_active: boolean; course: { title: string } | null };
export function AdminCommissionRules() {
  const courses = useOptions('courses', 'title');
  return <EntityGrid<CR> table="commission_rules" select="*, course:courses(title)" badge="Agent Management" title="Commission Rules" illus="commission" addLabel="Add Rule"
    subtitle="A course-specific rule wins over the default rule (no course). Commission is created when an agent's enrollment becomes active."
    defaults={{ kind: 'percent', is_active: true }} searchText={(r) => `${r.name} ${r.course?.title ?? ''}`}
    fields={[{ k: 'name', label: 'Rule name', required: true }, { k: 'course_id', label: 'Course (leave empty = default for all)', type: 'select', options: courses }, { k: 'kind', label: 'Type', type: 'select', half: true, required: true, options: [{ value: 'percent', label: 'Percentage of fee' }, { value: 'fixed', label: 'Fixed amount (MYR)' }] }, { k: 'value', label: 'Value', type: 'number', half: true, required: true }, { k: 'is_active', label: 'Active', type: 'checkbox' }]}
    toRow={(f) => ({ ...f, course_id: f.course_id ? Number(f.course_id) : null, value: Number(f.value) })}
    card={(r) => (<><div className="flex justify-between items-start mb-2"><span className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 grid place-items-center"><Percent size={20} /></span><StatusPill status={r.is_active ? 'active' : 'cancelled'} /></div>
      <h3 className="text-lg font-bold text-slate-900">{r.name}</h3><p className="text-sm text-slate-500">{r.course?.title ?? 'All courses (default)'}</p><p className="text-2xl font-black text-emerald-600 mt-2">{r.kind === 'percent' ? `${r.value}%` : money(r.value)}</p></>)} />;
}

// ---------------- Agent enrollments (referrals) ----------------
type Ref = { id: number; agent_id: string; student_name: string; student_email: string; student_phone: string | null; student_country: string | null; course_id: number; documents: Record<string, string>; status: string; review_note: string | null; created_at: string; course: { title: string } | null; agent: { full_name: string } | null; enrollment: { status: string } | null };
export function AdminAgentEnrollments() {
  const user = useAuth((s) => s.user);
  const [tab, setTab] = useState('submitted');
  const { data, loading, reload } = useData<Ref[]>(() => supabase.from('agent_referrals').select('*, course:courses(title), agent:profiles!agent_referrals_agent_id_fkey(full_name), enrollment:enrollments(status)').order('created_at', { ascending: false }));
  const reqs = useData<{ id: number; name: string }[]>(() => supabase.from('student_doc_requirements').select('id,name'));
  const [busy, setBusy] = useState<number | null>(null);
  const list = (data ?? []).filter((r) => tab === 'all' || r.status === tab);

  const approve = async (r: Ref) => {
    setBusy(r.id);
    try {
      // find or create the student account
      let sid: string | null = null;
      const ex = await supabase.from('profiles').select('id').eq('email', r.student_email).maybeSingle();
      if (ex.data) sid = ex.data.id;
      else {
        const tmp = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false, storageKey: 'llc-tmp' } });
        const pw = crypto.getRandomValues(new Uint32Array(4)).join('-') + 'Aa!';
        const su = await tmp.auth.signUp({ email: r.student_email, password: pw, options: { data: { full_name: r.student_name, phone: r.student_phone, country: r.student_country }, emailRedirectTo: `${location.origin}${import.meta.env.BASE_URL}login` } });
        if (su.error || !su.data.user) throw new Error(su.error?.message ?? 'Could not create the student account');
        sid = su.data.user.id;
        await new Promise((ok) => setTimeout(ok, 700));
        await supabase.auth.resetPasswordForEmail(r.student_email, { redirectTo: `${location.origin}${import.meta.env.BASE_URL}reset-password` });
      }
      const en = await supabase.from('enrollments').insert({ student_id: sid, course_id: r.course_id, status: 'pending', source: 'agent', agent_id: r.agent_id, note: `Referred by agent (#${r.id})` }).select('id').single();
      if (en.error) throw new Error(en.error.message);
      const up = await supabase.from('agent_referrals').update({ status: 'approved', student_id: sid, enrollment_id: en.data.id }).eq('id', r.id);
      if (up.error) throw new Error(up.error.message);
      await notify(r.agent_id, 'Student accepted', `${r.student_name} — ${r.course?.title}. Commission is created when the enrollment is activated.`, '/agent/enrollments');
      toast.ok('Approved — finish the enrollment (batch & payment) in Academic › Enrollments.');
      reload();
    } catch (e) { toast.err((e as Error).message); }
    setBusy(null);
  };
  const reject = async (r: Ref) => {
    const note = await askText('Reason (shown to the agent):'); if (note === null) return;
    const { error } = await supabase.from('agent_referrals').update({ status: 'rejected', review_note: note || null }).eq('id', r.id);
    if (error) return toast.err(error.message);
    await notify(r.agent_id, 'Student not accepted', `${r.student_name}${note ? ` — ${note}` : ''}`, '/agent/enrollments');
    reload();
  };
  return (
    <Page wide>
      {user?.demo && <DemoNotice />}
      <PageHero badge="Agent Management" title="Agent Enrollments" illus="enrollment" subtitle="Students submitted by agents. Approving creates the student's account (they get an email to set their password) and a pending enrollment."><Tabs tabs={['submitted', 'approved', 'rejected', 'all']} v={tab} set={setTab} /></PageHero>
      {loading ? <Spinner /> : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[900px]"><thead className="bg-slate-50 text-[11px] font-extrabold uppercase text-slate-500"><tr><th className="px-4 py-3">Student</th><th className="px-3 py-3">Course</th><th className="px-3 py-3">Agent</th><th className="px-3 py-3">Documents</th><th className="px-3 py-3">Status</th><th className="px-3 py-3 text-right">Action</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{list.map((r) => (
              <tr key={r.id}><td className="px-4 py-3"><p className="font-bold">{r.student_name}</p><p className="text-[11px] text-slate-400">{r.student_email} · {r.student_phone ?? ''} · {r.student_country ?? ''}</p></td>
                <td className="px-3 py-3">{r.course?.title}</td><td className="px-3 py-3 text-xs">{r.agent?.full_name}<br /><span className="text-slate-400">{fmtDate(r.created_at)}</span></td>
                <td className="px-3 py-3">{Object.entries(r.documents ?? {}).map(([rid, path]) => <button key={rid} onClick={() => openFile(path)} className="block text-xs font-bold text-indigo-600"><Paperclip size={11} className="inline mr-1" />{reqs.data?.find((q) => String(q.id) === rid)?.name ?? 'File'}</button>)}</td>
                <td className="px-3 py-3"><StatusPill status={r.status === 'submitted' ? 'pending' : r.status} />{r.enrollment && <p className="text-[10px] text-slate-400 mt-1">Enrollment: {r.enrollment.status}</p>}</td>
                <td className="px-3 py-3 text-right whitespace-nowrap">{r.status === 'submitted' && <>
                  <button disabled={busy === r.id} onClick={() => approve(r)} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold">{busy === r.id ? <Loader2 size={12} className="animate-spin inline" /> : 'Approve'}</button>
                  <button onClick={() => reject(r)} className="ml-1 px-3 py-1.5 rounded-lg border border-red-100 text-red-600 text-xs font-bold">Reject</button></>}</td></tr>
            ))}{!list.length && <tr><td colSpan={6} className="p-8 text-center text-slate-400 text-xs">Nothing here.</td></tr>}</tbody></table>
        </div>
      )}
    </Page>
  );
}

// ---------------- Earnings ----------------
type Ea = { id: number; amount: number; currency: string; status: string; created_at: string; payout_id: number | null; agent: { full_name: string } | null; enrollment: { status: string; student: { full_name: string } | null; course: { title: string } | null; payments: { status: string }[] } | null };
export function AdminAgentEarnings() {
  const user = useAuth((s) => s.user);
  const [tab, setTab] = useState('pending');
  const { data, loading, reload } = useData<Ea[]>(() => supabase.from('agent_earnings').select('*, agent:profiles!agent_earnings_agent_id_fkey(full_name), enrollment:enrollments(status, student:profiles!enrollments_student_id_fkey(full_name), course:courses(title), payments(status))').order('created_at', { ascending: false }));
  const list = (data ?? []).filter((x) => tab === 'all' || x.status === tab);
  const set = async (x: Ea, status: string) => { const { error } = await supabase.from('agent_earnings').update({ status }).eq('id', x.id); if (error) toast.err(error.message); else reload(); };
  return (
    <Page wide>
      {user?.demo && <DemoNotice />}
      <PageHero badge="Agent Management" title="Agent Earnings" illus="earnings" subtitle="Approve commission once the student's fee is paid. Approved earnings can be withdrawn by the agent."><Tabs tabs={['pending', 'approved', 'paid', 'cancelled', 'all']} v={tab} set={setTab} /></PageHero>
      {loading ? <Spinner /> : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[820px]"><thead className="bg-slate-50 text-[11px] font-extrabold uppercase text-slate-500"><tr><th className="px-4 py-3">Agent</th><th className="px-3 py-3">Student / Course</th><th className="px-3 py-3">Fee paid?</th><th className="px-3 py-3">Commission</th><th className="px-3 py-3">Status</th><th className="px-3 py-3 text-right">Action</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{list.map((x) => {
              const paid = x.enrollment?.payments?.some((p) => p.status === 'paid');
              return (
                <tr key={x.id}><td className="px-4 py-3 font-bold">{x.agent?.full_name}</td><td className="px-3 py-3"><p className="font-semibold">{x.enrollment?.student?.full_name}</p><p className="text-[11px] text-slate-400">{x.enrollment?.course?.title} · {fmtDate(x.created_at)}</p></td>
                  <td className="px-3 py-3 text-xs font-bold">{paid ? <span className="text-emerald-600">Yes</span> : <span className="text-amber-600">Not yet</span>}</td><td className="px-3 py-3 font-black">{money(x.amount, x.currency)}</td><td className="px-3 py-3"><StatusPill status={x.status} /></td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">{x.status === 'pending' && <><button onClick={() => set(x, 'approved')} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold">Approve</button><button onClick={() => set(x, 'cancelled')} className="ml-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold">Cancel</button></>}</td></tr>
              );
            })}{!list.length && <tr><td colSpan={6} className="p-8 text-center text-slate-400 text-xs">Nothing here.</td></tr>}</tbody></table>
        </div>
      )}
    </Page>
  );
}

// ---------------- Payouts ----------------
type Po = { id: number; agent_id: string; amount: number; currency: string; status: string; reference: string | null; note: string | null; created_at: string; paid_at: string | null; agent: { full_name: string; email: string } | null };
type Bank = { id: string; bank_name: string | null; bank_account_name: string | null; bank_account_no: string | null; swift: string | null; iban: string | null; paypal_email: string | null };
export function AdminAgentPayouts() {
  const user = useAuth((s) => s.user);
  const [tab, setTab] = useState('requested');
  const { data, loading, reload } = useData<Po[]>(() => supabase.from('agent_payouts').select('*, agent:profiles!agent_payouts_agent_id_fkey(full_name,email)').order('created_at', { ascending: false }));
  const banks = useData<Bank[]>(() => supabase.from('agent_profiles').select('id,bank_name,bank_account_name,bank_account_no,swift,iban,paypal_email'));
  const [pay, setPay] = useState<Po | null>(null);
  const [ref, setRef] = useState('');
  const list = (data ?? []).filter((p) => tab === 'all' || p.status === tab);
  const finish = async (status: 'paid' | 'rejected') => {
    if (!pay) return;
    const { error } = await supabase.from('agent_payouts').update({ status, reference: ref || null, note: status === 'rejected' ? ref || null : pay.note }).eq('id', pay.id);
    if (error) return toast.err(error.message);
    await notify(pay.agent_id, status === 'paid' ? 'Payout sent 💸' : 'Payout request declined', `${money(pay.amount, pay.currency)}${ref ? ` · ${ref}` : ''}`, '/agent/payouts');
    toast.ok(`Payout ${status}`); setPay(null); setRef(''); reload();
  };
  const b = banks.data?.find((x) => x.id === pay?.agent_id);
  return (
    <Page>
      {user?.demo && <DemoNotice />}
      <PageHero badge="Agent Management" title="Agent Payouts" illus="payouts" subtitle="Payout requests from agents. Transfer the money, then record the bank reference here."><Tabs tabs={['requested', 'paid', 'rejected', 'all']} v={tab} set={setTab} /></PageHero>
      {loading ? <Spinner /> : !list.length ? <p className="text-center text-slate-400 py-16">Nothing here.</p> : (
        <div className="space-y-3">{list.map((p) => (
          <div key={p.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 flex flex-wrap items-center gap-4">
            <span className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 grid place-items-center"><Banknote size={20} /></span>
            <div className="flex-1 min-w-48"><p className="font-bold text-slate-900">{p.agent?.full_name} <span className="text-xs font-normal text-slate-400">{p.agent?.email}</span></p><p className="text-xs text-slate-400">Requested {fmtDate(p.created_at)}{p.paid_at && ` · Paid ${fmtDate(p.paid_at)}`}{p.reference && ` · ${p.reference}`}</p></div>
            <p className="text-xl font-black">{money(p.amount, p.currency)}</p><StatusPill status={p.status === 'requested' ? 'pending' : p.status} />
            {p.status === 'requested' && <button onClick={() => setPay(p)} className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold">Process</button>}
          </div>
        ))}</div>
      )}
      <Modal open={!!pay} onClose={() => setPay(null)} title={`Pay ${pay?.agent?.full_name ?? ''}`}>
        <div className="space-y-4">
          <p className="text-3xl font-black text-slate-900">{pay && money(pay.amount, pay.currency)}</p>
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-sm grid grid-cols-3 gap-y-1">
            <span className="text-slate-400">Bank</span><span className="col-span-2 font-semibold">{b?.bank_name ?? '—'}</span>
            <span className="text-slate-400">Name</span><span className="col-span-2 font-semibold">{b?.bank_account_name ?? '—'}</span>
            <span className="text-slate-400">Account</span><span className="col-span-2 font-semibold">{b?.bank_account_no ?? '—'}</span>
            <span className="text-slate-400">SWIFT</span><span className="col-span-2 font-semibold">{b?.swift ?? '—'}</span>
            <span className="text-slate-400">PayPal</span><span className="col-span-2 font-semibold">{b?.paypal_email ?? '—'}</span>
          </div>
          <Field label="Bank reference / note"><input className={inputCls} value={ref} onChange={(e) => setRef(e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-2"><button onClick={() => finish('paid')} className={`${btnPrimary} bg-emerald-600 hover:bg-emerald-700`}><Check size={16} />Mark as Paid</button><button onClick={() => finish('rejected')} className="py-3 rounded-xl border border-red-100 text-red-600 text-sm font-bold">Decline</button></div>
        </div>
      </Modal>
    </Page>
  );
}
