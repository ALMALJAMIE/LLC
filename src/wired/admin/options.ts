import { supabase } from '../../lib/supabase';
import { useData } from '../../lib/db';

/** Loads {value,label} options from a table for select fields. */
export function useOptions(table: string, label: string, opts: { eq?: [string, unknown]; inList?: [string, unknown[]]; order?: string } = {}) {
  const { data } = useData<Record<string, unknown>[]>(() => {
    let q = supabase.from(table).select(`id,${label}`).order(opts.order ?? label);
    if (opts.eq) q = q.eq(opts.eq[0], opts.eq[1]);
    if (opts.inList) q = q.in(opts.inList[0], opts.inList[1]);
    return q;
  });
  return (data ?? []).map((r) => ({ value: r.id as string | number, label: String(r[label]) }));
}
