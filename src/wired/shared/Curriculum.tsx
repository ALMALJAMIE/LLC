import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowDown, ArrowLeft, ArrowUp, BookOpen, ClipboardList, Eye, FileAudio, FileImage, FileQuestion, FileSpreadsheet, FileText, FileType2, FileVideo,
  Layers, Loader2, Plus, Presentation, Save, Send, SquarePen, Trash2, Upload, X,
} from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { isAcademicLead } from '../../lib/nav';
import { supabase } from '../../lib/supabase';
import { fmtDateTime, useData } from '../../lib/db';
import { uploadMedia } from '../../lib/media';
import { DemoNotice, Field, Modal, Page, PageHero, SearchInput, Spinner, StatusPill, btnGhost, btnPrimary, inputCls, toast } from '../../components/ui';
import { LessonView, type LessonKind, type QuizQ } from './LessonView';

export type Lesson = {
  id: number; unit_id: number; title: string; content: string | null; video_url: string | null; resource_url: string | null; duration_min: number | null;
  sort_order: number; status: string; review_note: string | null; created_by: string | null; kind: LessonKind; file_url: string | null; quiz: QuizQ[];
};
export type Unit = { id: number; course_id: number; title: string; sort_order: number; summary: string | null; topics: string[]; pages: string | null; lessons: Lesson[] };
type Course = { id: number; title: string; code: string; course_units: { count: number }[] };

export const KINDS: { k: LessonKind; label: string; icon: typeof FileText; accept?: string }[] = [
  { k: 'text', label: 'Text', icon: FileText }, { k: 'video', label: 'Video', icon: FileVideo, accept: 'video/*' },
  { k: 'image', label: 'Image', icon: FileImage, accept: 'image/*' }, { k: 'audio', label: 'Audio', icon: FileAudio, accept: 'audio/*' },
  { k: 'pdf', label: 'PDF', icon: FileType2, accept: 'application/pdf' },
  { k: 'pptx', label: 'PPTX', icon: Presentation, accept: '.ppt,.pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation' },
  { k: 'docx', label: 'DOCX', icon: FileSpreadsheet, accept: '.doc,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  { k: 'quiz', label: 'Quiz', icon: FileQuestion },
];
export const kindIcon = (k: LessonKind) => KINDS.find((x) => x.k === k)?.icon ?? FileText;
const root = (role: string) => (isAcademicLead(role as never) ? '/admin-curriculum' : '/instructor/lessons');
const sortUnits = (u: Unit[] | null) => (u ?? []).map((x) => ({ ...x, topics: x.topics ?? [], lessons: [...(x.lessons ?? [])].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id) }));

/** Courses the user may build: all for admin / academic, the ones they teach for instructors. */
function useMyCourses() {
  const user = useAuth((s) => s.user)!;
  const lead = isAcademicLead(user.role);
  return useData<Course[]>(async () => {
    if (lead) return supabase.from('courses').select('id,title,code, course_units(count)').order('code');
    const b = await supabase.from('batches').select('course:courses(id,title,code, course_units(count))').eq('instructor_id', user.id);
    const m = new Map<number, Course>();
    ((b.data ?? []) as unknown as { course: Course | null }[]).forEach((x) => x.course && m.set(x.course.id, x.course));
    return { data: [...m.values()].sort((a, b) => a.code.localeCompare(b.code)), error: b.error };
  });
}

