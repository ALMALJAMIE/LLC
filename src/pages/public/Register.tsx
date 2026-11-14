import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Globe, Loader2, Lock, Mail, MailCheck, Phone, User } from 'lucide-react';
import AuthShell, { authBtn, authInput } from './AuthShell';
import { supabase } from '../../lib/supabase';

export default function Register() {
  const [f, setF] = useState({ full_name: '', email: '', phone: '', country: 'Malaysia', password: '', confirm: '', company: '' });
  const [agent, setAgent] = useState(() => new URLSearchParams(location.search).get('as') === 'agent');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (f.password.length < 8) return setError('Password must be at least 8 characters.');
    if (f.password !== f.confirm) return setError('Passwords do not match.');
    setError(''); setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: f.email.trim(), password: f.password,
      options: { data: { full_name: f.full_name.trim(), phone: f.phone.trim(), country: f.country.trim(), apply_agent: agent, company: f.company.trim() || null }, emailRedirectTo: `${location.origin}${import.meta.env.BASE_URL}login` },
    });
    setBusy(false);
    if (error) return setError(error.message);
    setDone(true);
  };

  if (done) return (
    <AuthShell>
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-500 grid place-items-center mx-auto mb-5"><MailCheck size={30} /></div>
        <h2 className="text-2xl font-extrabold text-slate-900 mb-2">Check your email</h2>
        <p className="text-slate-500 mb-8">We sent a confirmation link to <b>{f.email}</b>. Open it to activate your account, then sign in.{agent && ' Your agent application will be reviewed by LLC; you will be notified once it is approved.'}</p>
        <Link to="/login" className={authBtn}>Go to Sign In</Link>
      </div>
    </AuthShell>
  );

  const row = (k: keyof typeof f, label: string, Icon: typeof User, type = 'text', ph = '') => (
    <label className="block">
      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</span>
      <div className={authInput}><Icon size={18} className="text-slate-400" />
        <input required={k !== 'phone' && k !== 'company'} value={f[k]} onChange={set(k)} type={type} placeholder={ph} className="flex-1 outline-none text-sm bg-transparent" /></div>
    </label>
  );

  return (
    <AuthShell>
      <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">Create your account</h2>
      <p className="text-slate-500 mb-6">Join Language Leap Center as a {agent ? 'partner agent' : 'student'}.</p>
      <div className="inline-flex bg-slate-100 p-1 rounded-xl mb-6">
        <button type="button" onClick={() => setAgent(false)} className={`px-4 py-2 rounded-lg text-xs font-bold ${!agent ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>Student</button>
        <button type="button" onClick={() => setAgent(true)} className={`px-4 py-2 rounded-lg text-xs font-bold ${agent ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>Apply as Agent</button>
      </div>
      <form onSubmit={submit} className="space-y-4">
        {row('full_name', 'Full name', User, 'text', 'As in your passport / IC')}
        {row('email', 'Email', Mail, 'email', 'you@example.com')}
        <div className="grid grid-cols-2 gap-3">{row('phone', 'Phone / WhatsApp', Phone, 'tel', '+60…')}{row('country', 'Country', Globe)}</div>
        {agent && row('company', 'Company / Agency (optional)', Globe, 'text', 'Leave empty if individual')}
        <div className="grid grid-cols-2 gap-3">{row('password', 'Password', Lock, 'password', '8+ characters')}{row('confirm', 'Confirm', Lock, 'password', 'Repeat password')}</div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button disabled={busy} className={authBtn}>{busy ? <Loader2 className="animate-spin" size={18} /> : <>Create Account <ArrowRight size={18} /></>}</button>
      </form>
      <p className="text-sm text-slate-500 text-center mt-6">Already have an account? <Link to="/login" className="font-bold text-indigo-600 hover:text-orange-500">Sign in</Link></p>
    </AuthShell>
  );
}
