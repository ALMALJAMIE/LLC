import { create } from 'zustand';
import { money } from './db';
import { useBilling } from './site';

const NAMES: Record<string, string> = { USD: 'US dollar', MYR: 'Malaysian ringgit', SAR: 'Saudi riyal', AED: 'UAE dirham', EUR: 'Euro', GBP: 'British pound', IDR: 'Indonesian rupiah', YER: 'Yemeni rial' };
const read = () => { try { return localStorage.getItem('llc-cur') || 'USD'; } catch { return 'USD'; } };
export const useLocalCur = create<{ cur: string; set: (c: string) => void }>((set) => ({
  cur: read(),
  set: (cur) => { try { localStorage.setItem('llc-cur', cur); } catch { /* private mode */ } set({ cur }); },
}));

/** Approximate value in the visitor's chosen currency (null when it is USD or unknown). */
export function useApprox() {
  const fx = useBilling().fx;
  const cur = useLocalCur((s) => s.cur);
  return (amount: number | string | null | undefined, from = 'USD') => {
    const n = Number(amount);
    if (!n || cur === from || from !== 'USD' || !fx[cur]) return null;
    return new Intl.NumberFormat('en', { style: 'currency', currency: cur, maximumFractionDigits: n * fx[cur] >= 1000 ? 0 : 2 }).format(n * fx[cur]);
  };
}

/** Price in USD, with an approximate local amount underneath when the visitor picked a currency. */
export function Price({ amount, cur = 'USD', className = '', free = 'Free' }: { amount: number | string | null | undefined; cur?: string; className?: string; free?: string }) {
  const approx = useApprox();
  if (!Number(amount)) return <span className={className}>{free}</span>;
  const a = approx(amount, cur);
  return <span className={className}>{money(amount, cur)}{a && <span className="block text-[11px] font-semibold text-slate-400" data-no-i18n>≈ {a}</span>}</span>;
}

export function CurrencyPicker({ className = '' }: { className?: string }) {
  const fx = useBilling().fx;
  const { cur, set } = useLocalCur();
  return (
    <select value={cur} onChange={(e) => set(e.target.value)} title="Show prices also in" className={`px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 ${className}`}>
      <option value="USD">USD only</option>
      {Object.keys(fx).map((c) => <option key={c} value={c}>{c} · {NAMES[c] ?? c}</option>)}
    </select>
  );
}