// ---------------------------------------------------------------- course list
export function CurriculumList() {
  const user = useAuth((s) => s.user)!;
  const lead = isAcademicLead(user.role);
  const nav = useNavigate();
  const courses = useMyCourses();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const list = (courses.data ?? []).filter((c) => `${c.code} ${c.title}`.toLowerCase().includes(q.toLowerCase()));
  const per = 9, pages = Math.max(1, Math.ceil(list.length / per));
  const rows = list.slice((page - 1) * per, page * per);
  return (
    <Page wide>
      {user.demo && <DemoNotice />}
      <PageHero badge="Content Management" badgeColor="indigo" title={lead ? 'Course Curriculum' : 'Lessons'} illus="curriculum"
        subtitle={lead ? 'Structure your courses. Select a course below to view its details or open the curriculum builder.' : 'Prepare content for the courses you teach. What you add goes to the academic team for approval.'}>
        <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search your courses..." />
      </PageHero>
      {courses.loading ? <Spinner /> : !rows.length ? <p className="text-center text-slate-400 py-12">{courses.data?.length ? 'No courses match your search.' : lead ? 'No courses yet.' : 'No courses assigned to you yet.'}</p> : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">{rows.map((c) => (
          <div key={c.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 flex flex-col">
            <span className="self-start text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100">{c.code}</span>
            <h3 className="text-lg font-extrabold text-slate-900 mt-3 flex-1">{c.title}</h3>
            <p className="text-xs font-bold text-slate-400 flex items-center gap-1 mt-2"><Layers size={13} />{c.course_units?.[0]?.count ?? 0} Modules</p>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <button onClick={() => nav(`${root(user.role)}/${c.id}/view`)} className="py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold flex items-center justify-center gap-1"><Eye size={14} />Preview</button>
              <button onClick={() => nav(`${root(user.role)}/${c.id}/edit`)} className="py-2.5 rounded-xl bg-slate-900 hover:bg-orange-500 text-white text-xs font-bold flex items-center justify-center gap-1"><SquarePen size={14} />Builder</button>
            </div>
          </div>
        ))}</div>
      )}
      {pages > 1 && <div className="flex justify-center gap-2 mt-8">{Array.from({ length: pages }, (_, i) => i + 1).map((p) => <button key={p} onClick={() => setPage(p)} className={`w-9 h-9 rounded-xl text-sm font-bold ${p === page ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>{p}</button>)}</div>}
    </Page>
  );
}

function useCourseContent(cid: number) {
  const course = useData<{ id: number; title: string; code: string }>(() => supabase.from('courses').select('id,title,code').eq('id', cid).maybeSingle(), [cid]);
  const units = useData<Unit[]>(() => supabase.from('course_units').select('*, lessons(*)').eq('course_id', cid).order('sort_order').order('id'), [cid]);
  return { course, units, sorted: useMemo(() => sortUnits(units.data), [units.data]) };
}

// ---------------------------------------------------------------- builder
export function CurriculumBuilder() {
  const { id } = useParams();
  const cid = Number(id);
  const user = useAuth((s) => s.user)!;
  const lead = isAcademicLead(user.role);
  const nav = useNavigate();
  const { course, units, sorted } = useCourseContent(cid);
  const [sel, setSel] = useState<number | null>(null);
  const [tab, setTab] = useState<'content' | 'reports'>('content');
  const [edit, setEdit] = useState<Partial<Lesson> | null>(null);
  const [view, setView] = useState<Lesson | null>(null);
  const cur = sorted.find((u) => u.id === sel) ?? sorted[0];

  const addModule = async () => {
    const title = prompt('Module name (e.g. BIG QUESTION 1: Why do we protect animals?):'); if (!title?.trim()) return;
    const { data, error } = await supabase.from('course_units').insert({ course_id: cid, title: title.trim(), sort_order: sorted.length + 1 }).select('id').single();
    if (error) toast.err(error.message); else { await units.reload(); setSel(data.id); }
  };
  const move = async (u: Unit, dir: -1 | 1) => {
    const i = sorted.findIndex((x) => x.id === u.id); const o = sorted[i + dir]; if (!o) return;
    await supabase.from('course_units').update({ sort_order: i + 1 + dir }).eq('id', u.id);
    await supabase.from('course_units').update({ sort_order: i + 1 }).eq('id', o.id);
    units.reload();
  };
  const delModule = async (u: Unit) => {
    if (!confirm(`Delete "${u.title}" and its ${u.lessons.length} content elements?`)) return;
    const { error } = await supabase.from('course_units').delete().eq('id', u.id); if (error) toast.err(error.message); else { setSel(null); units.reload(); }
  };
  const moveEl = async (l: Lesson, dir: -1 | 1) => {
    const ls = cur!.lessons; const i = ls.findIndex((x) => x.id === l.id); const o = ls[i + dir]; if (!o) return;
    await supabase.from('lessons').update({ sort_order: i + 1 + dir }).eq('id', l.id);
    await supabase.from('lessons').update({ sort_order: i + 1 }).eq('id', o.id);
    units.reload();
  };
  const delEl = async (l: Lesson) => {
    if (!confirm(`Delete "${l.title}"?`)) return;
    const { error } = await supabase.from('lessons').delete().eq('id', l.id); if (error) toast.err(error.message); else units.reload();
  };

  if (units.loading && !units.data) return <Spinner />;
  return (
    <Page wide>
      {user.demo && <DemoNotice />}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <button onClick={() => nav(root(user.role))} className="w-10 h-10 rounded-full bg-white border border-slate-200 grid place-items-center"><ArrowLeft size={18} /></button>
        <div className="flex-1 min-w-48"><p className="text-[10px] font-black uppercase text-orange-500">Editing Mode</p><h1 className="text-2xl font-extrabold text-slate-900">{course.data?.title} <span className="text-sm font-mono text-slate-400">{course.data?.code}</span></h1></div>
        <div className="inline-flex bg-slate-50 p-1 rounded-xl border border-slate-200">
          <button onClick={() => setTab('content')} className={`px-4 py-2 rounded-lg text-xs font-bold ${tab === 'content' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>Module & Content Editing</button>
          <button onClick={() => setTab('reports')} className={`px-4 py-2 rounded-lg text-xs font-bold ${tab === 'reports' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>Quiz Reports</button>
        </div>
        <button onClick={() => nav(`${root(user.role)}/${cid}/view`)} className={btnGhost}><Eye size={16} /> Preview</button>
      </div>
      {tab === 'reports' ? <QuizReports cid={cid} /> : (
        <div className="grid lg:grid-cols-12 gap-6">
          <aside className="lg:col-span-4 xl:col-span-3 bg-white rounded-3xl border border-slate-100 shadow-sm p-4 h-fit">
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-500 px-1 mb-3">Content Modules ({sorted.length})</p>
            <div className="space-y-1.5">{sorted.map((u, i) => (
              <div key={u.id} onClick={() => setSel(u.id)} className={`flex items-center gap-2 p-3 rounded-2xl border cursor-pointer ${cur?.id === u.id ? 'border-orange-300 bg-orange-50' : 'border-slate-100 hover:bg-slate-50'}`}>
                <span className="w-7 h-7 shrink-0 rounded-lg bg-indigo-600 text-white grid place-items-center text-xs font-black">{i + 1}</span>
                <div className="flex-1 min-w-0"><p className="text-sm font-bold text-slate-800 leading-snug">{u.title}</p>{u.pages && <p className="text-[11px] text-slate-400">{u.pages}</p>}<p className="text-[11px] text-slate-400">{u.lessons.length} elements</p></div>
                <div className="flex flex-col"><button onClick={(e) => { e.stopPropagation(); move(u, -1); }} disabled={i === 0} className="p-0.5 text-slate-300 hover:text-slate-600 disabled:opacity-30"><ArrowUp size={14} /></button>
                  <button onClick={(e) => { e.stopPropagation(); move(u, 1); }} disabled={i === sorted.length - 1} className="p-0.5 text-slate-300 hover:text-slate-600 disabled:opacity-30"><ArrowDown size={14} /></button></div>
              </div>
            ))}</div>
            {lead && <button onClick={addModule} className="w-full mt-3 py-2.5 rounded-xl border-2 border-dashed border-slate-200 text-sm font-bold text-orange-500 hover:border-orange-300 flex items-center justify-center gap-1"><Plus size={15} />Add Module</button>}
          </aside>
          <main className="lg:col-span-8 xl:col-span-9 space-y-6">
            {!cur ? <div className="bg-white rounded-4xl border-2 border-dashed border-slate-200 py-16 text-center text-slate-400">{lead ? 'No modules yet. Start with “Add Module”.' : 'The academic team has not added modules to this course yet.'}</div> : <>
              <ModuleIdentity key={cur.id} unit={cur} canEdit={lead} onSaved={units.reload} onDelete={() => delModule(cur)} />
              <div className="bg-white rounded-4xl border border-slate-100 shadow-sm p-6">
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-3">Content Elements · {cur.lessons.length}</p>
                <div className="flex flex-wrap gap-2 mb-5">{KINDS.map(({ k, label }) => (
                  <button key={k} onClick={() => setEdit({ unit_id: cur.id, kind: k, sort_order: cur.lessons.length + 1, quiz: [] })} className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-black text-slate-600 hover:border-orange-300 hover:text-orange-600">+ {label.toUpperCase()}</button>
                ))}</div>
                {!cur.lessons.length && <p className="text-center text-slate-400 text-sm py-8">No content in this module yet. Use the buttons above to add text, videos, files or a quiz.</p>}
                <div className="divide-y divide-slate-50">{cur.lessons.map((l, i) => {
                  const I = kindIcon(l.kind);
                  return (
                    <div key={l.id} className="flex flex-wrap items-center gap-3 py-3">
                      <span className="w-9 h-9 rounded-xl bg-slate-100 text-slate-500 grid place-items-center"><I size={16} /></span>
                      <div className="flex-1 min-w-40"><p className="font-semibold text-slate-800">{l.title}</p><p className="text-[11px] uppercase font-bold text-slate-400">{l.kind}{l.kind === 'quiz' ? ` · ${l.quiz?.length ?? 0} questions` : ''}{l.duration_min ? ` · ${l.duration_min} min` : ''}</p>
                        {l.review_note && l.status === 'rejected' && <p className="text-[11px] text-red-500">{l.review_note}</p>}</div>
                      <StatusPill status={l.status} />
                      <button onClick={() => moveEl(l, -1)} disabled={i === 0} className="p-1.5 text-slate-300 hover:text-slate-600 disabled:opacity-30"><ArrowUp size={15} /></button>
                      <button onClick={() => moveEl(l, 1)} disabled={i === cur.lessons.length - 1} className="p-1.5 text-slate-300 hover:text-slate-600 disabled:opacity-30"><ArrowDown size={15} /></button>
                      <button onClick={() => setView(l)} className="p-1.5 text-slate-400 hover:text-indigo-600"><Eye size={16} /></button>
                      {(lead || l.created_by === user.id) && <><button onClick={() => setEdit(l)} className="p-1.5 text-slate-400 hover:text-blue-600"><SquarePen size={16} /></button>
                        <button onClick={() => delEl(l)} className="p-1.5 text-slate-400 hover:text-red-500"><Trash2 size={16} /></button></>}
                    </div>
                  );
                })}</div>
              </div>
            </>}
          </main>
        </div>
      )}
      {edit && <ElementForm el={edit} courseId={cid} onClose={() => setEdit(null)} onDone={() => { setEdit(null); units.reload(); }} />}
      {view && <ElementPreview l={view} onClose={() => setView(null)} />}
    </Page>
  );
}

function ModuleIdentity({ unit, canEdit, onSaved, onDelete }: { unit: Unit; canEdit: boolean; onSaved: () => void; onDelete: () => void }) {
  const [f, setF] = useState({ title: unit.title, summary: unit.summary ?? '', pages: unit.pages ?? '', topics: unit.topics ?? [] });
  const [topic, setTopic] = useState('');
  const [busy, setBusy] = useState(false);
  const dirty = f.title !== unit.title || f.summary !== (unit.summary ?? '') || f.pages !== (unit.pages ?? '') || JSON.stringify(f.topics) !== JSON.stringify(unit.topics ?? []);
  const save = async () => {
    if (!f.title.trim()) return toast.err('Module name is required');
    setBusy(true);
    const { error } = await supabase.from('course_units').update({ title: f.title.trim(), summary: f.summary.trim() || null, pages: f.pages.trim() || null, topics: f.topics }).eq('id', unit.id);
    setBusy(false);
    if (error) toast.err(error.message); else { toast.ok('Module saved'); onSaved(); }
  };
  const addTopic = () => { const t = topic.trim(); if (!t) return; setF({ ...f, topics: [...f.topics, t] }); setTopic(''); };
  return (
    <div className="bg-white rounded-4xl border border-slate-100 shadow-sm p-6">
      <div className="flex items-center gap-2 mb-4"><p className="flex-1 text-[11px] font-black uppercase tracking-wider text-slate-500">Module Identity</p>
        {canEdit && <button onClick={onDelete} className="p-1.5 text-slate-400 hover:text-red-500" title="Delete module"><Trash2 size={16} /></button>}</div>
      <fieldset disabled={!canEdit} className="space-y-4">
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2"><Field label={`Module Name · ${f.title.length} / 255`}><input maxLength={255} className={inputCls} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field></div>
          <Field label="Book units / pages"><input className={inputCls} value={f.pages} onChange={(e) => setF({ ...f, pages: e.target.value })} placeholder="Unit 1 - Unit 2 · 1.02-1.15" /></Field>
        </div>
        <Field label="Summary"><textarea rows={3} className={inputCls} value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} placeholder="What students learn in this module." /></Field>
        <Field label="Syllabus Topics">
          <div className="flex flex-wrap gap-2 mb-2">{f.topics.map((t, i) => <span key={i} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100">{t}{canEdit && <button type="button" onClick={() => setF({ ...f, topics: f.topics.filter((_, j) => j !== i) })}><X size={12} /></button>}</span>)}
            {!f.topics.length && <span className="text-xs text-slate-400">No topics yet.</span>}</div>
          {canEdit && <div className="flex gap-2"><input className={inputCls} value={topic} onChange={(e) => setTopic(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTopic(); } }} placeholder="e.g. Present perfect continuous" />
            <button type="button" onClick={addTopic} className={btnGhost}><Plus size={15} />Add Topic</button></div>}
        </Field>
      </fieldset>
      {canEdit && <button disabled={busy || !dirty} onClick={save} className={`${btnPrimary} mt-4`}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save Module</button>}
    </div>
  );
}

function ElementPreview({ l, onClose }: { l: Lesson; onClose: () => void }) {
  const keys = useData<{ keys: number[] }>(() => supabase.from('lesson_quiz_keys').select('keys').eq('lesson_id', l.id).maybeSingle(), [l.id]);
  return <Modal open onClose={onClose} title={l.title} wide><LessonView lesson={l} quizKeys={keys.data?.keys} /></Modal>;
}

type QEdit = { prompt: string; options: string[]; correct: number };
function ElementForm({ el, courseId, onClose, onDone }: { el: Partial<Lesson>; courseId: number; onClose: () => void; onDone: () => void }) {
  const user = useAuth((s) => s.user)!;
  const lead = isAcademicLead(user.role);
  const kind = el.kind ?? 'text';
  const meta = KINDS.find((x) => x.k === kind)!;
  const [f, setF] = useState({ title: el.title ?? '', content: el.content ?? '', video_url: el.video_url ?? '', file_url: el.file_url ?? '', resource_url: el.resource_url ?? '', duration_min: el.duration_min ? String(el.duration_min) : '' });
  const [quiz, setQuiz] = useState<QEdit[]>(() => (el.quiz ?? []).map((q) => ({ ...q, correct: 0 })));
  const [keysLoaded, setKeysLoaded] = useState(!el.id || kind !== 'quiz');
  const [busy, setBusy] = useState(false);
  const [up, setUp] = useState(false);
  const [preview, setPreview] = useState(false);
  if (!keysLoaded) {
    supabase.from('lesson_quiz_keys').select('keys').eq('lesson_id', el.id!).maybeSingle().then(({ data }) => {
      const k = (data?.keys as number[] | undefined) ?? [];
      setQuiz((qs) => qs.map((q, i) => ({ ...q, correct: k[i] ?? 0 })));
      setKeysLoaded(true);
    });
  }
  const upload = async (file?: File) => {
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) return toast.err('The file is larger than 50 MB.');
    setUp(true);
    const r = await uploadMedia(file, `courses/${courseId}`);
    setUp(false);
    if (r.error) toast.err(r.error); else { setF((p) => ({ ...p, file_url: r.url! })); toast.ok('File uploaded'); }
  };
  const save = async (status: string) => {
    if (!f.title.trim()) return toast.err('Title is required');
    if (kind === 'text' && !f.content.trim()) return toast.err('Write the text.');
    if (kind === 'video' && !f.video_url.trim() && !f.file_url) return toast.err('Add a video link or upload a video.');
    if (['image', 'audio', 'pdf', 'pptx', 'docx'].includes(kind) && !f.file_url) return toast.err('Upload the file or paste its link.');
    const qClean = quiz.map((q) => ({ ...q, prompt: q.prompt.trim(), options: q.options.map((o) => o.trim()) }));
    if (kind === 'quiz') {
      if (!qClean.length) return toast.err('Add at least one question.');
      for (const [i, q] of qClean.entries()) {
        const opts = q.options.filter(Boolean);
        if (!q.prompt || opts.length < 2) return toast.err(`Question ${i + 1}: write the question and at least two options.`);
        if (!q.options[q.correct]) return toast.err(`Question ${i + 1}: choose the correct option.`);
      }
    }
    setBusy(true);
    // drop empty options while keeping the correct index pointing at the same option
    const quizRows = qClean.map((q) => { const kept = q.options.map((o, i) => ({ o, i })).filter((x) => x.o); return { prompt: q.prompt, options: kept.map((x) => x.o), correct: kept.findIndex((x) => x.i === q.correct) }; });
    const row = {
      unit_id: el.unit_id, title: f.title.trim(), kind, content: f.content.trim() || null, video_url: kind === 'video' ? f.video_url.trim() || null : null,
      file_url: kind === 'text' || kind === 'quiz' ? null : f.file_url || null, resource_url: f.resource_url.trim() || null, duration_min: f.duration_min ? Number(f.duration_min) : null,
      quiz: kind === 'quiz' ? quizRows.map(({ prompt, options }) => ({ prompt, options })) : [], status, sort_order: el.sort_order ?? 1, ...(el.id ? {} : { created_by: user.id }),
    };
    const r = el.id ? await supabase.from('lessons').update(row).eq('id', el.id).select('id').single() : await supabase.from('lessons').insert(row).select('id').single();
    if (!r.error && kind === 'quiz') {
      const k = await supabase.from('lesson_quiz_keys').upsert({ lesson_id: r.data.id, keys: quizRows.map((q) => q.correct) });
      if (k.error) { setBusy(false); return toast.err(k.error.message); }
    }
    setBusy(false);
    if (r.error) toast.err(r.error.message); else { toast.ok(status === 'approved' ? 'Published' : status === 'pending' ? 'Sent for approval' : 'Draft saved'); onDone(); }
  };
  const draft = { ...el, ...f, kind, duration_min: f.duration_min ? Number(f.duration_min) : null, quiz: quiz.map(({ prompt, options }) => ({ prompt, options })) } as Lesson;
  return (
    <Modal open onClose={onClose} title={`${el.id ? 'Edit' : 'Add'} ${meta.label}${kind === 'quiz' ? '' : ' element'}`} wide>
      {preview ? <><LessonView lesson={draft} quizKeys={quiz.map((q) => q.correct)} /><button onClick={() => setPreview(false)} className={`${btnGhost} w-full mt-5`}>Back to editing</button></> : (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-4 gap-3">
            <div className="sm:col-span-3"><Field label="Title"><input className={inputCls} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder={kind === 'quiz' ? 'e.g. Unit 1 vocabulary quiz' : 'e.g. Why do we protect animals?'} /></Field></div>
            <Field label="Duration (min)"><input type="number" className={inputCls} value={f.duration_min} onChange={(e) => setF({ ...f, duration_min: e.target.value })} /></Field>
          </div>
          {kind === 'video' && <Field label="Video link (YouTube / Vimeo / Google Drive)"><input className={inputCls} value={f.video_url} onChange={(e) => setF({ ...f, video_url: e.target.value })} placeholder="https://youtu.be/..." /></Field>}
          {kind !== 'text' && kind !== 'quiz' && (
            <Field label={kind === 'video' ? 'Or upload a video file' : `${meta.label} file`} hint="Up to 50 MB. Uploaded files get a public link that only people with the link can find.">
              <div className="flex gap-2">
                <input className={inputCls} value={f.file_url} onChange={(e) => setF({ ...f, file_url: e.target.value })} placeholder="Paste a link or upload →" />
                <label className={`${btnGhost} cursor-pointer whitespace-nowrap`}>{up ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} Upload<input type="file" accept={meta.accept} className="hidden" onChange={(e) => upload(e.target.files?.[0])} /></label>
              </div>
            </Field>
          )}
          <Field label={kind === 'text' ? 'Text' : 'Description / instructions (optional)'} hint="Use # for headings, - for bullet points, **bold**.">
            <textarea rows={kind === 'text' ? 12 : 3} className={`${inputCls} ${kind === 'text' ? 'font-mono text-[13px]' : ''}`} value={f.content} onChange={(e) => setF({ ...f, content: e.target.value })} />
          </Field>
          {kind === 'quiz' && (!keysLoaded ? <Spinner /> : (
            <div className="space-y-3">
              {quiz.map((q, i) => (
                <div key={i} className="p-4 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex gap-2 items-center"><span className="font-black text-slate-400">{i + 1}.</span><input className={inputCls} value={q.prompt} onChange={(e) => setQuiz(quiz.map((x, j) => (j === i ? { ...x, prompt: e.target.value } : x)))} placeholder="Question" />
                    <button type="button" onClick={() => setQuiz(quiz.filter((_, j) => j !== i))} className="p-1.5 text-slate-400 hover:text-red-500"><Trash2 size={15} /></button></div>
                  {q.options.map((o, oi) => (
                    <div key={oi} className="flex items-center gap-2 pl-6"><input type="radio" checked={q.correct === oi} onChange={() => setQuiz(quiz.map((x, j) => (j === i ? { ...x, correct: oi } : x)))} className="accent-emerald-600 w-4 h-4" />
                      <span className="font-black text-slate-400 w-4">{String.fromCharCode(65 + oi)}</span>
                      <input className={inputCls} value={o} onChange={(e) => setQuiz(quiz.map((x, j) => (j === i ? { ...x, options: x.options.map((y, k) => (k === oi ? e.target.value : y)) } : x)))} /></div>
                  ))}
                  {q.options.length < 6 && <button type="button" onClick={() => setQuiz(quiz.map((x, j) => (j === i ? { ...x, options: [...x.options, ''] } : x)))} className="pl-6 text-xs font-bold text-orange-500">+ Add option</button>}
                </div>
              ))}
              <button type="button" onClick={() => setQuiz([...quiz, { prompt: '', options: ['', '', '', ''], correct: 0 }])} className={`${btnGhost} w-full`}><Plus size={15} /> Add Question</button>
              <p className="text-[11px] text-slate-400">Tick the correct option. Students never see the answers until they submit; their results appear under “Quiz Reports”.</p>
            </div>
          ))}
          <Field label="Worksheet / extra resource link (optional)"><input className={inputCls} value={f.resource_url} onChange={(e) => setF({ ...f, resource_url: e.target.value })} placeholder="https://drive.google.com/..." /></Field>
          <div className="flex flex-wrap gap-2 justify-end">
            <button onClick={() => setPreview(true)} className={btnGhost}><Eye size={16} /> Preview</button>
            <button disabled={busy || up} onClick={() => save('draft')} className={btnGhost}>Save Draft</button>
            {lead ? <button disabled={busy || up} onClick={() => save('approved')} className={btnPrimary}>{busy ? <Loader2 size={16} className="animate-spin" /> : <BookOpen size={16} />} Publish</button>
              : <button disabled={busy || up} onClick={() => save('pending')} className={btnPrimary}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Submit for Approval</button>}
          </div>
        </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------- quiz reports
type Attempt = { id: number; score: number; total: number; created_at: string; lesson: { title: string } | null; student: { full_name: string; email: string } | null };
function QuizReports({ cid }: { cid: number }) {
  const { data, loading } = useData<Attempt[]>(() => supabase.from('lesson_quiz_attempts')
    .select('id,score,total,created_at, lesson:lessons!inner(title, unit:course_units!inner(course_id)), student:profiles(full_name,email)')
    .eq('lesson.unit.course_id', cid).order('created_at', { ascending: false }), [cid]);
  const [q, setQ] = useState('');
  const list = (data ?? []).filter((a) => `${a.student?.full_name} ${a.lesson?.title}`.toLowerCase().includes(q.toLowerCase()));
  const avg = list.length ? Math.round(list.reduce((s, a) => s + (a.total ? (a.score * 100) / a.total : 0), 0) / list.length) : 0;
  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 flex flex-wrap gap-3 items-center border-b border-slate-100">
        <h2 className="flex-1 font-bold text-slate-800 flex items-center gap-2"><ClipboardList size={18} />Quiz attempts · {list.length}{list.length > 0 && <span className="text-sm text-slate-500 font-semibold">· average {avg}%</span>}</h2>
        <SearchInput value={q} onChange={setQ} placeholder="Search student or quiz..." />
      </div>
      {loading ? <Spinner /> : (
        <div className="overflow-x-auto"><table className="w-full text-left text-sm min-w-[640px]">
          <thead className="bg-slate-50 text-[11px] font-extrabold uppercase text-slate-500"><tr><th className="px-4 py-3">Student</th><th className="px-3 py-3">Quiz</th><th className="px-3 py-3">Score</th><th className="px-3 py-3">Date</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{list.map((a) => (
            <tr key={a.id}><td className="px-4 py-3"><p className="font-bold">{a.student?.full_name}</p><p className="text-[11px] text-slate-400">{a.student?.email}</p></td>
              <td className="px-3 py-3">{a.lesson?.title}</td>
              <td className="px-3 py-3 font-black">{a.score}/{a.total} <span className="text-xs text-slate-400">({a.total ? Math.round((a.score * 100) / a.total) : 0}%)</span></td>
              <td className="px-3 py-3 text-xs text-slate-500">{fmtDateTime(a.created_at)}</td></tr>
          ))}{!list.length && <tr><td colSpan={4} className="p-8 text-center text-slate-400 text-xs">No quiz attempts yet.</td></tr>}</tbody>
        </table></div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- staff preview
export function CurriculumPreview() {
  const { id } = useParams();
  const cid = Number(id);
  const user = useAuth((s) => s.user)!;
  const nav = useNavigate();
  const { course, units, sorted } = useCourseContent(cid);
  const [sel, setSel] = useState<number | null>(null);
  const cur = sorted.find((u) => u.id === sel);
  if (units.loading && !units.data) return <Spinner />;
  return (
    <div className="w-full bg-[#fafafa] min-h-screen">
      {user.demo && <DemoNotice />}
      <div className="bg-[#0b1a3a] text-white px-6 py-5 flex flex-wrap items-center gap-4">
        <button onClick={() => nav(root(user.role))} className="w-9 h-9 rounded-full bg-white/10 grid place-items-center"><ArrowLeft size={18} /></button>
        <div className="flex-1 min-w-48"><p className="text-[10px] font-black uppercase tracking-widest text-orange-400">Admin Preview · {course.data?.code}</p><h1 className="text-xl font-extrabold">{course.data?.title}</h1></div>
        <button onClick={() => nav(`${root(user.role)}/${cid}/edit`)} className="px-4 py-2 rounded-xl bg-orange-500 text-sm font-bold flex items-center gap-2"><SquarePen size={15} />Open Builder</button>
      </div>
      <div className="grid lg:grid-cols-12 gap-6 p-6 max-w-[1500px] mx-auto">
        <aside className="lg:col-span-4 xl:col-span-3 bg-white rounded-3xl border border-slate-100 shadow-sm p-4 h-fit lg:sticky lg:top-24">
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-500 px-1 mb-3">Content Modules ({sorted.length})</p>
          {sorted.map((u, i) => (
            <button key={u.id} onClick={() => setSel(u.id)} className={`w-full flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-left text-sm mb-1 ${u.id === sel ? 'bg-orange-50 text-orange-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>
              <span className="font-black text-slate-400 w-5">{i + 1}</span><span className="flex-1">{u.title}</span><span className="text-[10px] text-slate-400">{u.lessons.length}</span>
            </button>
          ))}
          {!sorted.length && <p className="text-xs text-slate-400 px-1">No modules yet.</p>}
        </aside>
        <main className="lg:col-span-8 xl:col-span-9">
          {!cur ? (
            <div className="bg-white rounded-4xl border border-slate-100 shadow-sm p-10 text-center">
              <Layers size={36} className="mx-auto text-slate-300 mb-3" /><h2 className="text-xl font-extrabold text-slate-900">Curriculum Overview</h2>
              <p className="text-sm text-slate-500 mt-1">Select a module from the sidebar to view its content elements, audio lessons, videos, and quizzes.</p>
              <p className="text-xs text-slate-400 mt-4">{sorted.length} modules · {sorted.reduce((a, u) => a + u.lessons.length, 0)} content elements</p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="bg-white rounded-4xl border border-slate-100 shadow-sm p-6">
                <h2 className="text-2xl font-extrabold text-slate-900">{cur.title}</h2>
                {cur.pages && <p className="text-xs font-bold text-slate-400 mt-1">{cur.pages}</p>}
                {cur.summary && <p className="text-sm text-slate-600 mt-3 leading-relaxed">{cur.summary}</p>}
                {cur.topics.length > 0 && <div className="flex flex-wrap gap-2 mt-3">{cur.topics.map((t, i) => <span key={i} className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100">{t}</span>)}</div>}
              </div>
              {cur.lessons.map((l) => {
                const I = kindIcon(l.kind);
                return (
                  <div key={l.id} className="bg-white rounded-4xl border border-slate-100 shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-4"><I size={18} className="text-indigo-500" /><h3 className="flex-1 font-extrabold text-slate-900">{l.title}</h3><StatusPill status={l.status} /></div>
                    <PreviewEl l={l} />
                  </div>
                );
              })}
              {!cur.lessons.length && <p className="text-center text-slate-400 py-8">This module has no content yet.</p>}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function PreviewEl({ l }: { l: Lesson }) {
  const keys = useData<{ keys: number[] }>(() => (l.kind === 'quiz' ? supabase.from('lesson_quiz_keys').select('keys').eq('lesson_id', l.id).maybeSingle() : Promise.resolve({ data: null, error: null })), [l.id]);
  return <LessonView lesson={l} quizKeys={keys.data?.keys} />;
}
