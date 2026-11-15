import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, BookOpen, Clock, Eye, FileText, Loader2, Plus, Send, SquarePen, Trash2, Video } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { useData } from '../../lib/db';
import { DemoNotice, Field, Modal, Page, PageHero, Spinner, StatusPill, btnGhost, btnPrimary, inputCls, toast } from '../../components/ui';
import { LessonView } from './LessonView';

export type Lesson = { id: number; unit_id: number; title: string; content: string | null; video_url: string | null; resource_url: string | null; duration_min: number | null; sort_order: number; status: string; review_note: string | null; created_by: string | null };
type Unit = { id: number; course_id: number; title: string; sort_order: number; lessons: Lesson[] };

/** Course → units → lessons editor. Admins publish directly; instructors submit lessons for approval. */
export default function CurriculumEditor() {
  const user = useAuth((s) => s.user)!;
  const admin = user.role === 'admin';
  const courses = useData<{ id: number; title: string; code: string }[]>(async () => {
    if (admin) return supabase.from('courses').select('id,title,code').order('code');
    const b = await supabase.from('batches').select('course:courses(id,title,code)').eq('instructor_id', user.id);
    const m = new Map<number, { id: number; title: string; code: string }>();
    ((b.data ?? []) as unknown as { course: { id: number; title: string; code: string } | null }[]).forEach((x) => x.course && m.set(x.course.id, x.course));
    return { data: [...m.values()], error: b.error };
  });
  const [cid, setCid] = useState<number | null>(null);
  const units = useData<Unit[]>(() => supabase.from('course_units').select('*, lessons(*)').eq('course_id', cid ?? 0).order('sort_order').order('id'), [cid]);
  const [edit, setEdit] = useState<Partial<Lesson> | null>(null);
  const [view, setView] = useState<Lesson | null>(null);
  const sorted = useMemo(() => (units.data ?? []).map((u) => ({ ...u, lessons: [...u.lessons].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id) })), [units.data]);
  const count = sorted.reduce((a, u) => a + u.lessons.length, 0);

  const addUnit = async () => {
    const title = prompt('Unit title (e.g. Unit 1: Greetings):'); if (!title) return;
    const { error } = await supabase.from('course_units').insert({ course_id: cid, title, sort_order: sorted.length + 1 });
    if (error) toast.err(error.message); else units.reload();
  };
  const renameUnit = async (u: Unit) => {
    const title = prompt('Unit title:', u.title); if (!title) return;
    const { error } = await supabase.from('course_units').update({ title }).eq('id', u.id); if (error) toast.err(error.message); else units.reload();
  };
  const delUnit = async (u: Unit) => {
    if (!confirm(`Delete "${u.title}" and its ${u.lessons.length} lessons?`)) return;
    const { error } = await supabase.from('course_units').delete().eq('id', u.id); if (error) toast.err(error.message); else units.reload();
  };
  const move = async (u: Unit, dir: -1 | 1) => {
    const i = sorted.findIndex((x) => x.id === u.id); const o = sorted[i + dir]; if (!o) return;
    await supabase.from('course_units').update({ sort_order: i + 1 + dir }).eq('id', u.id);
    await supabase.from('course_units').update({ sort_order: i + 1 }).eq('id', o.id);
    units.reload();
  };
  const delLesson = async (l: Lesson) => {
    if (!confirm(`Delete "${l.title}"?`)) return;
    const { error } = await supabase.from('lessons').delete().eq('id', l.id); if (error) toast.err(error.message); else units.reload();
  };

  return (
    <Page>
      {user.demo && <DemoNotice />}
      <PageHero badge="Curriculum" badgeColor="indigo" title={admin ? 'Course Curriculum' : 'Lessons'} illus="curriculum"
        subtitle={admin ? 'Build each course as units and lessons. Lessons you publish are visible to enrolled students immediately.' : 'Prepare lessons for the courses you teach. Submitted lessons go to the academic team for approval.'}>
        <select value={cid ?? ''} onChange={(e) => setCid(e.target.value ? Number(e.target.value) : null)} className="w-full max-w-md px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none">
          <option value="">— Select a course —</option>{(courses.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.code} · {c.title}</option>)}
        </select>
      </PageHero>
      {!cid ? <p className="text-center text-slate-400 py-12">{courses.loading ? 'Loading…' : courses.data?.length ? 'Select a course to edit its content.' : 'No courses assigned to you yet.'}</p> : units.loading ? <Spinner /> : (
        <>
          <div className="flex justify-between items-center mb-5"><p className="text-sm font-bold text-slate-500">{sorted.length} units · {count} lessons</p>
            <button onClick={addUnit} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-orange-500 text-white text-sm font-bold"><Plus size={16} /> Add Unit</button></div>
          {!sorted.length && <div className="bg-white rounded-4xl border-2 border-dashed border-slate-200 py-14 text-center text-slate-400">No units yet. Start with “Add Unit”.</div>}
          <div className="space-y-5">{sorted.map((u, i) => (
            <div key={u.id} className="bg-white rounded-4xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 px-6 py-4 bg-slate-50/70 border-b border-slate-100">
                <span className="w-9 h-9 rounded-xl bg-indigo-600 text-white grid place-items-center font-black text-sm">{i + 1}</span>
                <h3 className="flex-1 font-extrabold text-slate-900">{u.title}</h3>
                <button onClick={() => move(u, -1)} className="p-1.5 text-slate-400 hover:text-slate-700"><ArrowUp size={16} /></button>
                <button onClick={() => move(u, 1)} className="p-1.5 text-slate-400 hover:text-slate-700"><ArrowDown size={16} /></button>
                <button onClick={() => renameUnit(u)} className="p-1.5 text-slate-400 hover:text-blue-600"><SquarePen size={16} /></button>
                <button onClick={() => delUnit(u)} className="p-1.5 text-slate-400 hover:text-red-500"><Trash2 size={16} /></button>
              </div>
              <div className="divide-y divide-slate-50">
                {u.lessons.map((l) => (
                  <div key={l.id} className="flex flex-wrap items-center gap-3 px-6 py-3">
                    <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 grid place-items-center">{l.video_url ? <Video size={15} /> : <FileText size={15} />}</span>
                    <div className="flex-1 min-w-40"><p className="font-semibold text-slate-800">{l.title}</p>{l.review_note && l.status === 'rejected' && <p className="text-[11px] text-red-500">{l.review_note}</p>}</div>
                    {l.duration_min && <span className="text-xs text-slate-400 flex items-center gap-1"><Clock size={12} />{l.duration_min} min</span>}
                    <StatusPill status={l.status} />
                    <button onClick={() => setView(l)} className="p-1.5 text-slate-400 hover:text-indigo-600"><Eye size={16} /></button>
                    {(admin || l.created_by === user.id) && <><button onClick={() => setEdit(l)} className="p-1.5 text-slate-400 hover:text-blue-600"><SquarePen size={16} /></button>
                      <button onClick={() => delLesson(l)} className="p-1.5 text-slate-400 hover:text-red-500"><Trash2 size={16} /></button></>}
                  </div>
                ))}
                <button onClick={() => setEdit({ unit_id: u.id, sort_order: u.lessons.length + 1 })} className="w-full px-6 py-3 text-left text-sm font-bold text-orange-500 hover:bg-orange-50/50 flex items-center gap-2"><Plus size={15} /> Add lesson</button>
              </div>
            </div>
          ))}</div>
        </>
      )}
      {edit && <LessonForm lesson={edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); units.reload(); }} />}
      {view && <Modal open onClose={() => setView(null)} title={view.title} wide><LessonView lesson={view} /></Modal>}
    </Page>
  );
}

