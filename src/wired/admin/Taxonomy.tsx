import { CalendarRange, ListOrdered, Tag } from 'lucide-react';
import EntityGrid from './EntityGrid';
import { fmtDate } from '../../lib/db';

const COLORS = ['indigo', 'orange', 'emerald', 'sky', 'pink', 'purple', 'red', 'amber'];
const HEX: Record<string, string> = { indigo: '31,102,200', orange: '233,168,35', emerald: '16,185,129', sky: '14,165,233', pink: '236,72,153', purple: '168,85,247', red: '239,68,68', amber: '245,158,11' };

type Cat = { id: number; name: string; description: string | null; color: string | null; created_at: string };
export function AdminCategories() {
  return (
    <EntityGrid<Cat> table="categories" order="name" badge="Taxonomy" badgeTone="pink" title="Course Categories" illus="catalogue" addLabel="Add Category"
      subtitle="Define the structure of your academy. Group courses into categories students can browse."
      fields={[{ k: 'name', label: 'Name', required: true }, { k: 'color', label: 'Colour', type: 'select', options: COLORS.map((c) => ({ value: c, label: c })) }, { k: 'description', label: 'Description', type: 'textarea' }]}
      searchText={(r) => r.name}
      card={(r) => (
        <>
          <div className="h-24 rounded-2xl mb-4 flex items-center justify-center relative overflow-hidden" style={{ background: `rgba(${HEX[r.color ?? 'indigo']},0.125)`, color: `rgb(${HEX[r.color ?? 'indigo']})` }}><Tag size={32} /></div>
          <h3 className="text-xl font-bold text-slate-900 line-clamp-1 group-hover:text-orange-600 transition-colors mb-1">{r.name}</h3>
          <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed">{r.description || 'No description provided.'}</p>
          <p className="text-xs text-slate-400 font-medium mt-3">{fmtDate(r.created_at)}</p>
        </>
      )} />
  );
}

type Lvl = { id: number; name: string; cefr: string | null; sort_order: number };
export function AdminLevels() {
  return (
    <EntityGrid<Lvl> table="levels" order="sort_order" badge="Academic Structure" badgeTone="indigo" title="Batch Levels" illus="levels" addLabel="Add Level"
      subtitle="Set the proficiency levels used by courses, batches and placement tests."
      fields={[{ k: 'name', label: 'Level name', required: true }, { k: 'cefr', label: 'CEFR', half: true, ph: 'e.g. B1' }, { k: 'sort_order', label: 'Order', type: 'number', half: true, required: true }]}
      defaults={{ sort_order: 1 }} searchText={(r) => `${r.name} ${r.cefr ?? ''}`}
      card={(r) => (
        <div className="flex items-center gap-4">
          <span className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 grid place-items-center font-black text-lg">{r.sort_order}</span>
          <div><h3 className="text-xl font-bold text-slate-900">{r.name}</h3><p className="text-xs font-bold uppercase text-slate-400 flex items-center gap-1"><ListOrdered size={12} />CEFR {r.cefr ?? '—'}</p></div>
        </div>
      )} />
  );
}

type Ses = { id: number; name: string; start_date: string; end_date: string; is_active: boolean };
export function AdminSessions() {
  return (
    <EntityGrid<Ses> table="academic_sessions" order="start_date" ascending={false} badge="Academic Year" badgeTone="emerald" title="Academic Sessions" illus="session" addLabel="Add Session"
      subtitle="Create intakes and terms. Batches are attached to a session; only one session should be active."
      fields={[{ k: 'name', label: 'Name', required: true, ph: 'e.g. January 2027' }, { k: 'start_date', label: 'Start', type: 'date', half: true, required: true }, { k: 'end_date', label: 'End', type: 'date', half: true, required: true }, { k: 'is_active', label: 'Active session', type: 'checkbox' }]}
      searchText={(r) => r.name}
      card={(r) => (
        <>
          <div className="flex justify-between items-start mb-3"><span className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 grid place-items-center"><CalendarRange size={22} /></span>
            {r.is_active && <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">Active</span>}</div>
          <h3 className="text-xl font-bold text-slate-900">{r.name}</h3>
          <p className="text-sm text-slate-500">{fmtDate(r.start_date)} – {fmtDate(r.end_date)}</p>
        </>
      )} />
  );
}
