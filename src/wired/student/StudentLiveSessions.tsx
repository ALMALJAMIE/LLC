import { useState } from 'react';
import { Clock, Filter, Video } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { fmtDate, useData } from '../../lib/db';
import { DemoNotice, Empty, Page, PageHero, Spinner } from '../../components/ui';
import { hhmm, useMyEnrollments, type ClassSession } from './hooks';

type S = ClassSession & { batch: { name: string } | null };

export default function StudentLiveSessions() {
  const user = useAuth((s) => s.user);
  const [batch, setBatch] = useState<string>('all');
  const mine = useMyEnrollments();
  const ids = (mine.data ?? []).map((e) => e.batch_id).filter(Boolean) as number[];
  const { data, loading } = useData<S[]>(() =>
    supabase.from('class_sessions').select('*, batch:batches(name)').in('batch_id', ids.length ? ids : [0]).eq('mode', 'online')
      .gte('ends_at', new Date().toISOString()).order('starts_at').limit(60), [ids.join(',')]);
  const list = (data ?? []).filter((s) => batch === 'all' || String(s.batch_id) === batch);
  const now = Date.now();
  return (
    <Page>
      {user?.demo && <DemoNotice />}
      <PageHero badge="Virtual Classrooms" badgeColor="indigo" title="My Live Sessions" illus="lesson" subtitle="Join your upcoming classes via Google Meet. Only sessions marked as 'Live' can be joined.">
        <div className="relative max-w-md flex items-center bg-slate-50 border border-slate-200 rounded-xl">
          <span className="p-2 m-1.5 rounded-lg bg-white border border-slate-200 text-slate-400"><Filter size={16} /></span>
          <select value={batch} onChange={(e) => setBatch(e.target.value)} className="flex-1 bg-transparent outline-none text-sm text-slate-700 pr-3 py-2">
            <option value="all">All My Batches</option>
            {(mine.data ?? []).filter((e) => e.batch).map((e) => <option key={e.id} value={e.batch!.id}>{e.batch!.name}</option>)}
          </select>
        </div>
      </PageHero>
      {loading || mine.loading ? <Spinner /> : list.length === 0 ? (
        <Empty icon={<Video size={28} />} title="No Sessions Found" text="There are currently no live sessions scheduled for your selected batches." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {list.map((s) => {
            const live = now >= new Date(s.starts_at).getTime() - 15 * 60000 && now <= new Date(s.ends_at).getTime();
            return (
              <div key={s.id} className={`bg-white rounded-3xl border shadow-sm p-6 flex flex-col ${live ? 'border-emerald-200 ring-4 ring-emerald-50' : 'border-slate-100'}`}>
                <div className="flex justify-between items-start mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100 truncate max-w-[70%]">{s.batch?.name}</span>
                  {live ? <span className="flex items-center gap-1.5 text-[10px] font-black uppercase text-emerald-600"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />Live</span>
                    : <span className="text-[10px] font-bold uppercase text-slate-400">Scheduled</span>}
                </div>
                <h3 className="text-lg font-extrabold text-slate-900">{s.title}</h3>
                <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-1"><Clock size={14} />{fmtDate(s.starts_at)} · {hhmm(s.starts_at)} - {hhmm(s.ends_at)}</p>
                <a href={live && s.meeting_url ? s.meeting_url : undefined} target="_blank" rel="noreferrer"
                  className={`mt-6 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${live && s.meeting_url ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-100' : 'bg-slate-100 text-slate-400 pointer-events-none'}`}>
                  <Video size={16} /> {live ? 'Join Session' : 'Opens 15 min before class'}
                </a>
              </div>
            );
          })}
        </div>
      )}
    </Page>
  );
}
