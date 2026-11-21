import { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { AlertTriangle, HelpCircle } from 'lucide-react';

/** In-app replacements for the browser's confirm() and prompt() boxes. */
type D = { kind: 'confirm' | 'text'; message: string; danger?: boolean; initial?: string; resolve: (v: boolean | string | null) => void };
const useDialog = create<{ d: D | null }>(() => ({ d: null }));

export function askConfirm(message: string): Promise<boolean> {
  const danger = /delete|remove|archive|retake|حذف/i.test(message);
  return new Promise((resolve) => useDialog.setState({ d: { kind: 'confirm', message, danger, resolve: (v) => resolve(v === true) } }));
}
export function askText(message: string, initial = ''): Promise<string | null> {
  return new Promise((resolve) => useDialog.setState({ d: { kind: 'text', message, initial, resolve: (v) => resolve(typeof v === 'string' ? v : null) } }));
}

export function DialogHost() {
  const d = useDialog((s) => s.d);
  const [val, setVal] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (d) { setVal(d.initial ?? ''); setTimeout(() => ref.current?.focus(), 50); } }, [d]);
  useEffect(() => {
    if (!d) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') close(null); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }); // eslint-disable-line react-hooks/exhaustive-deps
  if (!d) return null;
  const close = (v: boolean | string | null) => { d.resolve(v); useDialog.setState({ d: null }); };
  const ok = () => close(d.kind === 'confirm' ? true : val);
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" onClick={() => close(d.kind === 'confirm' ? false : null)}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex gap-3 items-start">
          <span className={`w-10 h-10 shrink-0 rounded-2xl grid place-items-center ${d.danger ? 'bg-red-50 text-red-500' : 'bg-indigo-50 text-indigo-600'}`}>{d.danger ? <AlertTriangle size={20} /> : <HelpCircle size={20} />}</span>
          <p className="flex-1 text-sm font-semibold text-slate-800 leading-relaxed pt-2 whitespace-pre-line">{d.message}</p>
        </div>
        {d.kind === 'text' && <textarea ref={ref} rows={3} value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ok(); } }}
          className="mt-4 block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300" />}
        <div className="flex gap-2 justify-end mt-5">
          <button onClick={() => close(d.kind === 'confirm' ? false : null)} className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-bold">Cancel</button>
          <button onClick={ok} className={`px-5 py-2.5 rounded-xl text-white text-sm font-bold ${d.danger ? 'bg-red-500 hover:bg-red-600' : 'bg-indigo-600 hover:bg-indigo-700'}`}>{d.kind === 'confirm' && d.danger ? 'Delete' : 'OK'}</button>
        </div>
      </div>
    </div>
  );
}
