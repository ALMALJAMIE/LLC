import { useEffect, useState } from 'react';
import { Award, BookOpen, Compass, Crown, Flame, Footprints, GraduationCap, Library, Pencil, Target, Timer, type LucideIcon } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { toast } from '../../components/ui';

type Badge = { code: string; title: string; description: string; icon: string; earned_at: string | null };
type Stats = { streak: number; week: { day: string; minutes: number }[]; minutes_week: number; minutes_total: number; lessons_done: number; badges: Badge[]; new_badges: string[] };
const ICONS: Record<string, LucideIcon> = { compass: Compass, footprints: Footprints, book: BookOpen, library: Library, target: Target, flame: Flame, crown: Crown, pencil: Pencil, graduation: GraduationCap, award: Award };

/** Streak, minutes this week, a 7-day chart and badges, on the student dashboard. */
export default function LearningStats() {
  const user = useAuth((s) => s.user)!;
  const [s, setS] = useState<Stats | null>(null);
  useEffect(() => {
    if (user.demo) return;
    supabase.rpc('my_learning_stats').then(({ data }) => {
      const st = (data as Stats[] | null)?.[0]; if (!st) return;
      setS(st);
      st.new_badges?.forEach((c) => { const b = st.badges.find((x) => x.code === c); if (b) toast.ok(`New badge: ${b.title} 🏅`); });
    });
  }, [user]);
  if (!s) return null;
  const max = Math.max(10, ...s.week.map((d) => d.minutes));
  const earned = s.badges.filter((b) => b.earned_at);
  return (
    <div className="grid lg:grid-cols-3 gap-5 mb-10">
      <div className="bg-gradient-to-br from-orange-500 to-amber-500 text-white rounded-4xl p-6 shadow-lg shadow-orange-200">
        <Flame size={28} />
        <p className="text-4xl font-black mt-2">{s.streak} <span className="text-lg font-bold">day{s.streak === 1 ? '' : 's'}</span></p>
        <p className="text-sm font-bold opacity-90">Study streak</p>
        <p className="text-xs opacity-80 mt-3">{s.streak ? 'Study at least one minute today to keep it going.' : 'Open a lesson today to start a streak.'}</p>
      </div>
      <div className="bg-white rounded-4xl border border-slate-100 shadow-sm p-6">
        <div className="flex items-center gap-2"><Timer size={18} className="text-indigo-600" /><p className="flex-1 font-extrabold text-slate-900">This week</p><span className="text-sm font-black text-indigo-700">{s.minutes_week} min</span></div>
        <div className="flex items-end gap-2 h-28 mt-4">{s.week.map((d) => {
          const today = d.day === new Date().toISOString().slice(0, 10);
          return (
            <div key={d.day} className="flex-1 h-full flex flex-col items-center gap-1">
              <div className="w-full rounded-lg bg-slate-100 relative flex-1" title={`${d.minutes} min`}><div className={`absolute bottom-0 inset-x-0 rounded-lg ${today ? 'bg-orange-500' : 'bg-indigo-500'}`} style={{ height: `${Math.min(100, (d.minutes / max) * 100)}%` }} /></div>
              <span className={`text-[10px] font-bold ${today ? 'text-orange-600' : 'text-slate-400'}`}>{new Date(d.day).toLocaleDateString('en-GB', { weekday: 'narrow' })}</span>
            </div>
          );
        })}</div>
        <p className="text-[11px] text-slate-400 mt-2">{s.lessons_done} lessons completed · {Math.round(s.minutes_total / 60 * 10) / 10} hours in total</p>
      </div>
      <div className="bg-white rounded-4xl border border-slate-100 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-3"><Award size={18} className="text-amber-500" /><p className="flex-1 font-extrabold text-slate-900">Badges</p><span className="text-xs font-bold text-slate-400">{earned.length}/{s.badges.length}</span></div>
        <div className="grid grid-cols-5 gap-2">{s.badges.map((b) => {
          const I = ICONS[b.icon] ?? Award;
          return <div key={b.code} title={`${b.title} — ${b.description}`} className={`aspect-square rounded-2xl grid place-items-center ${b.earned_at ? 'bg-amber-50 text-amber-500 border border-amber-200' : 'bg-slate-50 text-slate-300 border border-slate-100'}`}><I size={20} /></div>;
        })}</div>
        <p className="text-[11px] text-slate-400 mt-3">{earned.length ? `Latest: ${earned.sort((a, b) => (b.earned_at ?? '').localeCompare(a.earned_at ?? ''))[0].title}` : 'Complete lessons and quizzes to earn badges.'}</p>
      </div>
    </div>
  );
}

/** Counts study time while a lesson page is open and visible (one call per minute). */
export function useStudyHeartbeat(active: boolean) {
  const user = useAuth((s) => s.user);
  useEffect(() => {
    if (!active || !user || user.demo || user.role !== 'student') return;
    const t = setInterval(() => { if (document.visibilityState === 'visible') supabase.rpc('log_study_time', { p_seconds: 60 }).then(() => {}); }, 60000);
    return () => clearInterval(t);
  }, [active, user]);
}
