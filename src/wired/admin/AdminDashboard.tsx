import { useNavigate } from 'react-router-dom';
import { Banknote, BookOpen, ClipboardCheck, FileText, GraduationCap, Layers, PenTool, Star, UserPlus, Users } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { fmtDate, money, useData } from '../../lib/db';
import { DemoNotice, StatusPill } from '../../components/ui';
import MiniCalendar from '../shared/MiniCalendar';

type D = { students: number; instructors: number; courses: number; batches: number; revenue: number; pendingEnroll: number; pendingPay: number; pendingMc: number; pendingReviews: number;
  recent: { id: number; status: string; created_at: string; student: { full_name: string } | null; course: { title: string } | null }[]; events: { starts_on: string }[] };

async function load() {
  const c = (t: string, f?: (q: any) => any) => { let q: any = supabase.from(t).select('id', { count: 'exact', head: true }); if (f) q = f(q); return q; }; // eslint-disable-line @typescript-eslint/no-explicit-any
  const [s, i, co, b, pe, pp, mc, rv, paid, recent, ev] = await Promise.all([
    c('profiles', (q) => q.eq('role', 'student')), c('profiles', (q) => q.eq('role', 'instructor')), c('courses', (q) => q.eq('status', 'published')), c('batches', (q) => q.eq('status', 'active')),
    c('enrollments', (q) => q.eq('status', 'pending')), c('payments', (q) => q.eq('status', 'pending')), c('absence_requests', (q) => q.eq('status', 'pending')), c('reviews', (q) => q.eq('status', 'pending')),
    supabase.from('payments').select('amount').eq('status', 'paid'),
    supabase.from('enrollments').select('id,status,created_at, student:profiles!enrollments_student_id_fkey(full_name), course:courses(title)').order('created_at', { ascending: false }).limit(6),
    supabase.from('calendar_events').select('starts_on'),
  ]);
  return { data: { students: s.count ?? 0, instructors: i.count ?? 0, courses: co.count ?? 0, batches: b.count ?? 0, pendingEnroll: pe.count ?? 0, pendingPay: pp.count ?? 0, pendingMc: mc.count ?? 0, pendingReviews: rv.count ?? 0,
    revenue: (paid.data ?? []).reduce((a: number, p: { amount: number }) => a + Number(p.amount), 0), recent: recent.data ?? [], events: ev.data ?? [] } as unknown as D, error: null };
}

export default function AdminDashboard() {
  const user = useAuth((s) => s.user)!;
  const nav = useNavigate();
  const { data } = useData<D>(load);
  const STATS = [
    { v: data?.students ?? 0, l: 'Students', icon: GraduationCap, tint: 'text-indigo-600', bg: 'bg-indigo-50', to: '/admin-users' },
    { v: data?.instructors ?? 0, l: 'Instructors', icon: Users, tint: 'text-slate-800', bg: 'bg-slate-100', to: '/admin-users' },
    { v: data?.batches ?? 0, l: 'Active Batches', icon: Layers, tint: 'text-[#e9a823]', bg: 'bg-orange-50', to: '/admin-batches' },
    { v: money(data?.revenue ?? 0), l: 'Revenue', icon: Banknote, tint: 'text-emerald-600', bg: 'bg-emerald-50', to: '/admin-financials' },
  ];
  const TODO = [
    { n: data?.pendingEnroll ?? 0, l: 'Enrollments to review', icon: ClipboardCheck, to: '/admin-enrollments' },
    { n: data?.pendingPay ?? 0, l: 'Payments to verify', icon: Banknote, to: '/admin-financials' },
    { n: data?.pendingMc ?? 0, l: 'Medical leave requests', icon: FileText, to: '/admin/absence-approvals' },
    { n: data?.pendingReviews ?? 0, l: 'Reviews to moderate', icon: Star, to: '/admin-reviews' },
  ];
  return (
    <div className="w-full bg-[#fafafa] font-sans min-h-screen pb-20">
      <main className="w-full px-6 lg:px-8 py-8">
        {user.demo && <DemoNotice />}
        <div className="bg-white rounded-4xl border border-slate-100 shadow-sm p-8 mb-10 flex flex-col lg:flex-row items-center justify-between">
          <div className="w-full lg:w-1/2">
            <span className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold uppercase tracking-wider mb-4 border border-indigo-100 shadow-sm"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />Admin Portal</span>
            <h1 className="text-4xl font-extrabold text-slate-900 mb-3 tracking-tight">Hello, {user.name.split(' ')[0]}! <span className="inline-block animate-wave origin-bottom-right">👋</span></h1>
            <p className="text-slate-500 text-lg leading-relaxed max-w-md">You have <span className="font-extrabold text-slate-800">{TODO.reduce((a, t) => a + t.n, 0)} items</span> waiting for your review.</p>
          </div>
          <div className="w-full lg:w-1/2 flex gap-3 flex-wrap justify-start lg:justify-end mt-6 lg:mt-0">
            <button onClick={() => nav('/admin/enroll-student')} className="bg-slate-900 text-white px-6 py-4 rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:bg-orange-500 transition-all flex items-center gap-2"><UserPlus size={16} /> Enroll Student</button>
            <button onClick={() => nav('/admin/toolkit')} className="bg-white text-slate-800 px-6 py-4 rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:shadow-xl transition-all shadow-sm border border-slate-200 flex items-center gap-2"><PenTool size={16} className="text-[#e9a823]" /> Toolkit</button>
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
              <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-extrabold text-slate-900">Recent Enrollments</h2><button onClick={() => nav('/admin-enrollments')} className="text-[10px] font-extrabold uppercase tracking-widest text-[#e9a823] hover:underline">View All</button></div>
              <div className="divide-y divide-slate-100">
                {(data?.recent ?? []).map((e) => (
                  <div key={e.id} className="flex items-center gap-4 py-3">
                    <span className="w-10 h-10 rounded-full bg-slate-100 grid place-items-center font-bold text-slate-500">{e.student?.full_name?.[0]}</span>
                    <div className="flex-1 min-w-0"><p className="font-bold text-sm text-slate-800 truncate">{e.student?.full_name}</p><p className="text-xs text-slate-400 truncate">{e.course?.title}</p></div>
                    <span className="text-xs text-slate-400">{fmtDate(e.created_at)}</span><StatusPill status={e.status} />
                  </div>
                ))}
                {!data?.recent.length && <p className="text-sm text-slate-400 py-6 text-center">No enrollments yet.</p>}
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
            <div className="bg-white rounded-4xl p-6 border border-slate-100 shadow-sm flex items-center gap-4"><span className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 grid place-items-center"><BookOpen size={22} /></span><div><p className="text-2xl font-black">{data?.courses ?? 0}</p><p className="text-xs font-bold text-slate-500">Published courses</p></div></div>
          </div>
        </div>
      </main>
    </div>
  );
}
