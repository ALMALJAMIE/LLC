import { useState } from 'react';
import { BookOpen, ChevronRight } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { fmtDate, useData } from '../../lib/db';
import { DemoNotice, Empty, Field, Modal, Page, PageHero, Spinner, StatusPill, btnPrimary, inputCls, toast } from '../../components/ui';
import { hhmm, useMyEnrollments, type ClassSession, type MyBatch } from './hooks';

export default function StudentAttendance() {
  const user = useAuth((s) => s.user);
  const [open, setOpen] = useState<MyBatch | null>(null);
  const { data, loading } = useMyEnrollments(false);
  const list = (data ?? []).filter((e) => e.batch && e.status !== 'pending' && e.status !== 'rejected');
  return (
    <Page>
      {user?.demo && <DemoNotice />}
      <PageHero badge="My Records" badgeColor="indigo" title="My Attendance" illus="attendance" subtitle="Select a course to view your attendance calendar." />
      {loading ? <Spinner /> : list.length === 0 ? <Empty icon={<BookOpen size={28} />} title="No attendance records" text="Records appear once your classes start." /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {list.map((e) => (
            <button key={e.id} onClick={() => setOpen(e)} className="text-left bg-white rounded-3xl border border-slate-100 shadow-sm p-5 hover:shadow-lg transition-all group">
              <div className="flex justify-between items-start mb-4">
                <span className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 grid place-items-center"><BookOpen size={18} /></span>
                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full truncate max-w-[60%]">{e.batch?.name}</span>
              </div>
              <h3 className="font-extrabold text-slate-900">{e.course?.title}</h3>
              <p className="text-xs text-slate-400">Instructor: {e.batch?.instructor?.full_name ?? 'TBA'}</p>
              <div className="mt-5 flex items-center justify-between text-sm font-bold text-slate-700">View Attendance Records
                <span className="w-7 h-7 rounded-full bg-slate-100 grid place-items-center group-hover:bg-orange-500 group-hover:text-white transition-colors"><ChevronRight size={14} /></span></div>
            </button>
          ))}
        </div>
      )}
      {open && <Records e={open} onClose={() => setOpen(null)} />}
    </Page>
  );
}

function Records({ e, onClose }: { e: MyBatch; onClose: () => void }) {
  const user = useAuth((s) => s.user)!;
  const sessions = useData<ClassSession[]>(() => supabase.from('class_sessions').select('*').eq('batch_id', e.batch!.id).lte('starts_at', new Date().toISOString()).order('starts_at', { ascending: false }));
  const att = useData<{ session_id: number; status: string }[]>(() => supabase.from('attendance').select('session_id,status').eq('student_id', user.id));
  const st = (id: number) => att.data?.find((a) => a.session_id === id)?.status ?? 'absent';
  const corr = useData<{ session_id: number; status: string }[]>(() => supabase.from('attendance_corrections').select('session_id,status').eq('student_id', user.id));
  const [ask, setAsk] = useState<ClassSession | null>(null);
  const [cf, setCf] = useState({ status: 'present', reason: '' });
  const sendCorr = async () => {
    if (!ask) return;
    if (cf.reason.trim().length < 5) return toast.err('Please explain what happened.');
    const { error } = await supabase.from('attendance_corrections').insert({ session_id: ask.id, student_id: user.id, requested_status: cf.status, reason: cf.reason.trim() });
    if (error) return toast.err(error.message);
    toast.ok('Request sent to your instructor'); setAsk(null); setCf({ status: 'present', reason: '' }); corr.reload();
  };
  const total = sessions.data?.length ?? 0;
  const counted = (sessions.data ?? []).filter((s) => ['present', 'late', 'excused'].includes(st(s.id))).length;
  const pct = total ? Math.round((counted / total) * 100) : 100;
  return (
    <Modal open onClose={onClose} title={`${e.course?.title} · Attendance`} wide>
      {sessions.loading || att.loading ? <Spinner /> : (
        <>
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[{ l: 'Attendance', v: `${pct}%`, c: pct >= 80 ? 'text-emerald-600' : 'text-red-500' }, { l: 'Classes held', v: total, c: 'text-slate-800' }, { l: 'Attended', v: counted, c: 'text-indigo-600' }].map((x) => (
              <div key={x.l} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-center"><p className={`text-2xl font-black ${x.c}`}>{x.v}</p><p className="text-[10px] font-bold uppercase text-slate-400">{x.l}</p></div>
            ))}
          </div>
          {pct < 80 && total > 0 && <p className="mb-4 text-xs text-red-500 font-semibold">Your attendance is below 80%. Submit a medical certificate for missed classes if you have one.</p>}
          <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden">
            {(sessions.data ?? []).map((s) => (
              <div key={s.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div><p className="font-bold text-slate-700">{s.title}</p><p className="text-xs text-slate-400">{fmtDate(s.starts_at)} · {hhmm(s.starts_at)}</p></div>
                <div className="flex items-center gap-2"><StatusPill status={st(s.id)} />
                  {(st(s.id) === 'absent' || st(s.id) === 'late') && (corr.data?.find((c) => c.session_id === s.id && c.status === 'pending')
                    ? <span className="text-[10px] font-bold text-amber-600">Correction requested</span>
                    : <button onClick={() => setAsk(s)} className="text-[11px] font-bold text-indigo-600">Wrong?</button>)}</div>
              </div>
            ))}
            {!total && <p className="p-6 text-center text-sm text-slate-400">No classes held yet.</p>}
          </div>
        </>
      )}
      {ask && <Modal open onClose={() => setAsk(null)} title={`Attendance correction · ${ask.title}`}>
        <div className="space-y-4">
          <p className="text-sm text-slate-500">{fmtDate(ask.starts_at)} · {hhmm(ask.starts_at)} — recorded as <b>{st(ask.id)}</b>.</p>
          <Field label="It should be"><select className={inputCls} value={cf.status} onChange={(e) => setCf({ ...cf, status: e.target.value })}><option value="present">Present</option><option value="late">Late</option><option value="excused">Excused</option></select></Field>
          <Field label="What happened?"><textarea rows={3} className={inputCls} value={cf.reason} onChange={(e) => setCf({ ...cf, reason: e.target.value })} placeholder="e.g. I was in class but the QR scan did not work." /></Field>
          <button onClick={sendCorr} className={`${btnPrimary} w-full`}>Send request</button>
        </div>
      </Modal>}
    </Modal>
  );
}
