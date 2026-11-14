import { useMemo, useState } from 'react';
import { Calendar, Clock, Eye, Globe, MapPin, User, Video } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { fmtDate, useData } from '../../lib/db';
import { DemoNotice, Empty, Modal, Page, PageHero, SearchInput, Spinner } from '../../components/ui';
import { dayName, hhmm, useMyEnrollments, type ClassSession, type MyBatch } from './hooks';

export default function StudentTimetable() {
  const user = useAuth((s) => s.user);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<MyBatch | null>(null);
  const { data, loading } = useMyEnrollments();
  const list = (data ?? []).filter((e) => e.batch && `${e.course?.title} ${e.batch.name}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Page>
      {user?.demo && <DemoNotice />}
      <PageHero badge="Student Portal" badgeColor="indigo" title="My Timetables" illus="session" subtitle="Browse your assigned schedules, view class details, and seamlessly join your live sessions.">
        <SearchInput value={q} onChange={setQ} placeholder="Search by course or title..." />
      </PageHero>
      {loading ? <Spinner /> : list.length === 0 ? <Empty icon={<Calendar size={28} />} title="No timetables yet" text="Your schedule appears here once you are placed in a batch." /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {list.map((e) => (
            <div key={e.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 flex flex-col hover:shadow-lg transition-all">
              <h3 className="font-extrabold text-slate-900 leading-snug">{e.course?.title} - Schedule</h3>
              <p className="text-sm font-bold text-indigo-600">{e.course?.title}</p>
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-1"><User size={12} />{e.batch?.instructor?.full_name ?? 'Instructor TBA'}</p>
              <div className="mt-4 px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-600 flex items-center gap-2"><Calendar size={14} className="text-slate-400" />{fmtDate(e.batch?.start_date)} - {fmtDate(e.batch?.end_date)}</div>
              <button onClick={() => setOpen(e)} className="mt-6 w-full py-3 rounded-xl bg-slate-900 hover:bg-orange-500 text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors"><Eye size={16} /> View Schedule Details</button>
            </div>
          ))}
        </div>
      )}
      {open && <ScheduleModal e={open} onClose={() => setOpen(null)} />}
    </Page>
  );
}

function ScheduleModal({ e, onClose }: { e: MyBatch; onClose: () => void }) {
  const { data, loading } = useData<ClassSession[]>(() =>
    supabase.from('class_sessions').select('*').eq('batch_id', e.batch!.id).order('starts_at'));
  const weekly = useMemo(() => {
    const m = new Map<string, ClassSession>();
    (data ?? []).forEach((s) => { const k = `${dayName(s.starts_at)} ${hhmm(s.starts_at)} ${s.title}`; if (!m.has(k)) m.set(k, s); });
    return [...m.values()].sort((a, b) => new Date(a.starts_at).getDay() - new Date(b.starts_at).getDay() || hhmm(a.starts_at).localeCompare(hhmm(b.starts_at)));
  }, [data]);
  const upcoming = (data ?? []).filter((s) => new Date(s.ends_at) > new Date()).slice(0, 8);
  return (
    <Modal open onClose={onClose} title={e.batch?.name} wide>
      {loading ? <Spinner /> : !data?.length ? <p className="text-sm text-slate-400 text-center py-8">No classes scheduled yet for this batch.</p> : (
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3">Weekly pattern · {weekly.length} classes per week</p>
            <div className="space-y-2">
              {weekly.map((s) => (
                <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="w-2 h-2 rounded-full bg-orange-500" />
                  <span className="text-sm font-bold text-slate-700 w-24">{dayName(s.starts_at)}</span>
                  <span className="text-xs text-slate-500 flex items-center gap-1"><Clock size={12} />{hhmm(s.starts_at)} - {hhmm(s.ends_at)}</span>
                  <span className="ml-auto text-xs font-semibold text-indigo-600">{s.title}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3">Next classes</p>
            <div className="space-y-2">
              {upcoming.map((s) => (
                <div key={s.id} className="p-3 rounded-xl border border-slate-100">
                  <div className="flex justify-between"><p className="text-sm font-bold text-slate-800">{s.title}</p>
                    <span className={`text-[10px] font-bold uppercase flex items-center gap-1 ${s.mode === 'online' ? 'text-sky-600' : 'text-orange-600'}`}>{s.mode === 'online' ? <Globe size={12} /> : <MapPin size={12} />}{s.mode === 'online' ? 'Online' : s.room ?? 'On campus'}</span></div>
                  <p className="text-xs text-slate-500">{fmtDate(s.starts_at)} · {hhmm(s.starts_at)} - {hhmm(s.ends_at)}</p>
                  {s.meeting_url && <a href={s.meeting_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-indigo-600"><Video size={12} /> Meeting link</a>}
                </div>
              ))}
              {!upcoming.length && <p className="text-xs text-slate-400">No upcoming classes.</p>}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
