import { useState } from 'react';
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { money, useData } from '../../lib/db';
import { Field, Modal, Spinner, btnPrimary, inputCls, toast } from '../../components/ui';
import { askConfirm } from '../../components/dialogs';

export type CourseOption = { id: number; course_id: number; name: string; kind: string; description: string | null; price: number; needs_batch: boolean; is_active: boolean; sort_order: number };
export const OPTION_KINDS: Record<string, string> = { self_paced: 'Self-paced', live: 'Live classes', blended: 'Blended', private: 'Private', other: 'Other' };

/** Ways to study one course (self-paced, live, blended…), each with its own price. */
export default function CourseOptionsEditor({ course, onClose }: { course: { id: number; title: string }; onClose: () => void }) {
  const { data, loading, reload } = useData<CourseOption[]>(() => supabase.from('course_options').select('*').eq('course_id', course.id).order('sort_order').order('price'), [course.id]);
  const [edit, setEdit] = useState<Partial<CourseOption> | null>(null);
  const syncPrice = async () => {
    const { data: rows } = await supabase.from('course_options').select('price').eq('course_id', course.id).eq('is_active', true);
    if (rows?.length) await supabase.from('courses').update({ price: Math.min(...rows.map((r) => Number(r.price))) }).eq('id', course.id);
  };
  const del = async (o: CourseOption) => {
    if (!(await askConfirm(`Delete the option "${o.name}"? Students already enrolled keep their place.`))) return;
    const { error } = await supabase.from('course_options').delete().eq('id', o.id);
    if (error) toast.err(error.message); else { await syncPrice(); reload(); }
  };
  return (
    <Modal open onClose={onClose} title={`Study options · ${course.title}`} wide>
      <div className="space-y-4">
        <p className="text-sm text-slate-500">Offer the same course in different ways, each with its own price. When a course has options, the student must choose one at checkout, and the course card on the website shows the lowest price.</p>
        {loading ? <Spinner /> : !(data ?? []).length ? <p className="text-sm text-slate-400">No options — the course is sold at its single price.</p> : (
          <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl">{(data ?? []).map((o) => (
            <div key={o.id} className="px-4 py-3 flex flex-wrap items-center gap-3 text-sm">
              <div className="flex-1 min-w-48"><p className="font-bold text-slate-800">{o.name} <span className="text-[10px] font-black uppercase text-indigo-600">{OPTION_KINDS[o.kind]}</span></p>
                <p className="text-[11px] text-slate-400">{o.needs_batch ? 'In a batch' : 'No batch needed'}{o.description ? ` · ${o.description}` : ''}{o.is_active ? '' : ' · hidden'}</p></div>
              <b data-no-i18n>{money(o.price)}</b>
              <button onClick={() => setEdit(o)} className="text-xs font-bold text-indigo-600">Edit</button>
              <button onClick={() => del(o)} className="p-1 text-slate-400 hover:text-red-500"><Trash2 size={15} /></button>
            </div>
          ))}</div>
        )}
        {edit ? <OptionForm o={edit} courseId={course.id} onCancel={() => setEdit(null)} onDone={async () => { setEdit(null); await syncPrice(); reload(); }} />
          : <button onClick={() => setEdit({ kind: 'live', needs_batch: true, is_active: true, sort_order: (data ?? []).length })} className={btnPrimary}><Plus size={16} /> Add option</button>}
      </div>
    </Modal>
  );
}

function OptionForm({ o, courseId, onCancel, onDone }: { o: Partial<CourseOption>; courseId: number; onCancel: () => void; onDone: () => void }) {
  const [f, setF] = useState({ name: o.name ?? '', kind: o.kind ?? 'live', description: o.description ?? '', price: String(o.price ?? ''), needs_batch: o.needs_batch ?? true, is_active: o.is_active ?? true });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (f.name.trim().length < 2 || f.price === '' || Number(f.price) < 0) return toast.err('Name and price are required.');
    setBusy(true);
    const row = { course_id: courseId, name: f.name.trim(), kind: f.kind, description: f.description.trim() || null, price: Number(f.price), needs_batch: f.needs_batch, is_active: f.is_active, sort_order: o.sort_order ?? 0 };
    const { error } = o.id ? await supabase.from('course_options').update(row).eq('id', o.id) : await supabase.from('course_options').insert(row);
    setBusy(false);
    if (error) toast.err(error.message); else { toast.ok('Saved'); onDone(); }
  };
  return (
    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
      <div className="grid sm:grid-cols-3 gap-3">
        <Field label="Type"><select className={inputCls} value={f.kind} onChange={(e) => { const k = e.target.value; setF({ ...f, kind: k, needs_batch: k !== 'self_paced', name: f.name || OPTION_KINDS[k] }); }}>{Object.entries(OPTION_KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Name shown to students"><input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Price (USD)"><input type="number" className={inputCls} value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></Field>
      </div>
      <Field label="What is included (short)"><input className={inputCls} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="e.g. Recorded lessons + monthly live Q&A" /></Field>
      <div className="flex flex-wrap gap-5 text-sm font-semibold">
        <label className="flex items-center gap-2"><input type="checkbox" className="accent-orange-500" checked={f.needs_batch} onChange={(e) => setF({ ...f, needs_batch: e.target.checked })} />Student joins a batch (live classes)</label>
        <label className="flex items-center gap-2"><input type="checkbox" className="accent-orange-500" checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} />Offered to students</label>
      </div>
      <div className="flex gap-2 justify-end"><button onClick={onCancel} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold">Cancel</button>
        <button disabled={busy} onClick={save} className={btnPrimary}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save option</button></div>
    </div>
  );
}
