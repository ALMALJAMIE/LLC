import { createClient } from '@supabase/supabase-js';

/** Public project values (safe to ship to the browser; data is protected by row-level security). */
export const SUPABASE_URL = 'https://hmrivomeomhpeevydand.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_hDZTkoYXT8M7pe5_g1LOtQ_t2b5LMQs';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
