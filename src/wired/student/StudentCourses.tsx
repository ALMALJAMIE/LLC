import PlacementRequired from '../../components/PlacementRequired';
import { usePlacementDone } from '../../lib/placement';
import PayBox from '../../components/PayBox';
import { OPTION_KINDS, type CourseOption } from '../admin/CourseOptions';
import { CurrencyPicker, Price } from '../../lib/price';
import { useMemo, useState } from 'react';
import { BookOpen, CalendarDays, ChevronRight, Clock, Funnel, Globe, Layers, MapPin, Search, Users } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { fmtDate, money, useData } from '../../lib/db';

import { CoverImg, Illus } from '../../components/media';
import { DemoNotice, Field, Modal, Spinner, StatusPill } from '../../components/ui';
import type { Batch, Course } from './types';

const DELIVERY: Record<string, string> = { online: 'Online', face_to_face: 'Face to Face', hybrid: 'Hybrid' };

export default function StudentCourses() {
  const user = useAuth((s) => s.user);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [open, setOpen] = useState<Course | null>(null);
  const courses = useData<Course[]>(() =>
    supabase.from('courses').select('*, category:categories(name), level:levels(name,cefr)').eq('status', 'published').order('code'));
  const mine = useData<{ course_id: number; status: string }[]>(() =>
    supabase.from('enrollments').select('course_id,status').eq('student_id', user!.id));

  const list = useMemo(() => (courses.data ?? []).filter((c) =>
    (filter === 'all' || (filter === 'free' ? Number(c.price) === 0 : Number(c.price) > 0)) &&
    `${c.title} ${c.code}`.toLowerCase().includes(q.toLowerCase())), [courses.data, q, filter]);

  return (
    <div className="w-full bg-[#fafafa] text-[#1e293b] font-sans min-h-screen pb-20 overflow-x-hidden">
      <main className="max-w-7xl mx-auto px-6 py-8">
        {user?.demo && <DemoNotice />}
        <div className="bg-white rounded-4xl border border-slate-100 shadow-sm p-8 mb-10 flex flex-col-reverse lg:flex-row items-center justify-between relative overflow-hidden">
          <div className="z-10 w-full lg:w-1/2 mt-6 lg:mt-0">
            <span className="inline-block px-3 py-1 bg-orange-50 text-orange-600 rounded-full text-xs font-bold uppercase tracking-wider mb-4 border border-orange-100">Student Portal</span>
            <h1 className="text-4xl font-extrabold text-slate-900 mb-3 tracking-tight">Course Catalog</h1>
            <p className="text-slate-500 text-lg mb-8 leading-relaxed max-w-md">Browse available courses and enroll in new batches to start learning.</p>
            <div className="flex flex-col sm:flex-row gap-4 max-w-lg">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input value={q} onChange={(e) => setQ(e.target.value)} className="block w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:bg-white transition-all shadow-sm" placeholder="Search by title or code..." type="text" />
              </div>
              <div className="relative w-full sm:w-48">
                <Funnel className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <select value={filter} onChange={(e) => setFilter(e.target.value)} className="block w-full pl-11 pr-8 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-orange-200 focus:bg-white transition-all shadow-sm appearance-none cursor-pointer">
                  <option value="all">All Courses</option><option value="free">Free Only</option><option value="paid">Paid Only</option>
                </select>
              </div>
              <CurrencyPicker className="self-center" />
            </div>
          </div>
          <div className="w-full lg:w-1/2 flex justify-center lg:justify-end relative">
            <Illus name="courses" className="max-h-75 object-contain drop-shadow-xl" />
          </div>
        </div>

        {courses.loading ? <Spinner /> : list.length === 0 ? (
          <div className="text-center py-20 text-slate-400">{user?.demo ? 'Sign in to browse the live catalog.' : 'No courses match your search.'}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {list.map((c) => {
              const st = mine.data?.find((m) => m.course_id === c.id)?.status;
              return (
                <div key={c.id} onClick={() => setOpen(c)} className="group bg-white rounded-4xl p-4 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-slate-100 flex flex-col h-full cursor-pointer relative">
                  <div className="relative h-48 rounded-3xl overflow-hidden mb-5 bg-slate-100">
                    <CoverImg className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={c.title} />
                    <div className="absolute top-3 left-3 flex flex-col gap-1.5 items-start">
                      {Number(c.price) === 0 && <span className="bg-white/90 backdrop-blur-sm text-emerald-600 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">FREE</span>}
                      {st && <span className="bg-white/90 backdrop-blur-sm text-indigo-600 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm uppercase">{st === 'pending' ? 'Request pending' : 'Enrolled'}</span>}
                    </div>
                  </div>
                  <div className="px-2 flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100">{c.code}</span>
                      <div className="flex items-center gap-1 text-slate-400 text-[10px] font-bold uppercase"><BookOpen size={12} /> {c.units_count} Units</div>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 leading-snug mb-3 line-clamp-2 group-hover:text-orange-600 transition-colors">{c.title}</h3>
                    <div className="mt-auto pt-3 border-t border-slate-50 flex items-center justify-between text-xs font-black text-indigo-600 uppercase">View Details <ChevronRight size={16} /></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
      {open && <CourseDetails course={open} status={mine.data?.find((m) => m.course_id === open.id)?.status} onClose={() => setOpen(null)} onDone={() => { mine.reload(); setOpen(null); }} />}
    </div>
  );
}

function CourseDetails({ course: c, status, onClose, onDone }: { course: Course; status?: string; onClose: () => void; onDone: () => void }) {
  const batches = useData<Batch[]>(() =>
    supabase.from('batches').select('*, instructor:profiles(full_name)').eq('course_id', c.id).in('status', ['upcoming', 'active']).order('start_date'));
  const [batchId, setBatchId] = useState<number | ''>('');
  const placed = usePlacementDone();
  const options = useData<CourseOption[]>(() => supabase.from('course_options').select('*').eq('course_id', c.id).eq('is_active', true).order('sort_order').order('price'), [c.id]);
  const seats = useData<Record<number, number>>(async () => {
    const out: Record<number, number> = {};
    for (const b of batches.data ?? []) { const { data } = await supabase.rpc('batch_seats_taken', { p_batch: b.id }); out[b.id] = Number(data ?? 0); }
    return { data: out, error: null };
  }, [batches.data]);
  const [optId, setOptId] = useState<number | null>(null);
  const opt = options.data?.find((o) => o.id === optId);
  const hasOptions = !!options.data?.length;
  const showBatches = !hasOptions || !!opt?.needs_batch;

  return (
    <Modal open onClose={onClose} title={c.title} wide>
      <div className="grid md:grid-cols-5 gap-6">
        <div className="md:col-span-2">
          <CoverImg className="w-full h-44 rounded-3xl" alt={c.title} />
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            {[
              { i: Layers, l: 'Level', v: c.level ? `${c.level.name}${c.level.cefr ? ` (${c.level.cefr})` : ''}` : 'All levels' },
              { i: BookOpen, l: 'Units', v: `${c.units_count}` },
              { i: Clock, l: 'Duration', v: c.duration_weeks ? `${c.duration_weeks} weeks` : '—' },
              { i: c.delivery === 'face_to_face' ? MapPin : Globe, l: 'Delivery', v: DELIVERY[c.delivery] },
            ].map(({ i: I, l, v }) => (
              <div key={l} className="p-3 rounded-xl bg-slate-50 border border-slate-100"><p className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1"><I size={12} />{l}</p><p className="font-bold text-slate-700 mt-0.5">{v}</p></div>
            ))}
          </div>
        </div>
        <div className="md:col-span-3 space-y-5">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100">{c.code}</span>
            {c.category && <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-orange-600 bg-orange-50 px-2.5 py-1 rounded-md border border-orange-100">{c.category.name}</span>}
            <p className="text-slate-600 text-sm leading-relaxed mt-3">{c.description}</p>
            {hasOptions ? <p className="text-sm font-bold text-slate-500 mt-3">{`From ${money(Math.min(...options.data!.map((o) => Number(o.price))))}`}</p>
              : <Price className="block text-2xl font-extrabold text-slate-900 mt-3" amount={c.price} cur={c.currency} />}
          </div>

          {!status && placed === false ? <PlacementRequired compact /> : status ? (
            <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100 text-sm text-indigo-700 flex items-center gap-2">Your request for this course: <StatusPill status={status} /></div>
          ) : (
            <>
              {hasOptions && <Field label="How do you want to study?">
                <div className="space-y-2">{options.data!.map((o) => (
                  <label key={o.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${optId === o.id ? 'border-orange-400 bg-orange-50' : 'border-slate-200 hover:border-slate-300'}`}>
                    <input type="radio" name="option" checked={optId === o.id} onChange={() => { setOptId(o.id); if (!o.needs_batch) setBatchId(''); }} className="accent-orange-500" />
                    <div className="flex-1 min-w-0"><p className="text-sm font-bold text-slate-800">{o.name} <span className="text-[10px] font-black uppercase text-indigo-600">{OPTION_KINDS[o.kind]}</span></p>{o.description && <p className="text-[11px] text-slate-500">{o.description}</p>}</div>
                    <Price className="text-sm font-black text-slate-900 text-right" amount={o.price} />
                  </label>
                ))}</div>
              </Field>}
              {showBatches && <Field label="Choose a batch">
                {batches.loading ? <Spinner label="Loading batches…" /> : (
                  <div className="space-y-2">
                    {(batches.data ?? []).map((b) => { const full = (seats.data?.[b.id] ?? 0) >= b.capacity; const left = b.capacity - (seats.data?.[b.id] ?? 0); return (
                      <label key={b.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${full ? 'opacity-50 cursor-not-allowed border-slate-200' : 'cursor-pointer'} ${batchId === b.id ? 'border-orange-400 bg-orange-50' : 'border-slate-200 hover:border-slate-300'}`}>
                        <input type="radio" name="batch" disabled={full} checked={batchId === b.id} onChange={() => setBatchId(b.id)} className="accent-orange-500" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-800 truncate">{b.name}</p>
                          <p className="text-[11px] text-slate-500 flex flex-wrap gap-x-3"><span className="flex items-center gap-1"><CalendarDays size={11} />{fmtDate(b.start_date)} – {fmtDate(b.end_date)}</span><span className="flex items-center gap-1"><Users size={11} />{b.instructor?.full_name ?? 'Instructor TBA'}</span></p>
                        </div>
                        {seats.data && <span className={`text-[10px] font-black ${full ? 'text-red-500' : left <= 3 ? 'text-orange-600' : 'text-slate-400'}`}>{full ? 'Full' : `${left} seats left`}</span>}
                      </label>
                    ); })}
                    {!batches.data?.length && <p className="text-xs text-slate-400">No open batch right now — send a request and we will place you in the next one.</p>}
                  </div>
                )}
              </Field>}
              {hasOptions && !opt ? <p className="text-sm text-slate-400">Choose a study option to see the price.</p>
                : <PayBox key={optId ?? 0} kind="course" item={c.id} option={optId} batch={batchId || null} label="Request Enrollment" onCancel={onClose} onDone={onDone} />}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
