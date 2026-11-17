import LangToggle from '../../components/LangToggle';
import type { ReactNode } from 'react';
import { BrandLockup } from '../../components/media';

export default function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#fafafa] grid lg:grid-cols-2">
      <div className="hidden lg:flex relative overflow-hidden bg-[#0b1a3a] text-white p-14 flex-col justify-between">
        <div className="absolute -right-24 -top-24 w-96 h-96 rounded-full bg-indigo-500/20" />
        <div className="absolute -left-20 bottom-10 w-72 h-72 rounded-full bg-orange-500/10" />
        <a href={import.meta.env.BASE_URL}><BrandLockup dark /></a>
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
          <div className="flex justify-end mb-4"><LangToggle /></div>
          <div className="lg:hidden mb-10"><BrandLockup /></div>
          {children}
        </div>
      </div>
    </div>
  );
}

export const authInput = 'mt-2 flex items-center gap-3 px-4 py-3 bg-white border border-slate-200 rounded-2xl focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-50';
export const authBtn = 'w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-lg shadow-indigo-200 transition-all disabled:opacity-60';
