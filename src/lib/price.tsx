import { create } from 'zustand';
import { money } from './db';
import { useBilling } from './site';
import { useAuth } from './auth';

const BY_COUNTRY: [RegExp, string][] = [[/malaysia/i, 'MYR'], [/indonesia/i, 'IDR'], [/saudi/i, 'SAR'], [/emirates|uae/i, 'AED'], [/yemen/i, 'YER'], [/united kingdom|britain|^uk$|england/i, 'GBP'],
  [/germany|france|italy|spain|netherlands|ireland|belgium|austria|portugal|finland|greece/i, 'EUR']];
/** The currency to show beside USD: the visitor's choice, otherwise the one of their profile country. */
export function useShownCur() {
  const chosen = useLocalCur((s) => s.cur);
  const country = useAuth((s) => s.profile?.country) ?? '';
  const fx = useBilling().fx;
  if (chosen) return chosen;
  const c = BY_COUNTRY.find(([re]) => re.test(country))?.[1];
  return c && fx[c] ? c : 'USD';
}

const NAMES: Record<string, string> = { USD: 'US dollar', MYR: 'Malaysian ringgit', SAR: 'Saudi riyal', AED: 'UAE dirham', EUR: 'Euro', GBP: 'British pound', IDR: 'Indonesian rupiah', YER: 'Yemeni rial' };
const read = () => { try { return localStorage.getItem('llc-cur') || ''; } catch { return ''; } };
export const useLocalCur = create<{ cur: string; set: (c: string) => void }>((set) => ({
  cur: read(),
  set: (cur) => { try { localStorage.setItem('llc-cur', cur); } catch { /* private mode */ } set({ cur }); },
}));

/** Approximate value in the visitor's chosen currency (null when it is USD or unknown). */
export function useApprox() {
  const fx = useBilling().fx;
  const cur = useShownCur();
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

export function CurrencyPicker({ className = '', compact = false }: { className?: string; compact?: boolean }) {
  const fx = useBilling().fx;
  const set = useLocalCur((s) => s.set);
  const cur = useShownCur();
  return (
    <select value={cur} onChange={(e) => set(e.target.value)} title="Show prices also in" className={`px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 ${className}`}>
      <option value="USD">{compact ? 'USD' : 'USD only'}</option>
      {Object.keys(fx).map((c) => <option key={c} value={c}>{compact ? c : `${c} · ${NAMES[c] ?? c}`}</option>)}
    </select>
  );
}
