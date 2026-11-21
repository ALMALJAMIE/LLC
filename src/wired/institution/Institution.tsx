import { useEffect, useMemo, useState } from 'react';
import { Building2, CheckCircle2, Clock, GraduationCap, KeyRound, Loader2, Mail, Plus, Save, SquarePen, UserMinus, UserPlus, Users } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { fmtDate, fmtDateTime, money, useData } from '../../lib/db';
import { DemoNotice, Field, Modal, Page, PageHero, SearchInput, Spinner, StatusPill, btnPrimary, inputCls, toast } from '../../components/ui';
import { askConfirm, askText } from '../../components/dialogs';

type Learner = { seat_id: number; name: string; email: string; assigned_at: string; placed: boolean; level: string | null; progress: number | null; status: string | null; attendance: number | null; last_active: string | null };
type Lic = { id: number; course: string; course_code: string; batch: string | null; seats: number; valid_from: string; valid_until: string | null; learners: Learner[] };
type Overview = { organisation: Org; licences: Lic[]; invoices: { id: number; invoice_no: string; description: string | null; amount: number; currency: string; status: string; created_at: string; due_at: string | null }[] };
type Org = { id: number; name: string; kind: string; contact_name: string | null; email: string | null; phone: string | null; country: string | null; address: string | null; tax_id: string | null; status: string; notes?: string | null; created_at: string };

