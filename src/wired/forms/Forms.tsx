import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, CheckCircle2, ClipboardList, Copy, Download, Eye, Inbox, Loader2, Lock, Plus, SquarePen, Trash2, Unlock } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { fmtDateTime, useData } from '../../lib/db';
import { BrandLockup } from '../../components/media';
import { DemoNotice, Field, Modal, Page, PageHero, Spinner, btnPrimary, inputCls, toast } from '../../components/ui';

export type FType = 'text' | 'email' | 'phone' | 'number' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'date';
export type FField = { key: string; label: string; type: FType; required: boolean; options?: string[] };
type Form = { id: number; owner_id: string; title: string; description: string | null; fields: FField[]; is_open: boolean; created_at: string; responses?: { count: number }[] };
type Resp = { id: number; answers: Record<string, string | string[]>; created_at: string };

const TYPES: { value: FType; label: string }[] = [
  { value: 'text', label: 'Short text' }, { value: 'textarea', label: 'Paragraph' }, { value: 'email', label: 'Email' }, { value: 'phone', label: 'Phone' },
  { value: 'number', label: 'Number' }, { value: 'date', label: 'Date' }, { value: 'select', label: 'Dropdown' }, { value: 'radio', label: 'Multiple choice' }, { value: 'checkbox', label: 'Checkboxes' },
];
const hasOptions = (t: FType) => t === 'select' || t === 'radio' || t === 'checkbox';
const slug = (s: string, i: number) => (s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'q') + '_' + i;
export const formUrl = (id: number) => `${location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}/f/${id}`;
const show = (v: string | string[] | undefined) => (Array.isArray(v) ? v.join(', ') : v ?? '');

// ---------------- Portal: list + builder ----------------
export default function FormBuilder() {
  const user = useAuth((s) => s.user);
  const [edit, setEdit] = useState<Partial<Form> | null>(null);
  const [view, setView] = useState<Form | null>(null);
  const { data, loading, reload } = useData<Form[]>(() => supabase.from('forms').select('*, responses:form_responses(count)').order('created_at', { ascending: false }));
  const mine = (data ?? []).filter((f) => user?.role === 'admin' || f.owner_id === user?.id);
  const toggle = async (f: Form) => { const { error } = await supabase.from('forms').update({ is_open: !f.is_open }).eq('id', f.id); if (error) toast.err(error.message); else reload(); };
  const del = async (f: Form) => { if (!confirm(`Delete “${f.title}” and all its responses?`)) return; const { error } = await supabase.from('forms').delete().eq('id', f.id); if (error) toast.err(error.message); else { toast.ok('Deleted'); reload(); } };
  const copy = (f: Form) => { navigator.clipboard?.writeText(formUrl(f.id)); toast.ok('Link copied'); };
  return (
    <Page>
      {user?.demo && <DemoNotice />}
      <PageHero badge="Data Collection" badgeColor="purple" title="Form Builder" illus="applications" subtitle={user?.role === 'agent' ? 'Build interest and pre-registration forms, share the link with prospective students, and follow up on every response.' : 'Build surveys, registration and feedback forms. Anyone with the link can answer — no account needed.'}>
        <button disabled={user?.demo} onClick={() => setEdit({ title: '', description: '', fields: [], is_open: true })} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-orange-500 text-white text-sm font-bold disabled:opacity-50"><Plus size={16} />New form</button>
      </PageHero>
      {loading ? <Spinner /> : !mine.length ? <p className="text-center text-slate-400 py-16">No forms yet. Create your first one.</p> : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">{mine.map((f) => (
          <div key={f.id} className="bg-white rounded-4xl border border-slate-100 shadow-sm p-6 flex flex-col">
            <div className="flex justify-between items-start"><span className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 grid place-items-center"><ClipboardList /></span>
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${f.is_open ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>{f.is_open ? 'Accepting' : 'Closed'}</span></div>
            <h3 className="text-lg font-extrabold text-slate-900 mt-4">{f.title}</h3>
            {f.description && <p className="text-sm text-slate-500 line-clamp-2">{f.description}</p>}
            <p className="text-xs text-slate-400 mt-2">{f.fields.length} questions · <b className="text-slate-700">{f.responses?.[0]?.count ?? 0}</b> responses</p>
            <div className="flex-1" />
            <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
              <button onClick={() => setView(f)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-bold"><Inbox size={14} />Responses</button>
              <button onClick={() => copy(f)} className="p-2 rounded-full hover:bg-slate-100 text-slate-500" title="Copy link"><Copy size={16} /></button>
              <a href={formUrl(f.id)} target="_blank" rel="noreferrer" className="p-2 rounded-full hover:bg-slate-100 text-slate-500" title="Preview"><Eye size={16} /></a>
              <button disabled={user?.demo} onClick={() => toggle(f)} className="p-2 rounded-full hover:bg-slate-100 text-slate-500" title={f.is_open ? 'Close form' : 'Reopen form'}>{f.is_open ? <Lock size={16} /> : <Unlock size={16} />}</button>
              <button disabled={user?.demo} onClick={() => setEdit(f)} className="p-2 rounded-full hover:bg-blue-50 text-slate-500 hover:text-blue-500 ml-auto" title="Edit"><SquarePen size={16} /></button>
              <button disabled={user?.demo} onClick={() => del(f)} className="p-2 rounded-full hover:bg-red-50 text-slate-500 hover:text-red-500" title="Delete"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}</div>
      )}
      {edit && <Builder form={edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); reload(); }} />}
      {view && <Responses form={view} onClose={() => setView(null)} />}
    </Page>
  );
}

