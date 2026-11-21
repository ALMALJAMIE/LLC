import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowDown, ArrowLeft, ArrowUp, BookOpenText, BrainCircuit, Check, CheckCircle2, Clock, Eye, FileText, ImagePlus, Info, Layers, ListChecks,
  Loader2, Mic, PenLine, Plus, Save, Settings2, Share2, SquarePen, Trash2, Upload, X,
} from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { isAcademicLead } from '../../lib/nav';
import { supabase } from '../../lib/supabase';
import { fmtDate, useData } from '../../lib/db';
import { uploadMedia } from '../../lib/media';
import { DemoNotice, Field, Modal, Page, PageHero, SearchInput, Spinner, StatusPill, btnGhost, btnPrimary, inputCls, toast } from '../../components/ui';
import { RichText } from '../shared/LessonView';

// ---------------------------------------------------------------- types
export type Test = {
  id: number; title: string; description: string | null; duration_min: number; is_active: boolean; category: 'language' | 'professional'; course_id: number | null;
  config: 'written' | 'interview' | 'both'; version: string | null; priority: number; assigned_to: string | null; agent_ids: string[]; approval: 'draft' | 'approved';
  created_by: string | null; created_at: string; course: { title: string } | null; creator: { full_name: string } | null; assignee: { full_name: string } | null;
  placement_questions: { count: number }[];
};
export type Section = { id: number; test_id: number; title: string; skill: string; description: string | null; time_min: number | null; scoring: 'auto' | 'manual'; instructions: string[]; images: string[]; sort_order: number };
export type Group = { id: number; section_id: number; title: string | null; passage: string | null; audio_url: string | null; image_url: string | null; sort_order: number };
export type Question = { id: number; test_id: number; section: string; section_id: number | null; group_id: number | null; context: string | null; prompt: string; options: string[]; correct_index: number; points: number; qtype: 'mcq' | 'short' | 'long'; sort_order: number };

export const SKILLS = ['grammar', 'vocabulary', 'reading', 'listening', 'writing', 'speaking'];
export const CONFIG_LABEL: Record<string, string> = { written: 'Written Only', interview: 'Interview Only', both: 'Written + Interview' };
const QTYPE_LABEL: Record<string, string> = { mcq: 'Multiple Choice', short: 'Short answer', long: 'Written answer' };
export const testCode = (id: number) => `PL${String(id).padStart(6, '0')}`;
const base = (role: string) => (isAcademicLead(role as never) ? '/admin-placement-tests' : '/instructor/placement-tests');
const TEST_SELECT = '*, course:courses(title), creator:profiles!placement_tests_created_by_fkey(full_name), assignee:profiles!placement_tests_assigned_to_fkey(full_name), placement_questions(count)';

