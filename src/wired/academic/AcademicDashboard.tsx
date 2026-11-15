import { useNavigate } from 'react-router-dom';
import { BookOpen, BrainCircuit, CalendarRange, Clock, FileText, Globe, GraduationCap, Layers, MapPin, MonitorPlay, PenTool, Star, UserCog, Users } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { useData } from '../../lib/db';
import { DemoNotice } from '../../components/ui';
import MiniCalendar from '../shared/MiniCalendar';

type Today = { id: number; title: string; starts_at: string; ends_at: string; mode: string; room: string | null;
  batch: { name: string; instructor: { full_name: string } | null } | null; substitute: { full_name: string } | null };
type D = { batches: number; instructors: number; students: number; courses: number;
  lessons: number; placement: number; mc: number; subs: number; reviews: number; today: Today[]; events: { starts_on: string }[] };

async function load() {
  const c = (t: string, f: (q: any) => any) => f(supabase.from(t).select('id', { count: 'exact', head: true })); // eslint-disable-line @typescript-eslint/no-explicit-any
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  const [b, i, s, co, l, p, mc, sub, rv, today, ev] = await Promise.all([
    c('batches', (q) => q.eq('status', 'active')), c('profiles', (q) => q.eq('role', 'instructor')), c('enrollments', (q) => q.eq('status', 'active')), c('courses', (q) => q.eq('status', 'published')),
    c('lessons', (q) => q.eq('status', 'pending')), c('placement_attempts', (q) => q.eq('status', 'submitted')), c('absence_requests', (q) => q.eq('status', 'pending')),
    c('substitute_requests', (q) => q.eq('status', 'pending')), c('reviews', (q) => q.eq('status', 'pending')),
    supabase.from('class_sessions').select('id,title,starts_at,ends_at,mode,room, batch:batches(name, instructor:profiles(full_name)), substitute:profiles!class_sessions_substitute_id_fkey(full_name)')
      .gte('starts_at', start.toISOString()).lt('starts_at', end.toISOString()).order('starts_at'),
    supabase.from('calendar_events').select('starts_on'),
  ]);
  return { data: { batches: b.count ?? 0, instructors: i.count ?? 0, students: s.count ?? 0, courses: co.count ?? 0, lessons: l.count ?? 0, placement: p.count ?? 0,
    mc: mc.count ?? 0, subs: sub.count ?? 0, reviews: rv.count ?? 0, today: today.data ?? [], events: ev.data ?? [] } as unknown as D, error: null };
}
const hm = (d: string) => new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

