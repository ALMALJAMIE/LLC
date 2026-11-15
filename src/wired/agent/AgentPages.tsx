import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Banknote, BookOpen, Briefcase, Building2, CalendarDays, ChartColumn, CircleCheck, Clock, FileSignature, FileText, Globe, Loader2, Mail, Percent, Phone, Printer, Save, ShieldCheck, Trash2, TrendingUp, Upload, User, UserPlus, Users, Wallet } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { fmtDate, fmtDateTime, money, useData } from '../../lib/db';
import { useCenter } from '../../lib/site';
import { DemoNotice, Field, Page, PageHero, Spinner, StatusPill, btnAccent, btnPrimary, inputCls, toast } from '../../components/ui';
import { sum, useAgentProfile, useEarnings, useReferrals, type AgentProfile } from './hooks';
import mark from '../../assets/llc-mark.png';

// ---------------- Dashboard ----------------
export function AgentDashboard() {
  const user = useAuth((s) => s.user)!;
  const nav = useNavigate();
  const ap = useAgentProfile();
  const earn = useEarnings();
  const refs = useReferrals();
  const pay = useData<{ amount: number; status: string }[]>(() => supabase.from('agent_payouts').select('amount,status').eq('agent_id', user.id));
  const e = earn.data ?? [];
  const STATS = [
    { l: 'Total Students', v: (refs.data ?? []).length, icon: Users, c: 'text-indigo-600 bg-indigo-50' },
    { l: 'Active Enrollments', v: (refs.data ?? []).filter((r) => r.enrollment?.status === 'active').length, icon: TrendingUp, c: 'text-red-500 bg-red-50' },
    { l: 'Pending Commission', v: money(sum(e.filter((x) => x.status === 'pending' || x.status === 'approved'))), icon: Clock, c: 'text-amber-500 bg-amber-50' },
    { l: 'Total Paid Out', v: money(sum((pay.data ?? []).filter((p) => p.status === 'paid'))), icon: Banknote, c: 'text-emerald-600 bg-emerald-50' },
  ];
  const NAVS = [
    { l: 'My Enrollments', d: 'View all enrolled students', icon: Users, to: '/agent/enrollments', c: 'text-indigo-600 bg-indigo-50' },
    { l: 'My Earnings', d: 'Track commission revenue', icon: ChartColumn, to: '/agent/earnings', c: 'text-emerald-600 bg-emerald-50' },
    { l: 'Programmes', d: 'Browse courses & payouts', icon: Briefcase, to: '/agent/programmes', c: 'text-amber-600 bg-amber-50' },
    { l: 'Payout History', d: 'View finalized payments', icon: Wallet, to: '/agent/payouts', c: 'text-red-500 bg-red-50' },
  ];
  const signed = !!ap.data?.contract_signed_at;
  return (
    <div className="w-full bg-[#fafafa] font-sans min-h-screen pb-20">
      <main className="w-full px-6 lg:px-8 py-8 max-w-7xl mx-auto">
        {user.demo && <DemoNotice />}
        <button onClick={() => nav('/agent/contract')} className="w-full bg-[#0b1a3a] rounded-3xl p-5 mb-6 flex items-center justify-between text-left">
          <div className="flex items-center gap-3"><span className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-400 grid place-items-center"><ShieldCheck size={20} /></span>
            <div><p className="font-bold text-white text-sm">Partnership Agreement</p><p className={`text-[11px] font-bold ${signed ? 'text-emerald-400' : 'text-orange-400'}`}>Status: {signed ? 'ACTIVE & VERIFIED' : 'SIGNATURE REQUIRED'}</p></div></div>
          <span className="text-[10px] font-mono text-slate-400 border border-white/10 rounded-lg px-2 py-1">Ref: AGT-{user.id.slice(0, 6).toUpperCase()}</span>
        </button>
        <div className="bg-white rounded-4xl border border-slate-100 shadow-sm p-8 mb-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <span className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold uppercase tracking-wider mb-3 border border-emerald-100"><span className="w-2 h-2 rounded-full bg-emerald-500" />Verified Partner Agent</span>
            <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Hello, {user.name.split(' ')[0]}! <span className="inline-block animate-wave origin-bottom-right">👋</span></h1>
            <p className="text-slate-500 mt-2 max-w-md">Welcome to your partner portal. Track your students and earnings here.</p>
          </div>
          <button onClick={() => nav('/agent/enroll-student')} className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-4 rounded-2xl font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-orange-200 flex items-center gap-2"><UserPlus size={16} /> Enroll New Student</button>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {STATS.map(({ l, v, icon: I, c }) => <div key={l} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5"><span className={`w-11 h-11 rounded-xl grid place-items-center mb-4 ${c}`}><I size={20} /></span><p className="text-2xl font-black text-slate-900">{v}</p><p className="text-xs font-bold text-slate-500">{l}</p></div>)}
        </div>
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <h3 className="font-extrabold text-slate-900 mb-4">Quick Navigation</h3>
            <div className="grid sm:grid-cols-2 gap-4">{NAVS.map(({ l, d, icon: I, to, c }) => (
              <button key={l} onClick={() => nav(to)} className="text-left bg-white rounded-3xl border border-slate-100 shadow-sm p-5 flex items-center gap-4 hover:shadow-lg transition-all"><span className={`w-11 h-11 rounded-xl grid place-items-center ${c}`}><I size={20} /></span><div><p className="font-bold text-slate-800">{l}</p><p className="text-xs text-slate-400">{d}</p></div></button>
            ))}</div>
          </div>
          <div className="bg-[#0b1a3a] rounded-4xl p-6 text-center text-white">
            <div className="w-20 h-20 mx-auto rounded-full border-4 border-orange-500 grid place-items-center text-3xl font-black">{user.name[0]}</div>
            <p className="font-extrabold mt-3">{user.name}</p><p className="text-xs text-slate-400">{user.email}</p>
            <div className="grid grid-cols-2 gap-2 mt-4 text-[10px] font-black uppercase"><div className="p-3 rounded-xl bg-white/5">Role<br /><span className="text-orange-400">Agent</span></div><div className="p-3 rounded-xl bg-white/5">Status<br /><span className="text-emerald-400">{ap.data?.status ?? 'verified'}</span></div></div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ---------------- Contract ----------------
