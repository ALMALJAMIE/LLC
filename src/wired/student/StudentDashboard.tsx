import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Award, Bell, ChartColumn, CircleCheck, CirclePlay, Clock, CreditCard, Layers, PenTool, User, Zap } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { fmtDate, money, useData } from '../../lib/db';
import { DemoNotice, StatusPill } from '../../components/ui';
import MiniCalendar from '../shared/MiniCalendar';
import { dayName, hhmm, type ClassSession } from './hooks';

type Overview = {
  enrollments: { id: number; status: string; batch_id: number | null; course: { title: string; code: string } | null; batch: { code: string; name: string; instructor: { full_name: string } | null } | null }[];
  results: { score: number | null; exam: { total_marks: number } | null }[];
  certs: number;
  payments: { id: number; amount: number; currency: string; status: string; created_at: string; enrollment: { course: { title: string } | null } | null }[];
  sessions: ClassSession[];
  notes: { id: number; title: string; body: string | null; created_at: string }[];
};

async function load(uid: string) {
  const [en, rs, ce, pa, no] = await Promise.all([
    supabase.from('enrollments').select('id,status,batch_id, course:courses(title,code), batch:batches(code,name, instructor:profiles(full_name))').eq('student_id', uid).in('status', ['active', 'pending', 'completed']),
    supabase.from('exam_results').select('score, exam:exams(total_marks)').eq('student_id', uid).eq('status', 'graded'),
    supabase.from('certificates').select('id', { count: 'exact', head: true }).eq('student_id', uid),
    supabase.from('payments').select('id,amount,currency,status,created_at, enrollment:enrollments(course:courses(title))').eq('student_id', uid).order('created_at', { ascending: false }).limit(4),
    supabase.from('notifications').select('id,title,body,created_at').eq('read', false).order('created_at', { ascending: false }).limit(4),
  ]);
  const enrollments = (en.data ?? []) as unknown as Overview['enrollments'];
  const ids = enrollments.filter((e) => e.status === 'active' && e.batch_id).map((e) => e.batch_id!) ;
  const ss = await supabase.from('class_sessions').select('*').in('batch_id', ids.length ? ids : [0]).gte('starts_at', new Date(Date.now() - 7 * 864e5).toISOString()).order('starts_at').limit(200);
  return {
    data: { enrollments, results: (rs.data ?? []) as unknown as Overview['results'], certs: ce.count ?? 0, payments: (pa.data ?? []) as unknown as Overview['payments'], sessions: (ss.data ?? []) as ClassSession[], notes: no.data ?? [] },
    error: en.error ?? null,
  };
}

