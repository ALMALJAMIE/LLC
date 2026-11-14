import { useState } from 'react';
import { FileText, Loader2, Paperclip, Plus, Upload } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { fmtDate, useData } from '../../lib/db';
import { DemoNotice, Field, Modal, Page, Spinner, StatusPill, btnPrimary, inputCls, toast } from '../../components/ui';
import { useMyEnrollments } from './hooks';

type R = { id: number; date_from: string; date_to: string; reason: string; attachment_url: string | null; status: string; review_note: string | null; created_at: string; batch: { name: string } | null };

export default function StudentAbsence() {
  const user = useAuth((s) => s.user);
  const [open, setOpen] = useState(false);
  const { data, loading, reload } = useData<R[]>(() => supabase.from('absence_requests').select('*, batch:batches(name)').eq('student_id', user!.id).order('created_at', { ascending: false }));
  const view = async (p: string) => { const { data } = await supabase.storage.from('uploads').createSignedUrl(p, 300); if (data) window.open(data.signedUrl, '_blank'); };
  return (
    <Page>
      {user?.demo && <DemoNotice />}
      <div className="bg-white rounded-4xl border border-slate-100 shadow-sm p-6 sm:p-8 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3 border bg-indigo-50 text-indigo-600 border-indigo-100">Student Portal</span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-2 tracking-tight">Medical Leave &amp; Excuses</h1>
          <p className="text-slate-500 text-sm sm:text-base leading-relaxed max-w-md">Submit your medical certificates. Approved dates will protect your attendance percentage.</p>
        </div>
        <button disabled={user?.demo} onClick={() => setOpen(true)} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-orange-500 text-white text-xs font-black uppercase tracking-wider transition-colors disabled:opacity-50"><Plus size={16} /> Submit New Excuse</button>
      </div>
      {loading ? <Spinner /> : !data?.length ? (
        <div className="bg-white rounded-4xl border border-slate-100 shadow-sm py-16 px-6 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-full bg-slate-50 grid place-items-center text-slate-300 mb-4"><FileText size={26} /></div>
          <h3 className="text-xl font-extrabold text-slate-900">No Records Found</h3>
          <p className="text-sm text-slate-500 max-w-xs mt-1">You haven't submitted any medical certificates or absence excuses yet.</p>
          <button disabled={user?.demo} onClick={() => setOpen(true)} className="mt-6 flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-lg shadow-indigo-200 disabled:opacity-50"><Plus size={16} /> Submit Your First Excuse</button>
        </div>
      ) : (
        <div className="space-y-4">
          {data.map((r) => (
            <div key={r.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 flex flex-col md:flex-row md:items-center gap-4">
              <span className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 grid place-items-center shrink-0"><FileText size={22} /></span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800">{fmtDate(r.date_from)}{r.date_to !== r.date_from && ` – ${fmtDate(r.date_to)}`}</p>
                <p className="text-sm text-slate-500 line-clamp-2">{r.reason}</p>
                <p className="text-[11px] text-slate-400 mt-1">{r.batch?.name ?? 'All classes'} · submitted {fmtDate(r.created_at)}</p>
                {r.review_note && <p className="text-xs mt-1 text-slate-600"><b>Reviewer:</b> {r.review_note}</p>}
              </div>
              {r.attachment_url && <button onClick={() => view(r.attachment_url!)} className="flex items-center gap-1 text-xs font-bold text-indigo-600"><Paperclip size={14} /> Attachment</button>}
              <StatusPill status={r.status} />
            </div>
          ))}
        </div>
      )}
      {open && <Submit onClose={() => setOpen(false)} onDone={() => { setOpen(false); reload(); }} />}
    </Page>
  );
}

function Submit({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const user = useAuth((s) => s.user)!;
  const mine = useMyEnrollments();
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({ batch: '', from: today, to: today, reason: '' });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (f.to < f.from) return toast.err('End date must be after start date.');
    setBusy(true);
    let path: string | null = null;
    if (file) {
      path = `${user.id}/mc/${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`;
      const up = await supabase.storage.from('uploads').upload(path, file);
      if (up.error) { setBusy(false); return toast.err(up.error.message); }
    }
    const { error } = await supabase.from('absence_requests').insert({ student_id: user.id, batch_id: f.batch ? Number(f.batch) : null, date_from: f.from, date_to: f.to, reason: f.reason.trim(), attachment_url: path, status: 'pending' });
    setBusy(false);
    if (error) return toast.err(error.message);
    toast.ok('Submitted for review'); onDone();
  };
  return (
    <Modal open onClose={onClose} title="Submit Medical Leave / Excuse">
      <form onSubmit={save} className="space-y-4">
        <Field label="Class"><select className={inputCls} value={f.batch} onChange={(e) => setF({ ...f, batch: e.target.value })}>
          <option value="">All my classes</option>{(mine.data ?? []).filter((x) => x.batch).map((x) => <option key={x.id} value={x.batch!.id}>{x.batch!.name}</option>)}</select></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="From"><input type="date" required className={inputCls} value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
          <Field label="To"><input type="date" required className={inputCls} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
        </div>
        <Field label="Reason"><textarea required rows={3} className={inputCls} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="e.g. Fever — clinic visit" /></Field>
        <label className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-slate-300 cursor-pointer hover:border-orange-400 text-sm text-slate-600">
          <Upload size={18} className="text-slate-400" /> {file ? file.name : 'Attach medical certificate (image or PDF)'}
          <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <button disabled={busy} className={`${btnPrimary} w-full`}>{busy && <Loader2 size={16} className="animate-spin" />} Submit</button>
      </form>
    </Modal>
  );
}