type Tpl = { id: number; version: number; title: string; body: string };
export function AgentContract() {
  const CENTER = useCenter();
  const user = useAuth((s) => s.user)!;
  const profile = useAuth((s) => s.profile);
  const ap = useAgentProfile();
  const tpl = useData<Tpl>(() => supabase.from('contract_templates').select('*').eq('is_active', true).order('version', { ascending: false }).limit(1).maybeSingle());
  const docs = useData<{ id: number; name: string; description: string | null; required: boolean }[]>(() => supabase.from('agent_doc_requirements').select('*').order('id'));
  const mine = useData<{ id: number; requirement_id: number; file_url: string; status: string }[]>(() => supabase.from('agent_documents').select('id,requirement_id,file_url,status').eq('agent_id', user.id));
  const [sig, setSig] = useState('');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const a = ap.data;
  const signedCurrent = a?.contract_signed_at && a.contract_version === tpl.data?.version;

  const sign = async () => {
    if (!agree || sig.trim().length < 3) return toast.err('Type your full name and tick the box to sign.');
    setBusy(true);
    const row = { id: user.id, contract_version: tpl.data!.version, contract_signed_at: new Date().toISOString(), signature_name: sig.trim() };
    const { error } = a ? await supabase.from('agent_profiles').update(row).eq('id', user.id) : await supabase.from('agent_profiles').insert({ ...row, status: 'pending' });
    setBusy(false);
    if (error) toast.err(error.message); else { toast.ok('Agreement signed'); ap.reload(); }
  };
  const upload = async (reqId: number, f: File) => {
    const path = `${user.id}/agent-docs/${reqId}-${Date.now()}-${f.name.replace(/[^\w.-]/g, '_')}`;
    const up = await supabase.storage.from('uploads').upload(path, f);
    if (up.error) return toast.err(up.error.message);
    const { error } = await supabase.from('agent_documents').insert({ agent_id: user.id, requirement_id: reqId, file_url: path });
    if (error) toast.err(error.message); else { toast.ok('Uploaded'); mine.reload(); }
  };
  const remove = async (id: number) => { const { error } = await supabase.from('agent_documents').delete().eq('id', id); if (error) toast.err(error.message); else mine.reload(); };

  const fill = (body: string) => body;
  return (
    <Page>
      {user.demo && <DemoNotice />}
      <PageHero badge="Agent Portal" title={signedCurrent ? 'Agent Executed Contract' : 'Agent Agreement'} illus="agreement" subtitle="Review your agreement, sign it electronically, and upload the documents LLC needs to verify you." />
      <div className="bg-white rounded-4xl border border-slate-100 shadow-sm p-6 mb-6">
        <h3 className="font-extrabold text-slate-900 flex items-center gap-2 mb-4"><Briefcase size={18} className="text-orange-500" /> Partner Summary</h3>
        <div className="grid sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 text-sm">
          {[['Agent Name', user.name], ['Agent ID', `AGT-${user.id.slice(0, 6).toUpperCase()}`], ['Email', user.email], ['Country', a?.country ?? profile?.country ?? '—']].map(([k, v]) => <div key={k}><p className="text-[10px] font-bold uppercase text-slate-400">{k}</p><p className="font-bold text-slate-800 truncate">{v}</p></div>)}
        </div>
      </div>
      <div className="bg-white rounded-4xl border border-slate-100 shadow-sm p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <div><h3 className="font-extrabold text-slate-900 flex items-center gap-2"><FileSignature size={18} className="text-indigo-600" />{tpl.data?.title ?? 'Agreement'} <span className="text-xs text-slate-400">v{tpl.data?.version}</span></h3>
            {signedCurrent && <p className="text-xs text-slate-500">Signed on {fmtDateTime(a!.contract_signed_at)}</p>}</div>
          <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-50 text-orange-600 text-xs font-bold"><Printer size={14} /> Save PDF</button>
        </div>
        {tpl.loading ? <Spinner /> : !tpl.data ? <p className="text-sm text-slate-400">No agreement has been published yet.</p> : (
          <div className="p-6 rounded-2xl border border-slate-100 bg-slate-50/50 text-sm text-slate-700 leading-relaxed whitespace-pre-line max-h-[420px] overflow-y-auto custom-scrollbar">
            <div className="text-center mb-4"><img src={mark} alt="" className="h-10 mx-auto" /><p className="font-black text-indigo-700 tracking-widest text-xs mt-1">LANGUAGE LEAP CENTER</p></div>
            <p className="mb-4"><b>Between</b> {CENTER.name} and <b>{user.name}</b>{a?.company ? ` (${a.company})` : ''}, {a?.country ?? ''}.</p>
            {fill(tpl.data.body)}
          </div>
        )}
        {signedCurrent ? (
          <div className="mt-5 p-4 rounded-2xl bg-indigo-50 border border-indigo-100 grid sm:grid-cols-3 gap-4 text-sm">
            <div><p className="text-[10px] font-bold uppercase text-indigo-400">Electronic signature</p><p className="font-[cursive] text-2xl text-indigo-900">{a!.signature_name}</p></div>
            <div><p className="text-[10px] font-bold uppercase text-indigo-400">Signed by</p><p className="font-bold">{user.email}</p></div>
            <div><p className="text-[10px] font-bold uppercase text-indigo-400">Date & time</p><p className="font-bold">{fmtDateTime(a!.contract_signed_at)}</p></div>
          </div>
        ) : tpl.data && (
          <div className="mt-5 grid sm:grid-cols-2 gap-4 items-end">
            <Field label="Type your full name as signature"><input className={`${inputCls} font-[cursive] text-xl`} value={sig} onChange={(e) => setSig(e.target.value)} /></Field>
            <div className="space-y-3">
              <label className="flex items-start gap-2 text-xs text-slate-600"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 accent-orange-500" /> I have read and agree to this agreement, and my typed name is my electronic signature.</label>
              <button disabled={busy || user.demo} onClick={sign} className={`${btnAccent} w-full`}>{busy ? <Loader2 size={16} className="animate-spin" /> : <FileSignature size={16} />} Sign Agreement</button>
            </div>
          </div>
        )}
      </div>
      <div className="bg-white rounded-4xl border border-slate-100 shadow-sm p-6">
        <h3 className="font-extrabold text-slate-900 flex items-center gap-2 mb-4"><FileText size={18} className="text-emerald-600" /> My Documents</h3>
        <div className="space-y-3">{(docs.data ?? []).map((d) => {
          const up = (mine.data ?? []).filter((m) => m.requirement_id === d.id);
          return (
            <div key={d.id} className="flex flex-wrap items-center gap-3 p-4 rounded-2xl border border-slate-100">
              <div className="flex-1 min-w-48"><p className="font-bold text-slate-800">{d.name} {d.required && <span className="text-red-500">*</span>}</p><p className="text-xs text-slate-400">{d.description}</p></div>
              {up.map((u) => <span key={u.id} className="flex items-center gap-2"><StatusPill status={u.status} />{u.status === 'submitted' && <button onClick={() => remove(u.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={14} /></button>}</span>)}
              {!up.some((u) => u.status !== 'rejected') && <label className="flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed border-slate-300 text-xs font-bold text-slate-600 cursor-pointer hover:border-orange-400"><Upload size={14} /> Upload<input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && upload(d.id, e.target.files[0])} /></label>}
            </div>
          );
        })}</div>
      </div>
    </Page>
  );
}

// ---------------- Programmes ----------------
type Prog = { id: number; code: string; title: string; price: number; currency: string; delivery: string; duration_weeks: number | null; category: { name: string } | null; level: { name: string } | null };
type Rule = { course_id: number | null; kind: string; value: number; is_active: boolean };
export function AgentProgrammes() {
  const user = useAuth((s) => s.user);
  const courses = useData<Prog[]>(() => supabase.from('courses').select('id,code,title,price,currency,delivery,duration_weeks, category:categories(name), level:levels(name)').eq('status', 'published').order('code'));
  const rules = useData<Rule[]>(() => supabase.from('commission_rules').select('course_id,kind,value,is_active').eq('is_active', true));
  const commission = (c: Prog) => {
    const r = (rules.data ?? []).find((x) => x.course_id === c.id) ?? (rules.data ?? []).find((x) => x.course_id == null);
    if (!r) return null;
    return r.kind === 'percent' ? { label: `${r.value}%`, amt: (Number(c.price) * Number(r.value)) / 100 } : { label: 'Fixed', amt: Number(r.value) };
  };
  return (
    <Page>
      {user?.demo && <DemoNotice />}
      <PageHero badge="Partner Catalogue" title="Programmes" illus="catalogue" subtitle="Courses you can enroll students into, with fees and the commission you earn on each." />
      {courses.loading ? <Spinner /> : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">{(courses.data ?? []).map((c) => {
          const k = commission(c);
          return (
            <div key={c.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
              <div className="flex justify-between"><span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">{c.code}</span><span className="text-[10px] font-bold uppercase text-slate-400">{c.category?.name}</span></div>
              <h3 className="text-lg font-extrabold text-slate-900 mt-3">{c.title}</h3>
              <p className="text-xs text-slate-500 flex gap-3 mt-1"><span className="flex items-center gap-1"><Globe size={12} />{c.delivery.replace(/_/g, ' ')}</span><span className="flex items-center gap-1"><Clock size={12} />{c.duration_weeks ?? '—'} weeks</span><span>{c.level?.name}</span></p>
              <div className="grid grid-cols-2 gap-2 mt-4">
                <div className="p-3 rounded-xl bg-slate-50"><p className="text-[10px] font-bold uppercase text-slate-400">Fee</p><p className="font-black text-slate-900">{Number(c.price) ? money(c.price, c.currency) : 'Free'}</p></div>
                <div className="p-3 rounded-xl bg-emerald-50"><p className="text-[10px] font-bold uppercase text-emerald-500 flex items-center gap-1"><Percent size={10} />Commission {k?.label}</p><p className="font-black text-emerald-700">{k ? money(k.amt, c.currency) : '—'}</p></div>
              </div>
            </div>
          );
        })}</div>
      )}
    </Page>
  );
}