/** Licences, seats and learner progress for one organisation (used by the institution manager and by LLC staff). */
function OrgOverview({ orgId }: { orgId: number }) {
  const [o, setO] = useState<Overview | null>(null);
  const [err, setErr] = useState('');
  const load = async () => { const { data, error } = await supabase.rpc('org_overview', { p_org: orgId }); if (error) setErr(error.message); else setO(data as Overview); };
  useEffect(() => { load(); }, [orgId]); // eslint-disable-line react-hooks/exhaustive-deps
  const assign = async (l: Lic) => {
    const email = await askText(`Give a seat on "${l.course}" to a learner. Write the email of their LLC student account:`);
    if (!email) return;
    const { error } = await supabase.rpc('assign_seat', { p_licence: l.id, p_email: email.trim() });
    if (error) toast.err(error.message); else { toast.ok('Seat given — the learner was notified'); load(); }
  };
  const revoke = async (x: Learner) => {
    if (!(await askConfirm(`Remove ${x.name} from this course? The seat becomes free for someone else.`))) return;
    const { error } = await supabase.rpc('revoke_seat', { p_seat: x.seat_id });
    if (error) toast.err(error.message); else { toast.ok('Seat freed'); load(); }
  };
  if (err) return <p className="text-sm text-red-500">{err}</p>;
  if (!o) return <Spinner />;
  const all = o.licences.flatMap((l) => l.learners);
  const stats = [
    { l: 'Learners', v: all.length, i: Users },
    { l: 'Seats', v: `${all.length} / ${o.licences.reduce((a, l) => a + l.seats, 0)}`, i: KeyRound },
    { l: 'Took placement test', v: all.filter((x) => x.placed).length, i: CheckCircle2 },
    { l: 'Average progress', v: all.length ? `${Math.round(all.reduce((a, x) => a + (x.progress ?? 0), 0) / all.length)}%` : '—', i: GraduationCap },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{stats.map(({ l, v, i: I }) => (
        <div key={l} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5"><I size={20} className="text-indigo-500" /><p className="text-2xl font-black text-slate-900 mt-2">{v}</p><p className="text-xs font-bold text-slate-500">{l}</p></div>
      ))}</div>
      {!o.licences.length && <p className="text-center text-slate-400 py-10">No courses yet. LLC adds your licences after the agreement.</p>}
      {o.licences.map((l) => {
        const ended = l.valid_until && new Date(l.valid_until) < new Date();
        return (
          <div key={l.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm">
            <div className="p-5 flex flex-wrap items-center gap-3 border-b border-slate-100">
              <div className="flex-1 min-w-56"><p className="font-extrabold text-slate-900">{l.course} <span className="text-xs font-mono text-slate-400" data-no-i18n>{l.course_code}</span></p>
                <p className="text-[11px] text-slate-400">{l.batch ?? 'Batch to be confirmed'} · {`from ${fmtDate(l.valid_from)}`}{l.valid_until ? <> · {`until ${fmtDate(l.valid_until)}`}</> : ''}</p></div>
              <span className="text-sm font-black text-slate-700">{`${l.learners.length} / ${l.seats} seats`}</span>
              {ended ? <StatusPill status="expired" /> : <button disabled={l.learners.length >= l.seats} onClick={() => assign(l)} className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-orange-500 text-white text-xs font-bold flex items-center gap-1 disabled:opacity-40"><UserPlus size={14} />Add learner</button>}
            </div>
            {!l.learners.length ? <p className="p-5 text-sm text-slate-400">No learners yet.</p> : (
              <div className="overflow-x-auto"><table className="w-full text-sm min-w-[760px]">
                <thead className="bg-slate-50 text-[11px] font-extrabold uppercase text-slate-500"><tr><th className="px-4 py-2 text-left">Learner</th><th className="px-3 py-2 text-left">Placement</th><th className="px-3 py-2 text-left">Progress</th><th className="px-3 py-2 text-left">Attendance</th><th className="px-3 py-2 text-left">Last studied</th><th /></tr></thead>
                <tbody className="divide-y divide-slate-100">{l.learners.map((x) => (
                  <tr key={x.seat_id}>
                    <td className="px-4 py-2.5"><p className="font-bold text-slate-800">{x.name}</p><p className="text-[11px] text-slate-400">{x.email}</p></td>
                    <td className="px-3 py-2.5">{x.placed ? <span className="text-xs font-bold text-emerald-600">{x.level ?? 'Done'}</span> : <span className="text-xs font-bold text-orange-600">Not yet</span>}</td>
                    <td className="px-3 py-2.5"><div className="flex items-center gap-2"><div className="w-24 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-indigo-500" style={{ width: `${x.progress ?? 0}%` }} /></div><span className="text-xs font-bold">{x.progress ?? 0}%</span></div></td>
                    <td className="px-3 py-2.5 text-xs font-bold">{x.attendance == null ? '—' : `${x.attendance}%`}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-500">{x.last_active ? fmtDate(x.last_active) : '—'}</td>
                    <td className="px-3 py-2.5 text-right"><button onClick={() => revoke(x)} title="Remove" className="p-1.5 text-slate-400 hover:text-red-500"><UserMinus size={16} /></button></td>
                  </tr>
                ))}</tbody>
              </table></div>
            )}
          </div>
        );
      })}
      {o.invoices.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5">
          <h3 className="font-bold text-slate-800 mb-2">Invoices</h3>
          <div className="divide-y divide-slate-100">{o.invoices.map((v) => (
            <div key={v.id} className="py-2.5 flex flex-wrap items-center gap-3 text-sm"><span className="flex-1">{v.description} · <span className="font-mono text-xs text-slate-400" data-no-i18n>{v.invoice_no}</span>{v.due_at && v.status === 'pending' ? <> · {`due ${fmtDate(v.due_at)}`}</> : ''}</span><b>{money(v.amount, v.currency)}</b><StatusPill status={v.status} /></div>
          ))}</div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- institution manager
export function InstitutionDashboard() {
  const user = useAuth((s) => s.user)!;
  const orgs = useData<Org[]>(() => supabase.from('organisations').select('*').order('name'));
  const [sel, setSel] = useState<number | null>(null);
  const org = (orgs.data ?? []).find((o) => o.id === sel) ?? orgs.data?.[0];
  return (
    <Page wide>
      {user.demo && <DemoNotice />}
      <PageHero badge="Institution" badgeColor="indigo" title={org?.name ?? 'Institution Portal'} illus="users" subtitle="Give your seats to learners, and follow their placement, progress and attendance. Learners need a free LLC student account — they sign up with the email you enter here.">
        {(orgs.data ?? []).length > 1 && <select value={org?.id} onChange={(e) => setSel(Number(e.target.value))} className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold">{(orgs.data ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>}
      </PageHero>
      {orgs.loading ? <Spinner /> : !org ? <p className="text-center text-slate-400 py-12">Your account is not linked to an organisation yet. Please contact LLC.</p> : <OrgOverview orgId={org.id} />}
    </Page>
  );
}

// ---------------------------------------------------------------- LLC staff: organisations
type Mgr = { user_id: string; profile: { full_name: string; email: string } | null };
type LicRow = { id: number; course_id: number; batch_id: number | null; seats: number; valid_from: string; valid_until: string | null; note: string | null; course: { title: string } | null; seat_assignments: { revoked_at: string | null }[] };
export function Organisations() {
  const user = useAuth((s) => s.user)!;
  const { data, loading, reload } = useData<(Org & { licences: { seats: number }[] })[]>(() => supabase.from('organisations').select('*, licences(seats)').order('name'));
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Partial<Org> | null>(null);
  const [open, setOpen] = useState<Org | null>(null);
  const list = (data ?? []).filter((o) => `${o.name} ${o.contact_name ?? ''} ${o.email ?? ''}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Page wide>
      {user.demo && <DemoNotice />}
      <PageHero badge="Institutions" badgeColor="indigo" title="Organisations" illus="users" subtitle="Companies, schools and other bodies that buy seats for their people. Add the person who manages their learners, then add licences (seats on a course).">
        <div className="flex flex-wrap gap-2"><SearchInput value={q} onChange={setQ} placeholder="Search organisations..." />
          <button onClick={() => setEdit({ kind: 'company', status: 'active' })} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-orange-500 text-white text-sm font-bold"><Plus size={16} /> New Organisation</button></div>
      </PageHero>
      {loading ? <Spinner /> : !list.length ? <p className="text-center text-slate-400 py-12">No organisations yet.</p> : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{list.map((o) => (
          <button key={o.id} onClick={() => setOpen(o)} className="text-left bg-white rounded-3xl border border-slate-100 shadow-sm p-5 hover:border-orange-200">
            <div className="flex items-start gap-3"><span className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 grid place-items-center"><Building2 size={20} /></span>
              <div className="flex-1"><p className="font-extrabold text-slate-900">{o.name}</p><p className="text-[11px] text-slate-400 capitalize">{o.kind}{o.country ? ` · ${o.country}` : ''}</p></div><StatusPill status={o.status} /></div>
            <p className="text-xs text-slate-500 mt-3">{o.contact_name ?? '—'}{o.email ? ` · ${o.email}` : ''}</p>
            <p className="text-xs font-bold text-slate-700 mt-1">{`${o.licences.length} licences · ${o.licences.reduce((a, l) => a + l.seats, 0)} seats`}</p>
          </button>
        ))}</div>
      )}
      {edit && <OrgForm o={edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); reload(); }} />}
      {open && <OrgDetails o={open} onEdit={() => { setEdit(open); setOpen(null); }} onClose={() => { setOpen(null); reload(); }} />}
    </Page>
  );
}
function OrgForm({ o, onClose, onDone }: { o: Partial<Org>; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ name: o.name ?? '', kind: o.kind ?? 'company', contact_name: o.contact_name ?? '', email: o.email ?? '', phone: o.phone ?? '', country: o.country ?? '', address: o.address ?? '', tax_id: o.tax_id ?? '', status: o.status ?? 'active', notes: o.notes ?? '' });
  const save = async () => {
    if (f.name.trim().length < 2) return toast.err('Name is required.');
    const row: Record<string, string | null> = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim() || null]));
    row.name = f.name.trim(); row.kind = f.kind; row.status = f.status;
    const { error } = o.id ? await supabase.from('organisations').update(row as never).eq('id', o.id) : await supabase.from('organisations').insert(row as never);
    if (error) toast.err(error.message); else { toast.ok('Saved'); onDone(); }
  };
  const input = (k: keyof typeof f, l: string) => <Field label={l}><input className={inputCls} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></Field>;
  return (
    <Modal open onClose={onClose} title={o.id ? 'Edit Organisation' : 'New Organisation'} wide>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">{input('name', 'Name')}</div>
        <Field label="Type"><select className={inputCls} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{['company', 'school', 'university', 'government', 'other'].map((k) => <option key={k} value={k}>{k}</option>)}</select></Field>
        <Field label="Status"><select className={inputCls} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="active">active</option><option value="inactive">inactive</option></select></Field>
        {input('contact_name', 'Contact person')}{input('email', 'Email')}{input('phone', 'Phone')}{input('country', 'Country')}
        {input('address', 'Address (for invoices)')}{input('tax_id', 'Tax / registration number')}
        <div className="sm:col-span-2"><Field label="Notes (LLC only)"><textarea rows={2} className={inputCls} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field></div>
        <button onClick={save} className={`${btnPrimary} sm:col-span-2`}><Save size={16} /> Save</button>
      </div>
    </Modal>
  );
}
function OrgDetails({ o, onEdit, onClose }: { o: Org; onEdit: () => void; onClose: () => void }) {
  const [tab, setTab] = useState<'overview' | 'licences' | 'managers'>('overview');
  const mgrs = useData<Mgr[]>(() => supabase.from('organisation_managers').select('user_id, profile:profiles(full_name,email)').eq('organisation_id', o.id), [o.id]);
  const lics = useData<LicRow[]>(() => supabase.from('licences').select('*, course:courses(title), seat_assignments(revoked_at)').eq('organisation_id', o.id).order('created_at', { ascending: false }), [o.id]);
  const [addLic, setAddLic] = useState(false);
  const [key, setKey] = useState(0);
  const addMgr = async () => {
    const email = await askText('Email of the person who will manage this organisation’s learners (they must already have an LLC account, not used for studying):');
    if (!email) return;
    const { error } = await supabase.rpc('add_org_manager', { p_org: o.id, p_email: email.trim() });
    if (error) toast.err(error.message); else { toast.ok('Manager added — they now see the Institution Portal'); mgrs.reload(); }
  };
  const removeMgr = async (m: Mgr) => {
    if (!(await askConfirm(`Remove ${m.profile?.full_name} as manager?`))) return;
    const { error } = await supabase.from('organisation_managers').delete().eq('organisation_id', o.id).eq('user_id', m.user_id);
    if (error) toast.err(error.message); else mgrs.reload();
  };
  return (
    <Modal open onClose={onClose} title={o.name} wide>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex bg-slate-50 p-1 rounded-xl border border-slate-200">{(['overview', 'licences', 'managers'] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-xs font-bold capitalize ${tab === t ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>{t}</button>)}</div>
          <button onClick={onEdit} className="ml-auto text-xs font-bold text-slate-500 flex items-center gap-1"><SquarePen size={14} />Edit details</button>
        </div>
        {tab === 'overview' && <OrgOverview key={key} orgId={o.id} />}
        {tab === 'licences' && <>
          <button onClick={() => setAddLic(true)} className={btnPrimary}><Plus size={16} /> Add licence</button>
          <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl">{(lics.data ?? []).map((l) => (
            <div key={l.id} className="px-4 py-3 text-sm flex flex-wrap items-center gap-3"><span className="flex-1"><b>{l.course?.title}</b> · {`${l.seat_assignments.filter((s) => !s.revoked_at).length} / ${l.seats} seats`}{l.valid_until ? <> · {`until ${fmtDate(l.valid_until)}`}</> : ''}{l.note ? ` · ${l.note}` : ''}</span>
              <button onClick={async () => { const n = await askText('New number of seats:', String(l.seats)); if (!n || !(Number(n) > 0)) return; const { error } = await supabase.from('licences').update({ seats: Number(n) }).eq('id', l.id); if (error) toast.err(error.message); else { lics.reload(); setKey(key + 1); } }} className="text-xs font-bold text-indigo-600">Change seats</button></div>
          ))}{!(lics.data ?? []).length && <p className="p-4 text-sm text-slate-400">No licences yet.</p>}</div>
          <p className="text-xs text-slate-500">To bill the organisation, create an invoice for its manager under Finance → Invoices.</p>
        </>}
        {tab === 'managers' && <>
          <button onClick={addMgr} className={btnPrimary}><UserPlus size={16} /> Add manager</button>
          <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl">{(mgrs.data ?? []).map((m) => (
            <div key={m.user_id} className="px-4 py-3 text-sm flex items-center gap-3"><Mail size={16} className="text-slate-400" /><span className="flex-1"><b>{m.profile?.full_name}</b> · {m.profile?.email}</span><button onClick={() => removeMgr(m)} className="text-xs font-bold text-red-500">Remove</button></div>
          ))}{!(mgrs.data ?? []).length && <p className="p-4 text-sm text-slate-400">No manager yet. The organisation cannot see its portal until you add one.</p>}</div>
        </>}
      </div>
      {addLic && <LicenceForm orgId={o.id} onClose={() => setAddLic(false)} onDone={() => { setAddLic(false); lics.reload(); setKey(key + 1); }} />}
    </Modal>
  );
}
function LicenceForm({ orgId, onClose, onDone }: { orgId: number; onClose: () => void; onDone: () => void }) {
  const courses = useData<{ id: number; title: string }[]>(() => supabase.from('courses').select('id,title').order('title'));
  const [f, setF] = useState({ course_id: '', batch_id: '', seats: '10', valid_from: new Date().toISOString().slice(0, 10), valid_until: '', note: '' });
  const batches = useData<{ id: number; name: string }[]>(() => (f.course_id ? supabase.from('batches').select('id,name').eq('course_id', Number(f.course_id)).in('status', ['upcoming', 'active']) : Promise.resolve({ data: [], error: null })), [f.course_id]);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!f.course_id || !(Number(f.seats) > 0)) return toast.err('Choose a course and the number of seats.');
    setBusy(true);
    const { error } = await supabase.from('licences').insert({ organisation_id: orgId, course_id: Number(f.course_id), batch_id: f.batch_id ? Number(f.batch_id) : null, seats: Number(f.seats), valid_from: f.valid_from, valid_until: f.valid_until || null, note: f.note.trim() || null });
    setBusy(false);
    if (error) toast.err(error.message); else { toast.ok('Licence added'); onDone(); }
  };
  return (
    <Modal open onClose={onClose} title="Add licence">
      <div className="space-y-3">
        <Field label="Course"><select className={inputCls} value={f.course_id} onChange={(e) => setF({ ...f, course_id: e.target.value, batch_id: '' })}><option value="">Choose…</option>{(courses.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></Field>
        <Field label="Batch (optional)"><select className={inputCls} value={f.batch_id} onChange={(e) => setF({ ...f, batch_id: e.target.value })}><option value="">Decide later</option>{(batches.data ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Seats"><input type="number" className={inputCls} value={f.seats} onChange={(e) => setF({ ...f, seats: e.target.value })} /></Field>
          <Field label="From"><input type="date" className={inputCls} value={f.valid_from} onChange={(e) => setF({ ...f, valid_from: e.target.value })} /></Field>
          <Field label="Until"><input type="date" className={inputCls} value={f.valid_until} onChange={(e) => setF({ ...f, valid_until: e.target.value })} /></Field>
        </div>
        <Field label="Note (e.g. contract number)"><input className={inputCls} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
        <button disabled={busy} onClick={save} className={`${btnPrimary} w-full`}>{busy && <Loader2 size={16} className="animate-spin" />} Save</button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- training requests from the website
type TR = { id: number; organisation_name: string; contact_name: string; email: string; phone: string | null; country: string | null; learners: number | null; needs: string | null; preferred_mode: string | null; status: string; staff_note: string | null; organisation_id: number | null; created_at: string };
export function TrainingRequests() {
  const user = useAuth((s) => s.user)!;
  const { data, loading, reload } = useData<TR[]>(() => supabase.from('training_requests').select('*').order('created_at', { ascending: false }));
  const [tab, setTab] = useState('new');
  const list = useMemo(() => (data ?? []).filter((r) => tab === 'all' || r.status === tab), [data, tab]);
  const set = async (r: TR, patch: Partial<TR>) => { const { error } = await supabase.from('training_requests').update(patch).eq('id', r.id); if (error) toast.err(error.message); else reload(); };
  const note = async (r: TR) => { const n = await askText('Note for the team:', r.staff_note ?? ''); if (n !== null) set(r, { staff_note: n || null }); };
  const toOrg = async (r: TR) => {
    if (!(await askConfirm(`Create the organisation "${r.organisation_name}" from this request?`))) return;
    const { data: o, error } = await supabase.from('organisations').insert({ name: r.organisation_name, contact_name: r.contact_name, email: r.email, phone: r.phone, country: r.country }).select('id').single();
    if (error) return toast.err(error.message);
    await set(r, { organisation_id: o.id, status: 'won' }); toast.ok('Organisation created — add its manager and licences under Organisations');
  };
  return (
    <Page wide>
      {user.demo && <DemoNotice />}
      <PageHero badge="Institutions" badgeColor="indigo" title="Training Requests" illus="users" subtitle="Organisations that asked for English training from the website form. Contact them, then turn a won request into an organisation.">
        <div className="inline-flex bg-slate-50 p-1 rounded-xl border border-slate-200">{['new', 'contacted', 'won', 'lost', 'all'].map((t) => <button key={t} onClick={() => setTab(t)} className={`px-3 py-2 rounded-lg text-xs font-bold capitalize ${tab === t ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>{t}</button>)}</div>
      </PageHero>
      {loading ? <Spinner /> : !list.length ? <p className="text-center text-slate-400 py-12">Nothing here.</p> : (
        <div className="space-y-3">{list.map((r) => (
          <div key={r.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5">
            <div className="flex flex-wrap items-start gap-3">
              <div className="flex-1 min-w-64"><p className="font-extrabold text-slate-900">{r.organisation_name}</p>
                <p className="text-xs text-slate-500">{r.contact_name} · <a className="text-indigo-600" href={`mailto:${r.email}`}>{r.email}</a>{r.phone ? ` · ${r.phone}` : ''}{r.country ? ` · ${r.country}` : ''}</p>
                <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1"><Clock size={12} />{fmtDateTime(r.created_at)}{r.learners ? ` · ${r.learners} learners` : ''}{r.preferred_mode ? ` · ${r.preferred_mode.replace(/_/g, ' ')}` : ''}</p></div>
              <select value={r.status} onChange={(e) => set(r, { status: e.target.value })} className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-bold capitalize">{['new', 'contacted', 'won', 'lost'].map((s) => <option key={s}>{s}</option>)}</select>
            </div>
            {r.needs && <p className="text-sm text-slate-700 mt-3 whitespace-pre-line p-3 rounded-xl bg-slate-50">{r.needs}</p>}
            {r.staff_note && <p className="text-xs text-amber-700 mt-2">{`Note: ${r.staff_note}`}</p>}
            <div className="flex gap-3 mt-3 text-xs font-bold"><button onClick={() => note(r)} className="text-slate-500">Add note</button>
              {!r.organisation_id && <button onClick={() => toOrg(r)} className="text-indigo-600">Create organisation</button>}</div>
          </div>
        ))}</div>
      )}
    </Page>
  );
}
