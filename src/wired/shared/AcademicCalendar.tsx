import { askConfirm, askText } from '../../components/dialogs';
import { useState } from 'react';
import { CalendarDays, Funnel, Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { isAcademicLead } from '../../lib/nav';
import { supabase } from '../../lib/supabase';
import { useData } from '../../lib/db';
import { Illus } from '../../components/media';
import { DemoNotice, Field, Modal, Page, Spinner, btnPrimary, inputCls, toast } from '../../components/ui';

type Ev = { id: number; title: string; description: string | null; kind: string; starts_on: string; ends_on: string | null };
const KIND: Record<string, { label: string; bg: string; chip: string; border: string }> = {
  event: { label: 'Event', bg: 'bg-blue-400', chip: 'bg-blue-50 text-blue-600 border-blue-100', border: 'border-blue-100' },
  holiday: { label: 'Holiday', bg: 'bg-orange-400', chip: 'bg-orange-50 text-orange-600 border-orange-100', border: 'border-orange-100' },
  exam: { label: 'Exam', bg: 'bg-red-400', chip: 'bg-red-50 text-red-600 border-red-100', border: 'border-red-100' },
  intake: { label: 'Intake', bg: 'bg-emerald-400', chip: 'bg-emerald-50 text-emerald-600 border-emerald-100', border: 'border-emerald-100' },
  deadline: { label: 'Deadline', bg: 'bg-purple-400', chip: 'bg-purple-50 text-purple-600 border-purple-100', border: 'border-purple-100' },
};
const long = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

export default function AcademicCalendar() {
  const user = useAuth((s) => s.user);
  const admin = isAcademicLead(user?.role) && !user?.demo;
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('all');
  const [edit, setEdit] = useState<Partial<Ev> | null>(null);
  const [page, setPage] = useState(1);
  const { data, loading, reload } = useData<Ev[]>(() => supabase.from('calendar_events').select('*').order('starts_on'));
  const today = new Date().toISOString().slice(0, 10);
  const list = (data ?? []).filter((e) => (kind === 'all' || e.kind === kind) && `${e.title} ${e.description ?? ''}`.toLowerCase().includes(q.toLowerCase()));
  const upcoming = list.filter((e) => (e.ends_on ?? e.starts_on) >= today);
  const past = list.filter((e) => (e.ends_on ?? e.starts_on) < today).reverse();
  const pages = Math.max(1, Math.ceil(past.length / 12));

  const del = async (e: Ev) => {
    if (!await askConfirm(`Delete "${e.title}"?`)) return;
    const { error } = await supabase.from('calendar_events').delete().eq('id', e.id);
    if (error) toast.err(error.message); else reload();
  };

  const Card = ({ e, isPast }: { e: Ev; isPast?: boolean }) => {
    const k = KIND[e.kind] ?? KIND.event;
    return (
      <div className={`group bg-white rounded-3xl p-6 border flex flex-col h-full relative min-h-55 overflow-hidden transition-all duration-300 ${k.border} ${isPast ? 'opacity-60 grayscale hover:grayscale-0 hover:opacity-100 hover:shadow-md' : 'shadow-sm hover:shadow-lg hover:-translate-y-1'}`}>
        <div className={`absolute top-0 right-0 w-24 h-24 rounded-bl-[4rem] rounded-tr-3xl pointer-events-none opacity-20 ${k.bg}`} />
        <div className="flex justify-between items-start mb-4 relative z-10">
          <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-sm ${isPast ? 'bg-slate-100 text-slate-500 border-slate-200' : k.chip}`}>{isPast ? `Past ${k.label}` : k.label}</span>
          {admin && <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
            <button onClick={() => setEdit(e)} className="w-8 h-8 rounded-full bg-white border border-slate-100 text-slate-600 flex items-center justify-center hover:bg-blue-500 hover:text-white shadow-sm"><Pencil size={14} /></button>
            <button onClick={() => del(e)} className="w-8 h-8 rounded-full bg-white border border-slate-100 text-slate-600 flex items-center justify-center hover:bg-red-500 hover:text-white shadow-sm"><Trash2 size={14} /></button>
          </div>}
        </div>
        <div className="flex-1 relative z-10 flex flex-col">
          <h3 className={`text-xl font-extrabold leading-tight mb-3 ${isPast ? 'text-slate-500 line-through decoration-slate-300' : 'text-slate-900'}`}>{e.title}</h3>
          <div className={`flex items-center gap-2 font-semibold text-sm mb-4 ${isPast ? 'text-slate-400' : 'text-slate-600'}`}><CalendarDays size={16} />{long(e.starts_on)}{e.ends_on && e.ends_on !== e.starts_on && ` → ${new Date(e.ends_on + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}</div>
          {e.description && <div className={`p-3 rounded-xl border mt-auto ${isPast ? 'bg-slate-100 border-slate-200' : 'bg-slate-50 border-slate-100'}`}><p className="text-xs text-slate-500 italic line-clamp-3">{e.description}</p></div>}
        </div>
      </div>
    );
  };

  return (
    <Page>
      {user?.demo && <DemoNotice />}
      <div className="bg-white rounded-4xl border border-slate-100 shadow-sm p-6 sm:p-8 mb-10 flex flex-col-reverse lg:flex-row items-center justify-between relative overflow-hidden">
        <div className="z-10 w-full lg:w-1/2 mt-6 lg:mt-0">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3 border bg-blue-50 text-blue-600 border-blue-100">Global Schedule</span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-2 tracking-tight">Academic Calendar</h1>
          <p className="text-slate-500 text-sm sm:text-base mb-6 leading-relaxed max-w-md">Keep track of public holidays, term deadlines, and important institute events.</p>
          <div className="flex flex-col sm:flex-row gap-3 max-w-lg">
            <div className="relative flex-1"><Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search events..." className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-200" /></div>
            <div className="relative"><Funnel size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <select value={kind} onChange={(e) => setKind(e.target.value)} className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none">
                <option value="all">All Events</option>{Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v.label}s</option>)}</select></div>
          </div>
        </div>
        <div className="w-full lg:w-1/2 flex justify-center lg:justify-end relative">
          <div className="absolute top-1/2 right-10 w-64 h-64 bg-blue-100/50 rounded-full blur-3xl -z-10" />
          <Illus name="calendar" className="max-h-75 object-contain drop-shadow-xl hover:scale-105 transition-transform duration-500" />
        </div>
      </div>
      {loading ? <Spinner /> : (
        <>
          <div className="mb-16">
            <h2 className="text-2xl font-extrabold text-slate-800 flex items-center gap-3 mb-6"><span className="w-2 h-8 rounded-full bg-blue-500" />Upcoming Events</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {admin && (
                <button onClick={() => setEdit({ kind: 'event', starts_on: today })} className="group border-2 border-dashed border-slate-300 rounded-3xl flex flex-col items-center justify-center p-8 hover:border-blue-400 hover:bg-blue-50/20 transition-all min-h-55 bg-white/50">
                  <div className="w-16 h-16 rounded-full bg-white shadow-md border border-slate-100 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300"><Plus className="text-slate-400 group-hover:text-blue-500" /></div>
                  <h3 className="text-lg font-bold text-slate-500 group-hover:text-blue-600 transition-colors">Add New Event</h3>
                </button>
              )}
              {upcoming.map((e) => <Card key={e.id} e={e} />)}
              {!upcoming.length && !admin && <p className="text-sm text-slate-400">No upcoming events.</p>}
            </div>
          </div>
          {past.length > 0 && (
            <div className="pt-10 border-t-2 border-dashed border-slate-200">
              <h2 className="text-xl font-bold text-slate-400 flex items-center gap-3 mb-6">Past Events</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">{past.slice((page - 1) * 12, page * 12).map((e) => <Card key={e.id} e={e} isPast />)}</div>
              {pages > 1 && <div className="flex justify-center gap-2 mt-8">{Array.from({ length: pages }, (_, i) => <button key={i} onClick={() => setPage(i + 1)} className={`w-9 h-9 rounded-xl text-sm font-bold ${page === i + 1 ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>{i + 1}</button>)}</div>}
            </div>
          )}
        </>
      )}
      {edit && <EventForm ev={edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); reload(); }} />}
    </Page>
  );
}

function EventForm({ ev, onClose, onDone }: { ev: Partial<Ev>; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ title: ev.title ?? '', description: ev.description ?? '', kind: ev.kind ?? 'event', starts_on: ev.starts_on ?? '', ends_on: ev.ends_on ?? '' });
  const [busy, setBusy] = useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    const row = { ...f, description: f.description || null, ends_on: f.ends_on || null };
    const { error } = ev.id ? await supabase.from('calendar_events').update(row).eq('id', ev.id) : await supabase.from('calendar_events').insert(row);
    setBusy(false);
    if (error) toast.err(error.message); else { toast.ok('Event saved'); onDone(); }
  };
  return (
    <Modal open onClose={onClose} title={ev.id ? 'Edit Event' : 'Add New Event'}>
      <form onSubmit={save} className="space-y-4">
        <Field label="Title"><input required className={inputCls} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Type"><select className={inputCls} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date"><input type="date" required className={inputCls} value={f.starts_on} onChange={(e) => setF({ ...f, starts_on: e.target.value })} /></Field>
          <Field label="End date (optional)"><input type="date" className={inputCls} value={f.ends_on} onChange={(e) => setF({ ...f, ends_on: e.target.value })} /></Field>
        </div>
        <Field label="Description"><textarea rows={3} className={inputCls} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <button disabled={busy} className={`${btnPrimary} w-full`}>{busy && <Loader2 size={16} className="animate-spin" />} Save Event</button>
      </form>
    </Modal>
  );
}