// ---------------- Timetable (upcoming intakes) ----------------
export function AgentTimetable() {
  const user = useAuth((s) => s.user);
  const { data, loading } = useData<{ id: number; name: string; start_date: string | null; end_date: string | null; capacity: number; mode: string; status: string; course: { title: string } | null; enrollments: { count: number }[] }[]>(() =>
    supabase.from('batches').select('id,name,start_date,end_date,capacity,mode,status, course:courses(title), enrollments(count)').in('status', ['upcoming', 'active']).order('start_date'));
  return (
    <Page>
      {user?.demo && <DemoNotice />}
      <PageHero badge="Intakes" badgeColor="indigo" title="Timetable" illus="calendar" subtitle="Open batches and their start dates, so you can advise students on the next intake." />
      {loading ? <Spinner /> : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[640px]"><thead className="bg-slate-50 text-[11px] font-extrabold uppercase text-slate-500"><tr><th className="px-4 py-3">Batch</th><th className="px-3 py-3">Course</th><th className="px-3 py-3">Dates</th><th className="px-3 py-3">Mode</th><th className="px-3 py-3">Seats left</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{(data ?? []).map((b) => {
              const left = b.capacity - (b.enrollments?.[0]?.count ?? 0);
              return <tr key={b.id}><td className="px-4 py-3 font-bold">{b.name}</td><td className="px-3 py-3">{b.course?.title}</td><td className="px-3 py-3 text-xs"><CalendarDays size={12} className="inline mr-1" />{fmtDate(b.start_date)} – {fmtDate(b.end_date)}</td><td className="px-3 py-3 text-xs capitalize">{b.mode.replace(/_/g, ' ')}</td><td className={`px-3 py-3 font-black ${left > 0 ? 'text-emerald-600' : 'text-red-500'}`}>{left > 0 ? left : 'Full'}</td></tr>;
            })}{!data?.length && <tr><td colSpan={5} className="p-8 text-center text-slate-400 text-xs">No open batches.</td></tr>}</tbody></table>
        </div>
      )}
    </Page>
  );
}

