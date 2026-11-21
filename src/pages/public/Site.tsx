import { CurrencyPicker } from '../../lib/price';
import { usePublished } from './Content';
import LangToggle from '../../components/LangToggle';
import { useState, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Camera as Instagram, Mail, Menu, MessageCircle, Phone, X } from 'lucide-react';
import { BrandLockup } from '../../components/media';
import { useAuth } from '../../lib/auth';
import { ROLE_HOME } from '../../lib/nav';
import { useCenter } from '../../lib/site';

const LINKS = [
  { to: '/courses', label: 'Courses' },
  { to: '/placement', label: 'Placement Test' },
  { to: '/#how', label: 'How it works' },
  { to: '/agents', label: 'Become an Agent' },
  { to: '/help', label: 'Help & FAQ' },
];

export function SiteNav() {
  const user = useAuth((s) => s.user);
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-xl border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-5 lg:px-8 h-20 flex items-center justify-between gap-6">
        <Link to="/"><BrandLockup /></Link>
        <nav className="hidden lg:flex items-center gap-1">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} className={({ isActive }) => `px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${isActive && !l.to.includes('#') ? 'text-orange-600 bg-orange-50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}>{l.label}</NavLink>
          ))}
        </nav>
        <div className="hidden lg:flex items-center gap-2">
          <CurrencyPicker compact className="!py-1.5" />
          <LangToggle />
          {user ? <Link to={ROLE_HOME[user.role]} className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-lg shadow-indigo-200">My Portal</Link> : <>
            <Link to="/login" className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50">Sign in</Link>
            <Link to="/register" className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold shadow-lg shadow-orange-200">Get started</Link>
          </>}
        </div>
        <div className="lg:hidden flex items-center gap-2"><LangToggle /><button onClick={() => setOpen(!open)} className="p-2 rounded-xl border border-slate-200">{open ? <X size={20} /> : <Menu size={20} />}</button></div>
      </div>
      {open && (
        <div className="lg:hidden border-t border-slate-100 bg-white px-5 py-4 space-y-1">
          {LINKS.map((l) => <Link key={l.to} to={l.to} onClick={() => setOpen(false)} className="block px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50">{l.label}</Link>)}
          <div className="grid grid-cols-2 gap-2 pt-3">
            {user ? <Link to={ROLE_HOME[user.role]} className="col-span-2 text-center py-3 rounded-xl bg-indigo-600 text-white text-sm font-bold">My Portal</Link> : <>
              <Link to="/login" className="text-center py-3 rounded-xl border border-slate-200 text-sm font-bold">Sign in</Link>
              <Link to="/register" className="text-center py-3 rounded-xl bg-orange-500 text-white text-sm font-bold">Get started</Link></>}
          </div>
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  const CENTER = useCenter();
  const legal = usePublished('legal', true);
  return (
    <footer className="bg-[#0b1a3a] text-slate-300">
      <div className="max-w-7xl mx-auto px-5 lg:px-8 py-14 grid md:grid-cols-4 gap-10">
        <div className="md:col-span-2">
          <BrandLockup dark />
          <p className="mt-5 text-sm leading-relaxed max-w-sm text-slate-400">English courses for every level — online and face to face in Kuala Lumpur. {CENTER.tagline}.</p>
          <div className="flex gap-2 mt-5">
            <a href={`https://wa.me/${CENTER.whatsapp}`} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-xl bg-white/5 hover:bg-emerald-500 grid place-items-center transition-colors" aria-label="WhatsApp"><MessageCircle size={18} /></a>
            <a href={CENTER.instagram} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-xl bg-white/5 hover:bg-pink-500 grid place-items-center transition-colors" aria-label="Instagram"><Instagram size={18} /></a>
            <a href={`mailto:${CENTER.email}`} className="w-10 h-10 rounded-xl bg-white/5 hover:bg-orange-500 grid place-items-center transition-colors" aria-label="Email"><Mail size={18} /></a>
          </div>
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-white mb-4">Explore</p>
          <ul className="space-y-2 text-sm">{LINKS.map((l) => <li key={l.to}><Link to={l.to} className="hover:text-orange-400">{l.label}</Link></li>)}
            <li><Link to="/training" className="hover:text-orange-400">For organisations</Link></li>
            <li><Link to="/blog" className="hover:text-orange-400">Blog</Link></li>
            <li><Link to="/verify" className="hover:text-orange-400">Check a certificate</Link></li></ul>
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-white mb-4">Contact</p>
          <ul className="space-y-3 text-sm">
            <li className="flex items-center gap-2"><Phone size={15} className="text-orange-400" />{CENTER.phone}</li>
            <li className="flex items-center gap-2"><Mail size={15} className="text-orange-400" />{CENTER.email}</li>
            <li className="flex items-center gap-2"><MessageCircle size={15} className="text-orange-400" />WhatsApp us anytime</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/5 py-5 text-center text-xs text-slate-500">© {new Date().getFullYear()} {CENTER.name}. All rights reserved.
        {(legal ?? []).map((p) => <span key={p.id}> · <Link to={`/legal/${p.slug}`} className="hover:text-orange-400">{p.title}</Link></span>)}</div>
    </footer>
  );
}

function Banner() {
  const c = useCenter();
  if (!c.banner) return null;
  return <div className="bg-orange-500 text-white text-center text-sm font-bold px-4 py-2.5">{c.banner}</div>;
}

export function SiteShell({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-[#fafafa] flex flex-col"><Banner /><SiteNav /><main className="flex-1">{children}</main><SiteFooter /></div>;
}

export function WhatsAppFab() {
  const CENTER = useCenter();
  return (
    <a href={`https://wa.me/${CENTER.whatsapp}`} target="_blank" rel="noreferrer" className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-emerald-500 text-white grid place-items-center shadow-xl shadow-emerald-200 hover:scale-110 transition-transform" aria-label="Chat on WhatsApp">
      <MessageCircle size={26} />
    </a>
  );
}
