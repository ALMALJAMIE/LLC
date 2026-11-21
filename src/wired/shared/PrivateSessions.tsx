import { useMemo, useState } from 'react';
import { CalendarPlus, CheckCircle2, Clock, Loader2, MapPin, Plus, Video, X } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { isAcademicLead } from '../../lib/nav';
import { supabase } from '../../lib/supabase';
import { fmtDateTime, useData } from '../../lib/db';
import { usePlacementDone } from '../../lib/placement';
import { DemoNotice, Field, Modal, Page, PageHero, Spinner, StatusPill, btnAccent, btnPrimary, inputCls, toast } from '../../components/ui';
import { askConfirm, askText } from '../../components/dialogs';
import PlacementRequired from '../../components/PlacementRequired';

type Slot = { id: number; instructor_id: string; starts_at: string; ends_at: string; mode: string; meeting_url: string | null; room: string | null; note: string | null; status: string; booked_by: string | null; student_note: string | null;
  instructor?: { full_name: string } | null; student?: { full_name: string; email: string; phone: string | null } | null };
const dayKey = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

// ---------------------------------------------------------------- instructor / academic
export function StaffPrivateSessions() {
  const user = useAuth((s) => s.user)!;
  const lead = isAcademicLead(user.role);
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const { data, loading, reload } = useData<Slot[]>(() => {
    const q = supabase.from('private_slots').select('*, instructor:profiles!private_slots_instructor_id_fkey(full_name), student:profiles!private_slots_booked_by_fkey(full_name,email,phone)').neq('status', 'cancelled').order('starts_at');
    return lead ? q : q.eq('instructor_id', user.id);
  });
  const [add, setAdd] = useState(false);
  const now = Date.now();
  const list = (data ?? []).filter((s) => (tab === 'upcoming' ? new Date(s.ends_at).getTime() >= now : new Date(s.ends_at).getTime() < now));
  const booked = (data ?? []).filter((s) => s.status === 'booked' && new Date(s.starts_at).getTime() > now).length;
  const remove = async (s: Slot) => {
    if (s.status === 'booked') {
      if (!(await askConfirm(`Cancel the session booked by ${s.student?.full_name}? The student is notified.`))) return;
      const { error } = await supabase.rpc('cancel_private_booking', { p_slot: s.id }); if (error) return toast.err(error.message);
    } else {
      if (!(await askConfirm('Delete this free time?'))) return;
      const { error } = await supabase.from('private_slots').delete().eq('id', s.id); if (error) return toast.err(error.message);
    }
    reload();
  };
  const markDone = async (s: Slot) => { const { error } = await supabase.from('private_slots').update({ status: 'done' }).eq('id', s.id); if (error) toast.err(error.message); else reload(); };
  const editLink = async (s: Slot) => {
    const url = await askText('Meeting link (Google Meet / Zoom):', s.meeting_url ?? ''); if (url === null) return;
    const { error } = await supabase.from('private_slots').update({ meeting_url: url.trim() || null }).eq('id', s.id); if (error) toast.err(error.message); else reload();
  };
  return (
    <Page wide>
      {user.demo && <DemoNotice />}
      <PageHero badge="Teaching" badgeColor="indigo" title="Private Sessions" illus="calendar" subtitle="Publish the times you are free for one-to-one sessions. Students with an active course book them, and you are notified.">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="inline-flex bg-slate-50 p-1 rounded-xl border border-slate-200">{(['upcoming', 'past'] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-xs font-bold capitalize ${tab === t ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>{t}</button>)}</div>
          <button onClick={() => setAdd(true)} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-orange-500 text-white text-sm font-bold"><CalendarPlus size={16} /> Add Free Times</button>
          {booked > 0 && <span className="text-xs font-bold text-emerald-700">{booked} booked</span>}
        </div>
      </PageHero>
      {loading ? <Spinner /> : !list.length ? <p className="text-center text-slate-400 py-12">{tab === 'upcoming' ? 'No free times yet. Use “Add Free Times”.' : 'Nothing here.'}</p> : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm divide-y divide-slate-100">{list.map((s) => (
          <div key={s.id} className="px-5 py-4 flex flex-wrap items-center gap-3">
            <div className="w-44"><p className="font-bold text-slate-800">{dayKey(s.starts_at)}</p><p className="text-xs text-slate-500 flex items-center gap-1"><Clock size={12} />{time(s.starts_at)} – {time(s.ends_at)}</p></div>
            <div className="flex-1 min-w-48">
              {lead && <p className="text-[11px] text-slate-400">{s.instructor?.full_name}</p>}
              {s.status === 'booked' || s.status === 'done' ? <><p className="font-bold text-slate-800">{s.student?.full_name}</p><p className="text-[11px] text-slate-400">{s.student?.email}{s.student?.phone ? ` · ${s.student.phone}` : ''}</p>{s.student_note && <p className="text-xs text-slate-600 mt-1">“{s.student_note}”</p>}</>
                : <p className="text-sm text-slate-400">Free — not booked yet</p>}
            </div>
            <span className="text-xs text-slate-500 flex items-center gap-1">{s.mode === 'online' ? <><Video size={13} />{s.meeting_url ? 'Link set' : 'No link yet'}</> : <><MapPin size={13} />{s.room ?? 'Centre'}</>}</span>
            <StatusPill status={s.status === 'open' ? 'open' : s.status} />
            {s.mode === 'online' && s.status !== 'done' && <button onClick={() => editLink(s)} className="text-xs font-bold text-indigo-600">Link</button>}
            {s.status === 'booked' && new Date(s.starts_at).getTime() < now && <button onClick={() => markDone(s)} className="text-xs font-bold text-emerald-600 flex items-center gap-1"><CheckCircle2 size={14} />Held</button>}
            {s.status !== 'done' && <button onClick={() => remove(s)} className="p-1.5 text-slate-400 hover:text-red-500" title={s.status === 'booked' ? 'Cancel booking' : 'Delete'}><X size={16} /></button>}
          </div>
        ))}</div>
      )}
      {add && <AddSlots onClose={() => setAdd(false)} onDone={() => { setAdd(false); reload(); }} />}
    </Page>
  );
}