// ---------------------------------------------------------------- list
export function PlacementTestsAdmin() {
  const user = useAuth((s) => s.user)!;
  const lead = isAcademicLead(user.role);
  const nav = useNavigate();
  const { data, loading, reload } = useData<Test[]>(() => {
    const qy = supabase.from('placement_tests').select(TEST_SELECT).order('priority', { ascending: false }).order('id', { ascending: false });
    return lead ? qy : qy.or(`created_by.eq.${user.id},assigned_to.eq.${user.id}`);
  });
  const [status, setStatus] = useState('all');
  const [cat, setCat] = useState('all');
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Partial<Test> | null>(null);
  const list = (data ?? []).filter((t) => (status === 'all' || (status === 'active') === t.is_active) && (cat === 'all' || t.category === cat)
    && `${t.title} ${testCode(t.id)} ${t.course?.title ?? ''}`.toLowerCase().includes(q.toLowerCase()));

  const patch = async (t: Test, row: Partial<Test>, msg: string) => {
    const { error } = await supabase.from('placement_tests').update(row).eq('id', t.id);
    if (error) toast.err(error.message); else { toast.ok(msg); reload(); }
  };
  const del = async (t: Test) => {
    if (!confirm(`Delete "${t.title}" with all its sections and questions?`)) return;
    const { error } = await supabase.from('placement_tests').delete().eq('id', t.id);
    if (error) toast.err(error.code === '23503' ? 'Students have already taken this test. Make it inactive instead.' : error.message); else reload();
  };

  return (
    <Page wide>
      {user.demo && <DemoNotice />}
      <PageHero badge="Assessment Center" badgeColor="indigo" title="Placement Tests" illus="exam"
        subtitle="Create and manage entrance exams. Tests created by instructors must be reviewed and approved by an administrator before they can be published.">
        <div className="flex flex-wrap gap-2 items-center">
          <SearchInput value={q} onChange={setQ} placeholder="Search by title or code..." />
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold"><option value="all">All Status</option><option value="active">Active Only</option><option value="inactive">Inactive Only</option></select>
          <select value={cat} onChange={(e) => setCat(e.target.value)} className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold"><option value="all">All Categories</option><option value="language">Language</option><option value="professional">Professional</option></select>
          <button onClick={() => setEdit({ category: 'language', config: 'written', priority: 5, duration_min: 30, version: '1', agent_ids: [], is_active: false })} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-orange-500 text-white text-sm font-bold"><Plus size={16} /> Create New Test</button>
        </div>
      </PageHero>
      {loading ? <Spinner /> : !list.length ? <p className="text-center text-slate-400 py-12">No tests found.</p> : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">{list.map((t) => (
          <div key={t.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 flex flex-col">
            <div className="flex items-start gap-3 mb-3">
              <span className="w-12 h-12 shrink-0 rounded-2xl bg-indigo-50 text-indigo-600 grid place-items-center"><BrainCircuit size={22} /></span>
              <div className="flex-1 min-w-0"><h3 className="text-base font-bold text-slate-900 leading-snug">{t.title}</h3><p className="text-[11px] font-mono text-slate-400">{testCode(t.id)}</p></div>
              {(lead || t.created_by === user.id) && <><button title="Settings" onClick={() => setEdit(t)} className="p-1.5 text-slate-400 hover:text-blue-600"><Settings2 size={16} /></button>
                <button title="Delete" onClick={() => del(t)} className="p-1.5 text-slate-400 hover:text-red-500"><Trash2 size={16} /></button></>}
            </div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              <StatusPill status={t.approval} /><StatusPill status={t.is_active ? 'active' : 'inactive'} />
              <span className="inline-flex items-center px-2.5 py-1 rounded-md border text-[10px] font-bold uppercase bg-orange-50 text-orange-600 border-orange-100">{t.category === 'language' ? 'Lang' : 'Prof'}</span>
              {t.agent_ids?.length > 0 && <span className="inline-flex items-center px-2.5 py-1 rounded-md border text-[10px] font-bold uppercase bg-pink-50 text-pink-600 border-pink-100">{t.agent_ids.length} agents only</span>}
            </div>
            <p className="text-[11px] text-slate-500">Created by: <b>{t.creator?.full_name ?? '—'}</b>{t.assignee && <> · Assigned: <b>{t.assignee.full_name}</b></>}</p>
            <p className="text-sm text-slate-500 mt-2 line-clamp-3 flex-1">{t.description || 'No description provided.'}</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-bold text-slate-500 mt-3">
              <span>{CONFIG_LABEL[t.config]}</span>{t.course && <span>{t.course.title}</span>}{t.version && <span>Version: {t.version}</span>}
              <span className="flex items-center gap-1"><Clock size={11} />{t.duration_min} Min</span><span className="flex items-center gap-1"><ListChecks size={11} />{t.placement_questions?.[0]?.count ?? 0} questions</span>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <button onClick={() => nav(`${base(user.role)}/${t.id}/manage`)} className="py-2.5 rounded-xl bg-slate-900 hover:bg-orange-500 text-white text-xs font-bold">Manage Sections</button>
              <button onClick={() => nav(`${base(user.role)}/${t.id}/details`)} className="py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold flex items-center justify-center gap-1"><Eye size={14} />Details</button>
            </div>
            {lead && <div className="grid grid-cols-2 gap-2 mt-2">
              {t.approval === 'draft' ? <button onClick={() => patch(t, { approval: 'approved' }, 'Test approved')} className="py-2 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-100 flex items-center justify-center gap-1"><Check size={14} />Approve</button>
                : <button onClick={() => patch(t, { approval: 'draft', is_active: false }, 'Moved back to draft')} className="py-2 rounded-xl bg-slate-50 text-slate-500 text-xs font-bold border border-slate-200">Back to draft</button>}
              <button onClick={() => (t.approval !== 'approved' && !t.is_active ? toast.err('Approve the test first.') : patch(t, { is_active: !t.is_active }, t.is_active ? 'Test closed' : 'Test is open to students'))}
                className={`py-2 rounded-xl text-xs font-bold border ${t.is_active ? 'bg-red-50 text-red-600 border-red-100' : 'bg-indigo-50 text-indigo-700 border-indigo-100'}`}>{t.is_active ? 'Deactivate' : 'Activate'}</button>
            </div>}
          </div>
        ))}</div>
      )}
      {edit && <TestForm test={edit} onClose={() => setEdit(null)} onDone={(id, isNew) => { setEdit(null); reload(); if (isNew) nav(`${base(user.role)}/${id}/manage`); }} />}
    </Page>
  );
}

