import { useEffect, useRef, useState } from 'react';
import { Calendar, Camera, Hash, KeyRound, Loader2, Mail, Save, User } from 'lucide-react';
import { useAuth, type Profile } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { fmtDate } from '../../lib/db';
import { DemoNotice, Modal, Page, PageHero, toast, btnPrimary, inputCls } from '../../components/ui';

const FIELDS: { k: keyof Profile; label: string; req?: boolean; type?: string; ph?: string; full?: boolean }[] = [
  { k: 'full_name', label: 'Full Name *', req: true },
  { k: 'phone', label: 'Phone Number *', req: true, type: 'tel', ph: '+60123456789' },
  { k: 'address', label: 'Street Address' },
  { k: 'city', label: 'City' },
  { k: 'state', label: 'State / Province' },
  { k: 'postcode', label: 'Postcode' },
  { k: 'country', label: 'Country *', req: true },
  { k: 'nationality', label: 'Nationality *', req: true },
  { k: 'education_level', label: 'Education Level' },
  { k: 'occupation', label: 'Current Role / Career' },
  { k: 'learning_goals', label: 'Learning Goals (comma separated)', ph: 'e.g. Academic English, IELTS', full: true },
];

type P = Profile & Record<string, string | null>;

export default function ManageProfile() {
  const { user, profile, loadProfile } = useAuth();
  const [form, setForm] = useState<Partial<P>>({});
  const [busy, setBusy] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const [avatar, setAvatar] = useState<string | null>(null);

  useEffect(() => { if (profile) setForm(profile as P); }, [profile]);
  useEffect(() => {
    if (profile?.avatar_url) supabase.storage.from('uploads').createSignedUrl(profile.avatar_url, 3600).then(({ data }) => setAvatar(data?.signedUrl ?? null));
  }, [profile?.avatar_url]);

  const dirty = profile && FIELDS.some(({ k }) => (form[k] ?? '') !== ((profile as P)[k] ?? ''));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setBusy(true);
    const patch = Object.fromEntries(FIELDS.map(({ k }) => [k, (form[k] as string | null)?.toString().trim() || null]));
    const { error } = await supabase.from('profiles').update(patch).eq('id', profile.id);
    setBusy(false);
    if (error) return toast.err(error.message);
    toast.ok('Profile saved');
    loadProfile();
  };

  const upload = async (f: File) => {
    if (!profile) return;
    const path = `${profile.id}/avatar-${Date.now()}.${f.name.split('.').pop()}`;
    const { error } = await supabase.storage.from('uploads').upload(path, f, { upsert: true });
    if (error) return toast.err(error.message);
    await supabase.from('profiles').update({ avatar_url: path }).eq('id', profile.id);
    toast.ok('Photo updated'); loadProfile();
  };

  const changePw = async () => {
    if (pw.length < 8) return toast.err('Password must be at least 8 characters');
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) return toast.err(error.message);
    toast.ok('Password changed'); setPw(''); setPwOpen(false);
  };

  return (
    <Page>
      {user?.demo && <DemoNotice />}
      <PageHero badge="Account Management" title="My Profile" illus="profile_new"
        subtitle={user?.role === 'instructor' ? 'Manage your personal details, teaching qualifications, and schedules.' : 'Manage your personal details and account settings.'} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-4xl border border-slate-100 shadow-sm p-6 flex flex-col items-center text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-24 bg-linear-to-r from-[#0b1a3a] to-indigo-900" />
            <div className="relative mt-12 mb-4 group cursor-pointer" onClick={() => !user?.demo && file.current?.click()}>
              <div className="w-32 h-32 rounded-full border-4 border-white shadow-lg overflow-hidden bg-slate-100">
                {avatar ? <img src={avatar} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-300"><User size={48} /></div>}
              </div>
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Camera className="text-white" /></div>
              <input ref={file} accept="image/png, image/jpeg, image/webp" className="hidden" type="file" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            </div>
            <h2 className="text-xl font-bold text-slate-900">{user?.name}</h2>
            <div className="flex flex-col items-center gap-2 mt-1 mb-6">
              <span className="px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100 uppercase">{user?.role}</span>
            </div>
            <div className="w-full grid grid-cols-1 gap-3 text-left">
              {[
                { icon: Mail, label: 'Email', value: user?.email },
                { icon: Hash, label: 'Student No.', value: profile?.student_no, hide: user?.role !== 'student' },
                { icon: Calendar, label: 'Joined', value: fmtDate(profile?.created_at) },
              ].filter((x) => !x.hide).map(({ icon: I, label, value }) => (
                <div key={label} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg text-slate-400 shadow-sm"><I size={18} /></div>
                  <div className="overflow-hidden w-full"><p className="text-[10px] uppercase font-bold text-slate-400">{label}</p><p className="text-sm font-semibold text-slate-700 truncate">{value || '—'}</p></div>
                </div>
              ))}
              <button disabled={user?.demo} onClick={() => setPwOpen(true)} className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-center gap-2 text-sm font-bold text-slate-700 hover:border-orange-300 hover:text-orange-600 transition-colors disabled:opacity-50">
                <KeyRound size={16} /> Change Password
              </button>
            </div>
          </div>
        </div>
        <div className="lg:col-span-2">
          <div className="bg-white rounded-4xl border border-slate-100 shadow-sm p-8">
            <form className="space-y-6" onSubmit={save}>
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2"><User /> Personal Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {FIELDS.map(({ k, label, req, type, ph, full }) => (
                  <div key={k} className={full ? 'md:col-span-2' : ''}>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-2">{label}</label>
                    <input disabled={user?.demo} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium focus:border-orange-500 disabled:opacity-60" required={req} type={type ?? 'text'} placeholder={ph}
                      value={(form[k] as string) ?? ''} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
                  </div>
                ))}
              </div>
              <div className="pt-6 border-t border-slate-100 flex justify-end">
                <button disabled={!dirty || busy} className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white bg-slate-900 hover:bg-orange-500 shadow-lg transition-all disabled:bg-slate-300 disabled:shadow-none disabled:cursor-not-allowed">
                  {busy ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      <Modal open={pwOpen} onClose={() => setPwOpen(false)} title="Change Password">
        <input type="password" className={inputCls} placeholder="New password (8+ characters)" value={pw} onChange={(e) => setPw(e.target.value)} />
        <button onClick={changePw} className={`${btnPrimary} w-full mt-4`}>Update Password</button>
      </Modal>
    </Page>
  );
}
