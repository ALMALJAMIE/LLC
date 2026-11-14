import { useEffect, type ReactNode } from 'react';
import { create } from 'zustand';
import { CircleAlert, CircleCheck, Info, Loader2, X } from 'lucide-react';
import { Illus } from './media';

const BADGE: Record<string, string> = {
  orange: 'bg-orange-50 text-orange-600 border-orange-100',
  indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
  green: 'bg-green-50 text-green-600 border-green-100',
  purple: 'bg-purple-50 text-purple-600 border-purple-100',
  red: 'bg-red-50 text-red-600 border-red-100',
  sky: 'bg-sky-50 text-sky-600 border-sky-100',
};

/** The white hero card that opens every portal page in the reference design. */
export function PageHero({ badge, badgeColor = 'orange', title, subtitle, illus, children }: {
  badge: string; badgeColor?: keyof typeof BADGE; title: ReactNode; subtitle?: ReactNode; illus: string; children?: ReactNode;
}) {
  return (
    <div className="bg-white rounded-4xl border border-slate-100 shadow-sm p-6 sm:p-8 mb-8 flex flex-col-reverse lg:flex-row items-center justify-between relative overflow-hidden">
      <div className="z-10 w-full lg:w-1/2 mt-6 lg:mt-0">
        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3 border ${BADGE[badgeColor]}`}>{badge}</span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-2 tracking-tight">{title}</h1>
        {subtitle && <p className="text-slate-500 text-sm sm:text-base mb-6 leading-relaxed max-w-md">{subtitle}</p>}
        {children}
      </div>
      <div className="w-full lg:w-1/2 flex justify-center lg:justify-end relative">
        <Illus name={illus} className="max-h-60 object-contain drop-shadow-xl" />
      </div>
    </div>
  );
}

export function Page({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="w-full bg-[#fafafa] min-h-screen pb-20 font-sans">
      <main className={`${wide ? 'max-w-[1600px]' : 'max-w-7xl'} mx-auto px-4 sm:px-6 py-8`}>{children}</main>
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative max-w-md">
      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
        <svg className="h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
      </div>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} type="text"
        className="block w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-200 transition-all shadow-sm" />
    </div>
  );
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return <div className="flex items-center justify-center gap-2 py-16 text-slate-400 text-sm"><Loader2 className="animate-spin" size={18} /> {label}</div>;
}

export function Empty({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="bg-white rounded-4xl border border-slate-100 shadow-sm py-16 px-6 flex flex-col items-center text-center">
      <div className="w-16 h-16 rounded-full bg-slate-50 grid place-items-center text-slate-300 mb-4">{icon}</div>
      <h3 className="font-bold text-slate-800">{title}</h3>
      {text && <p className="text-sm text-slate-400 mt-1 max-w-sm">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Shown on data pages when browsing a portal in demo mode (no signed-in account). */
export function DemoNotice() {
  return (
    <div className="mb-6 flex items-start gap-3 p-4 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-700 text-sm">
      <Info size={18} className="shrink-0 mt-0.5" />
      <span>You are previewing this portal in demo mode. <a href={`${import.meta.env.BASE_URL}login`} className="font-bold underline">Sign in</a> with a real account to see and save your own data.</span>
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-600 border-amber-100', active: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    approved: 'bg-emerald-50 text-emerald-600 border-emerald-100', paid: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    completed: 'bg-indigo-50 text-indigo-600 border-indigo-100', graded: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    rejected: 'bg-red-50 text-red-600 border-red-100', failed: 'bg-red-50 text-red-600 border-red-100',
    cancelled: 'bg-slate-100 text-slate-500 border-slate-200', refunded: 'bg-slate-100 text-slate-500 border-slate-200',
    submitted: 'bg-sky-50 text-sky-600 border-sky-100', present: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    late: 'bg-amber-50 text-amber-600 border-amber-100', absent: 'bg-red-50 text-red-600 border-red-100', excused: 'bg-sky-50 text-sky-600 border-sky-100',
  };
  return <span className={`inline-flex items-center px-2.5 py-1 rounded-md border text-[10px] font-bold uppercase tracking-wider ${map[status] ?? 'bg-slate-50 text-slate-500 border-slate-200'}`}>{status.replace('_', ' ')}</span>;
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate__animated animate__fadeIn animate__faster" onClick={onClose}>
      <div className={`bg-white rounded-4xl shadow-2xl w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[90vh] overflow-y-auto custom-scrollbar`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 sm:px-8 pt-6 pb-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h3 className="text-lg font-extrabold text-slate-900">{title}</h3>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 text-slate-400"><X size={18} /></button>
        </div>
        <div className="p-6 sm:p-8">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint && <span className="text-[11px] text-slate-400 mt-1 block">{hint}</span>}
    </label>
  );
}

export const inputCls = 'block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 focus:bg-white transition-all';
export const btnPrimary = 'inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-lg shadow-indigo-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed';
export const btnAccent = 'inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold shadow-lg shadow-orange-200 transition-all disabled:opacity-50';
export const btnGhost = 'inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-bold transition-all';

// ---- toasts ----
type Toast = { id: number; kind: 'ok' | 'err'; text: string };
const useToasts = create<{ list: Toast[]; push: (t: Omit<Toast, 'id'>) => void; drop: (id: number) => void }>((set) => ({
  list: [],
  push: (t) => {
    const id = Date.now() + Math.random();
    set((s) => ({ list: [...s.list, { ...t, id }] }));
    setTimeout(() => set((s) => ({ list: s.list.filter((x) => x.id !== id) })), 4000);
  },
  drop: (id) => set((s) => ({ list: s.list.filter((x) => x.id !== id) })),
}));
export const toast = {
  ok: (text: string) => useToasts.getState().push({ kind: 'ok', text }),
  err: (text: string) => useToasts.getState().push({ kind: 'err', text }),
};
export function Toaster() {
  const list = useToasts((s) => s.list);
  return (
    <div className="fixed bottom-6 right-6 z-[70] space-y-2">
      {list.map((t) => (
        <div key={t.id} className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border text-sm font-medium animate__animated animate__fadeInUp animate__faster ${t.kind === 'ok' ? 'bg-white border-emerald-100 text-emerald-700' : 'bg-white border-red-100 text-red-600'}`}>
          {t.kind === 'ok' ? <CircleCheck size={18} /> : <CircleAlert size={18} />} {t.text}
        </div>
      ))}
    </div>
  );
}
