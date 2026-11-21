import { askConfirm, askText } from '../../components/dialogs';
import { useState, type ReactNode } from 'react';
import { Loader2, Plus, Search, SquarePen, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useData } from '../../lib/db';
import { Illus } from '../../components/media';
import { DemoNotice, Field, Modal, Spinner, btnPrimary, inputCls, toast } from '../../components/ui';

export type FieldDef = {
  k: string; label: string; type?: 'text' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox' | 'url' | 'time';
  options?: { value: string | number; label: string }[]; required?: boolean; half?: boolean; ph?: string; hint?: string;
};

/** Generic "card grid + create/edit modal" admin screen in the reference layout. */
export default function EntityGrid<T extends { id: number | string }>({
  table, select = '*', order = 'id', ascending = true, badge, badgeTone = 'orange', title, subtitle, illus, addLabel, fields,
  card, searchText, defaults = {}, toRow, extraHero, filter,
}: {
  table: string; select?: string; order?: string; ascending?: boolean; badge: string; badgeTone?: 'orange' | 'indigo' | 'pink' | 'emerald' | 'sky';
  title: string; subtitle: string; illus: string; addLabel: string; fields: FieldDef[] | ((row: Partial<T>) => FieldDef[]);
  card: (row: T) => ReactNode; searchText: (row: T) => string; defaults?: Record<string, unknown>;
  toRow?: (form: Record<string, unknown>) => Record<string, unknown> | Promise<Record<string, unknown>>; extraHero?: ReactNode; filter?: (row: T) => boolean;
}) {
  const user = useAuth((s) => s.user);
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Partial<T> | null>(null);
  const { data, loading, reload } = useData<T[]>(() => supabase.from(table).select(select).order(order, { ascending }));
  const list = (data ?? []).filter((r) => (!filter || filter(r)) && searchText(r).toLowerCase().includes(q.toLowerCase()));
  const tone = { orange: 'bg-orange-50 text-orange-600 border-orange-100', indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100', pink: 'bg-pink-50 text-pink-600 border-pink-100', emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100', sky: 'bg-sky-50 text-sky-600 border-sky-100' }[badgeTone];

  const del = async (r: T) => {
    if (!await askConfirm('Delete this item? This cannot be undone.')) return;
    const { error } = await supabase.from(table).delete().eq('id', r.id);
    if (error) toast.err(error.code === '23503' ? 'It is still used by other records.' : error.message); else { toast.ok('Deleted'); reload(); }
  };

  return (
    <div className="w-full bg-[#fafafa] text-[#1e293b] font-sans min-h-screen pb-20 overflow-x-hidden">
      <main className="max-w-7xl mx-auto px-6 py-8">
        {user?.demo && <DemoNotice />}
        <div className="bg-white rounded-4xl border border-slate-100 shadow-sm p-8 mb-10 flex flex-col-reverse lg:flex-row items-center justify-between relative overflow-hidden">
          <div className="z-10 w-full lg:w-1/2 mt-6 lg:mt-0">
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4 border ${tone}`}>{badge}</span>
            <h1 className="text-4xl font-extrabold text-slate-900 mb-3 tracking-tight">{title}</h1>
            <p className="text-slate-500 text-base mb-8 leading-relaxed max-w-md">{subtitle}</p>
            <div className="relative max-w-md">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Search className="h-5 w-5 text-slate-400" /></div>
              <input value={q} onChange={(e) => setQ(e.target.value)} className="block w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:bg-white transition-all shadow-sm text-sm" placeholder={`Search ${title.toLowerCase()}...`} />
            </div>
            {extraHero}
          </div>
          <div className="w-full lg:w-1/2 flex justify-center lg:justify-end relative">
            <div className="absolute top-1/2 right-10 w-64 h-64 bg-orange-100/40 rounded-full blur-3xl -z-10" />
            <Illus name={illus} className="max-h-72 object-contain drop-shadow-xl hover:scale-105 transition-transform duration-500" />
          </div>
        </div>
        {loading ? <Spinner /> : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            <button disabled={user?.demo} onClick={() => setEdit({ ...defaults } as Partial<T>)} className="group border-2 border-dashed border-slate-300 rounded-4xl flex flex-col items-center justify-center p-8 hover:border-orange-400 hover:bg-orange-50/20 transition-all min-h-60 bg-white/50 disabled:opacity-50">
              <div className="w-16 h-16 rounded-full bg-white shadow-md border border-slate-100 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:shadow-lg transition-all duration-300"><Plus className="text-slate-400 group-hover:text-orange-500" /></div>
              <h3 className="text-lg font-bold text-slate-600 group-hover:text-orange-600 transition-colors">{addLabel}</h3>
            </button>
            {list.map((r) => (
              <div key={r.id} className="group bg-white rounded-4xl p-6 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)] hover:shadow-[0_10px_30px_-5px_rgba(0,0,0,0.1)] hover:-translate-y-1 transition-all duration-300 border border-slate-100 flex flex-col">
                <div className="flex-1">{card(r)}</div>
                <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end items-center gap-2 opacity-70 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setEdit(r)} className="p-2 rounded-full hover:bg-blue-50 text-slate-400 hover:text-blue-500 transition-colors" title="Edit"><SquarePen size={18} /></button>
                  <button onClick={() => del(r)} className="p-2 rounded-full hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors" title="Delete"><Trash2 size={18} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      {edit && <EntityForm table={table} row={edit as Record<string, unknown>} fields={typeof fields === 'function' ? fields(edit) : fields} toRow={toRow} title={edit.id ? `Edit ${title.replace(/s$/, '')}` : addLabel} onClose={() => setEdit(null)} onDone={() => { setEdit(null); reload(); }} />}
    </div>
  );
}

export function EntityForm({ table, row, fields, toRow, title, onClose, onDone }: {
  table: string; row: Record<string, unknown>; fields: FieldDef[]; title: string; onClose: () => void; onDone: () => void;
  toRow?: (form: Record<string, unknown>) => Record<string, unknown> | Promise<Record<string, unknown>>;
}) {
  const [f, setF] = useState<Record<string, unknown>>(() => Object.fromEntries(fields.map((d) => [d.k, row[d.k] ?? (d.type === 'checkbox' ? false : '')])));
  const [busy, setBusy] = useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try {
      const clean = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v === '' ? null : v]));
      const out = toRow ? await toRow(clean) : clean;
      const { error } = row.id ? await supabase.from(table).update(out).eq('id', row.id) : await supabase.from(table).insert(out);
      if (error) throw new Error(error.code === '23505' ? 'That name/code already exists.' : error.message);
      toast.ok('Saved'); onDone();
    } catch (err) { toast.err((err as Error).message); }
    setBusy(false);
  };
  return (
    <Modal open onClose={onClose} title={title} wide={fields.length > 6}>
      <form onSubmit={save} className="grid grid-cols-2 gap-4">
        {fields.map((d) => (
          <div key={d.k} className={d.half ? 'col-span-2 sm:col-span-1' : 'col-span-2'}>
            {d.type === 'checkbox' ? (
              <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-700 cursor-pointer">
                <input type="checkbox" className="accent-orange-500 w-4 h-4" checked={!!f[d.k]} onChange={(e) => setF({ ...f, [d.k]: e.target.checked })} /> {d.label}
              </label>
            ) : (
              <Field label={d.label} hint={d.hint}>
                {d.type === 'textarea' ? <textarea rows={3} required={d.required} className={inputCls} placeholder={d.ph} value={(f[d.k] as string) ?? ''} onChange={(e) => setF({ ...f, [d.k]: e.target.value })} />
                  : d.type === 'select' ? (
                    <select required={d.required} className={inputCls} value={(f[d.k] as string) ?? ''} onChange={(e) => setF({ ...f, [d.k]: e.target.value })}>
                      <option value="">— Select —</option>{d.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : <input type={d.type ?? 'text'} required={d.required} className={inputCls} placeholder={d.ph} step={d.type === 'number' ? 'any' : undefined} value={(f[d.k] as string) ?? ''} onChange={(e) => setF({ ...f, [d.k]: e.target.value })} />}
              </Field>
            )}
          </div>
        ))}
        <button disabled={busy} className={`${btnPrimary} col-span-2 mt-2`}>{busy && <Loader2 size={16} className="animate-spin" />} Save</button>
      </form>
    </Modal>
  );
}
