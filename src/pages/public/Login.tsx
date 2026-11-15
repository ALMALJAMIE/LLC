import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Briefcase, GraduationCap, Loader2, Lock, Mail, Presentation, ShieldCheck, ClipboardCheck, Wallet } from 'lucide-react';
import AuthShell, { authBtn, authInput } from './AuthShell';
import { DEMO_USERS, useAuth } from '../../lib/auth';
import { ROLE_HOME, type Role } from '../../lib/nav';
import { supabase } from '../../lib/supabase';

const ROLES: { role: Role; label: string; icon: typeof GraduationCap; desc: string }[] = [
  { role: 'student', label: 'Student', icon: GraduationCap, desc: 'Courses, classes, exams' },
  { role: 'instructor', label: 'Instructor', icon: Presentation, desc: 'Batches, lessons, grading' },
  { role: 'academic', label: 'Academic Supervisor', icon: ClipboardCheck, desc: 'Courses, timetables, approvals' },
  { role: 'finance', label: 'Finance Officer', icon: Wallet, desc: 'Payments, invoices, payouts' },
  { role: 'agent', label: 'Agent', icon: Briefcase, desc: 'Enrollments & earnings' },
  { role: 'admin', label: 'Admin', icon: ShieldCheck, desc: 'Full platform control' },
];

export default function Login() {
  const signInDemo = useAuth((s) => s.signIn);
  const loadProfile = useAuth((s) => s.loadProfile);
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const demo = (role: Role) => { signInDemo(DEMO_USERS[role]); nav(ROLE_HOME[role]); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) { setBusy(false); setError(error.message === 'Invalid login credentials' ? 'Incorrect email or password.' : error.message); return; }
    await loadProfile();
    const u = useAuth.getState().user;
    setBusy(false);
    nav(u ? ROLE_HOME[u.role] : '/');
  };

  return (
    <AuthShell>
      <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">Welcome back 👋</h2>
      <p className="text-slate-500 mb-8">Sign in to continue to your portal.</p>
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email</span>
          <div className={authInput}><Mail size={18} className="text-slate-400" />
            <input required value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" placeholder="you@example.com" className="flex-1 outline-none text-sm bg-transparent" /></div>
        </label>
        <label className="block">
          <div className="flex justify-between items-center"><span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Password</span>
            <Link to="/forgot-password" className="text-xs font-bold text-indigo-600 hover:text-orange-500">Forgot password?</Link></div>
          <div className={authInput}><Lock size={18} className="text-slate-400" />
            <input required value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" placeholder="••••••••" className="flex-1 outline-none text-sm bg-transparent" /></div>
        </label>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button disabled={busy} className={authBtn}>{busy ? <Loader2 className="animate-spin" size={18} /> : <>Sign In <ArrowRight size={18} /></>}</button>
      </form>
      <p className="text-sm text-slate-500 text-center mt-6">New to LLC? <Link to="/register" className="font-bold text-indigo-600 hover:text-orange-500">Create a student account</Link></p>

      <div className="flex items-center gap-4 my-8">
        <div className="h-px flex-1 bg-slate-200" /><span className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400">Preview portals</span><div className="h-px flex-1 bg-slate-200" />
      </div>
      <div className="grid grid-cols-2 gap-3 [&>*:last-child:nth-child(odd)]:col-span-2">
        {ROLES.map(({ role, label, icon: Icon, desc }) => (
          <button key={role} onClick={() => demo(role)} className="text-left p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md hover:border-orange-200 transition-all group">
            <span className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 grid place-items-center mb-3 group-hover:bg-orange-50 group-hover:text-orange-500 transition-colors"><Icon size={20} /></span>
            <p className="font-bold text-slate-800 text-sm">{label}</p>
            <p className="text-xs text-slate-400">{desc}</p>
          </button>
        ))}
      </div>
    </AuthShell>
  );
}
