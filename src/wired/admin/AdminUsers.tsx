import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Archive, ArchiveRestore, ChevronLeft, ChevronRight, CircleCheck, CircleX, Filter, Loader2, Mail, Phone, Plus, Search, Settings, Users } from 'lucide-react';
import { useAuth, type Profile } from '../../lib/auth';
import { SUPABASE_KEY, SUPABASE_URL, supabase } from '../../lib/supabase';
import { ROLE_LABEL } from '../../lib/nav';
import { fmtDate, useData } from '../../lib/db';
import { Illus } from '../../components/media';
import { DemoNotice, Field, Modal, Spinner, btnPrimary, inputCls, toast } from '../../components/ui';

const ROLES = ['student', 'instructor', 'academic', 'agent', 'admin'] as const;

export default function AdminUsers() {
  const me = useAuth((s) => s.user);
  const [tab, setTab] = useState<'active' | 'archived'>('active');
  const [q, setQ] = useState('');
  const [role, setRole] = useState('all');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<Profile | null>(null);
  const [adding, setAdding] = useState(false);
  const { data, loading, reload } = useData<Profile[]>(() => supabase.from('profiles').select('*').order('created_at', { ascending: false }));
  const list = (data ?? []).filter((u) => (tab === 'active' ? u.is_active : !u.is_active) && (role === 'all' || u.role === role)
    && `${u.full_name} ${u.email} ${u.phone ?? ''} ${u.student_no ?? ''}`.toLowerCase().includes(q.toLowerCase()));
  const pages = Math.max(1, Math.ceil(list.length / 9));
  const archive = async (u: Profile) => {
    if (u.id === me?.id) return toast.err('You cannot archive your own account.');
    const { error } = await supabase.from('profiles').update({ is_active: !u.is_active }).eq('id', u.id);
    if (error) toast.err(error.message); else { toast.ok(u.is_active ? 'User archived' : 'User restored'); reload(); }
  };
  return (
    <div className="w-full bg-[#fafafa] font-sans min-h-screen pb-20">
      <main className="max-w-7xl mx-auto px-6 py-8">
        {me?.demo && <DemoNotice />}
        <div className="bg-white rounded-4xl border border-slate-100 shadow-sm p-8 mb-10 flex flex-col-reverse lg:flex-row items-center justify-between relative overflow-hidden">
          <div className="z-10 w-full lg:w-3/5 mt-6 lg:mt-0">
            <span className="inline-block px-3 py-1 bg-orange-50 text-orange-600 rounded-full text-xs font-bold uppercase tracking-wider mb-4 border border-orange-100">Access Control</span>
            <h1 className="text-4xl font-extrabold text-slate-900 mb-3 tracking-tight">User Management</h1>
            <p className="text-slate-500 text-base mb-6 leading-relaxed max-w-md">Manage administrators, instructors, and student accounts.</p>
            <div className="inline-flex bg-slate-50 p-1 rounded-xl border border-slate-200 mb-4">
              <button onClick={() => setTab('active')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold ${tab === 'active' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}><Users size={14} /> Active / Suspended</button>
              <button onClick={() => setTab('archived')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold ${tab === 'archived' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}><Archive size={14} /> Archived List</button>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1"><Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search users..." className="w-full pl-10 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-200" /></div>
              <div className="relative"><Filter size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} className="pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 outline-none capitalize"><option value="all">All Roles</option>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></div>
              <button disabled={me?.demo} onClick={() => setAdding(true)} className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-orange-500 text-white text-sm font-bold disabled:opacity-50"><Plus size={16} /> Add User</button>
            </div>
          </div>
          <div className="w-full lg:w-2/5 flex justify-center lg:justify-end"><Illus name="users" className="max-h-72 object-contain drop-shadow-xl" /></div>
        </div>
        {loading ? <Spinner /> : list.length === 0 ? <p className="text-center text-slate-400 py-16">No users found.</p> : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {list.slice((page - 1) * 9, page * 9).map((u) => (
                <div key={u.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 flex flex-col">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="w-11 h-11 rounded-xl bg-indigo-500 text-white grid place-items-center font-bold text-lg">{(u.full_name || u.email)[0]?.toUpperCase()}</span>
                    <div className="min-w-0"><p className="font-bold text-slate-900 truncate">{u.full_name || '—'}</p><span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded border border-slate-300 text-slate-600">{u.role}</span></div>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-1.5 text-xs text-slate-600">
                    <p className="flex items-center gap-2 truncate"><Mail size={13} className="text-slate-400 shrink-0" />{u.email}</p>
                    {u.phone && <p className="flex items-center gap-2"><Phone size={13} className="text-slate-400" />{u.phone}</p>}
                    <p className="flex items-center gap-2">{u.is_active ? <CircleCheck size={13} className="text-emerald-500" /> : <CircleX size={13} className="text-red-400" />}Status: <b className={u.is_active ? 'text-emerald-600' : 'text-red-500'}>{u.is_active ? 'Active' : 'Archived'}</b></p>
                  </div>
                  <div className="flex items-center justify-between mt-4"><span className="text-[10px] font-mono text-slate-400">{u.student_no ?? fmtDate(u.created_at)}</span>
                    <div className="flex gap-1"><button onClick={() => setOpen(u)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-900 hover:text-white text-xs font-bold text-slate-700"><Settings size={13} />Manage</button>
                      <button title={u.is_active ? 'Archive' : 'Restore'} onClick={() => archive(u)} className="p-1.5 rounded-lg text-slate-300 hover:text-orange-500">{u.is_active ? <Archive size={16} /> : <ArchiveRestore size={16} />}</button></div></div>
                </div>
              ))}
            </div>
            {pages > 1 && <div className="flex justify-center items-center gap-2 mt-10">
              <button disabled={page === 1} onClick={() => setPage(page - 1)} className="w-9 h-9 rounded-xl bg-white border border-slate-200 grid place-items-center disabled:opacity-40"><ChevronLeft size={16} /></button>
              <span className="text-sm font-bold text-slate-600">{page} / {pages}</span>
              <button disabled={page === pages} onClick={() => setPage(page + 1)} className="w-9 h-9 rounded-xl bg-white border border-slate-200 grid place-items-center disabled:opacity-40"><ChevronRight size={16} /></button>
            </div>}
          </>
        )}
      </main>
      {open && <ManageUser u={open} onClose={() => setOpen(null)} onDone={() => { setOpen(null); reload(); }} />}
      {adding && <AddUser onClose={() => setAdding(false)} onDone={() => { setAdding(false); setTimeout(reload, 800); }} />}
    </div>
  );
}

function ManageUser({ u, onClose, onDone }: { u: Profile; onClose: () => void; onDone: () => void }) {
  const me = useAuth((s) => s.user);
  const [f, setF] = useState({ full_name: u.full_name, phone: u.phone ?? '', role: u.role, is_active: u.is_active });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (u.id === me?.id && f.role !== 'admin') return toast.err('You cannot remove your own admin role.');
    setBusy(true);
    const { error } = await supabase.from('profiles').update({ ...f, phone: f.phone || null }).eq('id', u.id);
    if (!error && f.role === 'agent') await supabase.from('agent_profiles').upsert({ id: u.id, status: 'approved' }, { onConflict: 'id' });
    setBusy(false);
    if (error) toast.err(error.message); else { toast.ok('User updated'); onDone(); }
  };
  const reset = async () => {
    const { error } = await supabase.auth.resetPasswordForEmail(u.email, { redirectTo: `${location.origin}${import.meta.env.BASE_URL}reset-password` });
    if (error) toast.err(error.message); else toast.ok('Password reset email sent');
  };
  return (
    <Modal open onClose={onClose} title="Manage User">
      <div className="space-y-4">
        <p className="text-sm text-slate-500">{u.email} · joined {fmtDate(u.created_at)}</p>
        <Field label="Full name"><input className={inputCls} value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></Field>
        <Field label="Phone"><input className={inputCls} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <Field label="Role"><select className={`${inputCls} capitalize`} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Profile['role'] })}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></Field>
        <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold"><input type="checkbox" className="accent-orange-500 w-4 h-4" checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} /> Account active</label>
        <div className="flex gap-2"><button onClick={reset} className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50">Send password reset</button>
          <button disabled={busy} onClick={save} className={`${btnPrimary} flex-1`}>{busy && <Loader2 size={16} className="animate-spin" />} Save</button></div>
      </div>
    </Modal>
  );
}

