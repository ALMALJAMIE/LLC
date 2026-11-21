import { askConfirm, askText } from '../../components/dialogs';
import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { CalendarPlus, Clock, Globe, Loader2, MapPin, QrCode, Trash2, Video } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { fmtDate, useData } from '../../lib/db';
import { DemoNotice, Field, Modal, Page, PageHero, Spinner, btnPrimary, inputCls, toast } from '../../components/ui';

type B = { id: number; name: string; code: string; start_date: string | null; end_date: string | null; mode: string };
type S = { id: number; title: string; starts_at: string; ends_at: string; mode: string; meeting_url: string | null; room: string | null; qr_token: string | null };
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const t = (s: string) => new Date(s).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

/** Timetable management: pick a batch, generate weekly classes, edit links, show QR codes. Admin sees all batches; instructors their own. */
export default function ClassScheduler({ title = 'Timetable Management', badge = 'Scheduling' }: { title?: string; badge?: string }) {
  const user = useAuth((s) => s.user)!;
  const batches = useData<B[]>(() => {
    let q = supabase.from('batches').select('id,name,code,start_date,end_date,mode').in('status', ['upcoming', 'active']).order('name');
    if (user.role === 'instructor') q = q.eq('instructor_id', user.id);
    return q;
  });
  const [bid, setBid] = useState<number | null>(null);
  const batch = (batches.data ?? []).find((b) => b.id === bid) ?? null;
  const sessions = useData<S[]>(() => supabase.from('class_sessions').select('*').eq('batch_id', bid ?? 0).order('starts_at'), [bid]);
  const [adding, setAdding] = useState(false);
  const [qr, setQr] = useState<S | null>(null);
  const upcoming = (sessions.data ?? []).filter((s) => new Date(s.ends_at) > new Date());
  const past = (sessions.data ?? []).length - upcoming.length;

  const del = async (s: S) => {
    if (!await askConfirm(`Delete "${s.title}" on ${fmtDate(s.starts_at)}?`)) return;
    const { error } = await supabase.from('class_sessions').delete().eq('id', s.id);
    if (error) toast.err(error.message); else sessions.reload();
  };
  const setLink = async (s: S) => {
    const url = await askText('Meeting link (Google Meet / Zoom):', s.meeting_url ?? '');
    if (url === null) return;
    const { error } = await supabase.from('class_sessions').update({ meeting_url: url || null }).eq('id', s.id);
    if (error) toast.err(error.message); else sessions.reload();
  };

  return (
    <Page wide>
      {user.demo && <DemoNotice />}
      <PageHero badge={badge} badgeColor="indigo" title={title} illus="session" subtitle="Choose a batch, then generate its weekly classes in one step. Students see them in their timetable instantly.">
        <select value={bid ?? ''} onChange={(e) => setBid(e.target.value ? Number(e.target.value) : null)} className="w-full max-w-md px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 outline-none">
          <option value="">— Select a batch —</option>{(batches.data ?? []).map((b) => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
        </select>
      </PageHero>
      {!batch ? <p className="text-center text-slate-400 py-12">{batches.loading ? 'Loading batches…' : batches.data?.length ? 'Select a batch to manage its classes.' : 'No active or upcoming batches.'}</p> : (
        <div className="bg-white rounded-4xl border border-slate-100 shadow-sm p-6 lg:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div><h2 className="text-xl font-extrabold text-slate-900">{batch.name}</h2><p className="text-sm text-slate-500">{upcoming.length} upcoming · {past} held · {fmtDate(batch.start_date)} – {fmtDate(batch.end_date)}</p></div>
            <button onClick={() => setAdding(true)} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-orange-500 text-white text-sm font-bold"><CalendarPlus size={16} /> Add Classes</button>
          </div>
          {sessions.loading ? <Spinner /> : upcoming.length === 0 ? <p className="text-center text-slate-400 py-10 text-sm">No upcoming classes. Use “Add Classes” to build the weekly timetable.</p> : (
            <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden">
              {upcoming.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-slate-50/60">
                  <div className="w-28"><p className="text-sm font-bold text-slate-800">{new Date(s.starts_at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</p><p className="text-xs text-slate-400 flex items-center gap-1"><Clock size={11} />{t(s.starts_at)}–{t(s.ends_at)}</p></div>
                  <p className="flex-1 min-w-32 font-semibold text-slate-700">{s.title}</p>
                  <span className={`text-[10px] font-bold uppercase flex items-center gap-1 ${s.mode === 'online' ? 'text-sky-600' : 'text-orange-600'}`}>{s.mode === 'online' ? <Globe size={12} /> : <MapPin size={12} />}{s.mode === 'online' ? 'Online' : s.room ?? 'On campus'}</span>
                  {s.mode === 'online' ? <button onClick={() => setLink(s)} className={`flex items-center gap-1 text-xs font-bold ${s.meeting_url ? 'text-indigo-600' : 'text-red-500'}`}><Video size={13} />{s.meeting_url ? 'Link set' : 'Add link'}</button>
                    : <button onClick={() => setQr(s)} className="flex items-center gap-1 text-xs font-bold text-indigo-600"><QrCode size={13} />QR</button>}
                  <button onClick={() => del(s)} className="p-1.5 text-slate-300 hover:text-red-500"><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {adding && batch && <Generate batch={batch} onClose={() => setAdding(false)} onDone={() => { setAdding(false); sessions.reload(); }} />}
      {qr && <QrModal s={qr} onClose={() => setQr(null)} />}
    </Page>
  );
}

function Generate({ batch, onClose, onDone }: { batch: B; onClose: () => void; onDone: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({ title: '', days: [0, 2] as number[], start: '09:00', end: '10:30', from: batch.start_date && batch.start_date > today ? batch.start_date : today, to: batch.end_date ?? today, mode: batch.mode === 'face_to_face' ? 'face_to_face' : 'online', room: '', url: '' });
  const [busy, setBusy] = useState(false);
  const rows = useMemo(() => {
    const out: { starts_at: string; ends_at: string }[] = [];
    if (!f.from || !f.to || f.end <= f.start) return out;
    const [sh, sm] = f.start.split(':').map(Number); const [eh, em] = f.end.split(':').map(Number);
    const [fy, fm, fd] = f.from.split('-').map(Number); const last = new Date(f.to + 'T23:59:59');
    for (let d = new Date(fy, fm - 1, fd); d <= last && out.length < 400; d.setDate(d.getDate() + 1)) {
      if (!f.days.includes((d.getDay() + 6) % 7)) continue;
      out.push({ starts_at: new Date(d.getFullYear(), d.getMonth(), d.getDate(), sh, sm).toISOString(), ends_at: new Date(d.getFullYear(), d.getMonth(), d.getDate(), eh, em).toISOString() });
    }
    return out;
  }, [f]);
  const save = async () => {
    if (!rows.length) return toast.err('No dates match. Check days and dates.');
    setBusy(true);
    const { error } = await supabase.from('class_sessions').insert(rows.map((r) => ({ batch_id: batch.id, title: f.title.trim() || 'Class', mode: f.mode, room: f.room || null, meeting_url: f.url || null, ...r })));
    setBusy(false);
    if (error) toast.err(error.message); else { toast.ok(`${rows.length} classes added`); onDone(); }
  };
  return (
    <Modal open onClose={onClose} title="Add Weekly Classes" wide>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Class title"><input className={inputCls} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Grammar, Speaking" /></Field>
        <Field label="Mode"><select className={inputCls} value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })}><option value="online">Online</option><option value="face_to_face">Face to Face</option></select></Field>
        <div className="sm:col-span-2"><Field label="Days">
          <div className="flex flex-wrap gap-2">{DAYS.map((d, i) => <button type="button" key={d} onClick={() => setF({ ...f, days: f.days.includes(i) ? f.days.filter((x) => x !== i) : [...f.days, i] })} className={`px-4 py-2 rounded-xl text-sm font-bold border ${f.days.includes(i) ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-slate-600 border-slate-200'}`}>{d}</button>)}</div>
        </Field></div>
        <Field label="Start time"><input type="time" className={inputCls} value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></Field>
        <Field label="End time"><input type="time" className={inputCls} value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></Field>
        <Field label="From"><input type="date" className={inputCls} value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
        <Field label="To"><input type="date" className={inputCls} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
        {f.mode === 'online' ? <div className="sm:col-span-2"><Field label="Meeting link (optional, can be set per class later)"><input className={inputCls} value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="https://meet.google.com/..." /></Field></div>
          : <div className="sm:col-span-2"><Field label="Room"><input className={inputCls} value={f.room} onChange={(e) => setF({ ...f, room: e.target.value })} placeholder="e.g. Room 2" /></Field></div>}
      </div>
      <button disabled={busy} onClick={save} className={`${btnPrimary} w-full mt-6`}>{busy && <Loader2 size={16} className="animate-spin" />} Create {rows.length} classes</button>
    </Modal>
  );
}

function QrModal({ s, onClose }: { s: S; onClose: () => void }) {
  const url = `${location.origin}${import.meta.env.BASE_URL}student/live-attendance?code=${s.qr_token}`;
  const [img, setImg] = useState('');
  useEffect(() => { QRCode.toDataURL(url, { width: 512, margin: 1, color: { dark: '#0b1a3a' } }).then(setImg); }, [url]);
  return (
    <Modal open onClose={onClose} title={`${s.title} · Check-in`}>
      <div className="text-center">
        <img alt="QR" className="mx-auto w-64 h-64 rounded-2xl border border-slate-100" src={img} />
        <p className="text-xs text-slate-500 mt-4">Students scan this with their phone camera, or type the code:</p>
        <p className="text-3xl font-black tracking-[0.3em] text-slate-900 mt-1 font-mono">{s.qr_token}</p>
        <p className="text-[11px] text-slate-400 mt-3">Valid from 15 minutes before the class until it ends. After 10 minutes students are marked late.</p>
      </div>
    </Modal>
  );
}