// ---------------- Enroll student ----------------
export function AgentEnrollStudent() {
  const user = useAuth((s) => s.user)!;
  const nav = useNavigate();
  const courses = useData<{ id: number; title: string; price: number }[]>(() => supabase.from('courses').select('id,title,price').eq('status', 'published').order('title'));
  const reqs = useData<{ id: number; name: string; description: string | null; required: boolean }[]>(() => supabase.from('student_doc_requirements').select('*').order('id'));
  const [f, setF] = useState({ name: '', email: '', phone: '', country: '', course: '' });
  const [files, setFiles] = useState<Record<number, File>>({});
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const missing = (reqs.data ?? []).filter((r) => r.required && !files[r.id]);
    if (missing.length) return toast.err(`Please upload: ${missing.map((m) => m.name).join(', ')}`);
    setBusy(true);
    const documents: Record<string, string> = {};
    for (const [rid, file] of Object.entries(files)) {
      const path = `${user.id}/referrals/${Date.now()}-${rid}-${file.name.replace(/[^\w.-]/g, '_')}`;
      const up = await supabase.storage.from('uploads').upload(path, file);
      if (up.error) { setBusy(false); return toast.err(up.error.message); }
      documents[rid] = path;
    }
    const { error } = await supabase.from('agent_referrals').insert({ agent_id: user.id, student_name: f.name.trim(), student_email: f.email.trim().toLowerCase(), student_phone: f.phone || null, student_country: f.country || null, course_id: Number(f.course), documents, status: 'submitted' });
    setBusy(false);
    if (error) return toast.err(error.message.includes('row-level') ? 'Your agent account must be approved before enrolling students.' : error.message);
    toast.ok('Student submitted. LLC will review and confirm the enrollment.');
    nav('/agent/enrollments');
  };
  return (
    <Page>
      {user.demo && <DemoNotice />}
      <div className="flex items-center gap-3 mb-6"><button onClick={() => nav(-1)} className="w-10 h-10 rounded-full bg-white border border-slate-200 grid place-items-center"><ArrowLeft size={18} /></button>
        <div><p className="text-[10px] font-black uppercase text-orange-500">Partner Action</p><h1 className="text-2xl font-extrabold text-slate-900">Enroll Student</h1></div></div>
      <form onSubmit={submit} className="bg-white rounded-4xl border border-slate-100 shadow-sm p-8 border-t-4 border-t-orange-400 space-y-8 max-w-4xl">
        <section>
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-4">Step 1: Student Information</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Full Name *"><div className="relative"><User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input required className={`${inputCls} pl-9`} placeholder="e.g. John Doe" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div></Field>
            <Field label="Email Address *"><div className="relative"><Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input required type="email" className={`${inputCls} pl-9`} placeholder="student@example.com" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div></Field>
            <Field label="Phone Number"><div className="relative"><Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input className={`${inputCls} pl-9`} placeholder="+60 12 345 6789" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div></Field>
            <Field label="Country"><input className={inputCls} value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} /></Field>
          </div>
        </section>
        <section>
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-4">Step 2: Student Documents</p>
          <div className="grid sm:grid-cols-2 gap-4">{(reqs.data ?? []).map((r) => (
            <label key={r.id} className="flex flex-col items-center justify-center gap-1 p-5 rounded-2xl border-2 border-dashed border-slate-200 cursor-pointer hover:border-orange-400 text-center">
              <Upload size={18} className="text-slate-400" /><span className="text-xs font-bold text-slate-700">{files[r.id]?.name ?? `Upload ${r.name}`}{r.required && ' *'}</span><span className="text-[10px] text-slate-400">PDF, JPG, PNG</span>
              <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && setFiles({ ...files, [r.id]: e.target.files[0] })} />
            </label>
          ))}</div>
        </section>
        <section>
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-4">Step 3: Course</p>
          <Field label="Select Course *"><select required className={inputCls} value={f.course} onChange={(e) => setF({ ...f, course: e.target.value })}><option value="">Choose a Course</option>{(courses.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.title} — {Number(c.price) ? money(c.price) : 'Free'}</option>)}</select></Field>
        </section>
        <button disabled={busy || user.demo} className={`${btnAccent} w-full py-4`}>{busy ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />} Finalize Enrollment</button>
        <p className="text-[11px] text-slate-400 text-center">Commission is calculated automatically from the active rules once LLC activates the enrollment.</p>
      </form>
    </Page>
  );
}

