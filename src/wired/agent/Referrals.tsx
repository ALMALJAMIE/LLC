import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Link2, Share2 } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { fmtDate, useData } from '../../lib/db';
import { DemoNotice, Page, PageHero, Spinner, StatusPill, toast } from '../../components/ui';

type Ref = { student_id: string; full_name: string; email: string; joined_at: string; placed: boolean; courses: { course: string; status: string }[] };

/** The agent's personal link: students who sign up with it are linked to the agent, and their paid courses earn commission. */
export default function AgentReferrals() {
  const user = useAuth((s) => s.user)!;
  const me = useData<{ ref_code: string; status: string }>(() => supabase.from('agent_profiles').select('ref_code,status').eq('id', user.id).maybeSingle());
  const refs = useData<Ref[]>(() => supabase.rpc('my_referrals'));
  const link = me.data?.ref_code ? `${location.origin}${import.meta.env.BASE_URL}r/${me.data.ref_code}` : '';
  const [qr, setQr] = useState('');
  useEffect(() => { if (link) QRCode.toDataURL(link, { width: 360, margin: 1, color: { dark: '#0b1a3a' } }).then(setQr); }, [link]);
  const copy = async () => { try { await navigator.clipboard.writeText(link); toast.ok('Link copied'); } catch { toast.err('Copy failed — select the link and copy it.'); } };
  const share = async () => { if (navigator.share) { try { await navigator.share({ title: 'Language Leap Center', text: 'Learn English with LLC', url: link }); } catch { /* closed */ } } else copy(); };
  return (
    <Page>
      {user.demo && <DemoNotice />}
      <PageHero badge="Agent" badgeColor="indigo" title="My Referral Link" illus="users" subtitle="Share your link. Students who create their account with it are linked to you, and every course they pay for earns your commission automatically." />
      {me.loading ? <Spinner /> : me.data?.status !== 'approved' ? <p className="text-center text-slate-400 py-10">Your link becomes active once LLC approves your agent account.</p> : (
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="md:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
            <p className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1"><Link2 size={14} />Your link</p>
            <p className="mt-2 p-3 rounded-xl bg-slate-50 border border-slate-100 font-mono text-sm break-all" data-no-i18n>{link}</p>
            <div className="flex flex-wrap gap-2 mt-4">
              <button onClick={copy} className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-orange-500 text-white text-sm font-bold flex items-center gap-2"><Copy size={16} />Copy link</button>
              <button onClick={share} className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold flex items-center gap-2"><Share2 size={16} />Share</button>
              <a href={`https://wa.me/?text=${encodeURIComponent('Learn English with Language Leap Center: ' + link)}`} target="_blank" rel="noreferrer" className="px-4 py-2.5 rounded-xl border border-emerald-200 text-emerald-700 text-sm font-bold">WhatsApp</a>
            </div>
            <p className="text-xs text-slate-500 mt-4">The link works for new accounts only, within 30 days of opening it. Students you register yourself (Enroll Student) are linked to you as before.</p>
          </div>
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 text-center">{qr && <img src={qr} alt="QR" className="mx-auto w-44 h-44" />}<p className="text-xs text-slate-500 mt-2">Print this QR on flyers.</p></div>
        </div>
      )}
      <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3">Students who joined with your link</h2>
      {refs.loading ? <Spinner /> : !(refs.data ?? []).length ? <p className="text-slate-400 text-sm">No one yet.</p> : (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm divide-y divide-slate-100">{(refs.data ?? []).map((r) => (
          <div key={r.student_id} className="px-5 py-3 flex flex-wrap items-center gap-3 text-sm">
            <div className="flex-1 min-w-48"><p className="font-bold text-slate-800">{r.full_name}</p><p className="text-[11px] text-slate-400">{r.email} · {`joined ${fmtDate(r.joined_at)}`}</p></div>
            <span className={`text-[11px] font-bold ${r.placed ? 'text-emerald-600' : 'text-orange-600'}`}>{r.placed ? 'Placement done' : 'Placement test pending'}</span>
            <div className="flex flex-wrap gap-1">{r.courses.map((c, i) => <span key={i} className="flex items-center gap-1 text-[11px]">{c.course} <StatusPill status={c.status} /></span>)}</div>
          </div>
        ))}</div>
      )}
    </Page>
  );
}
