import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronLeft, CircleQuestionMark, LogOut, ShieldCheck } from 'lucide-react';
import { NAV, ROLE_LABEL, type NavItem } from '../../lib/nav';
import { useAuth } from '../../lib/auth';
import mark from '../../assets/llc-mark.png';

const isActive = (item: NavItem, path: string): boolean =>
  !!(item.to && item.to === path) || !!item.children?.some((c) => isActive(c, path));

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const user = useAuth((s) => s.user)!;
  const signOut = useAuth((s) => s.signOut);
  const nav = useNavigate();
  const { pathname } = useLocation();
  const items = NAV[user.role];
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    items.forEach((i) => i.children && isActive(i, pathname) && setExpanded((e) => ({ ...e, [i.label]: true })));
  }, [pathname, items]);

  return (
    <div className="transition-all duration-300 ease-in-out h-full shrink-0 w-0 lg:w-72">
      <aside className={`fixed inset-y-0 left-0 z-50 bg-[#0b1a3a] border-r border-white/5 text-gray-300 transform transition-all duration-300 ease-in-out lg:translate-x-0 lg:static lg:block w-72 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-screen">
          <div className="p-6 shrink-0 transition-all flex flex-row items-start justify-between pb-6">
            <div className="group flex flex-col cursor-pointer" onClick={() => nav('/')}>
              <span className="h-10 w-10 rounded-md mb-2 self-start bg-white grid place-items-center p-1">
                <img src={mark} alt="LLC Logo" className="h-full w-auto object-contain" />
              </span>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.35em] pl-0.5">{ROLE_LABEL[user.role]}</span>
            </div>
            <button onClick={onClose} className="hidden lg:flex items-center justify-center rounded-lg text-gray-400 bg-white/5 hover:text-white hover:bg-white/10 transition-all border border-white/5 w-8 h-8 mt-1" title="Collapse Sidebar">
              <ChevronLeft size={18} />
            </button>
          </div>
          <div className="px-8 pb-2 shrink-0"><p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Menu</p></div>
          <div className="flex-1 overflow-y-auto min-h-0 px-4 space-y-1 sidebar-scrollbar">
            <div className="space-y-1 pb-4">
              {items.map((item) => {
                const active = isActive(item, pathname);
                const Icon = item.icon;
                if (!item.children) {
                  return (
                    <div key={item.label} className="flex flex-col relative">
                      <NavLink to={item.to!} onClick={onClose} className={`relative z-10 w-full flex items-center gap-3 py-3 rounded-xl text-sm font-medium transition-all duration-200 group px-4 ${active ? 'bg-orange-500/10 text-orange-500' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
                        {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-orange-500 rounded-r-full shadow-[0_0_8px_#e9a823]" />}
                        <span className={active ? 'text-orange-500' : 'text-gray-500 group-hover:text-white'}><Icon size={20} /></span>
                        <span className="flex-1 text-left">{item.label}</span>
                      </NavLink>
                    </div>
                  );
                }
                const isOpen = !!expanded[item.label];
                return (
                  <div key={item.label} className="flex flex-col relative">
                    <button onClick={() => setExpanded((e) => ({ ...e, [item.label]: !isOpen }))} className={`relative z-10 w-full flex items-center gap-3 py-3 rounded-xl text-sm font-medium transition-all duration-200 group px-4 ${active && !isOpen ? 'bg-orange-500/10 text-orange-500' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
                      <span className={active ? 'text-orange-500' : 'text-gray-500 group-hover:text-white'}><Icon size={20} /></span>
                      <span className="flex-1 text-left">{item.label}</span>
                      <ChevronDown size={16} className={`ml-auto text-gray-500 transition-transform duration-300 ${isOpen ? 'rotate-180 text-white' : ''}`} />
                    </button>
                    <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                      <div className="overflow-hidden">
                        <div className="relative pl-4 mt-1 ml-4 border-l border-white/10 space-y-1 pb-2">
                          {item.children.map((c) => {
                            const on = c.to === pathname;
                            const CI = c.icon;
                            return (
                              <NavLink key={c.label} to={c.to!} onClick={onClose} className={`relative w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all group/sub ${on ? 'text-white bg-white/5' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}>
                                {on && <div className="absolute -left-4.25 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_5px_#e9a823]" />}
                                <span className={on ? 'text-orange-500' : 'text-gray-600 group-hover/sub:text-gray-400'}><CI size={18} /></span>
                                <span>{c.label}</span>
                              </NavLink>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="p-4 border-t border-white/5 bg-[#0f2247]/50 shrink-0">
            <div className="flex flex-col gap-3">
              <button onClick={() => nav('/help')} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wide text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 hover:text-indigo-200 border border-indigo-500/10 transition-all px-4">
                <CircleQuestionMark size={16} /><span>Help &amp; FAQ</span>
              </button>
              <div className="flex items-center gap-3 py-2 rounded-lg hover:bg-white/5 transition-colors cursor-default px-3">
                <div className="w-9 h-9 rounded-full bg-linear-to-tr from-gray-700 to-gray-600 flex items-center justify-center border border-white/10 shrink-0">
                  <ShieldCheck size={20} className="text-gray-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{user.name}</p>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                </div>
              </div>
              <button onClick={() => { signOut(); nav('/login'); }} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wide text-white/70 bg-red-500/10 hover:bg-red-500/20 hover:text-red-400 border border-red-500/10 transition-all px-4">
                <LogOut size={16} /><span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={onClose} />}
    </div>
  );
}
