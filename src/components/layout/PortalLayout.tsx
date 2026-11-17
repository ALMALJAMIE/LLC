import LangToggle from '../LangToggle';
import { Suspense, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Menu, Type } from 'lucide-react';
import Sidebar from './Sidebar';
import Notifications from './Notifications';
import { useAuth } from '../../lib/auth';
import { ROLE_HOME, ROLE_LABEL } from '../../lib/nav';
import { BrandLockup } from '../media';

function Topbar({ onMenu }: { onMenu: () => void }) {
  const user = useAuth((s) => s.user)!;
  return (
    <header className="sticky top-0 z-30 px-6 py-4 lg:px-10 flex items-center justify-between bg-white/80 backdrop-blur-xl border-b border-gray-200/60 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)]">
      <div className="flex items-center gap-6">
        <button onClick={onMenu} className="lg:hidden p-2 rounded-lg border border-slate-200 text-slate-600"><Menu size={20} /></button>
        <Link to={ROLE_HOME[user.role]} className="group flex items-center select-none cursor-pointer"><BrandLockup /></Link>
      </div>
      <div className="flex items-center gap-4 md:gap-6">
        <LangToggle />
        <div className="relative">
          <button className="p-2 text-slate-500 hover:text-orange-500 bg-slate-50 hover:bg-orange-50 border border-slate-200 rounded-full transition-colors" title="Accessibility Settings"><Type size={20} /></button>
        </div>
        <Notifications />
        <div className="relative">
          <div className="flex items-center gap-3 pl-1.5 pr-1.5 sm:pr-4 py-1.5 rounded-full bg-white border border-gray-200 shadow-sm hover:shadow-lg hover:shadow-gray-200/50 hover:border-orange-200 transition-all duration-300 cursor-pointer group select-none">
            <div className="relative">
              <div className="h-9 w-9 rounded-full overflow-hidden border-2 border-white shadow-inner bg-orange-100 flex items-center justify-center">
                <span className="text-sm font-black text-slate-800 uppercase">{user.name[0]}</span>
              </div>
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full" />
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-xs font-bold text-[#0F172A] leading-tight group-hover:text-orange-600 transition-colors">{user.name}</p>
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">{ROLE_LABEL[user.role]}</p>
            </div>
            <ChevronDown size={14} className="text-gray-300 group-hover:text-orange-500 transition-transform duration-300 hidden sm:block ml-1" />
          </div>
        </div>
      </div>
    </header>
  );
}

export default function PortalLayout({ children, header = true }: { children: ReactNode; header?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex h-screen w-full bg-[#fafafa] overflow-hidden font-sans relative">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="min-h-full w-full">
            {header && <Topbar onMenu={() => setOpen(true)} />}
            {!header && (
              <button onClick={() => setOpen(true)} className="lg:hidden fixed top-4 left-4 z-30 p-2 rounded-lg bg-white border border-slate-200 text-slate-600 shadow-sm"><Menu size={20} /></button>
            )}
            <Suspense fallback={<div className="p-10 text-slate-400 text-sm">Loading…</div>}>{children}</Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