// ---------------- My enrollments ----------------
export function AgentEnrollments() {
  const user = useAuth((s) => s.user);
  const nav = useNavigate();
  const { data, loading } = useReferrals();
  return (
    <Page>
      {user?.demo && <DemoNotice />}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div><span className="text-[10px] font-black uppercase text-orange-500">Partner Overview</span><h1 className="text-3xl font-extrabold text-slate-900">My Enrollments</h1><p className="text-sm text-slate-500">You have enrolled <b>{data?.length ?? 0}</b> students overall.</p></div>
        <button onClick={() => nav('/agent/enroll-student')} className={btnAccent}><UserPlus size={16} /> Enroll New Student</button>
      </div>
      {loading ? <Spinner /> : !data?.length ? (
        <div className="bg-white rounded-4xl border border-slate-100 shadow-sm py-16 text-center"><Users size={36} className="mx-auto text-slate-300 mb-3" /><h3 className="font-bold text-slate-800">No Enrollments Yet</h3><p className="text-sm text-slate-400 mb-5">Start enrolling students to earn commissions.</p><button onClick={() => nav('/agent/enroll-student')} className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold">Get Started →</button></div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[720px]"><thead className="bg-slate-50 text-[11px] font-extrabold uppercase text-slate-500"><tr><th className="px-4 py-3">Student</th><th className="px-3 py-3">Course</th><th className="px-3 py-3">Submitted</th><th className="px-3 py-3">Review</th><th className="px-3 py-3">Enrollment</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{data.map((r) => (
              <tr key={r.id}><td className="px-4 py-3"><p className="font-bold">{r.student_name}</p><p className="text-[11px] text-slate-400">{r.student_email}</p></td><td className="px-3 py-3">{r.course?.title}</td><td className="px-3 py-3 text-xs">{fmtDate(r.created_at)}</td>
                <td className="px-3 py-3"><StatusPill status={r.status === 'submitted' ? 'pending' : r.status} />{r.review_note && <p className="text-[10px] text-slate-400 mt-1">{r.review_note}</p>}</td><td className="px-3 py-3">{r.enrollment ? <StatusPill status={r.enrollment.status} /> : '—'}</td></tr>
            ))}</tbody></table>
        </div>
      )}
    </Page>
  );
}

