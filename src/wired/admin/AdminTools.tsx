import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Clock, ExternalLink, Globe, History, Landmark, Loader2, MapPin, Save, Search, ShieldCheck, Video, X } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { fmtDate, fmtDateTime, useData } from '../../lib/db';
import { useSite, type Center } from '../../lib/site';
import { DemoNotice, Field, Modal, Page, PageHero, Spinner, StatusPill, btnPrimary, inputCls, toast } from '../../components/ui';
import EntityGrid from './EntityGrid';
import { notify } from './AdminEnrollments';
import { useOptions } from './options';

const hm = (d: string) => new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

// ---------------- CMS ----------------
export function AdminCms() {
  const user = useAuth((s) => s.user);
  const { c, load } = useSite();
  const [f, setF] = useState<Center>(c);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof Center, v: string) => setF({ ...f, [k]: v });
  const setBank = (k: keyof Center['bank'], v: string) => setF({ ...f, bank: { ...f.bank, [k]: v } });
  const save = async () => {
    setBusy(true);
    const { bank, ...center } = f;
    const { error } = await supabase.from('site_settings').upsert([{ key: 'center', value: center, updated_at: new Date().toISOString() }, { key: 'bank', value: bank, updated_at: new Date().toISOString() }]);
    setBusy(false);
    if (error) toast.err(error.message); else { toast.ok('Website updated'); load(); }
  };
  const text = (k: keyof Center, label: string, ph?: string, half = true) => (
    <div className={half ? 'col-span-2 sm:col-span-1' : 'col-span-2'}><Field label={label}><input className={inputCls} placeholder={ph} value={(f[k] as string) ?? ''} onChange={(e) => set(k, e.target.value)} /></Field></div>
  );
  return (
    <Page>
      {user?.demo && <DemoNotice />}
      <PageHero badge="Content Management" title="Website CMS" illus="cms" subtitle="Edit what visitors see on the public website: the home hero, the announcement banner, contact details and the bank account shown on invoices." />
      <div className="grid lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 bg-white rounded-4xl border border-slate-100 shadow-sm p-6 sm:p-8 grid grid-cols-2 gap-4 h-fit">
          <h2 className="col-span-2 text-lg font-extrabold text-slate-900">Home page</h2>
          <div className="col-span-2"><Field label="Hero title" hint="Leave empty to keep the default “Your leap to fluent English”."><input className={inputCls} value={f.heroTitle} onChange={(e) => set('heroTitle', e.target.value)} /></Field></div>
          <div className="col-span-2"><Field label="Hero subtitle"><textarea rows={3} className={inputCls} value={f.heroSubtitle} onChange={(e) => set('heroSubtitle', e.target.value)} /></Field></div>
          <div className="col-span-2"><Field label="Announcement banner" hint="Shown above the menu on every public page. Leave empty to hide."><input className={inputCls} placeholder="e.g. New intake starts 5 January — register now" value={f.banner} onChange={(e) => set('banner', e.target.value)} /></Field></div>
          <h2 className="col-span-2 text-lg font-extrabold text-slate-900 mt-4">Center & contacts</h2>
          {text('name', 'Center name')}{text('short', 'Short name')}
          {text('tagline', 'Tagline', '', false)}
          {text('phone', 'Phone')}{text('whatsapp', 'WhatsApp number', 'digits only, e.g. 60111…')}
          {text('email', 'Email')}{text('instagram', 'Instagram URL')}
          {text('snapchat', 'Snapchat URL')}{text('address', 'Address')}
        </section>
        <aside className="space-y-6">
          <section className="bg-white rounded-4xl border border-slate-100 shadow-sm p-6 space-y-4">
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2"><Landmark size={18} className="text-orange-500" />Bank account</h2>
            <p className="text-xs text-slate-500">Students see this when paying for a course and on their invoices.</p>
            <Field label="Bank name"><input className={inputCls} value={f.bank.bankName} onChange={(e) => setBank('bankName', e.target.value)} /></Field>
            <Field label="Account name"><input className={inputCls} value={f.bank.accountName} onChange={(e) => setBank('accountName', e.target.value)} /></Field>
            <Field label="Account number"><input className={inputCls} value={f.bank.accountNo} onChange={(e) => setBank('accountNo', e.target.value)} /></Field>
            <Field label="Note"><input className={inputCls} placeholder="e.g. Use your name as reference" value={f.bank.note} onChange={(e) => setBank('note', e.target.value)} /></Field>
          </section>
          <button disabled={busy || user?.demo} onClick={save} className={`${btnPrimary} w-full`}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Publish changes</button>
        </aside>
      </div>
    </Page>
  );
}

