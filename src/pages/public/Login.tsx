import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Briefcase, GraduationCap, Lock, Mail, Presentation, ShieldCheck } from 'lucide-react';
import { BrandLockup } from '../../components/media';
import { DEMO_USERS, useAuth } from '../../lib/auth';
import { ROLE_HOME, type Role } from '../../lib/nav';

const ROLES: { role: Role; label: string; icon: typeof GraduationCap; desc: string }[] = [
  { role: 'student', label: 'Student', icon: GraduationCap, desc: 'Courses, classes, exams' },
  { role: 'instructor', label: 'Instructor', icon: Presentation, desc: 'Batches, lessons, grading' },
  { role: 'agent', label: 'Agent', icon: Briefcase, desc: 'Enrollments & earnings' },
  { role: 'admin', label: 'Admin', icon: ShieldCheck, desc: 'Full platform control' },
];

export default function Login() {
  const signIn = useAuth((s) => s.signIn);
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const enter = (role: Role) => {
    signIn(DEMO_USERS[role]);
    nav(ROLE_HOME[role]);
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const u = Object.values(DEMO_USERS).find((x) => x.email === email.trim().toLowerCase());
    if (!u || password.length < 1) return setError('Use one of the demo accounts below, or pick a portal.');
    enter(u.role);
  };

  return (
    <div className="min-h-screen bg-[#fafafa] grid lg:grid-cols-2">
      <div className="hidden lg:flex relative overflow-hidden bg-[#0b1a3a] text-white p-14 flex-col justify-between">
        <div className="absolute -right-24 -top-24 w-96 h-96 rounded-full bg-indigo-500/20" />
        <div className="absolute -left-20 bottom-10 w-72 h-72 rounded-full bg-orange-500/10" />
        <BrandLockup dark />
        <div className="relative">
          <span className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 text-orange-300 rounded-full text-xs font-bold uppercase tracking-wider mb-6 border border-white/10">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Learning Platform
          </span>
          <h1 className="text-5xl font-extrabold tracking-tight leading-tight mb-4">Your leap to<br /><span className="text-orange-400">fluent English</span></h1>
          <p className="text-slate-300 text-lg max-w-md leading-relaxed">One place for students, instructors, agents and administrators of Language Leap Center.</p>
        </div>
        <p className="relative text-xs text-slate-400">© {new Date().getFullYear()} Language Leap Center</p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-10"><BrandLockup /></div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">Welcome back 👋</h2>
          <p className="text-slate-500 mb-8">Sign in to continue to your portal.</p>
          <form onSubmit={submit} className="space-y-4">
            <label className="block">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email</span>
              <div className="mt-2 flex items-center gap-3 px-4 py-3 bg-white border border-slate-200 rounded-2xl focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-50">
                <Mail size={18} className="text-slate-400" />
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@example.com" className="flex-1 outline-none text-sm bg-transparent" />
              </div>
            </label>
            <label className="block">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Password</span>
              <div className="mt-2 flex items-center gap-3 px-4 py-3 bg-white border border-slate-200 rounded-2xl focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-50">
                <Lock size={18} className="text-slate-400" />
                <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="••••••••" className="flex-1 outline-none text-sm bg-transparent" />
              </div>
            </label>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-lg shadow-indigo-200 transition-all">
              Sign In <ArrowRight size={18} />
            </button>
          </form>

          <div className="flex items-center gap-4 my-8">
            <div className="h-px flex-1 bg-slate-200" /><span className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400">Demo portals</span><div className="h-px flex-1 bg-slate-200" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {ROLES.map(({ role, label, icon: Icon, desc }) => (
              <button key={role} onClick={() => enter(role)} className="text-left p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md hover:border-orange-200 transition-all group">
                <span className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 grid place-items-center mb-3 group-hover:bg-orange-50 group-hover:text-orange-500 transition-colors"><Icon size={20} /></span>
                <p className="font-bold text-slate-800 text-sm">{label}</p>
                <p className="text-xs text-slate-400">{desc}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