export default function StudentDashboard() {
  const user = useAuth((s) => s.user)!;
  const nav = useNavigate();
  const [hideBanner, setHideBanner] = useState(() => localStorage.getItem('llc-notif') === '1' || (typeof Notification !== 'undefined' && Notification.permission !== 'default'));
  const { data } = useData<Overview>(() => load(user.id));
  const active = (data?.enrollments ?? []).filter((e) => e.status === 'active');
  const avg = data?.results.length ? Math.round(data.results.reduce((a, r) => a + (Number(r.score) / Number(r.exam?.total_marks || 100)) * 100, 0) / data.results.length) : 0;
  const completed = (data?.enrollments ?? []).filter((e) => e.status === 'completed').length;
  const first = user.name.split(' ')[0];

  const STATS = [
    { v: active.length, l: 'Active Batches', icon: Layers, tint: 'text-slate-800', bg: 'bg-slate-100' },
    { v: `${avg}%`, l: 'Avg Score', icon: ChartColumn, tint: 'text-[#e9a823]', bg: 'bg-orange-50' },
    { v: completed, l: 'Completed Courses', icon: CircleCheck, tint: 'text-[#f59e0b]', bg: 'bg-yellow-50' },
    { v: data?.certs ?? 0, l: 'Certificates', icon: Award, tint: 'text-indigo-600', bg: 'bg-indigo-50' },
  ];

  const enable = async () => {
    if (typeof Notification !== 'undefined') await Notification.requestPermission();
    localStorage.setItem('llc-notif', '1'); setHideBanner(true);
  };

  return (
    <div className="w-full bg-[#fafafa] text-[#1e293b] font-sans min-h-screen pb-20 overflow-x-hidden">
      <main className="w-full px-6 lg:px-8 py-8">
        {user.demo && <DemoNotice />}
        <div className="bg-white rounded-4xl border border-slate-100 shadow-sm p-8 mb-10 flex flex-col lg:flex-row items-center justify-between relative overflow-hidden">
          <div className="z-10 w-full lg:w-1/2 mt-6 lg:mt-0">
            <span className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold uppercase tracking-wider mb-4 border border-indigo-100 shadow-sm"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />Student Portal</span>
            <h1 className="text-4xl font-extrabold text-slate-900 mb-3 tracking-tight">Hello, {first}! <span className="inline-block animate-wave origin-bottom-right">👋</span></h1>
            <p className="text-slate-500 text-lg mb-4 lg:mb-0 leading-relaxed max-w-md">Welcome back. You have <span className="font-extrabold text-slate-800">{active.length} active enrollment{active.length === 1 ? '' : 's'}</span> today.</p>
          </div>
          <div className="w-full lg:w-1/2 flex gap-3 flex-wrap justify-start lg:justify-end">
            <button onClick={() => nav('/student/toolkit')} className="bg-white text-slate-800 px-6 py-4 rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:scale-105 hover:shadow-xl transition-all duration-300 shadow-sm border border-slate-200 flex items-center gap-2"><PenTool size={16} className="text-[#e9a823]" /> Student Toolkit</button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          <div className="xl:col-span-8 space-y-8">
            {!hideBanner && (
              <div className="bg-indigo-600 text-white p-4 rounded-3xl flex flex-col sm:flex-row items-center justify-between shadow-lg shadow-indigo-200 mb-6">
                <div className="flex items-center gap-3 mb-3 sm:mb-0"><Bell size={20} className="animate-bounce" /><p className="text-sm font-semibold">Enable notifications to get class reminders and important updates.</p></div>
                <div className="flex gap-2">
                  <button onClick={enable} className="bg-white text-indigo-600 px-4 py-2 rounded-xl text-xs font-bold shadow-sm hover:scale-105 transition-transform">Enable</button>
                  <button onClick={() => { localStorage.setItem('llc-notif', '1'); setHideBanner(true); }} className="bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-400 transition-colors">Dismiss</button>
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {STATS.map(({ v, l, icon: I, tint, bg }) => (
                <div key={l} className="bg-white rounded-4xl p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-slate-100 relative overflow-hidden group cursor-default">
                  <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity duration-500 ${tint}`}><I size={100} className="transform rotate-12 translate-x-4 -translate-y-4" /></div>
                  <div className="relative z-10">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 ${bg}`}><I size={24} className={tint} /></div>
                    <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-1"><span>{v}</span></h3>
                    <div className="flex items-center justify-between mt-2"><p className="text-sm font-bold text-slate-500">{l}</p></div>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <div className="flex items-center justify-between mb-6"><h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2 tracking-tight"><Zap size={20} className="text-yellow-400 fill-yellow-400" /> Current Batches</h2></div>
              {(data?.enrollments ?? []).filter((e) => e.status !== 'completed').length === 0 ? (
                <div className="bg-white p-8 rounded-4xl border border-dashed border-slate-200 text-center text-sm text-slate-500">You are not enrolled yet. <button onClick={() => nav('/student/courses')} className="font-bold text-orange-500">Browse courses</button></div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {(data?.enrollments ?? []).filter((e) => e.status !== 'completed').map((e) => {
                    const ss = (data?.sessions ?? []).filter((s) => s.batch_id === e.batch_id);
                    const week = new Map<string, ClassSession>();
                    ss.forEach((s) => { const k = `${dayName(s.starts_at)}${hhmm(s.starts_at)}${s.title}`; if (!week.has(k)) week.set(k, s); });
                    const pattern = [...week.values()];
                    return (
                      <div key={e.id} className="bg-white p-6 rounded-4xl border border-slate-100 hover:shadow-xl transition-all duration-300 group flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start mb-4 relative z-10">
                            <span className="px-3 py-1 bg-slate-50 text-slate-600 border border-slate-100 rounded-lg text-[10px] font-extrabold uppercase tracking-widest">{e.batch?.code ?? e.course?.code}</span>
                            <StatusPill status={e.status} />
                          </div>
                          <h3 className="font-extrabold text-lg text-slate-900 mb-1 line-clamp-1">{e.course?.title}</h3>
                          <p className="text-sm text-slate-500 mb-4 flex items-center gap-1.5 font-medium"><User size={14} className="text-slate-400" />{e.batch?.instructor?.full_name ?? (e.status === 'pending' ? 'Awaiting approval' : 'Instructor TBA')}</p>
                          {pattern.length > 0 && (
                            <div className="mb-4 space-y-2">
                              <div className="text-xs text-slate-600 font-medium flex items-center gap-1"><Clock size={12} />{pattern.length} classes per week</div>
                              {pattern.slice(0, 2).map((s) => (
                                <div key={s.id} className="text-xs text-slate-500 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-orange-400" /><span className="font-medium">{dayName(s.starts_at)}</span><span>{hhmm(s.starts_at)} - {hhmm(s.ends_at)}</span><span className="truncate">{s.title}</span></div>
                              ))}
                              {pattern.length > 2 && <div className="text-xs text-slate-400">+{pattern.length - 2} more classes</div>}
                            </div>
                          )}
                        </div>
                        <button disabled={e.status !== 'active'} onClick={() => nav('/student/my-learning')} className="w-full py-3.5 rounded-2xl text-[10px] font-extrabold uppercase tracking-widest flex items-center justify-center gap-2 bg-slate-900 text-white hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-200 disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none"><CirclePlay size={16} /> {e.status === 'active' ? 'Continue Learning' : 'Awaiting Approval'}</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-white rounded-4xl p-6 lg:p-8 border border-slate-100 shadow-sm hover:shadow-xl transition-shadow duration-300">
              <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Recent Transactions</h2>
                <button onClick={() => nav('/student/finances')} className="text-[10px] font-extrabold uppercase tracking-widest text-[#e9a823] hover:underline">View All</button></div>
              {!data?.payments.length ? (
                <div className="flex flex-col items-center justify-center text-center p-8 border border-dashed border-slate-200 rounded-4xl bg-white h-full min-h-50">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-slate-300"><CreditCard size={28} /></div>
                  <h4 className="text-slate-900 font-extrabold text-lg tracking-tight mb-2">No Transactions</h4>
                  <p className="text-slate-500 text-sm max-w-xs mb-6">Payment history will appear here.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {data.payments.map((p) => (
                    <div key={p.id} className="flex items-center gap-4 py-3">
                      <span className="w-10 h-10 rounded-xl bg-orange-50 text-orange-500 grid place-items-center"><CreditCard size={18} /></span>
                      <div className="flex-1 min-w-0"><p className="font-bold text-sm text-slate-800 truncate">{p.enrollment?.course?.title ?? 'Payment'}</p><p className="text-xs text-slate-400">{fmtDate(p.created_at)}</p></div>
                      <p className="font-bold text-sm text-slate-800">{money(p.amount, p.currency)}</p><StatusPill status={p.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="xl:col-span-4 space-y-8">
            <div className="rounded-4xl p-8 bg-white border border-slate-100 relative overflow-hidden text-center shadow-sm hover:shadow-xl transition-all duration-300">
              <div className="absolute top-0 left-0 w-full h-24 bg-slate-50 border-b border-slate-100 z-0" />
              <div className="relative z-10">
                <div className="w-24 h-24 mx-auto rounded-full p-1 bg-white border border-slate-100 shadow-md mb-5 mt-4"><div className="w-full h-full rounded-full bg-slate-100 flex items-center justify-center overflow-hidden"><span className="text-3xl font-extrabold text-slate-400">{first[0]?.toUpperCase()}</span></div></div>
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight mb-1">{user.name}</h2>
                <p className="text-slate-500 text-sm mb-6 font-medium">{user.email}</p>
                <div className="grid grid-cols-2 gap-4 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">Courses<br /><span className="text-slate-900 text-base mt-1 inline-block">{active.length}</span></div>
                  <div className="bg-emerald-50/50 rounded-2xl p-4 border border-emerald-100/50">Status<br /><span className="text-emerald-600 text-base mt-1 inline-block">Active</span></div>
                </div>
              </div>
            </div>
            <MiniCalendar marks={(data?.sessions ?? []).map((s) => s.starts_at.slice(0, 10))} />
            <div className="bg-white rounded-4xl p-6 lg:p-8 border border-slate-100 shadow-sm">
              <h3 className="text-xl font-extrabold text-slate-900 tracking-tight mb-6 flex items-center gap-2"><Bell size={20} /> Notifications</h3>
              {!data?.notes.length ? (
                <div className="flex flex-col items-center justify-center text-center p-8 border border-dashed border-slate-200 rounded-4xl">
                  <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-slate-300"><CircleCheck size={24} /></div>
                  <h4 className="text-slate-900 font-extrabold tracking-tight">All Caught Up</h4><p className="text-slate-500 text-sm">No new notifications at the moment.</p>
                </div>
              ) : data.notes.map((n) => (
                <div key={n.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-100 mb-2"><p className="text-sm font-bold text-slate-800">{n.title}</p>{n.body && <p className="text-xs text-slate-500">{n.body}</p>}<p className="text-[10px] text-slate-400 mt-1">{fmtDate(n.created_at)}</p></div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
