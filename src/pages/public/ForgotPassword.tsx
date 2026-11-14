import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, KeyRound, Loader2, Lock, Mail, MailCheck } from 'lucide-react';
import AuthShell, { authBtn, authInput } from './AuthShell';
import { supabase } from '../../lib/supabase';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError('');
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${location.origin}${import.meta.env.BASE_URL}reset-password` });
    setBusy(false);
    if (error) setError(error.message); else setSent(true);
  };
  return (
    <AuthShell>
      {sent ? (
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-500 grid place-items-center mx-auto mb-5"><MailCheck size={30} /></div>
          <h2 className="text-2xl font-extrabold text-slate-900 mb-2">Check your email</h2>
          <p className="text-slate-500 mb-8">If an account exists for <b>{email}</b>, a reset link is on its way.</p>
          <Link to="/login" className={authBtn}>Back to Sign In</Link>
        </div>
      ) : (
        <>
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 grid place-items-center mb-6"><KeyRound size={26} /></div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">Forgot password?</h2>
          <p className="text-slate-500 mb-8">Enter your email and we will send you a reset link.</p>
          <form onSubmit={submit} className="space-y-4">
            <label className="block"><span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email</span>
              <div className={authInput}><Mail size={18} className="text-slate-400" /><input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="flex-1 outline-none text-sm bg-transparent" /></div></label>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button disabled={busy} className={authBtn}>{busy ? <Loader2 className="animate-spin" size={18} /> : <>Send Reset Link <ArrowRight size={18} /></>}</button>
          </form>
          <p className="text-sm text-slate-500 text-center mt-6"><Link to="/login" className="font-bold text-indigo-600 hover:text-orange-500">Back to Sign In</Link></p>
        </>
      )}
    </AuthShell>
  );
}

export function ResetPassword() {
  const nav = useNavigate();
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);
  useEffect(() => { supabase.auth.getSession().then(({ data }) => { if (!data.session) setError('This reset link has expired. Request a new one.'); }); }, []);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) return setError('Password must be at least 8 characters.');
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) setError(error.message); else { setOk(true); setTimeout(() => nav('/'), 1500); }
  };
  return (
    <AuthShell>
      <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">Set a new password</h2>
      <p className="text-slate-500 mb-8">Choose a strong password you have not used before.</p>
      <form onSubmit={submit} className="space-y-4">
        <label className="block"><span className="text-xs font-bold text-slate-500 uppercase tracking-wider">New password</span>
          <div className={authInput}><Lock size={18} className="text-slate-400" /><input required type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="8+ characters" className="flex-1 outline-none text-sm bg-transparent" /></div></label>
        {error && <p className="text-sm text-red-500">{error}</p>}
        {ok && <p className="text-sm text-emerald-600">Password updated. Redirecting…</p>}
        <button disabled={busy} className={authBtn}>{busy ? <Loader2 className="animate-spin" size={18} /> : 'Update Password'}</button>
      </form>
    </AuthShell>
  );
}
