import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './auth';

/** Tiny data hook: runs `fn` when the user is ready; returns data, loading, error and reload. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useData<T>(fn: () => PromiseLike<{ data: any; error: { message: string } | null }>, deps: unknown[] = []) {
  const user = useAuth((s) => s.user);
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async () => {
    if (!user || user.demo) { setData(null); setLoading(false); return; }
    setLoading(true);
    const res = await fn();
    setData(res.data as T);
    setError(res.error?.message ?? null);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, ...deps]);
  useEffect(() => { run(); }, [run]);
  return { data, loading, error, reload: run, demo: !!user?.demo };
}

export const money = (n: number | string | null | undefined, cur = 'MYR') =>
  `${cur} ${Number(n ?? 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const fmtDateTime = (d?: string | null) =>
  d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