function AddSlots({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const user = useAuth((s) => s.user)!;
  const lead = isAcademicLead(user.role);
  const teachers = useData<{ id: string; full_name: string }[]>(() => (lead ? supabase.from('profiles').select('id,full_name').eq('role', 'instructor').order('full_name') : Promise.resolve({ data: [], error: null })));
  const [f, setF] = useState({ instructor_id: lead ? '' : user.id, date: '', start: '10:00', minutes: '60', count: '1', weeks: '1', mode: 'online', meeting_url: '', room: '' });
  const [busy, setBusy] = useState(false);
  const rows = useMemo(() => {
    if (!f.date || !f.start) return [];
    const out: { starts_at: string; ends_at: string }[] = [];
    const mins = Number(f.minutes) || 60;
    for (let w = 0; w < Math.min(Number(f.weeks) || 1, 12); w++) {
      for (let i = 0; i < Math.min(Number(f.count) || 1, 8); i++) {
        const s = new Date(`${f.date}T${f.start}`); s.setDate(s.getDate() + 7 * w); s.setMinutes(s.getMinutes() + i * mins);
        out.push({ starts_at: s.toISOString(), ends_at: new Date(s.getTime() + mins * 60000).toISOString() });
      }
    }
    return out;
  }, [f]);
  const save = async () => {
    if (!f.instructor_id) return toast.err('Choose the instructor.');
    if (!rows.length) return toast.err('Choose the date and start time.');
    if (new Date(rows[0].starts_at) < new Date()) return toast.err('Choose a time in the future.');
    setBusy(true);
    const { error } = await supabase.from('private_slots').insert(rows.map((r) => ({ ...r, instructor_id: f.instructor_id, mode: f.mode, meeting_url: f.mode === 'online' ? f.meeting_url || null : null, room: f.mode === 'face_to_face' ? f.room || null : null })));
    setBusy(false);
    if (error) toast.err(error.message); else { toast.ok(`${rows.length} free times published`); onDone(); }
  };
  return (
    <Modal open onClose={onClose} title="Add Free Times" wide>
      <div className="space-y-4">
        {lead && <Field label="Instructor"><select className={inputCls} value={f.instructor_id} onChange={(e) => setF({ ...f, instructor_id: e.target.value })}><option value="">— Choose —</option>{(teachers.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}</select></Field>}
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Date"><input type="date" className={inputCls} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="First session starts"><input type="time" className={inputCls} value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></Field>
          <Field label="Length (minutes)"><select className={inputCls} value={f.minutes} onChange={(e) => setF({ ...f, minutes: e.target.value })}>{['30', '45', '60', '90'].map((m) => <option key={m}>{m}</option>)}</select></Field>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Sessions in a row that day"><input type="number" min={1} max={8} className={inputCls} value={f.count} onChange={(e) => setF({ ...f, count: e.target.value })} /></Field>
          <Field label="Repeat weekly for (weeks)"><input type="number" min={1} max={12} className={inputCls} value={f.weeks} onChange={(e) => setF({ ...f, weeks: e.target.value })} /></Field>
        </div>
        <div className="flex gap-2">{([['online', 'Online'], ['face_to_face', 'At the centre']] as const).map(([v, l]) => <button key={v} type="button" onClick={() => setF({ ...f, mode: v })} className={`px-4 py-2.5 rounded-xl border text-sm font-bold ${f.mode === v ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-slate-200 text-slate-600'}`}>{l}</button>)}</div>
        {f.mode === 'online' ? <Field label="Meeting link (you can add it later)"><input className={inputCls} value={f.meeting_url} onChange={(e) => setF({ ...f, meeting_url: e.target.value })} placeholder="https://meet.google.com/..." /></Field>
          : <Field label="Room"><input className={inputCls} value={f.room} onChange={(e) => setF({ ...f, room: e.target.value })} placeholder="e.g. Room 2" /></Field>}
        {rows.length > 0 && <p className="text-xs text-slate-500">{rows.length} free times: first {fmtDateTime(rows[0].starts_at)}{rows.length > 1 ? `, last ${fmtDateTime(rows[rows.length - 1].starts_at)}` : ''}.</p>}
        <button disabled={busy} onClick={save} className={`${btnPrimary} w-full`}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Publish</button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- student
export function StudentPrivateSessions() {
  const user = useAuth((s) => s.user)!;
  const placed = usePlacementDone();
  const { data, loading, reload } = useData<Slot[]>(() => supabase.from('private_slots').select('*, instructor:profiles!private_slots_instructor_id_fkey(full_name)').gte('ends_at', new Date().toISOString()).order('starts_at'));
  const [pick, setPick] = useState<Slot | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const mine = (data ?? []).filter((s) => s.booked_by === user.id && s.status === 'booked');
  const free = (data ?? []).filter((s) => s.status === 'open' && new Date(s.starts_at).getTime() > Date.now() + 2 * 3600000);
  const days = useMemo(() => { const m = new Map<string, Slot[]>(); free.forEach((s) => m.set(dayKey(s.starts_at), [...(m.get(dayKey(s.starts_at)) ?? []), s])); return [...m.entries()]; }, [free]);
  const book = async () => {
    if (!pick) return;
    if (user.demo) return toast.err('Sign in with a real account to book.');
    setBusy(true);
    const { error } = await supabase.rpc('book_private_slot', { p_slot: pick.id, p_note: note });
    setBusy(false);
    if (error) return toast.err(error.message);
    toast.ok('Session booked — your instructor was notified'); setPick(null); setNote(''); reload();
  };
  const cancel = async (s: Slot) => {
    if (!(await askConfirm('Cancel this booking?'))) return;
    const { error } = await supabase.rpc('cancel_private_booking', { p_slot: s.id }); if (error) toast.err(error.message); else { toast.ok('Booking cancelled'); reload(); }
  };
  return (
    <Page>
      {user.demo && <DemoNotice />}
      <PageHero badge="Learning" badgeColor="indigo" title="Private Sessions" illus="calendar" subtitle="Book a one-to-one session with an instructor at a time that suits you. You can cancel up to 24 hours before." />
      {placed === false ? <PlacementRequired /> : loading ? <Spinner /> : <>
        {mine.length > 0 && <div className="mb-8"><h2 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3">My bookings</h2>
          <div className="space-y-2">{mine.map((s) => (
            <div key={s.id} className="bg-white rounded-2xl border border-emerald-100 p-4 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-48"><p className="font-bold text-slate-800">{dayKey(s.starts_at)} · {time(s.starts_at)}–{time(s.ends_at)}</p><p className="text-xs text-slate-500">with {s.instructor?.full_name} · {s.mode === 'online' ? 'Online' : s.room ?? 'At the centre'}</p></div>
              {s.mode === 'online' && (s.meeting_url ? <a href={s.meeting_url} target="_blank" rel="noreferrer" className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold flex items-center gap-1"><Video size={14} />Join</a> : <span className="text-xs text-slate-400">Link coming soon</span>)}
              <button onClick={() => cancel(s)} className="text-xs font-bold text-red-500">Cancel</button>
            </div>
          ))}</div></div>}
        <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3">Available times</h2>
        {!days.length ? <p className="text-center text-slate-400 py-10">No free times right now. Check again soon.</p> : (
          <div className="space-y-5">{days.map(([d, slots]) => (
            <div key={d}><p className="font-extrabold text-slate-900 mb-2">{d}</p>
              <div className="flex flex-wrap gap-2">{slots.map((s) => (
                <button key={s.id} onClick={() => setPick(s)} className="px-4 py-3 rounded-2xl bg-white border border-slate-200 hover:border-orange-400 text-left">
                  <p className="font-bold text-slate-800">{time(s.starts_at)}–{time(s.ends_at)}</p><p className="text-[11px] text-slate-500">{s.instructor?.full_name} · {s.mode === 'online' ? 'Online' : 'Centre'}</p>
                </button>
              ))}</div></div>
          ))}</div>
        )}
      </>}
      {pick && (
        <Modal open onClose={() => setPick(null)} title="Book this session">
          <div className="space-y-4">
            <p className="text-sm text-slate-700"><b>{dayKey(pick.starts_at)}</b>, {time(pick.starts_at)}–{time(pick.ends_at)} with <b>{pick.instructor?.full_name}</b> ({pick.mode === 'online' ? 'online' : 'at the centre'}).</p>
            <Field label="What would you like to work on? (optional)"><textarea rows={3} className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Speaking practice for my IELTS test" /></Field>
            <button disabled={busy} onClick={book} className={`${btnAccent} w-full`}>{busy ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Confirm Booking</button>
          </div>
        </Modal>
      )}
    </Page>
  );
}
