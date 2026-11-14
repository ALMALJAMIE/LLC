import { useState } from 'react';
import { Loader2, MessageSquare, Plus, Star } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { fmtDate, useData } from '../../lib/db';
import { DemoNotice, Field, Modal, Page, PageHero, StatusPill, btnPrimary, inputCls, toast } from '../../components/ui';
import { useMyEnrollments } from './hooks';

type R = { id: number; rating: number; comment: string | null; status: string; created_at: string; course: { title: string } | null };

export default function StudentReviews() {
  const user = useAuth((s) => s.user);
  const [tab, setTab] = useState('all');
  const [open, setOpen] = useState(false);
  const { data, reload } = useData<R[]>(() => supabase.from('reviews').select('id,rating,comment,status,created_at, course:courses(title)').eq('student_id', user!.id).order('created_at', { ascending: false }));
  const list = (data ?? []).filter((r) => tab === 'all' || r.status === tab);
  return (
    <Page>
      {user?.demo && <DemoNotice />}
      <PageHero badge="Student Feedback" title="My Reviews" illus="review" subtitle="Your feedback helps us improve and helps other students choose the right path.">
        <button disabled={user?.demo} onClick={() => setOpen(true)} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-900 hover:bg-orange-500 text-white font-bold transition-colors disabled:opacity-50"><Plus size={18} /> Write a Review</button>
      </PageHero>
      <div className="flex justify-between items-center mb-5">
        <div className="bg-white p-1 rounded-xl border border-slate-200 flex shadow-sm">
          {['all', 'approved', 'pending'].map((t) => <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-[11px] font-black uppercase ${tab === t ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>{t}</button>)}
        </div>
        <p className="text-xs italic font-bold text-slate-400">Total: {data?.length ?? 0} Reviews</p>
      </div>
      {list.length === 0 ? (
        <div className="bg-white rounded-4xl border-2 border-dashed border-slate-200 py-16 text-center"><MessageSquare size={36} className="mx-auto text-slate-300 mb-3" /><h3 className="font-bold text-slate-800">No reviews found</h3>
          <button disabled={user?.demo} onClick={() => setOpen(true)} className="text-sm font-bold text-orange-500 mt-1">Share your first experience</button></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {list.map((r) => (
            <div key={r.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
              <div className="flex justify-between items-start"><div><p className="font-bold text-slate-800">{r.course?.title ?? 'Language Leap Center'}</p><p className="text-xs text-slate-400">{fmtDate(r.created_at)}</p></div><StatusPill status={r.status} /></div>
              <div className="flex gap-0.5 my-3">{[1, 2, 3, 4, 5].map((i) => <Star key={i} size={16} className={i <= r.rating ? 'fill-orange-400 text-orange-400' : 'text-slate-200'} />)}</div>
              {r.comment && <p className="text-sm text-slate-600">{r.comment}</p>}
            </div>
          ))}
        </div>
      )}
      {open && <Write onClose={() => setOpen(false)} onDone={() => { setOpen(false); reload(); }} />}
    </Page>
  );
}

function Write({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const user = useAuth((s) => s.user)!;
  const mine = useMyEnrollments(false);
  const [course, setCourse] = useState('');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from('reviews').insert({ student_id: user.id, course_id: course ? Number(course) : null, rating, comment: comment.trim() || null, status: 'pending' });
    setBusy(false);
    if (error) return toast.err(error.message);
    toast.ok('Thank you! Your review was sent for approval.'); onDone();
  };
  return (
    <Modal open onClose={onClose} title="Write a Review">
      <div className="space-y-4">
        <Field label="Course"><select className={inputCls} value={course} onChange={(e) => setCourse(e.target.value)}><option value="">The center in general</option>{(mine.data ?? []).map((m) => m.course && <option key={m.id} value={m.course.id}>{m.course.title}</option>)}</select></Field>
        <Field label="Rating"><div className="flex gap-1">{[1, 2, 3, 4, 5].map((i) => <button type="button" key={i} onClick={() => setRating(i)}><Star size={30} className={i <= rating ? 'fill-orange-400 text-orange-400' : 'text-slate-200'} /></button>)}</div></Field>
        <Field label="Your experience"><textarea rows={4} className={inputCls} value={comment} onChange={(e) => setComment(e.target.value)} /></Field>
        <button onClick={save} disabled={busy} className={`${btnPrimary} w-full`}>{busy && <Loader2 size={16} className="animate-spin" />} Submit Review</button>
      </div>
    </Modal>
  );
}