// ---------------- Accreditations ----------------
type Ac = { id: number; name: string; issuer: string | null; reference_no: string | null; valid_until: string | null; link: string | null; is_public: boolean };
export function AdminAccreditations() {
  return (
    <EntityGrid<Ac> table="accreditations" order="name" badge="Quality & Compliance" badgeTone="emerald" title="Accreditations" illus="certificate"
      subtitle="Licences, memberships and recognitions. Public ones appear on the home page." addLabel="Add Accreditation" defaults={{ is_public: true }}
      fields={[{ k: 'name', label: 'Name', required: true }, { k: 'issuer', label: 'Issued by', half: true }, { k: 'reference_no', label: 'Reference no.', half: true }, { k: 'valid_until', label: 'Valid until', type: 'date', half: true }, { k: 'link', label: 'Verification link', type: 'url', half: true }, { k: 'is_public', label: 'Show on the public website', type: 'checkbox' }]}
      searchText={(r) => `${r.name} ${r.issuer ?? ''}`}
      card={(r) => {
        const expired = r.valid_until && new Date(r.valid_until) < new Date();
        return (<>
          <div className="flex justify-between items-start"><span className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 grid place-items-center"><ShieldCheck /></span>
            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${r.is_public ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>{r.is_public ? 'Public' : 'Internal'}</span></div>
          <h3 className="text-lg font-extrabold text-slate-900 mt-4">{r.name}</h3>
          <p className="text-sm text-slate-500">{r.issuer ?? '—'}{r.reference_no && ` · ${r.reference_no}`}</p>
          {r.valid_until && <p className={`text-xs font-bold mt-3 ${expired ? 'text-red-500' : 'text-slate-500'}`}>{expired ? 'Expired' : 'Valid until'} {fmtDate(r.valid_until)}</p>}
          {r.link && <a href={r.link} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-indigo-600"><ExternalLink size={12} />Verify</a>}
        </>);
      }} />
  );
}

// ---------------- Grading scales ----------------
type Gs = { id: number; grade: string; min_pct: number; label: string | null; is_pass: boolean };
export function AdminGradingScales() {
  return (
    <EntityGrid<Gs> table="grading_scales" order="min_pct" ascending={false} badge="Assessment Policy" badgeTone="indigo" title="Exam Grading Scales" illus="results"
      subtitle="The letter grade a student gets is the highest grade whose minimum percentage they reach. Instructors' grading uses this table." addLabel="Add Grade" defaults={{ is_pass: true }}
      fields={[{ k: 'grade', label: 'Grade', required: true, half: true, ph: 'A+' }, { k: 'min_pct', label: 'Minimum %', type: 'number', required: true, half: true }, { k: 'label', label: 'Description', ph: 'Excellent' }, { k: 'is_pass', label: 'Counts as a pass', type: 'checkbox' }]}
      toRow={(f) => ({ ...f, min_pct: Math.round(Number(f.min_pct)) })}
      searchText={(r) => `${r.grade} ${r.label ?? ''}`}
      card={(r) => (<div className="flex items-center gap-5">
        <span className={`w-16 h-16 rounded-2xl grid place-items-center text-2xl font-black ${r.is_pass ? 'bg-indigo-50 text-indigo-600' : 'bg-red-50 text-red-500'}`}>{r.grade}</span>
        <div><p className="text-2xl font-extrabold text-slate-900">≥ {r.min_pct}%</p><p className="text-sm text-slate-500">{r.label ?? '—'} · {r.is_pass ? 'Pass' : 'Fail'}</p></div>
      </div>)} />
  );
}

// ---------------- Exam templates ----------------
type Et = { id: number; name: string; kind: string; duration_min: number; total_marks: number; instructions: string | null };
export function AdminExamTemplates() {
  return (
    <EntityGrid<Et> table="exam_templates" order="name" badge="Assessment Design" badgeTone="pink" title="Exam Templates" illus="exam"
      subtitle="Reusable exam blueprints. Instructors can create an exam from a template in one click." addLabel="New Template" defaults={{ kind: 'quiz', duration_min: 60, total_marks: 100 }}
      fields={[{ k: 'name', label: 'Template name', required: true }, { k: 'kind', label: 'Type', type: 'select', required: true, half: true, options: [{ value: 'quiz', label: 'Quiz' }, { value: 'midterm', label: 'Mid-term' }, { value: 'final', label: 'Final' }] }, { k: 'duration_min', label: 'Duration (min)', type: 'number', half: true }, { k: 'total_marks', label: 'Total marks', type: 'number', half: true }, { k: 'instructions', label: 'Instructions / structure', type: 'textarea' }]}
      searchText={(r) => `${r.name} ${r.kind}`}
      card={(r) => (<>
        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-pink-50 text-pink-600">{r.kind}</span>
        <h3 className="text-lg font-extrabold text-slate-900 mt-3">{r.name}</h3>
        <p className="text-xs text-slate-500 flex gap-3 mt-1"><span className="flex items-center gap-1"><Clock size={12} />{r.duration_min} min</span><span>{r.total_marks} marks</span></p>
        {r.instructions && <p className="text-sm text-slate-600 mt-3 line-clamp-3">{r.instructions}</p>}
      </>)} />
  );
}

// ---------------- Rubric bank ----------------
type Rb = { id: number; name: string; skill: string; criteria: string };
export const parseRubric = (s: string) => s.split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((p) => p[0]).map(([name, max]) => ({ name, max: Number(max) || 0 }));
export function AdminRubrics() {
  return (
    <EntityGrid<Rb> table="rubrics" order="name" badge="Evaluation Standards" badgeTone="sky" title="Rubric Bank" illus="review"
      subtitle="Standard marking criteria so every instructor grades writing and speaking the same way." addLabel="New Rubric" defaults={{ skill: 'writing' }}
      fields={[{ k: 'name', label: 'Rubric name', required: true }, { k: 'skill', label: 'Skill', type: 'select', required: true, options: ['writing', 'speaking', 'reading', 'listening', 'general'].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) })) }, { k: 'criteria', label: 'Criteria', type: 'textarea', required: true, hint: 'One per line: Criterion | max points', ph: 'Task achievement | 5\nGrammar accuracy | 5' }]}
      searchText={(r) => `${r.name} ${r.skill}`}
      card={(r) => {
        const c = parseRubric(r.criteria);
        return (<>
          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-sky-50 text-sky-600">{r.skill}</span>
          <h3 className="text-lg font-extrabold text-slate-900 mt-3">{r.name}</h3>
          <ul className="mt-3 space-y-1.5">{c.map((x) => <li key={x.name} className="flex justify-between text-sm"><span className="text-slate-600">{x.name}</span><b className="text-slate-800">{x.max}</b></li>)}</ul>
          <p className="text-xs font-black text-slate-500 mt-3 pt-3 border-t border-slate-100 flex justify-between"><span>TOTAL</span><span>{c.reduce((a, x) => a + x.max, 0)}</span></p>
        </>);
      }} />
  );
}