/** Home of the academic supervisor: teaching at a glance, no money. */
export default function AcademicDashboard() {
  const user = useAuth((s) => s.user)!;
  const nav = useNavigate();
  const { data } = useData<D>(load);
  const STATS = [
    { v: data?.batches ?? 0, l: 'Active Batches', icon: Layers, tint: 'text-[#e9a823]', bg: 'bg-orange-50', to: '/admin-batches' },
    { v: data?.students ?? 0, l: 'Students in Class', icon: GraduationCap, tint: 'text-indigo-600', bg: 'bg-indigo-50', to: '/admin-batches' },
    { v: data?.instructors ?? 0, l: 'Instructors', icon: Users, tint: 'text-slate-800', bg: 'bg-slate-100', to: '/admin/master-timetable' },
    { v: data?.courses ?? 0, l: 'Published Courses', icon: BookOpen, tint: 'text-emerald-600', bg: 'bg-emerald-50', to: '/admin-courses' },
  ];
  const TODO = [
    { n: data?.lessons ?? 0, l: 'Lessons to approve', icon: MonitorPlay, to: '/admin/lessons/review' },
    { n: data?.placement ?? 0, l: 'Placement results to confirm', icon: BrainCircuit, to: '/admin-placement-requests' },
    { n: data?.subs ?? 0, l: 'Substitute requests', icon: UserCog, to: '/admin/substitutes' },
    { n: data?.mc ?? 0, l: 'Medical leave requests', icon: FileText, to: '/admin/absence-approvals' },
    { n: data?.reviews ?? 0, l: 'Reviews to moderate', icon: Star, to: '/admin-reviews' },
  ];
  return (
    <div className="w-full bg-[#fafafa] font-sans min-h-screen pb-20">
      <main className="w-full px-6 lg:px-8 py-8">
        {user.demo && <DemoNotice />}
        <div className="bg-white rounded-4xl border border-slate-100 shadow-sm p-8 mb-10 flex flex-col lg:flex-row items-center justify-between">
          <div className="w-full lg:w-1/2">
            <span className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold uppercase tracking-wider mb-4 border border-indigo-100 shadow-sm"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />Academic Office</span>
            <h1 className="text-4xl font-extrabold text-slate-900 mb-3 tracking-tight">Hello, {user.name.split(' ')[0]}! <span className="inline-block animate-wave origin-bottom-right">👋</span></h1>
            <p className="text-slate-500 text-lg leading-relaxed max-w-md">You have <span className="font-extrabold text-slate-800">{TODO.reduce((a, t) => a + t.n, 0)} items</span> waiting for your review.</p>
          </div>
          <div className="w-full lg:w-1/2 flex gap-3 flex-wrap justify-start lg:justify-end mt-6 lg:mt-0">
            <button onClick={() => nav('/admin/timetable')} className="bg-slate-900 text-white px-6 py-4 rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:bg-orange-500 transition-all flex items-center gap-2"><CalendarRange size={16} /> Timetable</button>
            <button onClick={() => nav('/academic/toolkit')} className="bg-white text-slate-800 px-6 py-4 rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:shadow-xl transition-all shadow-sm border border-slate-200 flex items-center gap-2"><PenTool size={16} className="text-[#e9a823]" /> Toolkit</button>
          </div>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          <div className="xl:col-span-8 space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {STATS.map(({ v, l, icon: I, tint, bg, to }) => (
                <button key={l} onClick={() => nav(to)} className="text-left bg-white rounded-4xl p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-slate-100 relative overflow-hidden group">
                  <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 ${tint}`}><I size={100} className="rotate-12 translate-x-4 -translate-y-4" /></div>
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 ${bg}`}><I size={24} className={tint} /></div>
                  <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-1">{v}</h3><p className="text-sm font-bold text-slate-500">{l}</p>
                </button>
              ))}
            </div>
            <div className="bg-white rounded-4xl p-6 lg:p-8 border border-slate-100 shadow-sm">
              <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-extrabold text-slate-900">Today's Classes</h2><button onClick={() => nav('/admin/master-timetable')} className="text-[10px] font-extrabold uppercase tracking-widest text-[#e9a823] hover:underline">Master Schedule</button></div>
              <div className="divide-y divide-slate-100">
                {(data?.today ?? []).map((s) => (
                  <div key={s.id} className="flex items-center gap-4 py-3">
                    <span className="w-24 text-xs font-black text-slate-500 flex items-center gap-1"><Clock size={12} />{hm(s.starts_at)}–{hm(s.ends_at)}</span>
                    <div className="flex-1 min-w-0"><p className="font-bold text-sm text-slate-800 truncate">{s.title}</p><p className="text-xs text-slate-400 truncate">{s.batch?.name}</p></div>
                    <span className="text-xs text-slate-500 truncate max-w-40">{s.substitute ? <b className="text-purple-600">Cover: {s.substitute.full_name}</b> : s.batch?.instructor?.full_name ?? 'No instructor'}</span>
                    <span className={`text-[10px] font-bold uppercase flex items-center gap-1 ${s.mode === 'online' ? 'text-sky-600' : 'text-orange-600'}`}>{s.mode === 'online' ? <><Globe size={11} />Online</> : <><MapPin size={11} />{s.room ?? 'Campus'}</>}</span>
                  </div>
                ))}
                {!data?.today.length && <p className="text-sm text-slate-400 py-6 text-center">No classes today.</p>}
              </div>
            </div>
          </div>
          <div className="xl:col-span-4 space-y-8">
            <div className="bg-[#0b1a3a] rounded-4xl p-6 lg:p-8 text-white">
              <h3 className="text-lg font-extrabold mb-5">Needs your attention</h3>
              <div className="space-y-2">
                {TODO.map(({ n, l, icon: I, to }) => (
                  <button key={l} onClick={() => nav(to)} className="w-full flex items-center gap-3 p-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors text-left">
                    <span className="w-9 h-9 rounded-xl bg-white/10 grid place-items-center text-orange-400"><I size={18} /></span>
                    <span className="flex-1 text-sm font-semibold text-slate-200">{l}</span>
                    <span className={`min-w-7 h-7 px-2 rounded-full grid place-items-center text-xs font-black ${n ? 'bg-orange-500 text-white' : 'bg-white/10 text-slate-400'}`}>{n}</span>
                  </button>
                ))}
              </div>
            </div>
            <MiniCalendar marks={(data?.events ?? []).map((e) => e.starts_on)} />
          </div>
        </div>
      </main>
    </div>
  );
}
