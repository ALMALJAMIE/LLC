import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';

type N = { id: number; title: string; body: string | null; link: string | null; read: boolean; created_at: string };
const ago = (d: string) => { const s = (Date.now() - new Date(d).getTime()) / 1000; return s < 60 ? 'just now' : s < 3600 ? `${Math.floor(s / 60)} min ago` : s < 86400 ? `${Math.floor(s / 3600)} h ago` : new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); };

export default function Notifications() {
  const user = useAuth((s) => s.user);
  const nav = useNavigate();
  const [list, setList] = useState<N[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const load = async () => {
    if (!user || user.demo) return;
    const { data } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(20);
    setList((data ?? []) as N[]);
  };
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false); document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []);
  const unread = list.filter((n) => !n.read).length;
  const readAll = async () => { await supabase.from('notifications').update({ read: true }).eq('read', false); load(); };
  const openN = async (n: N) => { if (!n.read) await supabase.from('notifications').update({ read: true }).eq('id', n.id); setOpen(false); load(); if (n.link) nav(n.link); };
  const del = async (n: N) => { await supabase.from('notifications').delete().eq('id', n.id); load(); };
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} aria-label="Notifications" className="relative p-2.5 text-slate-600 hover:text-[#e9a823] bg-white border border-slate-200 rounded-full shadow-sm hover:bg-slate-50 transition-all duration-300">
        <Bell size={20} />
        {unread > 0 && <span className="absolute -top-1 -right-1 bg-[#e9a823] text-white text-xs rounded-full h-5 min-w-5 px-1 flex items-center justify-center font-bold shadow-sm">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 mt-3 w-[340px] max-w-[90vw] bg-white rounded-3xl border border-slate-100 shadow-2xl overflow-hidden z-50 animate__animated animate__fadeIn animate__faster">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100"><p className="font-extrabold text-slate-900">Notifications</p>
            {unread > 0 && <button onClick={readAll} className="text-xs font-bold text-indigo-600 flex items-center gap-1"><CheckCheck size={14} />Mark all read</button>}</div>
          <div className="max-h-96 overflow-y-auto custom-scrollbar">
            {!list.length ? <p className="p-8 text-center text-sm text-slate-400">{user?.demo ? 'Sign in to see notifications.' : 'You are all caught up.'}</p> : list.map((n) => (
              <div key={n.id} className={`group flex gap-3 px-5 py-3.5 border-b border-slate-50 cursor-pointer hover:bg-slate-50 ${n.read ? '' : 'bg-orange-50/40'}`} onClick={() => openN(n)}>
                <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.read ? 'bg-transparent' : 'bg-orange-500'}`} />
                <div className="flex-1 min-w-0"><p className="text-sm font-bold text-slate-800">{n.title}</p>{n.body && <p className="text-xs text-slate-500 line-clamp-2">{n.body}</p>}<p className="text-[10px] text-slate-400 mt-1">{ago(n.created_at)}</p></div>
                <button onClick={(e) => { e.stopPropagation(); del(n); }} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