function LessonForm({ lesson, onClose, onDone }: { lesson: Partial<Lesson>; onClose: () => void; onDone: () => void }) {
  const user = useAuth((s) => s.user)!;
  const admin = user.role === 'admin';
  const [f, setF] = useState({ title: lesson.title ?? '', video_url: lesson.video_url ?? '', resource_url: lesson.resource_url ?? '', duration_min: lesson.duration_min ? String(lesson.duration_min) : '', content: lesson.content ?? '' });
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const save = async (status: string) => {
    if (!f.title.trim()) return toast.err('Title is required');
    setBusy(true);
    const row = { unit_id: lesson.unit_id, title: f.title.trim(), video_url: f.video_url || null, resource_url: f.resource_url || null, duration_min: f.duration_min ? Number(f.duration_min) : null, content: f.content || null, status, sort_order: lesson.sort_order ?? 1, ...(lesson.id ? {} : { created_by: user.id }) };
    const { error } = lesson.id ? await supabase.from('lessons').update(row).eq('id', lesson.id) : await supabase.from('lessons').insert(row);
    setBusy(false);
    if (error) toast.err(error.message); else { toast.ok(status === 'approved' ? 'Lesson published' : status === 'pending' ? 'Sent for approval' : 'Draft saved'); onDone(); }
  };
  return (
    <Modal open onClose={onClose} title={lesson.id ? 'Edit Lesson' : 'New Lesson'} wide>
      {preview ? (
        <><LessonView lesson={{ ...f, duration_min: f.duration_min ? Number(f.duration_min) : null } as Lesson} /><button onClick={() => setPreview(false)} className={`${btnGhost} w-full mt-5`}>Back to editing</button></>
      ) : (
        <div className="space-y-4">
          <Field label="Lesson title"><input className={inputCls} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Present simple: daily routines" /></Field>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2"><Field label="Video link (YouTube / Vimeo / Google Drive)"><input className={inputCls} value={f.video_url} onChange={(e) => setF({ ...f, video_url: e.target.value })} placeholder="https://youtu.be/..." /></Field></div>
            <Field label="Duration (min)"><input type="number" className={inputCls} value={f.duration_min} onChange={(e) => setF({ ...f, duration_min: e.target.value })} /></Field>
          </div>
          <Field label="Lesson text" hint="Use # for headings, - for bullet points, **bold**. Blank line = new paragraph."><textarea rows={12} className={`${inputCls} font-mono text-[13px]`} value={f.content} onChange={(e) => setF({ ...f, content: e.target.value })} /></Field>
          <Field label="Worksheet / extra resource link (optional)"><input className={inputCls} value={f.resource_url} onChange={(e) => setF({ ...f, resource_url: e.target.value })} placeholder="https://drive.google.com/..." /></Field>
          <div className="flex flex-wrap gap-2 justify-end">
            <button onClick={() => setPreview(true)} className={btnGhost}><Eye size={16} /> Preview</button>
            <button disabled={busy} onClick={() => save('draft')} className={btnGhost}>Save Draft</button>
            {admin ? <button disabled={busy} onClick={() => save('approved')} className={btnPrimary}>{busy ? <Loader2 size={16} className="animate-spin" /> : <BookOpen size={16} />} Publish</button>
              : <button disabled={busy} onClick={() => save('pending')} className={btnPrimary}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Submit for Approval</button>}
          </div>
        </div>
      )}
    </Modal>
  );
}
