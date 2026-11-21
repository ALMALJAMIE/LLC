import { useEffect, useState } from 'react';
import { useAuth } from './auth';
import { supabase } from './supabase';

/** Has the signed-in student taken the placement test (or been exempted by staff)? Staff and demo users count as done. */
export function usePlacementDone() {
  const user = useAuth((s) => s.user);
  const [done, setDone] = useState<boolean | null>(null);
  useEffect(() => {
    if (!user) return;
    if (user.demo || user.role !== 'student') { setDone(true); return; }
    supabase.rpc('placement_done').then(({ data, error }) => setDone(error ? true : !!data)); // if the check is unavailable, the database still enforces it
  }, [user]);
  return done;
}