// ---------------- Substitute requests ----------------
type Sr = { id: number; reason: string; status: string; admin_note: string | null; created_at: string; substitute_id: string | null;
  requester: { id: string; full_name: string } | null; substitute: { full_name: string } | null;
  session: { id: number; title: string; starts_at: string; ends_at: string; batch: { name: string } | null } | null };
export function AdminSubstitutes() {
  const user = useAuth((s) => s.user);
  const [tab, setTab] = useState('pending');
  const [open, setOpen] = useState<Sr | null>(null);
  const { data, loading, reload } = useData<Sr[]>(() => supabase.from('substitute_requests').select('id,reason,status,admin_note,created_at,substitute_id, requester:profiles!substitute_requests_requested_by_fkey(id,full_name), substitute:profiles!substitute_requests_substitute_id_fkey(full_name), session:class_sessions(id,title,starts_at,ends_at, batch:batches(name))').order('created_at', { ascending: false }));
  const list = (data ?? []).filter((r) => tab === 'all' || r.status === tab);
  return (
    <Page>
      {user?.demo && <DemoNotice />}
      <PageHero badge="Class Cover" badgeColor="indigo" title="Substitute Requests" illus="session" subtitle="Instructors ask for cover from their timetable. Assign a substitute and both instructors are notified.">
        <div className="inline-flex bg-slate-50 p-1 rounded-xl border border-slate-200">{['pending', 'approved', 'rejected', 'all'].map((t) => <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-xs font-bold capitalize ${tab === t ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>{t}</button>)}</div>
      </PageHero>
      {loading ? <Spinner /> : !list.length ? <p className="text-center text-slate-400 py-16">No requests here.</p> : (
        <div className="grid md:grid-cols-2 gap-5">{list.map((r) => (
          <div key={r.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
            <div className="flex justify-between gap-3"><div><p className="font-extrabold text-slate-900">{r.session?.title}</p><p className="text-xs text-slate-500">{r.session?.batch?.name}</p></div><StatusPill status={r.status} /></div>
            {r.session && <p className="text-xs font-bold text-slate-600 mt-3 flex items-center gap-1"><Clock size={12} />{fmtDateTime(r.session.starts_at)} – {hm(r.session.ends_at)}</p>}
            <p className="text-sm text-slate-600 mt-3"><b>{r.requester?.full_name}:</b> {r.reason}</p>
            {r.substitute && <p className="text-sm mt-2 text-emerald-700">Cover: <b>{r.substitute.full_name}</b></p>}
            {r.admin_note && <p className="text-xs text-slate-400 mt-1">Note: {r.admin_note}</p>}
            {r.status === 'pending' && <button disabled={user?.demo} onClick={() => setOpen(r)} className="mt-4 px-4 py-2 rounded-xl bg-slate-900 hover:bg-orange-500 text-white text-xs font-bold disabled:opacity-50">Review</button>}
          </div>
        ))}</div>
      )}
      {open && <SubstituteDecision r={open} onClose={() => setOpen(null)} onDone={() => { setOpen(null); reload(); }} />}
    </Page>
  );
}
function SubstituteDecision({ r, onClose, onDone }: { r: Sr; onClose: () => void; onDone: () => void }) {
  const instructors = useOptions('profiles', 'full_name', { eq: ['role', 'instructor'] }).filter((o) => o.value !== r.requester?.id);
  const [sub, setSub] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const decide = async (status: 'approved' | 'rejected') => {
    if (status === 'approved' && !sub) return toast.err('Choose the substitute instructor.');
    setBusy(true);
    const { error } = await supabase.from('substitute_requests').update({ status, substitute_id: status === 'approved' ? sub : null, admin_note: note || null }).eq('id', r.id);
    if (!error && status === 'approved' && r.session) await supabase.from('class_sessions').update({ substitute_id: sub }).eq('id', r.session.id);
    setBusy(false);
    if (error) return toast.err(error.message);
    const when = r.session ? fmtDateTime(r.session.starts_at) : '';
    if (r.requester) await notify(r.requester.id, status === 'approved' ? 'Substitute assigned' : 'Substitute request declined', `${r.session?.title ?? ''} · ${when}${note ? ` — ${note}` : ''}`, '/instructor/timetable');
    if (status === 'approved') await notify(sub, 'You are covering a class', `${r.session?.title ?? ''} (${r.session?.batch?.name ?? ''}) · ${when}`, '/instructor/timetable');
    toast.ok(status === 'approved' ? 'Substitute assigned' : 'Request declined'); onDone();
  };
  return (
    <Modal open onClose={onClose} title="Substitute request">
      <div className="space-y-4">
        <p className="text-sm text-slate-600">{r.requester?.full_name} — {r.reason}</p>
        <Field label="Substitute instructor"><select className={inputCls} value={sub} onChange={(e) => setSub(e.target.value)}><option value="">— Select —</option>{instructors.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>
        <Field label="Note (optional)"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <div className="flex gap-3">
          <button disabled={busy} onClick={() => decide('approved')} className={`${btnPrimary} flex-1`}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}Assign</button>
          <button disabled={busy} onClick={() => decide('rejected')} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-red-50 text-red-600 font-bold text-sm"><X size={16} />Decline</button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------- Master schedule ----------------
type Ms = { id: number; title: string; starts_at: string; ends_at: string; mode: string; room: string | null; substitute_id: string | null;
  batch: { name: string; instructor_id: string | null; instructor: { full_name: string } | null } | null; substitute: { full_name: string } | null };
const startOfWeek = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
export function AdminMasterTimetable() {
  const user = useAuth((s) => s.user);
  const [week, setWeek] = useState(() => startOfWeek(new Date()));
  const end = new Date(week); end.setDate(end.getDate() + 7);
  const { data, loading } = useData<Ms[]>(() => supabase.from('class_sessions').select('id,title,starts_at,ends_at,mode,room,substitute_id, batch:batches(name,instructor_id, instructor:profiles(full_name)), substitute:profiles!class_sessions_substitute_id_fkey(full_name)').gte('starts_at', week.toISOString()).lt('starts_at', end.toISOString()).order('starts_at'), [week.getTime()]);
  const clashes = useMemo(() => {
    const ids = new Set<number>(); const l = data ?? [];
    l.forEach((a, i) => l.slice(i + 1).forEach((b) => {
      const ta = a.substitute_id ?? a.batch?.instructor_id, tb = b.substitute_id ?? b.batch?.instructor_id;
      if (ta && ta === tb && new Date(a.starts_at) < new Date(b.ends_at) && new Date(b.starts_at) < new Date(a.ends_at)) { ids.add(a.id); ids.add(b.id); }
      if (a.mode === 'face_to_face' && b.mode === 'face_to_face' && a.room && a.room === b.room && new Date(a.starts_at) < new Date(b.ends_at) && new Date(b.starts_at) < new Date(a.ends_at)) { ids.add(a.id); ids.add(b.id); }
    }));
    return ids;
  }, [data]);
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(week); d.setDate(d.getDate() + i); return d; });
  const shift = (n: number) => { const d = new Date(week); d.setDate(d.getDate() + n * 7); setWeek(d); };
  return (
    <Page wide>
      {user?.demo && <DemoNotice />}
      <PageHero badge="Institution-wide" badgeColor="indigo" title="Master Schedule" illus="calendar" subtitle="Every class across all batches for the week. Clashes (same instructor or same room at the same time) are highlighted in red.">
        <div className="flex items-center gap-3">
          <button onClick={() => shift(-1)} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200"><ArrowLeft size={16} /></button>
          <span className="font-bold text-slate-700 text-sm">{week.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – {new Date(end.getTime() - 1).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          <button onClick={() => shift(1)} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200"><ArrowRight size={16} /></button>
          <button onClick={() => setWeek(startOfWeek(new Date()))} className="px-3 py-2 rounded-xl text-xs font-bold text-indigo-600 bg-indigo-50">This week</button>
        </div>
        {clashes.size > 0 && <p className="mt-4 text-sm font-bold text-red-600 flex items-center gap-2"><AlertTriangle size={16} />{clashes.size} sessions clash</p>}
      </PageHero>
      {loading ? <Spinner /> : (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">{days.map((d) => {
          const list = (data ?? []).filter((s) => new Date(s.starts_at).toDateString() === d.toDateString());
          const today = d.toDateString() === new Date().toDateString();
          return (
            <div key={d.toISOString()} className={`rounded-3xl border p-3 min-h-40 ${today ? 'bg-orange-50/40 border-orange-200' : 'bg-white border-slate-100'}`}>
              <p className="text-xs font-black uppercase text-slate-500 mb-3">{d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })}</p>
              <div className="space-y-2">{list.map((s) => (
                <div key={s.id} className={`rounded-2xl p-3 text-xs border ${clashes.has(s.id) ? 'bg-red-50 border-red-200' : s.mode === 'online' ? 'bg-sky-50 border-sky-100' : 'bg-indigo-50 border-indigo-100'}`}>
                  <p className="font-black text-slate-700">{hm(s.starts_at)}–{hm(s.ends_at)}</p>
                  <p className="font-bold text-slate-900 truncate">{s.batch?.name ?? s.title}</p>
                  <p className="text-slate-500 truncate">{s.substitute ? <>Cover: {s.substitute.full_name}</> : s.batch?.instructor?.full_name ?? 'No instructor'}</p>
                  <p className="text-[10px] uppercase font-bold mt-1 text-slate-500 flex items-center gap-1">{s.mode === 'online' ? <><Globe size={10} />Online</> : <><MapPin size={10} />{s.room ?? 'Campus'}</>}</p>
                </div>
              ))}{!list.length && <p className="text-[11px] text-slate-300">—</p>}</div>
            </div>
          );
        })}</div>
      )}
    </Page>
  );
}

