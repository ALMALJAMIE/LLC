import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CircleCheck, Loader2, MapPin, QrCode, Search } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { useData } from '../../lib/db';
import { DemoNotice, Page, toast } from '../../components/ui';
import { hhmm, useMyEnrollments, type ClassSession } from './hooks';

type S = ClassSession & { batch: { name: string } | null };

export default function StudentLiveAttendance() {
  const user = useAuth((s) => s.user);
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const mine = useMyEnrollments();
  const ids = (mine.data ?? []).map((e) => e.batch_id).filter(Boolean) as number[];
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  const today = useData<S[]>(() => supabase.from('class_sessions').select('*, batch:batches(name)').in('batch_id', ids.length ? ids : [0])
    .eq('mode', 'face_to_face').gte('starts_at', start.toISOString()).lt('starts_at', end.toISOString()).order('starts_at'), [ids.join(',')]);
  const att = useData<{ session_id: number; status: string }[]>(() => supabase.from('attendance').select('session_id,status').eq('student_id', user!.id));
  const done = useRef(false);

  const checkIn = async (c: string) => {
    if (user?.demo) return toast.err('Sign in with a real account to check in.');
    setBusy(true);
    const { data, error } = await supabase.rpc('check_in', { p_code: c });
    setBusy(false);
    if (error) return toast.err(error.message);
    const r = (data as { title: string; status: string }[])[0];
    toast.ok(`Checked in to ${r.title} (${r.status})`);
    setCode(''); att.reload();
  };

  // Scanning the instructor's QR opens this page with ?code=… and checks in automatically.
  useEffect(() => {
    const c = params.get('code');
    if (c && user && !user.demo && !done.current) { done.current = true; checkIn(c).then(() => setParams({}, { replace: true })); }
  }, [params, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = (today.data ?? []).filter((s) => `${s.title} ${s.batch?.name}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Page>
      {user?.demo && <DemoNotice />}
      <div className="bg-white rounded-4xl border border-slate-100 shadow-sm p-6 sm:p-8 mb-8 flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div>
          <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3 border bg-indigo-50 text-indigo-600 border-indigo-100">Face to Face Classes</span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-2 tracking-tight">Live Attendance</h1>
          <p className="text-slate-500 text-sm sm:text-base leading-relaxed max-w-md">Manage Face to Face class attendance securely via QR verification.</p>
        </div>
        <div className="relative w-full md:w-64">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search classes..." className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-200" />
        </div>
      </div>

      <div className="bg-[#0b1a3a] rounded-4xl p-6 sm:p-8 mb-8 text-white flex flex-col md:flex-row items-center gap-6">
        <span className="w-16 h-16 rounded-2xl bg-white/10 grid place-items-center text-orange-400 shrink-0"><QrCode size={32} /></span>
        <div className="flex-1">
          <h3 className="text-lg font-extrabold">Scan the QR code in class</h3>
          <p className="text-sm text-slate-300">Use your phone camera to scan the code your instructor shows. Or type the code here.</p>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); if (code.trim()) checkIn(code); }} className="flex gap-2 w-full md:w-auto">
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Class code" className="flex-1 md:w-44 px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white placeholder-slate-400 outline-none focus:border-orange-400 font-mono tracking-widest" />
          <button disabled={busy} className="px-5 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 font-bold text-sm flex items-center gap-2">{busy && <Loader2 size={16} className="animate-spin" />}Check In</button>
        </form>
      </div>

      {list.length === 0 ? (
        <div className="bg-white rounded-4xl border border-slate-100 shadow-sm py-14 text-center">
          <CircleCheck size={40} className="mx-auto text-emerald-500 mb-3" />
          <h3 className="font-bold text-slate-800">No Classes Found</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">We couldn't find any Face to Face classes matching your search or scheduled for today.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {list.map((s) => {
            const st = att.data?.find((a) => a.session_id === s.id)?.status;
            return (
              <div key={s.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
                <p className="text-[10px] font-bold uppercase text-indigo-600 truncate">{s.batch?.name}</p>
                <h3 className="text-lg font-extrabold text-slate-900">{s.title}</h3>
                <p className="text-sm text-slate-500">{hhmm(s.starts_at)} - {hhmm(s.ends_at)}</p>
                {s.room && <p className="text-xs text-slate-400 flex items-center gap-1 mt-1"><MapPin size={12} />{s.room}</p>}
                <div className={`mt-4 py-2.5 rounded-xl text-center text-sm font-bold ${st ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>{st ? `✓ Checked in (${st})` : 'Not checked in yet'}</div>
              </div>
            );
          })}
        </div>
      )}
    </Page>
  );
}