function Builder({ form, onClose, onDone }: { form: Partial<Form>; onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState(form.title ?? '');
  const [desc, setDesc] = useState(form.description ?? '');
  const [fields, setFields] = useState<(FField & { opts?: string })[]>(() => (form.fields ?? []).map((f) => ({ ...f, opts: f.options?.join('\n') })));
  const [busy, setBusy] = useState(false);
  const upd = (i: number, p: Partial<FField & { opts: string }>) => setFields(fields.map((f, j) => (j === i ? { ...f, ...p } : f)));
  const move = (i: number, d: number) => { const n = [...fields]; const [x] = n.splice(i, 1); n.splice(i + d, 0, x); setFields(n); };
  const add = (type: FType = 'text') => setFields([...fields, { key: '', label: '', type, required: false, opts: '' }]);
  const save = async () => {
    if (!title.trim()) return toast.err('Give the form a title.');
    if (!fields.length) return toast.err('Add at least one question.');
    if (fields.some((f) => !f.label.trim())) return toast.err('Every question needs a label.');
    const used = new Set<string>();
    const out: FField[] = fields.map((f, i) => {
      let key = f.key || slug(f.label, i); while (used.has(key)) key += '_'; used.add(key);
      return { key, label: f.label.trim(), type: f.type, required: f.required, ...(hasOptions(f.type) ? { options: (f.opts ?? '').split('\n').map((o) => o.trim()).filter(Boolean) } : {}) };
    });
    if (out.some((f) => hasOptions(f.type) && !f.options?.length)) return toast.err('Choice questions need at least one option.');
    setBusy(true);
    const row = { title: title.trim(), description: desc.trim() || null, fields: out };
    const { error } = form.id ? await supabase.from('forms').update(row).eq('id', form.id) : await supabase.from('forms').insert(row);
    setBusy(false);
    if (error) toast.err(error.message); else { toast.ok('Form saved'); onDone(); }
  };
  return (
    <Modal open onClose={onClose} title={form.id ? 'Edit form' : 'New form'} wide>
      <div className="space-y-4">
        <Field label="Title"><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. IELTS preparation — interest form" /></Field>
        <Field label="Description (optional)"><textarea rows={2} className={inputCls} value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
        <div className="space-y-3">{fields.map((f, i) => (
          <div key={i} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="flex gap-2 items-start">
              <span className="text-xs font-black text-slate-400 mt-3 w-5">{i + 1}</span>
              <div className="flex-1 grid sm:grid-cols-3 gap-2">
                <input className={`${inputCls} sm:col-span-2`} placeholder="Question" value={f.label} onChange={(e) => upd(i, { label: e.target.value })} />
                <select className={inputCls} value={f.type} onChange={(e) => { const t = e.target.value as FType; upd(i, { type: t }); }}>{TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
                {hasOptions(f.type) && <textarea rows={3} className={`${inputCls} sm:col-span-3`} placeholder={'One option per line, e.g.\nMorning\nEvening'} value={f.opts ?? ''} onChange={(e) => upd(i, { opts: e.target.value })} />}
              </div>
              <div className="flex flex-col">
                <button disabled={i === 0} onClick={() => move(i, -1)} className="p-1 text-slate-400 disabled:opacity-30"><ArrowUp size={14} /></button>
                <button disabled={i === fields.length - 1} onClick={() => move(i, 1)} className="p-1 text-slate-400 disabled:opacity-30"><ArrowDown size={14} /></button>
                <button onClick={() => setFields(fields.filter((_, j) => j !== i))} className="p-1 text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs font-bold text-slate-600 mt-2 ml-7"><input type="checkbox" className="accent-orange-500" checked={f.required} onChange={(e) => upd(i, { required: e.target.checked })} />Required</label>
          </div>
        ))}</div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => add('text')} className="flex items-center gap-1 px-3 py-2 rounded-xl border-2 border-dashed border-slate-300 text-xs font-bold text-slate-600 hover:border-orange-400 hover:text-orange-600"><Plus size={14} />Add question</button>
          {!fields.length && <button onClick={() => setFields([{ key: 'full_name', label: 'Full name', type: 'text', required: true }, { key: 'email', label: 'Email', type: 'email', required: true }, { key: 'phone', label: 'Phone / WhatsApp', type: 'phone', required: true }])} className="px-3 py-2 rounded-xl bg-orange-50 text-orange-700 text-xs font-bold">Start with name, email, phone</button>}
        </div>
        <button disabled={busy} onClick={save} className={`${btnPrimary} w-full`}>{busy && <Loader2 size={16} className="animate-spin" />}Save form</button>
      </div>
    </Modal>
  );
}

function Responses({ form, onClose }: { form: Form; onClose: () => void }) {
  const { data, loading, reload } = useData<Resp[]>(() => supabase.from('form_responses').select('id,answers,created_at').eq('form_id', form.id).order('created_at', { ascending: false }));
  const csv = () => {
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const rows = [['Submitted', ...form.fields.map((f) => f.label)], ...(data ?? []).map((r) => [new Date(r.created_at).toISOString(), ...form.fields.map((f) => show(r.answers[f.key]))])];
    const blob = new Blob(['﻿' + rows.map((r) => r.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${form.title.replace(/[^\w]+/g, '-')}-responses.csv`; a.click();
  };
  const del = async (r: Resp) => { if (!confirm('Delete this response?')) return; const { error } = await supabase.from('form_responses').delete().eq('id', r.id); if (error) toast.err(error.message); else reload(); };
  return (
    <Modal open onClose={onClose} title={`Responses — ${form.title}`} wide>
      {loading ? <Spinner /> : !data?.length ? <p className="text-center text-slate-400 py-10">No responses yet. Share the link: <br /><code className="text-xs text-slate-600">{formUrl(form.id)}</code></p> : (<>
        <div className="flex justify-between items-center mb-3"><p className="text-sm text-slate-500"><b className="text-slate-800">{data.length}</b> responses</p>
          <button onClick={csv} className="flex items-center gap-1 px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold"><Download size={14} />Export CSV</button></div>
        <div className="overflow-x-auto border border-slate-200 rounded-2xl max-h-[60vh]">
          <table className="w-full text-left text-sm"><thead className="bg-slate-50 text-[11px] font-extrabold uppercase text-slate-500 sticky top-0"><tr><th className="px-3 py-2 whitespace-nowrap">Submitted</th>{form.fields.map((f) => <th key={f.key} className="px-3 py-2 whitespace-nowrap">{f.label}</th>)}<th /></tr></thead>
            <tbody className="divide-y divide-slate-100">{data.map((r) => (
              <tr key={r.id}><td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">{fmtDateTime(r.created_at)}</td>{form.fields.map((f) => <td key={f.key} className="px-3 py-2 text-slate-700">{show(r.answers[f.key])}</td>)}
                <td className="px-2"><button onClick={() => del(r)} title="Delete response" aria-label="Delete response" className="p-1 text-slate-400 hover:text-red-500"><Trash2 size={14} /></button></td></tr>
            ))}</tbody></table>
        </div>
      </>)}
    </Modal>
  );
}

// ---------------- Public response page /f/:id ----------------
export function PublicForm() {
  const { id } = useParams();
  // Public page: visitors have no account, so load directly instead of useData (which waits for a signed-in user).
  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { supabase.from('forms').select('id,owner_id,title,description,fields,is_open,created_at').eq('id', Number(id)).maybeSingle().then(({ data }) => { setForm(data as Form | null); setLoading(false); }); }, [id]);
  const [a, setA] = useState<Record<string, string | string[]>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!form) return;
    const miss = form.fields.find((f) => f.required && (Array.isArray(a[f.key]) ? !(a[f.key] as string[]).length : !String(a[f.key] ?? '').trim()));
    if (miss) return toast.err(`Please answer “${miss.label}”.`);
    setBusy(true);
    const { error } = await supabase.from('form_responses').insert({ form_id: form.id, answers: a });
    setBusy(false);
    if (error) toast.err(error.message); else setDone(true);
  };
  const set = (k: string, v: string | string[]) => setA({ ...a, [k]: v });
  return (
    <div className="min-h-screen bg-[#fafafa] py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-center mb-8"><BrandLockup /></div>
        {loading ? <Spinner /> : !form ? <Card><p className="text-center text-slate-500">This form does not exist or is no longer available.</p></Card>
          : !form.is_open ? <Card><p className="text-center text-slate-500"><Lock className="mx-auto mb-3 text-slate-300" />“{form.title}” is closed and no longer accepts responses.</p></Card>
          : done ? <Card><div className="text-center"><CheckCircle2 size={56} className="mx-auto text-emerald-500 mb-4" /><h1 className="text-2xl font-extrabold text-slate-900">Thank you!</h1><p className="text-slate-500 mt-2">Your response has been recorded. Our team will contact you soon.</p></div></Card>
          : (
            <form onSubmit={submit} className="space-y-4">
              <div className="bg-white rounded-4xl border-t-8 border-t-indigo-600 border border-slate-100 shadow-sm p-8">
                <h1 className="text-3xl font-extrabold text-slate-900">{form.title}</h1>
                {form.description && <p className="text-slate-500 mt-2 whitespace-pre-line">{form.description}</p>}
                <p className="text-xs text-red-500 mt-4">* Required</p>
              </div>
              {form.fields.map((f) => (
                <div key={f.key} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
                  <p className="font-bold text-slate-800 mb-3">{f.label}{f.required && <span className="text-red-500"> *</span>}</p>
                  {f.type === 'textarea' ? <textarea rows={4} className={inputCls} value={(a[f.key] as string) ?? ''} onChange={(e) => set(f.key, e.target.value)} />
                    : f.type === 'select' ? <select className={inputCls} value={(a[f.key] as string) ?? ''} onChange={(e) => set(f.key, e.target.value)}><option value="">— Choose —</option>{f.options?.map((o) => <option key={o}>{o}</option>)}</select>
                    : f.type === 'radio' ? <div className="space-y-2">{f.options?.map((o) => <label key={o} className="flex items-center gap-3 text-sm text-slate-700 cursor-pointer"><input type="radio" name={f.key} className="accent-indigo-600 w-4 h-4" checked={a[f.key] === o} onChange={() => set(f.key, o)} />{o}</label>)}</div>
                    : f.type === 'checkbox' ? <div className="space-y-2">{f.options?.map((o) => { const cur = (a[f.key] as string[]) ?? []; return <label key={o} className="flex items-center gap-3 text-sm text-slate-700 cursor-pointer"><input type="checkbox" className="accent-indigo-600 w-4 h-4" checked={cur.includes(o)} onChange={(e) => set(f.key, e.target.checked ? [...cur, o] : cur.filter((x) => x !== o))} />{o}</label>; })}</div>
                    : <input type={f.type === 'phone' ? 'tel' : f.type} className={inputCls} value={(a[f.key] as string) ?? ''} onChange={(e) => set(f.key, e.target.value)} />}
                </div>
              ))}
              <button disabled={busy} className={`${btnPrimary} w-full`}>{busy && <Loader2 size={16} className="animate-spin" />}Submit</button>
              <p className="text-center text-xs text-slate-400">Language Leap Center · Never submit passwords through this form.</p>
            </form>
          )}
      </div>
    </div>
  );
}
const Card = ({ children }: { children: React.ReactNode }) => <div className="bg-white rounded-4xl border border-slate-100 shadow-sm p-10">{children}</div>;
