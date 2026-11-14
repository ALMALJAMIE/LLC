import { useNavigate } from 'react-router-dom';
import { CircleCheck, Clock, Layers, PenTool, Plus, TriangleAlert, Users, Zap } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { useData } from '../../lib/db';
import { DemoNotice } from '../../components/ui';
import MiniCalendar from '../shared/MiniCalendar';
import { useRoster, useTeaching } from './hooks';

type S = { id: number; batch_id: number; title: string; starts_at: string; ends_at: string; mode: string };
const hm = (s: string) => new Date(s).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

export default function InstructorDashboard() {
  const user = useAuth((s) => s.user)!;
  const nav = useNavigate();
  const batches = useTeaching(['active', 'upcoming']);
  const ids = (batches.data ?? []).map((b) => b.id);
  const roster = useRoster(ids);
  const sessions = useData<S[]>(() => supabase.from('class_sessions').select('id,batch_id,title,starts_at,ends_at,mode').in('batch_id', ids.length ? ids : [0]).gte('starts_at', new Date(Date.now() - 30 * 864e5).toISOString()).order('starts_at'), [ids.join(',')]);
  const toGrade = useData<{ id: number }[]>(() => supabase.from('exam_results').select('id, exam:exams!inner(batch_id)').eq('status', 'submitted').in('exam.batch_id', ids.length ? ids : [0]), [ids.join(',')]);
  const att = useData<{ student_id: string; status: string; session_id: number }[]>(() => supabase.from('attendance').select('student_id,status,session_id').in('session_id', (sessions.data ?? []).map((s) => s.id).concat(0)), [sessions.data?.length]);

  const todayKey = new Date().toDateString();
  const today = (sessions.data ?? []).filter((s) => new Date(s.starts_at).toDateString() === todayKey);
  const held = (sessions.data ?? []).filter((s) => new Date(s.starts_at) < new Date());
  const atRisk = (roster.data ?? []).map((r) => {
    const mine = held.filter((s) => s.batch_id === r.batch_id);
    const ok = mine.filter((s) => att.data?.some((a) => a.session_id === s.id && a.student_id === r.student?.id && a.status !== 'absent')).length;
    return { r, pct: mine.length ? Math.round((ok / mine.length) * 100) : 100, n: mine.length };
  }).filter((x) => x.n >= 3 && x.pct < 80);
  const students = new Set((roster.data ?? []).map((r) => r.student?.id)).size;

  const CARDS = [
    { l: 'Total Students', v: students, icon: Users, tint: 'text-indigo-600 bg-indigo-50' },
    { l: 'Active Batches', v: (batches.data ?? []).filter((b) => b.status === 'active').length, icon: Layers, tint: 'text-emerald-600 bg-emerald-50' },
    { l: 'Schedule Today', v: today.length, icon: Clock, tint: 'text-red-500 bg-red-50' },
  ];
  return (
    <div className="w-full bg-[#fafafa] font-sans min-h-screen pb-20">
      <main className="w-full px-6 lg:px-8 py-8">
        {user.demo && <DemoNotice />}
        <div className="bg-white rounded-4xl border border-slate-100 shadow-sm p-8 mb-8 flex flex-col lg:flex-row items-center justify-between">
          <div className="w-full lg:w-1/2">
            <span className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-xs font-bold uppercase tracking-wider mb-4 border border-emerald-100"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />Instructor Portal • Online</span>
            <h1 className="text-4xl font-extrabold text-slate-900 mb-3 tracking-tight">Hello, {user.name.split(' ')[0]}! <span className="inline-block animate-wave origin-bottom-right">👋</span></h1>
            <p className="text-slate-500 text-lg leading-relaxed max-w-md">Welcome to your daily dashboard. You have {today.length} class{today.length === 1 ? '' : 'es'} scheduled today.</p>
          </div>
          <div className="flex gap-3 mt-6 lg:mt-0">
            <button onClick={() => nav('/instructor/toolkit')} className="bg-white text-slate-800 px-5 py-3.5 rounded-2xl font-bold uppercase tracking-widest text-[10px] border border-slate-200 shadow-sm flex items-center gap-2"><PenTool size={15} className="text-emerald-600" /> Toolkit</button>
            <button onClick={() => nav('/instructor/exams')} className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-3.5 rounded-2xl font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-orange-200 flex items-center gap-2"><Plus size={15} /> Create Exam</button>
          </div>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          <div className="xl:col-span-8 space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {CARDS.map(({ l, v, icon: I, tint }) => (
                <div key={l} className="bg-white rounded-4xl p-6 border border-slate-100 shadow-sm flex items-center gap-4"><span className={`w-12 h-12 rounded-2xl grid place-items-center ${tint}`}><I size={22} /></span><div><p className="text-3xl font-black text-slate-900">{v}</p><p className="text-sm font-bold text-slate-500">{l}</p></div></div>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-4xl p-6 border border-slate-100 shadow-sm">
                <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-extrabold text-slate-900">Today's Schedule</h3><span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-red-50 text-red-500 border border-red-100">Live</span></div>
                {today.length === 0 ? <div className="text-center py-8 border border-dashed border-slate-200 rounded-3xl"><Clock className="mx-auto text-slate-300 mb-2" /><p className="font-bold text-slate-800">Clear Schedule</p><p className="text-sm text-slate-500">No classes today. Enjoy your time!</p></div>
                  : today.map((s) => <div key={s.id} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100 mb-2"><span className="text-xs font-black text-slate-700 w-24">{hm(s.starts_at)}–{hm(s.ends_at)}</span><span className="flex-1 text-sm font-semibold truncate">{s.title}</span><span className="text-[10px] font-bold uppercase text-slate-400">{s.mode === 'online' ? 'Online' : 'F2F'}</span></div>)}
              </div>
              <div className="bg-white rounded-4xl p-6 border border-slate-100 shadow-sm">
                <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-extrabold text-slate-900">Pending Tasks</h3><button onClick={() => nav('/instructor/grading')} className="text-[10px] font-black uppercase text-indigo-600">View All</button></div>
                {!toGrade.data?.length ? <div className="text-center py-8 border border-dashed border-slate-200 rounded-3xl"><CircleCheck className="mx-auto text-slate-300 mb-2" /><p className="font-bold text-slate-800">All Caught Up</p><p className="text-sm text-slate-500">No pending grading right now.</p></div>
                  : <button onClick={() => nav('/instructor/grading')} className="w-full p-4 rounded-2xl bg-orange-50 border border-orange-100 text-left"><p className="text-2xl font-black text-orange-600">{toGrade.data.length}</p><p className="text-sm font-bold text-slate-700">submissions waiting for grades</p></button>}
              </div>
            </div>
            <div className="bg-white rounded-4xl p-6 border border-slate-100 shadow-sm">
              <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2 mb-4"><Zap size={18} className="text-yellow-400 fill-yellow-400" /> My Active Batches</h3>
              {!batches.data?.length ? <p className="text-center text-sm text-slate-500 py-8 border border-dashed border-slate-200 rounded-3xl">You haven't been assigned to any running batches yet.</p> : (
                <div className="grid sm:grid-cols-2 gap-4">{batches.data.map((b) => (
                  <button key={b.id} onClick={() => nav('/instructor/batches')} className="text-left p-4 rounded-3xl border border-slate-100 hover:shadow-lg transition-all">
                    <div className="flex justify-between"><span className="text-[10px] font-black uppercase text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">{b.code}</span><span className="text-[10px] font-black uppercase text-emerald-600">{b.status}</span></div>
                    <p className="font-extrabold text-slate-900 mt-2">{b.name}</p>
                    <p className="text-xs text-slate-500 flex items-center gap-1"><Users size={12} />{(roster.data ?? []).filter((r) => r.batch_id === b.id).length}/{b.capacity} students</p>
                  </button>
                ))}</div>
              )}
            </div>
          </div>
          <div className="xl:col-span-4 space-y-8">
            <MiniCalendar marks={(sessions.data ?? []).map((s) => s.starts_at.slice(0, 10))} />
            <div className="bg-white rounded-4xl p-6 border border-slate-100 shadow-sm">
              <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2 mb-4"><TriangleAlert size={18} className="text-red-500" /> At-Risk Students</h3>
              {!atRisk.length ? <div className="text-center py-6 border border-dashed border-slate-200 rounded-3xl"><CircleCheck className="mx-auto text-slate-300 mb-2" /><p className="font-bold text-slate-800">All Good!</p><p className="text-sm text-slate-500">No students are flagged as at-risk.</p></div>
                : atRisk.map(({ r, pct }) => <div key={r.id} className="flex justify-between items-center p-3 rounded-2xl bg-red-50/50 border border-red-100 mb-2"><span className="text-sm font-bold text-slate-800">{r.student?.full_name}</span><span className="text-xs font-black text-red-500">{pct}% attendance</span></div>)}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
