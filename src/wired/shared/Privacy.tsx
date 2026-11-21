import { useEffect, useState } from 'react';
import { Download, ExternalLink, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { fmtDateTime, useData } from '../../lib/db';
import { StatusPill, btnGhost, btnPrimary, toast } from '../../components/ui';
import { askText } from '../../components/dialogs';

type DR = { id: number; kind: string; status: string; response: string | null; created_at: string };

/** Section on "My Profile": consents, data download, privacy requests. */
export function PrivacySection() {
  const user = useAuth((s) => s.user)!;
  const consents = useData<{ kind: string; granted: boolean; created_at: string }[]>(() => supabase.from('consents').select('kind,granted,created_at').eq('user_id', user.id).order('created_at', { ascending: false }));
  const reqs = useData<DR[]>(() => supabase.from('data_requests').select('*').eq('user_id', user.id).order('created_at', { ascending: false }));
  const latest = (k: string) => consents.data?.find((c) => c.kind === k);
  const setConsent = async (kind: string, granted: boolean) => {
    const { error } = await supabase.from('consents').insert({ user_id: user.id, kind, granted });
    if (error) toast.err(error.message); else { toast.ok('Saved'); consents.reload(); }
  };
  const download = async () => {
    const { data, error } = await supabase.rpc('my_data_export');
    if (error) return toast.err(error.message);
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); a.download = 'my-llc-data.json'; a.click();
  };
  const request = async (kind: 'correction' | 'deletion') => {
    const details = await askText(kind === 'deletion' ? 'Ask LLC to delete your account and personal data. Records the law requires us to keep (such as invoices) are kept. Anything you want to add?' : 'What should be corrected?');
    if (details === null) return;
    if (kind === 'correction' && details.trim().length < 3) return toast.err('Please describe what should be corrected.');
    const { error } = await supabase.from('data_requests').insert({ user_id: user.id, kind, details: details.trim() || null });
    if (error) toast.err(error.message); else { toast.ok('Request sent. We will answer within 21 days.'); reqs.reload(); }
  };
  if (user.demo) return null;
  return (
    <div className="bg-white rounded-4xl border border-slate-100 shadow-sm p-6 mt-6">
      <h2 className="font-extrabold text-slate-900 flex items-center gap-2 mb-4"><ShieldCheck size={18} className="text-indigo-600" />Privacy</h2>
      <label className="flex items-center gap-3 text-sm"><input type="checkbox" className="accent-indigo-600 w-4 h-4" checked={!!latest('marketing')?.granted} onChange={(e) => setConsent('marketing', e.target.checked)} />Send me news about new courses and offers</label>
      <label className="flex items-center gap-3 text-sm mt-2"><input type="checkbox" className="accent-indigo-600 w-4 h-4" checked={!!latest('recording')?.granted} onChange={(e) => setConsent('recording', e.target.checked)} />I agree that online classes I attend may be recorded for learning purposes</label>
      <div className="flex flex-wrap gap-2 mt-5">
        <button onClick={download} className={btnGhost}><Download size={15} /> Download my data</button>
        <button onClick={() => request('correction')} className={btnGhost}>Ask to correct my data</button>
        <button onClick={() => request('deletion')} className={`${btnGhost} text-red-600`}>Ask to delete my account</button>
      </div>
      {!!(reqs.data ?? []).length && <div className="mt-4 divide-y divide-slate-100">{(reqs.data ?? []).map((r) => (
        <div key={r.id} className="py-2 flex items-center gap-3 text-sm"><span className="flex-1">{`${r.kind} request · ${fmtDateTime(r.created_at)}`}{r.response ? ` — ${r.response}` : ''}</span><StatusPill status={r.status} /></div>
      ))}</div>}
    </div>
  );
}

/** Asks every signed-in user to accept the privacy notice once it is published (and again when it changes). */
export function ConsentGate() {
  const user = useAuth((s) => s.user);
  const [need, setNeed] = useState<{ updated: string } | null>(null);
  const [ok, setOk] = useState(false);
  useEffect(() => {
    if (!user || user.demo) return;
    (async () => {
      const { data: page } = await supabase.from('cms_pages').select('updated_at').eq('slug', 'privacy').eq('status', 'published').maybeSingle();
      if (!page) return;
      const { data: c } = await supabase.from('consents').select('created_at,granted').eq('user_id', user.id).eq('kind', 'privacy').order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (!c || !c.granted || c.created_at < page.updated_at) setNeed({ updated: page.updated_at });
    })();
  }, [user]);
  if (!need || !user) return null;
  const accept = async () => {
    const { error } = await supabase.from('consents').insert({ user_id: user.id, kind: 'privacy', version: need.updated.slice(0, 10), granted: true });
    if (error) toast.err(error.message); else setNeed(null);
  };
  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/50 backdrop-blur-sm grid place-items-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl">
        <ShieldCheck size={32} className="text-indigo-600" />
        <h2 className="text-xl font-extrabold text-slate-900 mt-3">Our privacy notice</h2>
        <p className="text-sm text-slate-600 mt-2">Please read how Language Leap Center uses your personal data. You can change your choices any time under My Profile → Privacy.</p>
        <a href={`${import.meta.env.BASE_URL}legal/privacy`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-3 text-sm font-bold text-indigo-600"><ExternalLink size={14} />Read the privacy notice</a>
        <label className="flex items-start gap-2 mt-4 text-sm"><input type="checkbox" className="mt-1 accent-indigo-600" checked={ok} onChange={(e) => setOk(e.target.checked)} />I have read the privacy notice and agree to it.</label>
        <button disabled={!ok} onClick={accept} className={`${btnPrimary} w-full mt-5`}>Continue</button>
      </div>
    </div>
  );
}
