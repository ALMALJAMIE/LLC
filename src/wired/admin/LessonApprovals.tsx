import { useState } from 'react';
import { Check, Eye, X } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { fmtDate, useData } from '../../lib/db';
import { DemoNotice, Modal, Page, PageHero, Spinner, StatusPill, toast } from '../../components/ui';
import { LessonView } from '../shared/LessonView';
import type { Lesson } from '../shared/CurriculumEditor';
import { notify } from './AdminEnrollments';

type L = Lesson & { submitted_at: string | null; unit: { title: string; course: { title: string } | null } | null; author: { full_name: string } | null };

export default function LessonApprovals() {
  const user = useAuth((s) => s.user);
  const [tab, setTab] = useState('pending');
  const [view, setView] = useState<L | null>(null);
  const { data, loading, reload } = useData<L[]>(() => supabase.from('lessons').select('*, unit:course_units(title, course:courses(title)), author:profiles(full_name)').order('submitted_at', { ascending: false, nullsFirst: false }));
  const list = (data ?? []).filter((l) => tab === 'all' || l.status === tab);
  const decide = async (l: L, status: 'approved' | 'rejected') => {
    const note = status === 'rejected' ? prompt('What should the instructor fix?') : '';
    if (note === null) return;
    const { error } = await supabase.from('lessons').update({ status, review_note: note || null }).eq('id', l.id);
    if (error) return toast.err(error.message);
    if (l.created_by) await notify(l.created_by, `Lesson ${status}`, `${l.title}${note ? ` — ${note}` : ''}`, '/instructor/lessons');
    toast.ok(`Lesson ${status}`); setView(null); reload();
  };
  return (
    <Page>
      {user?.demo && <DemoNotice />}
      <PageHero badge="Quality Control" badgeColor="indigo" title="Lesson Approvals" illus="lesson" subtitle="Review lessons submitted by instructors before students can see them.">
        <div className="inline-flex bg-slate-50 p-1 rounded-xl border border-slate-200">{['pending', 'approved', 'rejected', 'draft', 'all'].map((t) => <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-xs font-bold capitalize ${tab === t ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>{t}</button>)}</div>
      </PageHero>
      {loading ? <Spinner /> : !list.length ? <p className="text-center text-slate-400 py-16">Nothing to review.</p> : (
        <div className="space-y-3">{list.map((l) => (
          <div key={l.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-56"><p className="font-extrabold text-slate-900">{l.title}</p><p className="text-xs text-slate-500">{l.unit?.course?.title} · {l.unit?.title}</p><p className="text-[11px] text-slate-400">By {l.author?.full_name ?? '—'}{l.submitted_at && ` · submitted ${fmtDate(l.submitted_at)}`}</p></div>
            <StatusPill status={l.status} />
            <button onClick={() => setView(l)} className="flex items-center gap-1 px-4 py-2 rounded-xl bg-slate-100 text-xs font-bold"><Eye size={14} />Review</button>
          </div>
        ))}</div>
      )}
      {view && <Modal open onClose={() => setView(null)} title={view.title} wide>
        <LessonView lesson={view} />
        {view.status !== 'approved' && <div className="flex gap-2 mt-6 pt-5 border-t border-slate-100">
          <button onClick={() => decide(view, 'approved')} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 text-white font-bold text-sm"><Check size={16} />Approve & publish</button>
          <button onClick={() => decide(view, 'rejected')} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-red-100 text-red-600 font-bold text-sm"><X size={16} />Send back</button>
        </div>}
      </Modal>}
    </Page>
  );
}