function TestForm({ test, onClose, onDone }: { test: Partial<Test>; onClose: () => void; onDone: (id: number, isNew: boolean) => void }) {
  const user = useAuth((s) => s.user)!;
  const lead = isAcademicLead(user.role);
  const courses = useData<{ id: number; title: string; code: string }[]>(() => supabase.from('courses').select('id,title,code').order('code'));
  const teachers = useData<{ id: string; full_name: string }[]>(() => supabase.from('profiles').select('id,full_name').eq('role', 'instructor').order('full_name'));
  const agents = useData<{ id: string; company: string | null; profile: { full_name: string } | null }[]>(() => lead ? supabase.from('agent_profiles').select('id,company, profile:profiles!agent_profiles_id_fkey(full_name)').eq('status', 'approved') : Promise.resolve({ data: [], error: null }) as never);
  const [f, setF] = useState({
    title: test.title ?? '', description: test.description ?? '', category: test.category ?? 'language', course_id: test.course_id ? String(test.course_id) : '',
    config: test.config ?? 'written', version: test.version ?? '', priority: String(test.priority ?? 5), duration_min: String(test.duration_min ?? 30),
    assigned_to: test.assigned_to ?? '', agent_ids: test.agent_ids ?? [], is_active: test.is_active ?? false,
  });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!f.title.trim()) return toast.err('Title is required');
    if (!f.course_id) return toast.err('Choose the target course.');
    const pr = Number(f.priority), dur = Number(f.duration_min);
    if (!(pr >= 1 && pr <= 10)) return toast.err('Priority must be between 1 and 10.');
    if (!(dur > 0)) return toast.err('Enter the overall time limit in minutes.');
    setBusy(true);
    const row: Record<string, unknown> = { title: f.title.trim(), description: f.description.trim() || null, category: f.category, course_id: Number(f.course_id), config: f.config,
      version: f.version.trim() || null, priority: pr, duration_min: dur, assigned_to: f.assigned_to || null };
    if (lead) Object.assign(row, { agent_ids: f.agent_ids, is_active: f.is_active });
    const r = test.id ? await supabase.from('placement_tests').update(row).eq('id', test.id).select('id').single() : await supabase.from('placement_tests').insert(row).select('id').single();
    setBusy(false);
    if (r.error) return toast.err(r.error.message);
    toast.ok(test.id ? 'Test updated' : lead ? 'Test created' : 'Test created as a draft — an administrator will review it');
    onDone(r.data.id, !test.id);
  };
  const radio = (k: 'category' | 'config', opts: [string, string][]) => (
    <div className="flex flex-wrap gap-2">{opts.map(([v, l]) => <button type="button" key={v} onClick={() => setF({ ...f, [k]: v })} className={`px-4 py-2.5 rounded-xl border text-sm font-bold ${f[k] === v ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-slate-200 text-slate-600'}`}>{l}</button>)}</div>
  );
  return (
    <Modal open onClose={onClose} title={test.id ? 'Test Settings' : 'Create Placement Test'} wide>
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Assign To Instructor"><select className={inputCls} value={f.assigned_to} onChange={(e) => setF({ ...f, assigned_to: e.target.value })}><option value="">-- Unassigned (Global / You) --</option>{(teachers.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}</select></Field>
          {lead && <Field label="Restrict to Specific Agents (optional)">
            <div className="max-h-28 overflow-y-auto border border-slate-200 rounded-xl p-2 bg-slate-50 space-y-1">
              {!(agents.data ?? []).length && <p className="text-xs text-slate-400 p-1">-- Global Test (No Agents Selected) --</p>}
              {(agents.data ?? []).map((a) => <label key={a.id} className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-orange-500" checked={f.agent_ids.includes(a.id)} onChange={(e) => setF({ ...f, agent_ids: e.target.checked ? [...f.agent_ids, a.id] : f.agent_ids.filter((x) => x !== a.id) })} />{a.profile?.full_name}{a.company && <span className="text-slate-400 text-xs">· {a.company}</span>}</label>)}
            </div>
          </Field>}
        </div>
        <Field label="1. Category Type">{radio('category', [['language', 'Language'], ['professional', 'Professional']])}</Field>
        <Field label="2. Target Course *"><select className={inputCls} value={f.course_id} onChange={(e) => setF({ ...f, course_id: e.target.value })}><option value="">-- Choose Course --</option>{(courses.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.code} · {c.title}</option>)}</select></Field>
        <Field label="3. Test Configuration *">{radio('config', [['written', 'Written Only'], ['interview', 'Interview Only'], ['both', 'Written + Interview']])}</Field>
        <Field label="Test Title *"><input className={inputCls} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. General English Placement Assessment — Set 1" /></Field>
        <Field label="Description"><textarea rows={3} className={inputCls} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Version"><input className={inputCls} value={f.version} onChange={(e) => setF({ ...f, version: e.target.value })} /></Field>
          <Field label="Priority (1-10) *"><input type="number" min={1} max={10} className={inputCls} value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })} /></Field>
          <Field label="Overall Time Limit (Min) *"><input type="number" className={inputCls} value={f.duration_min} onChange={(e) => setF({ ...f, duration_min: e.target.value })} /></Field>
        </div>
        {lead && test.id && test.approval === 'approved' && <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" className="accent-orange-500" checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} />Open to students (active)</label>}
        <button disabled={busy} onClick={save} className={`${btnPrimary} w-full`}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {test.id ? 'Save Changes' : 'Create Test'}</button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- data hook shared by builder & details
function useTestContent(tid: number) {
  const test = useData<Test>(() => supabase.from('placement_tests').select(TEST_SELECT).eq('id', tid).maybeSingle(), [tid]);
  const secs = useData<Section[]>(() => supabase.from('placement_sections').select('*').eq('test_id', tid).order('sort_order').order('id'), [tid]);
  const groups = useData<Group[]>(() => supabase.from('placement_groups').select('*, section:placement_sections!inner(test_id)').eq('section.test_id', tid).order('sort_order').order('id'), [tid]);
  const qs = useData<Question[]>(() => supabase.from('placement_questions').select('*').eq('test_id', tid).order('sort_order').order('id'), [tid]);
  const reload = () => { secs.reload(); groups.reload(); qs.reload(); };
  return { test, secs, groups, qs, reload, loading: test.loading || secs.loading || groups.loading || qs.loading };
}

// ---------------------------------------------------------------- builder (Manage Sections)
export function TestBuilder() {
  const { id } = useParams();
  const tid = Number(id);
  const user = useAuth((s) => s.user)!;
  const nav = useNavigate();
  const { test, secs, groups, qs, reload, loading } = useTestContent(tid);
  const [sel, setSel] = useState<number | null>(null);
  const [secForm, setSecForm] = useState<Partial<Section> | null>(null);
  const [qForm, setQForm] = useState<Partial<Question> | null>(null);
  const [gForm, setGForm] = useState<Partial<Group> | null>(null);
  const [instr, setInstr] = useState<string | null>(null);
  const list = secs.data ?? [];
  const cur = list.find((s) => s.id === sel) ?? list[0];
  const curGroups = (groups.data ?? []).filter((g) => g.section_id === cur?.id);
  const curQs = (qs.data ?? []).filter((q) => q.section_id === cur?.id);
  const standalone = curQs.filter((q) => !q.group_id);
  const pts = (sid: number) => (qs.data ?? []).filter((q) => q.section_id === sid).reduce((a, q) => a + q.points, 0);

  const moveSec = async (s: Section, dir: -1 | 1) => {
    const i = list.findIndex((x) => x.id === s.id); const o = list[i + dir]; if (!o) return;
    await supabase.from('placement_sections').update({ sort_order: i + 1 + dir }).eq('id', s.id);
    await supabase.from('placement_sections').update({ sort_order: i + 1 }).eq('id', o.id);
    secs.reload();
  };
  const delSec = async (s: Section) => {
    if (!confirm(`Delete section "${s.title}" and all its questions?`)) return;
    const { error } = await supabase.from('placement_sections').delete().eq('id', s.id); if (error) toast.err(error.message); else { setSel(null); reload(); }
  };
  const delQ = async (q: Question) => { if (!confirm('Delete this question?')) return; const { error } = await supabase.from('placement_questions').delete().eq('id', q.id); if (error) toast.err(error.message); else qs.reload(); };
  const delG = async (g: Group) => {
    const n = curQs.filter((q) => q.group_id === g.id).length;
    if (!confirm(`Delete this passage group${n ? ` and its ${n} questions` : ''}?`)) return;
    if (n) await supabase.from('placement_questions').delete().eq('group_id', g.id);
    const { error } = await supabase.from('placement_groups').delete().eq('id', g.id); if (error) toast.err(error.message); else reload();
  };
  const saveInstructions = async (arr: string[]) => {
    const { error } = await supabase.from('placement_sections').update({ instructions: arr }).eq('id', cur!.id);
    if (error) toast.err(error.message); else secs.reload();
  };
  const newQ = (group_id: number | null) => setQForm({ test_id: tid, section_id: cur!.id, section: cur!.skill, group_id, qtype: cur!.scoring === 'manual' ? 'short' : 'mcq', options: ['', '', '', ''], correct_index: 0, points: 1, sort_order: curQs.length + 1 });

  if (loading && !test.data) return <Spinner />;
  if (!test.data) return <Page><p className="text-center text-slate-400 py-16">Test not found.</p></Page>;
  const t = test.data;
  return (
    <Page wide>
      {user.demo && <DemoNotice />}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <button onClick={() => nav(base(user.role))} className="w-10 h-10 rounded-full bg-white border border-slate-200 grid place-items-center"><ArrowLeft size={18} /></button>
        <div className="flex-1 min-w-48"><h1 className="text-2xl font-extrabold text-slate-900">{t.title} <span className="text-sm font-mono text-slate-400">({testCode(t.id)})</span></h1>
          <p className="text-xs font-bold text-slate-500 mt-0.5">Ver: {t.version ?? '—'} · {CONFIG_LABEL[t.config]} · {t.duration_min} min · <StatusPill status={t.approval} /></p></div>
        <button onClick={() => nav(`${base(user.role)}/${t.id}/details`)} className={btnGhost}><Eye size={16} /> Details</button>
      </div>
      {t.config === 'interview' && <div className="mb-5 p-4 rounded-2xl bg-sky-50 border border-sky-100 text-sm text-sky-800 flex gap-2"><Info size={18} className="shrink-0" />Interview-only test: there is nothing for students to answer online. The interviewer records the score under “Placement Results”. You can still add sections as a guide for the interviewer.</div>}
      <div className="grid lg:grid-cols-12 gap-6">
        <aside className="lg:col-span-4 xl:col-span-3 bg-white rounded-3xl border border-slate-100 shadow-sm p-4 h-fit">
          <div className="flex items-center justify-between px-1 mb-3"><p className="text-[11px] font-black uppercase tracking-wider text-slate-500">Assessment Sections</p>
            <button onClick={() => setSecForm({ test_id: tid, skill: 'reading', scoring: 'auto', instructions: [], images: [], sort_order: list.length + 1 })} className="px-3 py-1.5 rounded-lg bg-orange-500 text-white text-[11px] font-black flex items-center gap-1"><Plus size={12} />ADD</button></div>
          {!list.length && <p className="text-xs text-slate-400 px-1 py-4">No sections yet. Add the first one.</p>}
          <div className="space-y-1.5">{list.map((s, i) => (
            <div key={s.id} onClick={() => setSel(s.id)} className={`group flex items-center gap-2 p-3 rounded-2xl border cursor-pointer ${cur?.id === s.id ? 'border-orange-300 bg-orange-50' : 'border-slate-100 hover:bg-slate-50'}`}>
              <div className="flex-1 min-w-0"><p className="text-[10px] font-black uppercase text-indigo-500">{s.skill}</p><p className="text-sm font-bold text-slate-800 leading-snug">{s.title}</p>
                <p className="text-[11px] text-slate-400">{s.time_min ? `${s.time_min} Mins · ` : ''}{pts(s.id)} pts</p></div>
              <div className="flex flex-col"><button onClick={(e) => { e.stopPropagation(); moveSec(s, -1); }} disabled={i === 0} className="p-0.5 text-slate-300 hover:text-slate-600 disabled:opacity-30"><ArrowUp size={14} /></button>
                <button onClick={(e) => { e.stopPropagation(); moveSec(s, 1); }} disabled={i === list.length - 1} className="p-0.5 text-slate-300 hover:text-slate-600 disabled:opacity-30"><ArrowDown size={14} /></button></div>
            </div>
          ))}</div>
        </aside>
        <main className="lg:col-span-8 xl:col-span-9">
          {!cur ? <div className="bg-white rounded-4xl border-2 border-dashed border-slate-200 py-16 text-center text-slate-400">Add a section to start building the test.</div> : (
            <div className="bg-white rounded-4xl border border-slate-100 shadow-sm p-6">
              <div className="flex flex-wrap items-start gap-3 mb-5 pb-5 border-b border-slate-100">
                <div className="flex-1 min-w-48"><p className="text-[10px] font-black uppercase text-indigo-500">{cur.skill} · Default: {cur.scoring}</p><h2 className="text-xl font-extrabold text-slate-900">{cur.title}</h2>
                  {cur.description && <p className="text-sm text-slate-500 mt-1">{cur.description}</p>}
                  {cur.images.length > 0 && <div className="flex gap-2 mt-3">{cur.images.map((u) => <img key={u} src={u} alt="" className="h-16 rounded-lg border border-slate-100" />)}</div>}</div>
                <button onClick={() => setSecForm(cur)} className="p-2 text-slate-400 hover:text-blue-600"><SquarePen size={17} /></button>
                <button onClick={() => delSec(cur)} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={17} /></button>
              </div>
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2">Section Items</p>
              <div className="flex flex-wrap gap-2 mb-6">
                <button onClick={() => setInstr('')} className={btnGhost}><Info size={15} /> Add Instruction</button>
                <button onClick={() => newQ(null)} className={btnGhost}><Plus size={15} /> Add Standalone Question</button>
                <button onClick={() => setGForm({ section_id: cur.id, sort_order: curGroups.length + 1 })} className={btnGhost}><BookOpenText size={15} /> Add Passage Group</button>
              </div>

              {cur.instructions.length > 0 && <Block title="Instructions Group" count={cur.instructions.length}>
                {cur.instructions.map((s, i) => (
                  <div key={i} className="flex items-start gap-2 px-4 py-2.5 rounded-xl bg-sky-50/60 border border-sky-100 text-sm"><span className="flex-1">{s}</span>
                    <button onClick={() => saveInstructions(cur.instructions.filter((_, j) => j !== i))} className="p-1 text-slate-400 hover:text-red-500"><X size={14} /></button></div>
                ))}
              </Block>}

              {standalone.length > 0 && <Block title="Standalone Questions" count={standalone.length}>
                {standalone.map((q, i) => <QRow key={q.id} q={q} n={i + 1} onEdit={() => setQForm(q)} onDel={() => delQ(q)} />)}
              </Block>}

              {curGroups.map((g, gi) => {
                const gq = curQs.filter((q) => q.group_id === g.id);
                return (
                  <Block key={g.id} title={`Context Group ${gi + 1}${g.title ? ` · ${g.title}` : ''}`} count={gq.length}
                    actions={<><button onClick={() => setGForm(g)} className="p-1.5 text-slate-400 hover:text-blue-600"><SquarePen size={15} /></button><button onClick={() => delG(g)} className="p-1.5 text-slate-400 hover:text-red-500"><Trash2 size={15} /></button></>}>
                    <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 text-sm max-h-48 overflow-y-auto">
                      {g.image_url && <img src={g.image_url} alt="" className="max-h-40 rounded-lg mb-2" />}
                      {g.audio_url && <audio controls src={g.audio_url} className="w-full mb-2" />}
                      {g.passage ? <p className="whitespace-pre-line text-slate-700">{g.passage}</p> : <p className="text-slate-400">No passage text.</p>}
                    </div>
                    {gq.map((q, i) => <QRow key={q.id} q={q} n={i + 1} onEdit={() => setQForm(q)} onDel={() => delQ(q)} />)}
                    <button onClick={() => newQ(g.id)} className="text-xs font-bold text-orange-500 px-1">+ Add question to this passage</button>
                  </Block>
                );
              })}
              {!cur.instructions.length && !curQs.length && !curGroups.length && <p className="text-center text-slate-400 text-sm py-8">No questions or question groups added to this section yet.</p>}
            </div>
          )}
        </main>
      </div>
      {secForm && <SectionForm s={secForm} onClose={() => setSecForm(null)} onDone={(sid) => { setSecForm(null); setSel(sid); secs.reload(); }} />}
      {qForm && <QuestionForm q={qForm} onClose={() => setQForm(null)} onDone={() => { setQForm(null); qs.reload(); }} />}
      {gForm && <GroupForm g={gForm} testId={tid} onClose={() => setGForm(null)} onDone={() => { setGForm(null); groups.reload(); }} />}
      {instr !== null && cur && (
        <Modal open onClose={() => setInstr(null)} title="Add Instruction">
          <Field label="Instruction" hint="One instruction per line; each line becomes a separate item."><textarea rows={4} className={inputCls} value={instr} onChange={(e) => setInstr(e.target.value)} placeholder="Choose the ONE correct option (A, B, C or D) for each question." /></Field>
          <button onClick={async () => { const add = instr.split('\n').map((s) => s.trim()).filter(Boolean); if (!add.length) return; await saveInstructions([...cur.instructions, ...add]); setInstr(null); }} className={`${btnPrimary} w-full mt-4`}><Save size={16} /> Save</button>
        </Modal>
      )}
    </Page>
  );
}

function Block({ title, count, children, actions }: { title: string; count: number; children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-2"><p className="flex-1 text-[11px] font-black uppercase tracking-wider text-orange-500">{title}</p><span className="text-[11px] font-black text-slate-400 bg-slate-100 rounded-full px-2">{count}</span>{actions}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function QRow({ q, n, onEdit, onDel }: { q: Question; n: number; onEdit: () => void; onDel: () => void }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 rounded-2xl border border-slate-100 hover:border-slate-200">
      <span className="w-7 h-7 shrink-0 rounded-lg bg-slate-100 text-slate-500 grid place-items-center text-xs font-black">{n}</span>
      <div className="flex-1 min-w-0">
        {q.context && <p className="text-[11px] font-bold text-indigo-600 mb-0.5">Context: {q.context}</p>}
        <p className="text-sm font-semibold text-slate-800">{q.prompt}</p>
        <p className="text-[11px] text-slate-400 mt-0.5">{QTYPE_LABEL[q.qtype]} · {q.points} Pts{q.qtype === 'mcq' && q.options[q.correct_index] != null && <> · Answer: <b className="text-emerald-600">{String.fromCharCode(65 + q.correct_index)}) {q.options[q.correct_index]}</b></>}</p>
      </div>
      <button onClick={onEdit} className="p-1.5 text-slate-400 hover:text-blue-600"><SquarePen size={15} /></button>
      <button onClick={onDel} className="p-1.5 text-slate-400 hover:text-red-500"><Trash2 size={15} /></button>
    </div>
  );
}