// ---------------- Live sessions (online) ----------------
type Ls = { id: number; title: string; starts_at: string; ends_at: string; meeting_url: string | null; batch: { name: string; instructor: { full_name: string } | null } | null };
export function AdminLiveSessions() {
  const user = useAuth((s) => s.user);
  const [edit, setEdit] = useState<Ls | null>(null);
  const [url, setUrl] = useState('');
  const since = new Date(Date.now() - 3 * 3600e3).toISOString();
  const { data, loading, reload } = useData<Ls[]>(() => supabase.from('class_sessions').select('id,title,starts_at,ends_at,meeting_url, batch:batches(name, instructor:profiles(full_name))').eq('mode', 'online').gte('ends_at', since).order('starts_at').limit(60));
  const now = Date.now();
  const live = (data ?? []).filter((s) => new Date(s.starts_at).getTime() <= now && new Date(s.ends_at).getTime() >= now);
  const next = (data ?? []).filter((s) => new Date(s.starts_at).getTime() > now);
  const save = async () => {
    if (!edit) return;
    const { error } = await supabase.from('class_sessions').update({ meeting_url: url || null }).eq('id', edit.id);
    if (error) toast.err(error.message); else { toast.ok('Link saved'); setEdit(null); reload(); }
  };
  const card = (s: Ls, isLive = false) => (
    <div key={s.id} className={`bg-white rounded-3xl border shadow-sm p-5 ${isLive ? 'border-red-200' : 'border-slate-100'}`}>
      <div className="flex justify-between items-start">
        <p className="text-xs font-black text-slate-500 flex items-center gap-1"><Clock size={12} />{fmtDateTime(s.starts_at)} – {hm(s.ends_at)}</p>
        {isLive && <span className="flex items-center gap-1 text-[10px] font-black uppercase text-red-600 bg-red-50 px-2 py-0.5 rounded-full"><span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />Live</span>}
      </div>
      <p className="font-extrabold text-slate-900 mt-2">{s.title}</p>
      <p className="text-xs text-slate-500">{s.batch?.name} · {s.batch?.instructor?.full_name ?? 'No instructor'}</p>
      <div className="flex items-center gap-2 mt-4">
        {s.meeting_url ? <a href={s.meeting_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-bold"><Video size={14} />Join</a> : <span className="text-xs font-bold text-amber-600 flex items-center gap-1"><AlertTriangle size={12} />No meeting link</span>}
        <button disabled={user?.demo} onClick={() => { setEdit(s); setUrl(s.meeting_url ?? ''); }} className="ml-auto text-xs font-bold text-slate-500 hover:text-orange-600 disabled:opacity-50">Edit link</button>
      </div>
    </div>
  );
  return (
    <Page>
      {user?.demo && <DemoNotice />}
      <PageHero badge="Virtual Classrooms" badgeColor="red" title="Live Sessions" illus="session" subtitle="Monitor online classes happening now and make sure every upcoming class has a working meeting link." />
      {loading ? <Spinner /> : (<>
        <h2 className="text-sm font-black uppercase tracking-wider text-slate-500 mb-3">Happening now ({live.length})</h2>
        {live.length ? <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">{live.map((s) => card(s, true))}</div> : <p className="text-slate-400 text-sm mb-10">No online class is running right now.</p>}
        <h2 className="text-sm font-black uppercase tracking-wider text-slate-500 mb-3">Upcoming ({next.length})</h2>
        {next.length ? <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{next.map((s) => card(s))}</div> : <p className="text-slate-400 text-sm">No upcoming online classes.</p>}
      </>)}
      {edit && <Modal open onClose={() => setEdit(null)} title={`Meeting link — ${edit.title}`}>
        <div className="space-y-4"><Field label="Zoom / Google Meet / Teams URL"><input type="url" className={inputCls} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" /></Field>
          <button onClick={save} className={`${btnPrimary} w-full`}><Save size={16} />Save</button></div>
      </Modal>}
    </Page>
  );
}

// ---------------- Audit logs ----------------
type Al = { id: number; actor_name: string | null; action: string; table_name: string; row_id: string | null; changes: Record<string, unknown> | null; created_at: string };
const ACTION_TONE: Record<string, string> = { insert: 'bg-emerald-50 text-emerald-700', update: 'bg-sky-50 text-sky-700', delete: 'bg-red-50 text-red-600' };
export function AdminAuditLogs() {
  const user = useAuth((s) => s.user);
  const [q, setQ] = useState('');
  const [table, setTable] = useState('');
  const [limit, setLimit] = useState(100);
  const [open, setOpen] = useState<Al | null>(null);
  const { data, loading } = useData<Al[]>(() => { let x = supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(limit); if (table) x = x.eq('table_name', table); return x; }, [table, limit]);
  const list = (data ?? []).filter((r) => `${r.actor_name ?? ''} ${r.table_name} ${r.row_id} ${JSON.stringify(r.changes)}`.toLowerCase().includes(q.toLowerCase()));
  const summary = (r: Al) => r.action === 'update' && r.changes ? Object.keys(r.changes).join(', ') : r.action === 'insert' ? 'Created' : 'Deleted';
  return (
    <Page>
      {user?.demo && <DemoNotice />}
      <PageHero badge="Security" badgeColor="red" title="Audit Logs" illus="documents" subtitle="Who changed what and when: prices, enrollments, payments, roles, grades and payouts are recorded automatically.">
        <div className="flex flex-wrap gap-3 max-w-xl">
          <div className="relative flex-1 min-w-48"><Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search user, record, value..." className="w-full pl-10 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none" /></div>
          <select value={table} onChange={(e) => setTable(e.target.value)} className="px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"><option value="">All tables</option>{['profiles', 'courses', 'batches', 'enrollments', 'payments', 'exam_results', 'certificates', 'lessons', 'agent_payouts', 'agent_earnings', 'commission_rules', 'substitute_requests', 'site_settings'].map((t) => <option key={t}>{t}</option>)}</select>
        </div>
      </PageHero>
      {loading ? <Spinner /> : !list.length ? <p className="text-center text-slate-400 py-16">No activity recorded yet.</p> : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[720px]"><thead className="bg-slate-50 text-[11px] font-extrabold uppercase text-slate-500"><tr><th className="px-4 py-3">When</th><th className="px-3 py-3">User</th><th className="px-3 py-3">Action</th><th className="px-3 py-3">Record</th><th className="px-3 py-3">Changed</th><th /></tr></thead>
            <tbody className="divide-y divide-slate-100">{list.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50/60">
                <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{fmtDateTime(r.created_at)}</td>
                <td className="px-3 py-3 font-semibold text-slate-800">{r.actor_name ?? <span className="text-slate-400">System</span>}</td>
                <td className="px-3 py-3"><span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${ACTION_TONE[r.action] ?? ''}`}>{r.action}</span></td>
                <td className="px-3 py-3 text-slate-600">{r.table_name} <span className="text-slate-400">#{r.row_id}</span></td>
                <td className="px-3 py-3 text-xs text-slate-500 max-w-60 truncate">{summary(r)}</td>
                <td className="px-3 py-3"><button onClick={() => setOpen(r)} className="text-xs font-bold text-indigo-600">Details</button></td>
              </tr>
            ))}</tbody></table>
          {data && data.length >= limit && <button onClick={() => setLimit(limit + 200)} className="w-full py-3 text-xs font-bold text-slate-500 hover:bg-slate-50 flex items-center justify-center gap-1"><History size={14} />Load older</button>}
        </div>
      )}
      {open && <Modal open onClose={() => setOpen(null)} title={`${open.action} · ${open.table_name} #${open.row_id}`} wide>
        {open.action === 'update' && open.changes ? (
          <table className="w-full text-sm"><thead className="text-[11px] uppercase text-slate-500"><tr><th className="text-left py-2">Field</th><th className="text-left">From</th><th className="text-left">To</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{Object.entries(open.changes as Record<string, { from: unknown; to: unknown }>).map(([k, v]) => <tr key={k}><td className="py-2 font-bold text-slate-700">{k}</td><td className="text-red-600 break-all">{JSON.stringify(v.from)}</td><td className="text-emerald-700 break-all">{JSON.stringify(v.to)}</td></tr>)}</tbody></table>
        ) : <pre className="text-xs bg-slate-50 rounded-xl p-4 overflow-auto max-h-96">{JSON.stringify(open.changes, null, 2)}</pre>}
      </Modal>}
    </Page>
  );
}