function AddUser({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ full_name: '', email: '', phone: '', role: 'student', password: '' });
  const [busy, setBusy] = useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (f.password.length < 8) return toast.err('Temporary password must be at least 8 characters.');
    setBusy(true);
    // A separate client so creating the account does not sign the admin out.
    const tmp = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false, storageKey: 'llc-tmp' } });
    const { data, error } = await tmp.auth.signUp({ email: f.email.trim(), password: f.password, options: { data: { full_name: f.full_name.trim(), phone: f.phone.trim() }, emailRedirectTo: `${location.origin}${import.meta.env.BASE_URL}login` } });
    if (error || !data.user) { setBusy(false); return toast.err(error?.message ?? 'Could not create user'); }
    if (f.role !== 'student') {
      await new Promise((r) => setTimeout(r, 600));
      const up = await supabase.from('profiles').update({ role: f.role }).eq('id', data.user.id);
      if (up.error) toast.err(`Created, but role not set: ${up.error.message}`);
      else if (f.role === 'agent') await supabase.from('agent_profiles').upsert({ id: data.user.id, status: 'approved' }, { onConflict: 'id' });
    }
    setBusy(false);
    toast.ok('User created. They must confirm their email before signing in.');
    onDone();
  };
  return (
    <Modal open onClose={onClose} title="Add User">
      <form onSubmit={save} className="space-y-4">
        <Field label="Full name"><input required className={inputCls} value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></Field>
        <Field label="Email"><input required type="email" className={inputCls} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone"><input className={inputCls} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
          <Field label="Role"><select className={`${inputCls} capitalize`} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></Field>
        </div>
        <Field label="Temporary password" hint="Share it with the user; they can change it from My Profile."><input required className={inputCls} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        <button disabled={busy} className={`${btnPrimary} w-full`}>{busy && <Loader2 size={16} className="animate-spin" />} Create User</button>
      </form>
    </Modal>
  );
}
