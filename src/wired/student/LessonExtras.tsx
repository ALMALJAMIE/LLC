import { useEffect, useRef, useState } from 'react';
import { Bookmark, Loader2, MessageCircleQuestion, NotebookPen, Send, Trash2 } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { fmtDateTime, useData } from '../../lib/db';
import { toast } from '../../components/ui';
import { askConfirm } from '../../components/dialogs';

/** Bookmark button for the lesson header. */
export function BookmarkButton({ lessonId, on, onChange }: { lessonId: number; on: boolean; onChange: (v: boolean) => void }) {
  const user = useAuth((s) => s.user)!;
  const toggle = async () => {
    if (user.demo) return;
    const { error } = await supabase.from('lesson_notes').upsert({ student_id: user.id, lesson_id: lessonId, bookmarked: !on, updated_at: new Date().toISOString() }, { onConflict: 'student_id,lesson_id' });
    if (error) toast.err(error.message); else { onChange(!on); toast.ok(on ? 'Bookmark removed' : 'Lesson bookmarked'); }
  };
  return <button title={on ? 'Remove bookmark' : 'Bookmark this lesson'} onClick={toggle} className={`p-2.5 rounded-xl border ${on ? 'bg-amber-50 border-amber-200 text-amber-500' : 'border-slate-200 text-slate-400 hover:text-amber-500'}`}><Bookmark size={18} fill={on ? 'currentColor' : 'none'} /></button>;
}

/** Private notes (autosaved) and questions to the teacher, under each lesson. */
export function LessonExtras({ lessonId }: { lessonId: number }) {
  const user = useAuth((s) => s.user)!;
  const [tab, setTab] = useState<'notes' | 'ask'>('notes');
  const [note, setNote] = useState<string | null>(null);
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved'>('idle');
  const first = useRef(true);
  useEffect(() => {
    first.current = true; setNote(null);
    if (user.demo) { setNote(''); return; }
    supabase.from('lesson_notes').select('body').eq('student_id', user.id).eq('lesson_id', lessonId).maybeSingle().then(({ data }) => setNote(data?.body ?? ''));
  }, [lessonId, user]);
  useEffect(() => {
    if (note === null || user.demo) return;
    if (first.current) { first.current = false; return; }
    setSaved('saving');
    const t = setTimeout(async () => {
      const { error } = await supabase.from('lesson_notes').upsert({ student_id: user.id, lesson_id: lessonId, body: note, updated_at: new Date().toISOString() }, { onConflict: 'student_id,lesson_id' });
      setSaved(error ? 'idle' : 'saved');
    }, 1000);
    return () => clearTimeout(t);
  }, [note]); // eslint-disable-line react-hooks/exhaustive-deps

  const qs = useData<{ id: number; body: string; answer: string | null; answered_at: string | null; created_at: string }[]>(
    () => supabase.from('lesson_questions').select('id,body,answer,answered_at,created_at').eq('lesson_id', lessonId).eq('student_id', user.id).order('created_at'), [lessonId]);
  const [ask, setAsk] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (user.demo) return toast.err('Sign in with a real account to ask.');
    if (ask.trim().length < 3) return toast.err('Write your question first.');
    setBusy(true);
    const { error } = await supabase.from('lesson_questions').insert({ lesson_id: lessonId, student_id: user.id, body: ask.trim() });
    setBusy(false);
    if (error) return toast.err(error.message);
    setAsk(''); toast.ok('Question sent to your teacher'); qs.reload();
  };
  const del = async (id: number) => {
    if (!(await askConfirm('Delete this question?'))) return;
    const { error } = await supabase.from('lesson_questions').delete().eq('id', id); if (error) toast.err(error.message); else qs.reload();
  };
  const waiting = (qs.data ?? []).filter((q) => !q.answer).length;
  return (
    <div className="mt-8 rounded-3xl border border-slate-200 bg-slate-50/50">
      <div className="flex border-b border-slate-200">
        <button onClick={() => setTab('notes')} className={`flex-1 px-4 py-3 text-sm font-bold flex items-center justify-center gap-2 ${tab === 'notes' ? 'text-indigo-700 border-b-2 border-indigo-600' : 'text-slate-500'}`}><NotebookPen size={16} />My notes</button>
        <button onClick={() => setTab('ask')} className={`flex-1 px-4 py-3 text-sm font-bold flex items-center justify-center gap-2 ${tab === 'ask' ? 'text-indigo-700 border-b-2 border-indigo-600' : 'text-slate-500'}`}><MessageCircleQuestion size={16} />Ask your teacher{waiting > 0 && <span className="text-[10px] bg-amber-100 text-amber-700 rounded-full px-1.5">{waiting}</span>}</button>
      </div>
      <div className="p-4">
        {tab === 'notes' ? (note === null ? <Loader2 className="animate-spin text-slate-300" /> : <>
          <textarea rows={5} value={note} onChange={(e) => setNote(e.target.value)} className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white text-sm" placeholder="Write your own notes for this lesson. Only you can see them." />
          <p className="text-[11px] text-slate-400 mt-1">{saved === 'saving' ? 'Saving…' : saved === 'saved' ? 'Saved' : 'Saved automatically · only you can see your notes'}</p>
        </>) : (
          <div className="space-y-3">
            {(qs.data ?? []).map((q) => (
              <div key={q.id} className="p-3 rounded-2xl bg-white border border-slate-200 text-sm">
                <div className="flex gap-2"><p className="flex-1 font-semibold text-slate-800 whitespace-pre-line">{q.body}</p>{!q.answer && <button onClick={() => del(q.id)} className="p-1 text-slate-300 hover:text-red-500"><Trash2 size={14} /></button>}</div>
                <p className="text-[11px] text-slate-400">{fmtDateTime(q.created_at)}</p>
                {q.answer ? <div className="mt-2 p-3 rounded-xl bg-emerald-50 border border-emerald-100"><p className="text-[11px] font-bold text-emerald-700">Teacher’s answer</p><p className="whitespace-pre-line text-slate-700">{q.answer}</p></div>
                  : <p className="mt-1 text-[11px] font-bold text-amber-600">Waiting for an answer</p>}
              </div>
            ))}
            <div className="flex gap-2"><textarea rows={2} value={ask} onChange={(e) => setAsk(e.target.value)} className="flex-1 px-4 py-3 rounded-2xl border border-slate-200 bg-white text-sm" placeholder="Something not clear in this lesson? Ask your teacher." />
              <button disabled={busy} onClick={send} className="px-4 rounded-2xl bg-indigo-600 text-white">{busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}</button></div>
          </div>
        )}
      </div>
    </div>
  );
}