function SectionForm({ s, onClose, onDone }: { s: Partial<Section>; onClose: () => void; onDone: (id: number) => void }) {
  const [f, setF] = useState({ title: s.title ?? '', time_min: s.time_min ? String(s.time_min) : '', skill: s.skill ?? 'reading', description: s.description ?? '', scoring: s.scoring ?? 'auto', images: s.images ?? [] });
  const [busy, setBusy] = useState(false);
  const [up, setUp] = useState(false);
  const addImages = async (files: FileList | null) => {
    if (!files?.length) return;
    setUp(true);
    const urls: string[] = [];
    for (const file of Array.from(files)) { const r = await uploadMedia(file, `placement/${s.test_id}`); if (r.error) toast.err(r.error); else urls.push(r.url!); }
    setUp(false);
    setF((p) => ({ ...p, images: [...p.images, ...urls] }));
  };
  const save = async () => {
    if (!f.title.trim()) return toast.err('Section title is required');
    setBusy(true);
    const row = { test_id: s.test_id, title: f.title.trim(), time_min: f.time_min ? Number(f.time_min) : null, skill: f.skill, description: f.description.trim() || null, scoring: f.scoring, images: f.images, sort_order: s.sort_order ?? 0 };
    const r = s.id ? await supabase.from('placement_sections').update(row).eq('id', s.id).select('id').single() : await supabase.from('placement_sections').insert({ ...row, instructions: [] }).select('id').single();
    setBusy(false);
    if (r.error) return toast.err(r.error.message);
    if (s.id) await supabase.from('placement_questions').update({ section: f.skill }).eq('section_id', s.id);
    toast.ok('Section saved'); onDone(r.data.id);
  };
  return (
    <Modal open onClose={onClose} title={s.id ? 'Edit Section' : 'Create New Section'} wide>
      <div className="space-y-4">
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2"><Field label="Section Title *"><input className={inputCls} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Section 2 — Questions 6–10 (Personal Email)" /></Field></div>
          <Field label="Min Limit"><input type="number" className={inputCls} value={f.time_min} onChange={(e) => setF({ ...f, time_min: e.target.value })} placeholder="10" /></Field>
        </div>
        <Field label="Skill Type"><div className="flex flex-wrap gap-2">{SKILLS.map((k) => <button type="button" key={k} onClick={() => setF({ ...f, skill: k })} className={`px-3.5 py-2 rounded-xl border text-sm font-bold capitalize ${f.skill === k ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-slate-200 text-slate-600'}`}>{k}</button>)}</div></Field>
        <Field label="Section Description (Optional)"><textarea rows={2} className={inputCls} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <Field label="Default Section Scoring" hint="Auto-score: new questions are multiple choice and marked automatically. Manual: new questions are written answers marked by staff.">
          <div className="flex gap-2">{([['auto', 'Auto-score'], ['manual', 'Manual Score']] as const).map(([v, l]) => <button type="button" key={v} onClick={() => setF({ ...f, scoring: v })} className={`px-4 py-2.5 rounded-xl border text-sm font-bold ${f.scoring === v ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-slate-200 text-slate-600'}`}>{l}</button>)}</div>
        </Field>
        <Field label="Reference Images">
          <div className="flex flex-wrap gap-2 items-center">
            {f.images.map((u) => <div key={u} className="relative"><img src={u} alt="" className="h-20 rounded-xl border border-slate-200" /><button type="button" onClick={() => setF({ ...f, images: f.images.filter((x) => x !== u) })} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white grid place-items-center"><X size={12} /></button></div>)}
            <label className="h-20 px-4 rounded-xl border-2 border-dashed border-slate-300 grid place-items-center text-xs font-bold text-slate-500 cursor-pointer hover:border-orange-400">
              {up ? <Loader2 size={18} className="animate-spin" /> : <span className="flex items-center gap-1"><ImagePlus size={16} />Add Images</span>}
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => addImages(e.target.files)} />
            </label>
          </div>
        </Field>
        <div className="flex gap-2 justify-end"><button onClick={onClose} className={btnGhost}>Cancel</button><button disabled={busy || up} onClick={save} className={btnPrimary}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save Section</button></div>
      </div>
    </Modal>
  );
}

function GroupForm({ g, testId, onClose, onDone }: { g: Partial<Group>; testId: number; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ title: g.title ?? '', passage: g.passage ?? '', audio_url: g.audio_url ?? '', image_url: g.image_url ?? '' });
  const [busy, setBusy] = useState(false);
  const [up, setUp] = useState<string | null>(null);
  const upload = async (k: 'audio_url' | 'image_url', file?: File) => {
    if (!file) return; setUp(k);
    const r = await uploadMedia(file, `placement/${testId}`); setUp(null);
    if (r.error) toast.err(r.error); else setF((p) => ({ ...p, [k]: r.url! }));
  };
  const save = async () => {
    if (!f.passage.trim() && !f.audio_url && !f.image_url) return toast.err('Add the passage text, an audio file or an image.');
    setBusy(true);
    const row = { section_id: g.section_id, title: f.title.trim() || null, passage: f.passage.trim() || null, audio_url: f.audio_url || null, image_url: f.image_url || null, sort_order: g.sort_order ?? 0 };
    const { error } = g.id ? await supabase.from('placement_groups').update(row).eq('id', g.id) : await supabase.from('placement_groups').insert(row);
    setBusy(false);
    if (error) toast.err(error.message); else { toast.ok('Passage saved'); onDone(); }
  };
  return (
    <Modal open onClose={onClose} title={g.id ? 'Edit Passage Group' : 'Add Passage Group'} wide>
      <div className="space-y-4">
        <Field label="Title (optional)"><input className={inputCls} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Local Library to Host Free Reading Festival" /></Field>
        <Field label="Passage" hint="Students read this once and answer all the questions under it."><textarea rows={10} className={inputCls} value={f.passage} onChange={(e) => setF({ ...f, passage: e.target.value })} /></Field>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Audio (listening)"><div className="flex gap-2"><input className={inputCls} value={f.audio_url} onChange={(e) => setF({ ...f, audio_url: e.target.value })} placeholder="https://… .mp3" />
            <label className="px-3 grid place-items-center rounded-xl border border-slate-200 cursor-pointer">{up === 'audio_url' ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}<input type="file" accept="audio/*" className="hidden" onChange={(e) => upload('audio_url', e.target.files?.[0])} /></label></div></Field>
          <Field label="Image"><div className="flex gap-2"><input className={inputCls} value={f.image_url} onChange={(e) => setF({ ...f, image_url: e.target.value })} placeholder="https://…" />
            <label className="px-3 grid place-items-center rounded-xl border border-slate-200 cursor-pointer">{up === 'image_url' ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}<input type="file" accept="image/*" className="hidden" onChange={(e) => upload('image_url', e.target.files?.[0])} /></label></div></Field>
        </div>
        <div className="flex gap-2 justify-end"><button onClick={onClose} className={btnGhost}>Cancel</button><button disabled={busy || !!up} onClick={save} className={btnPrimary}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save</button></div>
      </div>
    </Modal>
  );
}

