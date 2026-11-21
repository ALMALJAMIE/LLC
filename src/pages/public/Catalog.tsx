import { CurrencyPicker, Price } from '../../lib/price';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Link, useSearchParams } from 'react-router-dom';
import { BookOpen, Clock, Globe, Layers, MapPin, Search } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { CoverImg } from '../../components/media';
import { Modal } from '../../components/ui';
import { SiteShell, WhatsAppFab } from './Site';
import { CourseCard, usePublicCourses } from './Home';

export default function Catalog() {
  const courses = usePublicCourses();
  const user = useAuth((s) => s.user);
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [mode, setMode] = useState('all');
  const list = useMemo(() => (courses ?? []).filter((c) => (mode === 'all' || c.delivery === mode) && `${c.title} ${c.description ?? ''} ${c.level?.name ?? ''}`.toLowerCase().includes(q.toLowerCase())), [courses, q, mode]);
  const sel = (courses ?? []).find((c) => String(c.id) === params.get('c'));
  return (
    <SiteShell>
      <section className="max-w-7xl mx-auto px-5 lg:px-8 pt-14 pb-8">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-orange-500">Course catalogue</p>
        <h1 className="text-4xl lg:text-5xl font-extrabold text-slate-900 mt-3 tracking-tight">Find the right course</h1>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 max-w-2xl">
          <div className="relative flex-1"><Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by course or level…" className="w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-orange-200" /></div>
          <div className="inline-flex bg-white p-1 rounded-2xl border border-slate-200">{[['all', 'All'], ['online', 'Online'], ['face_to_face', 'In class'], ['hybrid', 'Hybrid']].map(([k, l]) => <button key={k} onClick={() => setMode(k)} className={`px-4 py-2 rounded-xl text-sm font-bold ${mode === k ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>{l}</button>)}</div>
          <CurrencyPicker className="self-center" />
        </div>
      </section>
      <section className="max-w-7xl mx-auto px-5 lg:px-8 pb-24">
        {courses === null ? <p className="text-slate-400">Loading…</p> : !list.length ? <p className="text-slate-400 py-10">No courses match your search.</p> : <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">{list.map((c) => <CourseCard key={c.id} c={c} />)}</div>}
      </section>
      {sel && (
        <Modal open onClose={() => setParams({})} title={sel.title} wide>
          <div className="grid md:grid-cols-5 gap-6">
            <CoverImg className="md:col-span-2 w-full h-48 rounded-3xl" alt={sel.title} />
            <div className="md:col-span-3">
              <p className="text-slate-600 leading-relaxed">{sel.description}</p>
              <div className="grid grid-cols-2 gap-2 mt-5 text-sm">
                {[{ i: Layers, l: 'Level', v: sel.level ? `${sel.level.name} (${sel.level.cefr ?? ''})` : 'All levels' }, { i: Clock, l: 'Duration', v: `${sel.duration_weeks ?? '—'} weeks` }, { i: sel.delivery === 'face_to_face' ? MapPin : Globe, l: 'Delivery', v: sel.delivery.replace(/_/g, ' ') }, { i: BookOpen, l: 'Fee', v: <Price amount={sel.price} cur={sel.currency} /> }].map(({ i: I, l, v }) => (
                  <div key={l} className="p-3 rounded-xl bg-slate-50 border border-slate-100"><p className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1"><I size={12} />{l}</p><p className="font-bold text-slate-800 capitalize">{v}</p></div>
                ))}
              </div>
              <PublicOptions courseId={sel.id} />
              <Link to={user?.role === 'student' ? '/student/courses' : '/register'} className="mt-6 w-full inline-flex items-center justify-center py-3.5 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-bold shadow-lg shadow-orange-200">{user?.role === 'student' ? 'Enroll from my portal' : 'Create account to enroll'}</Link>
              <Link to="/placement" className="mt-2 w-full inline-flex items-center justify-center py-3 rounded-2xl text-sm font-bold text-indigo-600">Not sure of your level? Take the placement test</Link>
            </div>
          </div>
        </Modal>
      )}
      <WhatsAppFab />
    </SiteShell>
  );
}

/** The ways to study a course and their prices (self-paced, live, blended…). */
function PublicOptions({ courseId }: { courseId: number }) {
  const [rows, setRows] = useState<{ id: number; name: string; kind: string; description: string | null; price: number }[]>([]);
  useEffect(() => { supabase.from('course_options').select('id,name,kind,description,price').eq('course_id', courseId).eq('is_active', true).order('sort_order').order('price').then(({ data }) => setRows(data ?? [])); }, [courseId]);
  if (!rows.length) return null;
  return (
    <div className="mt-5">
      <p className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">Ways to study</p>
      <div className="space-y-2">{rows.map((o) => (
        <div key={o.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200">
          <div className="flex-1"><p className="font-bold text-slate-800 text-sm">{o.name}</p>{o.description && <p className="text-[11px] text-slate-500">{o.description}</p>}</div>
          <Price className="font-black text-slate-900 text-right" amount={o.price} />
        </div>
      ))}</div>
    </div>
  );
}
