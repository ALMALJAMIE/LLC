import { BookOpen, Clock, Globe, Layers, MapPin, Users } from 'lucide-react';
import EntityGrid from './EntityGrid';
import { useOptions } from './options';
import { fmtDate, money } from '../../lib/db';
import { CoverImg } from '../../components/media';

type Course = { id: number; code: string; title: string; description: string | null; category_id: number | null; level_id: number | null; units_count: number; duration_weeks: number | null; delivery: string; price: number; currency: string; status: string; category: { name: string } | null; level: { name: string } | null };

export function AdminCourses() {
  const cats = useOptions('categories', 'name');
  const lvls = useOptions('levels', 'name', { order: 'sort_order' });
  return (
    <EntityGrid<Course> table="courses" select="*, category:categories(name), level:levels(name)" order="code" badge="Curriculum Management" title="Course Directory" illus="courses" addLabel="Create New Course"
      subtitle="Create, manage, and organize your educational content."
      defaults={{ status: 'published', delivery: 'online', currency: 'USD', price: 0, units_count: 8 }}
      fields={[
        { k: 'code', label: 'Code', required: true, half: true, ph: 'LLC-GE07' }, { k: 'status', label: 'Status', type: 'select', half: true, required: true, options: [{ value: 'draft', label: 'Draft' }, { value: 'published', label: 'Published (Live)' }, { value: 'archived', label: 'Archived' }] },
        { k: 'title', label: 'Title', required: true }, { k: 'description', label: 'Description', type: 'textarea' },
        { k: 'category_id', label: 'Category', type: 'select', options: cats, half: true }, { k: 'level_id', label: 'Level', type: 'select', options: lvls, half: true },
        { k: 'delivery', label: 'Delivery', type: 'select', half: true, required: true, options: [{ value: 'online', label: 'Online' }, { value: 'face_to_face', label: 'Face to Face' }, { value: 'hybrid', label: 'Hybrid' }] },
        { k: 'units_count', label: 'Units', type: 'number', half: true }, { k: 'duration_weeks', label: 'Duration (weeks)', type: 'number', half: true },
        { k: 'price', label: 'Price (USD, 0 = free)', type: 'number', half: true, required: true },
      ]}
      toRow={(f) => ({ ...f, category_id: f.category_id ? Number(f.category_id) : null, level_id: f.level_id ? Number(f.level_id) : null, price: Number(f.price ?? 0), units_count: Number(f.units_count ?? 0), duration_weeks: f.duration_weeks ? Number(f.duration_weeks) : null })}
      searchText={(r) => `${r.title} ${r.code}`}
      card={(r) => (
        <>
          <div className="relative h-40 rounded-3xl overflow-hidden mb-4 -mx-2 -mt-2">
            <CoverImg className="w-full h-full" alt={r.title} />
            <span className={`absolute top-3 left-3 text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${r.status === 'published' ? 'bg-white text-emerald-600' : 'bg-slate-900 text-white'}`}>{r.status === 'published' ? 'Live' : r.status}</span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100">{r.code}</span>
          <h3 className="text-lg font-bold text-slate-900 mt-2 mb-2 line-clamp-2">{r.title}</h3>
          <div className="flex flex-wrap gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1"><Clock size={12} />{r.duration_weeks ?? '—'} weeks</span>
            <span className="flex items-center gap-1"><BookOpen size={12} />{r.units_count} units</span>
            <span className="flex items-center gap-1">{r.delivery === 'face_to_face' ? <MapPin size={12} /> : <Globe size={12} />}{r.delivery.replace(/_/g, ' ')}</span>
          </div>
          <p className="mt-2 text-sm font-extrabold text-slate-800">{Number(r.price) ? money(r.price, r.currency) : 'Free'} <span className="text-xs font-medium text-slate-400">· {r.level?.name ?? 'All levels'}</span></p>
        </>
      )} />
  );
}

type Batch = { id: number; code: string; name: string; course_id: number; session_id: number | null; instructor_id: string | null; start_date: string | null; end_date: string | null; capacity: number; mode: string; status: string; course: { title: string } | null; instructor: { full_name: string } | null; enrollments: { count: number }[] };

export function AdminBatches() {
  const courses = useOptions('courses', 'title');
  const sessions = useOptions('academic_sessions', 'name');
  const teachers = useOptions('profiles', 'full_name', { inList: ['role', ['instructor', 'admin']] });
  return (
    <EntityGrid<Batch> table="batches" select="*, course:courses(title), instructor:profiles(full_name), enrollments(count)" order="start_date" ascending={false}
      badge="Class Management" title="Batches" illus="batch" addLabel="Create New Batch"
      subtitle="Open batches for each course, assign instructors and set capacity and dates."
      defaults={{ capacity: 20, mode: 'online', status: 'upcoming' }}
      fields={[
        { k: 'code', label: 'Batch code', required: true, half: true, ph: 'B-GE01-JAN27' }, { k: 'status', label: 'Status', type: 'select', half: true, required: true, options: ['upcoming', 'active', 'completed', 'cancelled'].map((v) => ({ value: v, label: v })) },
        { k: 'name', label: 'Batch name', required: true, ph: 'English Beginner - January 2027' },
        { k: 'course_id', label: 'Course', type: 'select', options: courses, required: true }, { k: 'session_id', label: 'Academic session', type: 'select', options: sessions, half: true },
        { k: 'instructor_id', label: 'Instructor', type: 'select', options: teachers, half: true },
        { k: 'start_date', label: 'Start', type: 'date', half: true }, { k: 'end_date', label: 'End', type: 'date', half: true },
        { k: 'mode', label: 'Mode', type: 'select', half: true, options: [{ value: 'online', label: 'Online' }, { value: 'face_to_face', label: 'Face to Face' }, { value: 'hybrid', label: 'Hybrid' }] },
        { k: 'capacity', label: 'Capacity', type: 'number', half: true },
      ]}
      toRow={(f) => ({ ...f, course_id: Number(f.course_id), session_id: f.session_id ? Number(f.session_id) : null, capacity: Number(f.capacity ?? 20) })}
      searchText={(r) => `${r.name} ${r.code} ${r.course?.title ?? ''}`}
      card={(r) => {
        const n = r.enrollments?.[0]?.count ?? 0;
        return (
          <>
            <div className="flex justify-between items-start mb-3">
              <span className="px-3 py-1 bg-slate-50 text-slate-600 border border-slate-100 rounded-lg text-[10px] font-extrabold uppercase tracking-widest">{r.code}</span>
              <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${r.status === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : r.status === 'upcoming' ? 'bg-sky-50 text-sky-600 border-sky-100' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>{r.status}</span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 line-clamp-2">{r.name}</h3>
            <p className="text-xs text-slate-500 mb-3">{r.course?.title} · {r.instructor?.full_name ?? 'No instructor'}</p>
            <div className="flex justify-between text-xs text-slate-500"><span className="flex items-center gap-1"><Layers size={12} />{fmtDate(r.start_date)} – {fmtDate(r.end_date)}</span><span className="flex items-center gap-1 font-bold"><Users size={12} />{n}/{r.capacity}</span></div>
            <div className="h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden"><div className="h-full bg-orange-500 rounded-full" style={{ width: `${Math.min(100, (n / (r.capacity || 1)) * 100)}%` }} /></div>
          </>
        );
      }} />
  );
}