function QuestionForm({ q, onClose, onDone }: { q: Partial<Question>; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ qtype: q.qtype ?? 'mcq', context: q.context ?? '', prompt: q.prompt ?? '', options: q.options?.length ? q.options : ['', '', '', ''], correct_index: q.correct_index ?? 0, points: String(q.points ?? 1) });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const opts = f.options.map((o) => o.trim()).filter(Boolean);
    if (!f.prompt.trim()) return toast.err('Write the question.');
    if (f.qtype === 'mcq' && opts.length < 2) return toast.err('Write the question and at least two options.');
    if (f.qtype === 'mcq' && f.correct_index >= opts.length) return toast.err('Choose which option is correct.');
    if (!(Number(f.points) > 0)) return toast.err('Points must be more than 0.');
    setBusy(true);
    const row = { test_id: q.test_id, section_id: q.section_id, section: q.section, group_id: q.group_id ?? null, qtype: f.qtype, context: f.context.trim() || null, prompt: f.prompt.trim(),
      options: f.qtype === 'mcq' ? opts : [], correct_index: f.qtype === 'mcq' ? f.correct_index : 0, points: Number(f.points), sort_order: q.sort_order ?? 0 };
    const { error } = q.id ? await supabase.from('placement_questions').update(row).eq('id', q.id) : await supabase.from('placement_questions').insert(row);
    setBusy(false);
    if (error) toast.err(error.message); else { toast.ok('Question saved'); onDone(); }
  };
  return (
    <Modal open onClose={onClose} title={q.id ? 'Edit Question' : q.group_id ? 'Add Question to Passage' : 'Add Standalone Question'} wide>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2"><Field label="Question type"><div className="flex flex-wrap gap-2">{(['mcq', 'short', 'long'] as const).map((k) => <button type="button" key={k} onClick={() => setF({ ...f, qtype: k })} className={`px-3 py-2 rounded-xl border text-xs font-bold ${f.qtype === k ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-slate-200 text-slate-600'}`}>{QTYPE_LABEL[k]}</button>)}</div></Field></div>
          <Field label="Points"><input type="number" className={inputCls} value={f.points} onChange={(e) => setF({ ...f, points: e.target.value })} /></Field>
        </div>
        {!q.group_id && <Field label="Question-specific context (optional)" hint="A short notice, sign or sentence shown above this question only."><input className={inputCls} value={f.context} onChange={(e) => setF({ ...f, context: e.target.value })} placeholder="e.g. NO PARKING AT ANY TIME" /></Field>}
        <Field label="Question"><textarea rows={2} className={inputCls} value={f.prompt} onChange={(e) => setF({ ...f, prompt: e.target.value })} placeholder="She ___ a teacher." /></Field>
        {f.qtype === 'mcq' ? (
          <Field label="Options — tick the correct one">
            <div className="space-y-2">{f.options.map((o, i) => (
              <div key={i} className="flex items-center gap-2"><input type="radio" checked={f.correct_index === i} onChange={() => setF({ ...f, correct_index: i })} className="accent-emerald-600 w-4 h-4" />
                <span className="font-black text-slate-400 w-4">{String.fromCharCode(65 + i)}</span><input className={inputCls} value={o} onChange={(e) => { const op = [...f.options]; op[i] = e.target.value; setF({ ...f, options: op }); }} />
                {f.options.length > 2 && <button type="button" onClick={() => setF({ ...f, options: f.options.filter((_, j) => j !== i), correct_index: f.correct_index >= i && f.correct_index > 0 ? f.correct_index - (f.correct_index === i ? 0 : 1) : f.correct_index })} className="p-1 text-slate-300 hover:text-red-500"><X size={14} /></button>}</div>
            ))}{f.options.length < 6 && <button type="button" onClick={() => setF({ ...f, options: [...f.options, ''] })} className="text-xs font-bold text-orange-500">+ Add option</button>}</div>
          </Field>
        ) : <p className="text-xs text-slate-500 p-3 rounded-xl bg-amber-50 border border-amber-100">Students type their answer. Staff mark it under “Placement Results” (0 to {f.points || 1} points).</p>}
        <div className="flex gap-2 justify-end"><button onClick={onClose} className={btnGhost}>Cancel</button><button disabled={busy} onClick={save} className={btnPrimary}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save Question</button></div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- details (preview with answers)
export function TestDetails() {
  const { id } = useParams();
  const tid = Number(id);
  const user = useAuth((s) => s.user)!;
  const nav = useNavigate();
  const { test, secs, groups, qs, loading } = useTestContent(tid);
  const total = useMemo(() => (qs.data ?? []).reduce((a, q) => a + q.points, 0), [qs.data]);
  if (loading && !test.data) return <Spinner />;
  if (!test.data) return <Page><p className="text-center text-slate-400 py-16">Test not found.</p></Page>;
  const t = test.data;
  const share = async () => {
    const link = `${location.origin}${import.meta.env.BASE_URL}student/assessments`;
    try { await navigator.clipboard.writeText(link); toast.ok('Student link copied'); } catch { toast.ok(link); }
  };
  let qn = 0;
  const QView = ({ q }: { q: Question }) => { qn += 1; return (
    <div className="py-3 border-b border-slate-50 last:border-0">
      {q.context && <div className="mb-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-100 text-xs font-bold text-amber-800">Question-Specific Context: {q.context}</div>}
      <div className="flex gap-2"><p className="flex-1 font-semibold text-slate-800">Q{qn}. {q.prompt}</p><span className="text-[11px] text-slate-400 whitespace-nowrap">{QTYPE_LABEL[q.qtype]} · {q.qtype === 'mcq' ? 'auto' : 'manual'} · {q.points} Pts</span></div>
      {q.qtype === 'mcq' && <div className="grid sm:grid-cols-2 gap-1.5 mt-2">{q.options.map((o, i) => <span key={i} className={`px-3 py-1.5 rounded-lg text-sm border ${i === q.correct_index ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-bold' : 'border-slate-100 text-slate-600'}`}>{String.fromCharCode(65 + i)}) {o} {i === q.correct_index && <span className="text-[10px] uppercase">· Correct Answer</span>}</span>)}</div>}
    </div>
  ); };
  return (
    <Page>
      {user.demo && <DemoNotice />}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <button onClick={() => nav(base(user.role))} className="w-10 h-10 rounded-full bg-white border border-slate-200 grid place-items-center"><ArrowLeft size={18} /></button>
        <div className="flex-1 min-w-48"><h1 className="text-2xl font-extrabold text-slate-900">{t.title}</h1><p className="text-xs font-bold text-slate-500">{t.course?.title ?? '—'} · Version: {t.version ?? '—'} · {testCode(t.id)}</p></div>
        <button onClick={share} className={btnGhost}><Share2 size={16} /> Share</button>
        <button onClick={() => nav(`${base(user.role)}/${t.id}/manage`)} className={btnPrimary}><PenLine size={16} /> Manage Sections</button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[{ i: Clock, l: 'Time Limit', v: `${t.duration_min} Mins` }, { i: CheckCircle2, l: 'Total Score', v: `${total} Points` }, { i: Layers, l: 'Sections', v: String(secs.data?.length ?? 0) }, { i: FileText, l: 'Created By', v: t.creator?.full_name ?? '—' }].map(({ i: I, l, v }) => (
          <div key={l} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4"><p className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1"><I size={12} />{l}</p><p className="text-lg font-extrabold text-slate-900 mt-1">{v}</p></div>
        ))}
      </div>
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 mb-6 text-sm">
        <div className="flex flex-wrap gap-2 mb-2"><StatusPill status={t.is_active ? 'active' : 'inactive'} /><StatusPill status={t.approval} />
          <span className="text-xs font-bold text-slate-500 uppercase">{t.category} Assessment · {CONFIG_LABEL[t.config]}{t.config !== 'written' && <Mic size={12} className="inline ml-1" />}</span>
          <span className="text-xs text-slate-400">Created: {fmtDate(t.created_at)}</span></div>
        <p className="text-slate-600">{t.description || 'No description provided.'}</p>
      </div>
      {(secs.data ?? []).map((s, si) => {
        const sq = (qs.data ?? []).filter((q) => q.section_id === s.id);
        const sg = (groups.data ?? []).filter((g) => g.section_id === s.id);
        return (
          <div key={s.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 mb-5">
            <div className="flex items-start gap-3 mb-3"><span className="w-9 h-9 rounded-xl bg-indigo-600 text-white grid place-items-center font-black">{si + 1}</span>
              <div className="flex-1"><h2 className="font-extrabold text-slate-900">{s.title}</h2><p className="text-[11px] font-bold uppercase text-slate-400">{s.skill} section · Default: {s.scoring}{s.time_min ? ` · ${s.time_min} Mins` : ''}</p></div>
              <span className="text-sm font-black text-slate-700">{sq.reduce((a, q) => a + q.points, 0)} Pts</span></div>
            {s.description && <p className="text-sm text-slate-500 mb-3">{s.description}</p>}
            {s.images.length > 0 && <div className="flex flex-wrap gap-2 mb-3">{s.images.map((u) => <img key={u} src={u} alt="" className="max-h-40 rounded-xl border" />)}</div>}
            {s.instructions.length > 0 && <ul className="mb-3 p-4 rounded-2xl bg-sky-50/60 border border-sky-100 text-sm list-disc pl-8 space-y-1">{s.instructions.map((x, i) => <li key={i}>{x}</li>)}</ul>}
            {sq.filter((q) => !q.group_id).map((q) => <QView key={q.id} q={q} />)}
            {sg.map((g, gi) => (
              <div key={g.id} className="mt-3">
                <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 text-sm mb-1">
                  <p className="text-[10px] font-black uppercase text-indigo-500 mb-1">Context Group {gi + 1}{g.title ? ` · ${g.title}` : ''}</p>
                  {g.image_url && <img src={g.image_url} alt="" className="max-h-48 rounded-lg mb-2" />}{g.audio_url && <audio controls src={g.audio_url} className="w-full mb-2" />}
                  {g.passage && <RichText text={g.passage} />}
                </div>
                {sq.filter((q) => q.group_id === g.id).map((q) => <QView key={q.id} q={q} />)}
              </div>
            ))}
            {!sq.length && <p className="text-sm text-slate-400">No questions or question groups added to this section yet.</p>}
          </div>
        );
      })}
    </Page>
  );
}