// ---------------- Earnings ----------------
export function AgentEarnings() {
  const user = useAuth((s) => s.user);
  const { data, loading } = useEarnings();
  const ap = useAgentProfile();
  const cur = ap.data?.payout_currency ?? 'MYR';
  const e = data ?? [];
  const nav = useNavigate();
  const available = sum(e.filter((x) => x.status === 'approved' && !x.payout_id));
  const cards = [
    { l: 'Total Confirmed', v: sum(e.filter((x) => x.status === 'approved' || x.status === 'paid')), icon: TrendingUp, c: 'bg-emerald-50 border-emerald-100 text-emerald-600' },
    { l: 'Pending Clearance', v: sum(e.filter((x) => x.status === 'pending')), icon: Clock, c: 'bg-amber-50 border-amber-100 text-amber-600' },
    { l: 'Total Paid Out', v: sum(e.filter((x) => x.status === 'paid')), icon: Wallet, c: 'bg-sky-50 border-sky-100 text-sky-600' },
  ];
  return (
    <Page>
      {user?.demo && <DemoNotice />}
      <span className="text-[10px] font-black uppercase text-orange-500">Financial Overview · Payout preference: {cur}</span>
      <h1 className="text-3xl font-extrabold text-slate-900">My Earnings</h1><p className="text-sm text-slate-500 mb-6">Track your commission earnings.</p>
      <div className="grid sm:grid-cols-3 gap-5 mb-6">{cards.map(({ l, v, icon: I, c }) => <div key={l} className={`rounded-3xl border p-5 ${c}`}><I size={20} /><p className="text-xs font-bold mt-3">{l}</p><p className="text-2xl font-black text-slate-900">{money(v, cur)}</p></div>)}</div>
      {available > 0 && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-slate-900 text-white p-5">
          <p className="text-sm"><b className="text-orange-300">{money(available, cur)}</b> is ready to withdraw.</p>
          <button onClick={() => nav('/agent/payouts')} className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold flex items-center gap-2"><Wallet size={16} />Request Payout</button>
        </div>
      )}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-x-auto">
        <table className="w-full text-left text-sm min-w-[640px]"><thead className="bg-slate-50 text-[11px] font-extrabold uppercase text-slate-500"><tr><th className="px-4 py-3">Student</th><th className="px-3 py-3">Course</th><th className="px-3 py-3">Date</th><th className="px-3 py-3">Commission</th><th className="px-3 py-3">Status</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{loading ? <tr><td colSpan={5}><Spinner /></td></tr> : e.map((x) => (
            <tr key={x.id}><td className="px-4 py-3 font-bold">{x.enrollment?.student?.full_name ?? '—'}</td><td className="px-3 py-3">{x.enrollment?.course?.title}</td><td className="px-3 py-3 text-xs">{fmtDate(x.created_at)}</td><td className="px-3 py-3 font-black">{money(x.amount, x.currency)}</td><td className="px-3 py-3"><StatusPill status={x.status} /></td></tr>
          ))}{!loading && !e.length && <tr><td colSpan={5} className="p-10 text-center text-slate-400 text-xs">No earnings found. Earnings appear here when you enroll students.</td></tr>}</tbody></table>
      </div>
    </Page>
  );
}

