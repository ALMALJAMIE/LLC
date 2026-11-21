import { useState } from 'react';
import { BarChart3, Building2, CheckCircle2, KeyRound, Loader2, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { SiteShell } from './Site';

const inp = 'w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-orange-200';

/** Public page: organisations ask LLC for English training for their people. */
export default function TrainingRequest() {
  const [f, setF] = useState({ organisation_name: '', contact_name: '', email: '', phone: '', country: '', learners: '', preferred_mode: 'online', needs: '' });
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  const send = async () => {
    setErr('');
    if (f.organisation_name.trim().length < 2 || f.contact_name.trim().length < 2) return setErr('Please write the organisation and your name.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) return setErr('Please write a valid email.');
    setBusy(true);
    const { error } = await supabase.from('training_requests').insert({
      organisation_name: f.organisation_name.trim(), contact_name: f.contact_name.trim(), email: f.email.trim(), phone: f.phone.trim() || null,
      country: f.country.trim() || null, learners: f.learners ? Number(f.learners) : null, preferred_mode: f.preferred_mode, needs: f.needs.trim() || null,
    });
    setBusy(false);
    if (error) setErr(error.message); else setSent(true);
  };
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <SiteShell>
      <section className="max-w-6xl mx-auto px-5 lg:px-8 py-14 grid lg:grid-cols-2 gap-12">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-orange-500">For organisations</p>
          <h1 className="text-4xl lg:text-5xl font-extrabold text-slate-900 mt-3 tracking-tight">English training for your team</h1>
          <p className="text-slate-600 mt-4 leading-relaxed">Companies, schools, universities and embassies buy seats on our courses for their staff or students. Every learner takes the placement test first, and you follow their progress from your own portal.</p>
          <ul className="mt-8 space-y-4">{[
            [Building2, 'One contract and one invoice', 'Pay for the seats you need, online or in class.'],
            [KeyRound, 'You choose who learns', 'Give seats to your people and move a seat to someone else when needed.'],
            [BarChart3, 'Clear reports', 'Placement level, progress and attendance for each learner.'],
          ].map(([I, t, d]) => { const Icon = I as typeof Building2; return (
            <li key={t as string} className="flex gap-4"><span className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 grid place-items-center shrink-0"><Icon size={20} /></span><div><p className="font-bold text-slate-900">{t as string}</p><p className="text-sm text-slate-500">{d as string}</p></div></li>
          ); })}</ul>
        </div>
        <div className="bg-white rounded-4xl border border-slate-100 shadow-xl p-7">
          {sent ? (
            <div className="text-center py-12"><CheckCircle2 size={48} className="mx-auto text-emerald-500" /><h2 className="text-2xl font-extrabold text-slate-900 mt-4">Thank you!</h2><p className="text-slate-500 mt-2">We received your request and will contact you within two working days.</p></div>
          ) : (
            <div className="space-y-3">
              <h2 className="text-xl font-extrabold text-slate-900">Ask for a proposal</h2>
              <input className={inp} placeholder="Organisation name" value={f.organisation_name} onChange={set('organisation_name')} />
              <div className="grid sm:grid-cols-2 gap-3"><input className={inp} placeholder="Your name" value={f.contact_name} onChange={set('contact_name')} /><input className={inp} placeholder="Work email" type="email" value={f.email} onChange={set('email')} /></div>
              <div className="grid sm:grid-cols-3 gap-3"><input className={inp} placeholder="Phone" value={f.phone} onChange={set('phone')} /><input className={inp} placeholder="Country" value={f.country} onChange={set('country')} /><input className={inp} placeholder="Number of learners" type="number" value={f.learners} onChange={set('learners')} /></div>
              <select className={inp} value={f.preferred_mode} onChange={set('preferred_mode')}><option value="online">Online classes</option><option value="face_to_face">Classes at our centre</option><option value="hybrid">Both</option></select>
              <textarea className={inp} rows={4} placeholder="What do your people need? (e.g. business English, IELTS, levels, timing)" value={f.needs} onChange={set('needs')} />
              {err && <p className="text-sm text-red-500">{err}</p>}
              <button disabled={busy} onClick={send} className="w-full py-3.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold flex items-center justify-center gap-2">{busy ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />} Send request</button>
              <p className="text-[11px] text-slate-400">We use these details only to answer your request.</p>
            </div>
          )}
        </div>
      </section>
    </SiteShell>
  );
}
