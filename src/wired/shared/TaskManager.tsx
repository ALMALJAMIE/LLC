import { useMemo, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, CircleCheck, Clock, Layers, Link2, Loader2, Plus, Search, Trash2, TriangleAlert, Undo2 } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { useData } from '../../lib/db';
import { Illus } from '../../components/media';
import { DemoNotice, Field, Modal, btnPrimary, inputCls, toast } from '../../components/ui';

type Task = { id: number; title: string; notes: string | null; link: string | null; priority: 'low' | 'medium' | 'high'; due_at: string | null; done: boolean; created_at: string };
const PRI = { low: 'bg-sky-500', medium: 'bg-orange-500', high: 'bg-red-500' };
const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const timeOf = (s: string) => new Date(s).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

export default function TaskManager() {
  const user = useAuth((s) => s.user);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'active' | 'done'>('active');
  const [day, setDay] = useState<string>('all');
  const [adding, setAdding] = useState(false);
  const strip = useRef<HTMLDivElement>(null);
  const { data, reload } = useData<Task[]>(() => supabase.from('tasks').select('*').order('due_at', { ascending: true, nullsFirst: false }));

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = useMemo(() => Array.from({ length: 30 }, (_, i) => { const d = new Date(today); d.setDate(d.getDate() + i); return d; }), [today.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = (data ?? []).filter((t) => (tab === 'done' ? t.done : !t.done)
    && `${t.title} ${t.notes ?? ''}`.toLowerCase().includes(q.toLowerCase())
    && (day === 'all' || (t.due_at && dayKey(new Date(t.due_at)) === day)));
  const now = Date.now();
  const overdue = list.filter((t) => !t.done && t.due_at && new Date(t.due_at).getTime() < now);
  const rest = list.filter((t) => !overdue.includes(t));

  const toggle = async (t: Task) => {
    const { error } = await supabase.from('tasks').update({ done: !t.done }).eq('id', t.id);
    if (error) toast.err(error.message); else { toast.ok(t.done ? 'Moved back to active' : 'Marked as done'); reload(); }
  };
  const remove = async (t: Task) => {
    if (!confirm(`Delete "${t.title}"?`)) return;
    const { error } = await supabase.from('tasks').delete().eq('id', t.id);
    if (error) toast.err(error.message); else reload();
  };

  const Card = ({ t, late }: { t: Task; late?: boolean }) => (
    <div className={`group relative bg-white p-6 rounded-3xl border transition-all duration-300 hover:shadow-lg hover:-translate-y-1 flex flex-col justify-between min-h-40 ${late ? 'border-slate-200 bg-slate-100/50' : 'border-slate-200'}`}>
      <div className={`absolute top-6 bottom-6 left-0 w-1 rounded-r-lg ${t.done ? 'bg-emerald-500' : PRI[t.priority]}`} />
      <div>
        <div className="flex justify-between items-start mb-3 pl-4">
          <div className="flex gap-2 flex-wrap">
            {t.due_at && <span className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${late ? 'text-red-500' : 'text-slate-400'}`}><Clock size={12} />{day === 'all' && !late ? new Date(t.due_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' · ' : ''}{timeOf(t.due_at)}</span>}
            <span className="text-[9px] font-black px-1.5 rounded uppercase bg-slate-100 text-slate-500">{t.priority}</span>
          </div>
          <button onClick={() => remove(t)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all"><Trash2 size={16} /></button>
        </div>
        <div className="pl-4 mb-4">
          <h4 className={`text-lg font-bold leading-snug mb-1 ${t.done ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{t.title}</h4>
          {t.notes && <p className="text-sm text-slate-500 line-clamp-2">{t.notes}</p>}
          {t.link && <a href={t.link} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-bold transition-colors w-fit border border-indigo-100 shadow-sm"><Link2 size={14} /> Open Link</a>}
        </div>
      </div>
      <div className="pl-4 pt-3 border-t border-slate-50/50 flex items-center justify-end">
        <button onClick={() => toggle(t)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all bg-slate-900 text-white hover:bg-orange-600 shadow-md">
          {t.done ? <><Undo2 size={12} /> Undo</> : <><CircleCheck size={12} /> Mark Done</>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-24">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {user?.demo && <DemoNotice />}
        <div className="bg-white rounded-[2.5rem] p-10 mb-8 shadow-sm border border-slate-100 relative overflow-hidden flex flex-col md:flex-row items-center justify-between">
          <div className="relative z-10 w-full md:w-2/3">
            <div className="flex items-center gap-3 mb-4">
              <span className="bg-orange-50 text-orange-600 text-[11px] font-black uppercase px-3 py-1.5 rounded-lg border border-orange-100 tracking-wider">Task Manager</span>
              <span className="text-slate-400 text-sm font-bold flex items-center gap-1.5"><Calendar size={14} />{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
            </div>
            <h1 className="text-5xl font-black text-slate-900 mb-4 tracking-tight">Your Schedule</h1>
            <p className="text-slate-500 font-medium text-lg max-w-md leading-relaxed">Manage assignments, personal tasks, and schedules.</p>
          </div>
          <div className="relative z-10 mt-8 md:mt-0 w-full md:w-1/3 flex justify-center md:justify-end">
            <div className="w-48 h-48 bg-orange-50 rounded-full absolute -top-8 -right-8 blur-3xl opacity-60" />
            <Illus name="notifiaction" className="w-48 md:w-64 object-contain" />
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-5 justify-between items-center mb-8">
          <div className="relative w-full lg:max-w-md">
            <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-full text-sm font-semibold outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all shadow-sm" placeholder="Search tasks by title or description..." />
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-end">
            <div className="bg-white p-1.5 rounded-full border border-slate-200 flex shadow-sm">
              {(['active', 'done'] as const).map((k) => (
                <button key={k} onClick={() => setTab(k)} className={`px-5 py-2 rounded-full text-xs font-bold transition-all capitalize ${tab === k ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>{k}</button>
              ))}
            </div>
            <button disabled={user?.demo} onClick={() => setAdding(true)} className="flex items-center gap-2 px-6 py-3.5 bg-slate-900 text-white rounded-full text-sm font-bold hover:bg-orange-600 shadow-lg shadow-orange-100 hover:shadow-orange-200 transition-all active:scale-95 disabled:opacity-50"><Plus size={18} /> Add Task</button>
          </div>
        </div>

        <div className="mb-8">
          <div className="relative w-full group">
            <div className="absolute left-0 top-0 bottom-0 z-20 flex items-center bg-linear-to-r from-[#f8fafc] via-[#f8fafc]/90 to-transparent pr-4">
              <button onClick={() => strip.current?.scrollBy({ left: -300, behavior: 'smooth' })} className="w-8 h-8 rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center text-slate-500 hover:text-orange-600 hover:border-orange-200 transition-all active:scale-95"><ChevronLeft size={16} /></button>
            </div>
            <div ref={strip} className="flex overflow-x-auto gap-3 pb-2 pt-2 px-10 no-scrollbar">
              <button onClick={() => setDay('all')} className={`flex flex-col items-center justify-center min-w-18 h-23.75 rounded-3xl border transition-all duration-300 shrink-0 ${day === 'all' ? 'bg-orange-600 text-white border-orange-600 shadow-lg shadow-orange-200' : 'bg-white text-slate-500 border-slate-200'}`}>
                <Layers size={20} className="mb-1" /><span className="text-[11px] font-bold uppercase tracking-wide">All</span>
              </button>
              {days.map((d) => {
                const k = dayKey(d); const on = day === k; const isToday = k === dayKey(today);
                return (
                  <button key={k} onClick={() => setDay(k)} className={`flex flex-col items-center justify-center min-w-18 h-23.75 rounded-3xl border transition-all duration-300 shrink-0 snap-start ${on ? 'bg-orange-600 text-white border-orange-600 shadow-lg shadow-orange-200' : isToday ? 'bg-white text-orange-600 border-orange-200 ring-2 ring-orange-50' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider mb-0.5 opacity-40">{d.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                    <span className="text-3xl font-black leading-none tracking-tight mb-1">{d.getDate()}</span>
                    <span className={`text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md ${on ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400'}`}>{d.toLocaleDateString('en-US', { month: 'short' })}</span>
                  </button>
                );
              })}
            </div>
            <div className="absolute right-0 top-0 bottom-0 z-20 flex items-center bg-linear-to-l from-[#f8fafc] via-[#f8fafc]/90 to-transparent pl-4">
              <button onClick={() => strip.current?.scrollBy({ left: 300, behavior: 'smooth' })} className="w-8 h-8 rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center text-slate-500 hover:text-orange-600 hover:border-orange-200 transition-all active:scale-95"><ChevronRight size={16} /></button>
            </div>
          </div>
        </div>

        {overdue.length > 0 && (
          <div className="mb-10">
            <h3 className="text-lg font-black text-red-500 mb-5 flex items-center gap-2"><TriangleAlert size={20} /> Overdue</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">{overdue.map((t) => <Card key={t.id} t={t} late />)}</div>
          </div>
        )}
        {rest.length > 0 && (
          <div>
            <h3 className="text-lg font-black text-slate-800 mb-5 flex items-center gap-2"><Calendar size={20} /> {tab === 'done' ? 'Completed' : 'Upcoming'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">{rest.map((t) => <Card key={t.id} t={t} />)}</div>
          </div>
        )}
        {list.length === 0 && <div className="text-center py-20 text-slate-400"><CircleCheck size={40} className="mx-auto mb-3 text-slate-300" />{tab === 'done' ? 'No completed tasks yet.' : 'You are all caught up!'}</div>}
      </div>
      {adding && <AddTask onClose={() => setAdding(false)} onSaved={() => { setAdding(false); reload(); }} />}
    </div>
  );
}

function AddTask({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ title: '', notes: '', link: '', priority: 'medium', due: '' });
  const [busy, setBusy] = useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    const { error } = await supabase.from('tasks').insert({ title: f.title.trim(), notes: f.notes || null, link: f.link || null, priority: f.priority, due_at: f.due ? new Date(f.due).toISOString() : null });
    setBusy(false);
    if (error) toast.err(error.message); else { toast.ok('Task added'); onSaved(); }
  };
  return (
    <Modal open onClose={onClose} title="Add Task">
      <form onSubmit={save} className="space-y-4">
        <Field label="Title"><input required className={inputCls} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Description"><textarea rows={3} className={inputCls} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Due"><input type="datetime-local" className={inputCls} value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} /></Field>
          <Field label="Priority"><select className={inputCls} value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></Field>
        </div>
        <Field label="Link (optional)"><input type="url" className={inputCls} placeholder="https://" value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} /></Field>
        <button disabled={busy} className={`${btnPrimary} w-full`}>{busy && <Loader2 size={16} className="animate-spin" />} Save Task</button>
      </form>
    </Modal>
  );
}