// ---------------- Payouts ----------------
export function AgentPayouts() {
  const user = useAuth((s) => s.user)!;
  const earn = useEarnings();
  const { data, loading, reload } = useData<{ id: number; amount: number; currency: string; status: string; reference: string | null; note: string | null; created_at: string; paid_at: string | null }[]>(() =>
    supabase.from('agent_payouts').select('*').eq('agent_id', user.id).order('created_at', { ascending: false }));
  const available = sum((earn.data ?? []).filter((x) => x.status === 'approved' && !x.payout_id));
  const [busy, setBusy] = useState(false);
  const request = async () => {
    setBusy(true);
    const { error } = await supabase.rpc('request_payout');
    setBusy(false);
    if (error) toast.err(error.message); else { toast.ok('Payout requested'); reload(); earn.reload(); }
  };
  return (
    <Page>
      {user.demo && <DemoNotice />}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div><span className="text-[10px] font-black uppercase text-orange-500">Partner Finance</span><h1 className="text-3xl font-extrabold text-slate-900">Payout History</h1><p className="text-sm text-slate-500">All processed and pending payouts ({data?.length ?? 0} total).</p></div>
        <div className="flex items-center gap-3 bg-white rounded-2xl border border-slate-100 p-3 shadow-sm"><div><p className="text-[10px] font-bold uppercase text-slate-400">Available to withdraw</p><p className="text-xl font-black text-emerald-600">{money(available)}</p></div>
          <button disabled={busy || available <= 0} onClick={request} className={btnPrimary}>{busy && <Loader2 size={14} className="animate-spin" />} Request Payout</button></div>
      </div>
      {loading ? <Spinner /> : !data?.length ? <div className="bg-white rounded-4xl border border-slate-100 shadow-sm py-16 text-center"><Wallet size={36} className="mx-auto text-slate-300 mb-3" /><h3 className="font-bold text-slate-800">No Payouts Yet</h3><p className="text-sm text-slate-400">Payouts appear here once your earnings are processed by the administration.</p></div> : (
        <div className="space-y-3">{data.map((p) => (
          <div key={p.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 flex flex-wrap items-center gap-4">
            <span className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 grid place-items-center"><Banknote size={20} /></span>
            <div className="flex-1"><p className="font-black text-slate-900">{money(p.amount, p.currency)}</p><p className="text-xs text-slate-400">Requested {fmtDate(p.created_at)}{p.paid_at && ` · Paid ${fmtDate(p.paid_at)}`}{p.reference && ` · Ref ${p.reference}`}</p>{p.note && <p className="text-xs text-slate-500">{p.note}</p>}</div>
            <StatusPill status={p.status === 'requested' ? 'pending' : p.status} />
          </div>
        ))}</div>
      )}
    </Page>
  );
}

// ---------------- Bank details ----------------
export function AgentBankDetails() {
  const user = useAuth((s) => s.user)!;
  const ap = useAgentProfile();
  const [f, setF] = useState<Partial<AgentProfile>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (ap.data) setF(ap.data); }, [ap.data]);
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    const row = { payout_currency: f.payout_currency ?? 'MYR', paypal_email: f.paypal_email || null, bank_name: f.bank_name || null, bank_account_name: f.bank_account_name || null, bank_account_no: f.bank_account_no || null, swift: f.swift || null, iban: f.iban || null, bank_address: f.bank_address || null };
    const { error } = ap.data ? await supabase.from('agent_profiles').update(row).eq('id', user.id) : await supabase.from('agent_profiles').insert({ id: user.id, status: 'pending', ...row });
    setBusy(false);
    if (error) toast.err(error.message); else { toast.ok('Payment details saved'); ap.reload(); }
  };
  const inp = (k: keyof AgentProfile, label: string, ph = '', full = false) => (
    <div className={full ? 'sm:col-span-2' : ''}><Field label={label}><input className={inputCls} placeholder={ph} value={(f[k] as string) ?? ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></Field></div>
  );
  return (
    <Page>
      {user.demo && <DemoNotice />}
      <span className="text-[10px] font-black uppercase text-orange-500">Payout Preferences</span>
      <h1 className="text-3xl font-extrabold text-slate-900">Bank &amp; Payment Details</h1><p className="text-sm text-slate-500 mb-6">Enter your bank account or PayPal details to receive commission payments.</p>
      <form onSubmit={save} className="bg-white rounded-4xl border border-slate-100 shadow-sm p-8 border-t-4 border-t-orange-400 max-w-3xl space-y-8">
        <section><h3 className="font-extrabold text-slate-900 flex items-center gap-2 mb-4"><Globe size={18} className="text-orange-500" /> Payout Currency Preference</h3>
          <select className={`${inputCls} max-w-xs`} value={f.payout_currency ?? 'MYR'} onChange={(e) => setF({ ...f, payout_currency: e.target.value })}>{['MYR', 'USD', 'SAR', 'AED', 'YER', 'EUR', 'GBP'].map((c) => <option key={c}>{c}</option>)}</select></section>
        <section><h3 className="font-extrabold text-slate-900 flex items-center gap-2 mb-4"><Mail size={18} className="text-orange-500" /> Online Payout (PayPal)</h3><div className="grid sm:grid-cols-2 gap-4">{inp('paypal_email', 'PayPal Email Address', 'agent@paypal.com')}</div></section>
        <section><h3 className="font-extrabold text-slate-900 flex items-center gap-2 mb-4"><Building2 size={18} className="text-orange-500" /> Direct Bank Transfer Details</h3>
          <div className="grid sm:grid-cols-2 gap-4">{inp('bank_name', 'Bank Name', 'e.g. Maybank')}{inp('bank_account_name', 'Account Name (Beneficiary)', 'Name exactly as it appears on bank')}{inp('bank_account_no', 'Account Number', 'e.g. 1234567890')}{inp('swift', 'SWIFT / BIC Code', 'e.g. MBBEMYKL')}{inp('iban', 'IBAN (Optional)')}{inp('bank_address', 'Bank Branch Address', '', true)}</div></section>
        <div className="flex justify-end"><button disabled={busy || user.demo} className={btnAccent}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save Payment Details</button></div>
      </form>
    </Page>
  );
}


