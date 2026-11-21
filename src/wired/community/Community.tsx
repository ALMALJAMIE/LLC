import { askConfirm, askText } from '../../components/dialogs';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Briefcase, Globe, Hash, Heart, ImagePlus, Loader2, Lock, LockOpen, Megaphone, MessageCircle, Send, ShieldCheck, Trash2, Users, Video, X } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { isAcademicLead } from '../../lib/nav';
import { supabase } from '../../lib/supabase';
import { useData } from '../../lib/db';
import { DemoNotice, Spinner, toast } from '../../components/ui';

const HUBS = [
  { key: 'LANGUAGE', title: 'Global Language Hub', text: 'Connect with learners and master new languages together.', icon: Globe, c: 'bg-emerald-500' },
  { key: 'PROFESSIONAL', title: 'Professional Network', text: 'Network with experts and accelerate your career.', icon: Briefcase, c: 'bg-indigo-600' },
];

/** Students unlock the Professional Network with an active Business / professional course. */
function useProfessionalUnlocked() {
  const user = useAuth((s) => s.user);
  const r = useData<{ course: { category: { name: string } | null } | null }[]>(() =>
    supabase.from('enrollments').select('course:courses(category:categories(name))').eq('student_id', user!.id).in('status', ['active', 'completed']));
  if (user?.role !== 'student') return true;
  return (r.data ?? []).some((e) => /business|professional/i.test(e.course?.category?.name ?? ''));
}

export function CommunityAccess() {
  const user = useAuth((s) => s.user)!;
  const nav = useNavigate();
  const pro = useProfessionalUnlocked();
  return (
    <div className="w-full bg-[#fafafa] min-h-screen pb-20">
      <main className="max-w-6xl mx-auto px-6 py-10">
        {user.demo && <DemoNotice />}
        <div className="flex items-start justify-between mb-10">
          <div><p className="text-[11px] font-black uppercase tracking-widest text-indigo-600">Community Access</p>
            <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mt-1">Where Learning Meets <span className="text-indigo-600">Connection</span></h1>
            <p className="text-slate-500 mt-2 max-w-lg">Join your hubs to collaborate, discuss, and grow with peers and mentors.</p></div>
        </div>
        <div className="grid md:grid-cols-2 gap-6">{HUBS.map((h) => {
          const open = h.key === 'LANGUAGE' || pro;
          const I = h.icon;
          return (
            <div key={h.key} className="bg-white rounded-4xl border border-slate-100 shadow-sm p-7 flex flex-col">
              <div className="flex justify-between items-start mb-6"><span className={`w-14 h-14 rounded-2xl grid place-items-center text-white ${open ? h.c : 'bg-slate-400'}`}><I size={26} /></span>
                <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full flex items-center gap-1 ${open ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>{open ? <LockOpen size={11} /> : <Lock size={11} />}{open ? 'Unlocked' : 'Locked'}</span></div>
              <h2 className={`text-2xl font-extrabold ${open ? 'text-slate-900' : 'text-slate-500'}`}>{h.title}</h2>
              <p className="text-slate-500 mt-1 flex-1">{h.text}</p>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1 mt-6 pt-4 border-t border-slate-100"><Users size={12} />Community hub</p>
              <button disabled={!open} onClick={() => nav(`/${user.role}/community/feed/${h.key}`)} className={`mt-4 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 ${open ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}>
                {open ? <>Enter Hub <ArrowRight size={18} /></> : <>Enroll in a business course to unlock <Lock size={16} /></>}</button>
            </div>
          );
        })}</div>
      </main>
    </div>
  );
}

type Ch = { id: number; hub: string; name: string; kind: string; batch_id: number | null; sort_order: number };
type Post = { id: number; author_id: string; author_name: string | null; author_role: string | null; body: string; image_url: string | null; created_at: string;
  community_likes: { user_id: string }[]; community_comments: { id: number; author_id: string; author_name: string | null; author_role: string | null; body: string; created_at: string }[] };

const ago = (d: string) => { const s = (Date.now() - new Date(d).getTime()) / 1000; return s < 60 ? 'just now' : s < 3600 ? `${Math.floor(s / 60)}m` : s < 86400 ? `${Math.floor(s / 3600)}h` : new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); };
const roleTint: Record<string, string> = { admin: 'bg-red-50 text-red-600', instructor: 'bg-indigo-50 text-indigo-600', agent: 'bg-amber-50 text-amber-600', student: 'bg-slate-100 text-slate-500' };

export function CommunityHub() {
  const { hub = 'LANGUAGE' } = useParams();
  const user = useAuth((s) => s.user)!;
  const nav = useNavigate();
  const staff = user.role === 'admin' || user.role === 'instructor' || user.role === 'academic';
  const chans = useData<Ch[]>(() => supabase.from('community_channels').select('*').eq('hub', hub).order('sort_order').order('name'), [hub]);
  const [cid, setCid] = useState<number | null>(null);
  useEffect(() => { if (!cid && chans.data?.length) setCid(chans.data[0].id); }, [chans.data, cid]);
  const ch = (chans.data ?? []).find((c) => c.id === cid);
  const posts = useData<Post[]>(() => supabase.from('community_posts').select('*, community_likes(user_id), community_comments(id,author_id,author_name,author_role,body,created_at)').eq('channel_id', cid ?? 0).order('created_at', { ascending: false }).limit(50), [cid]);
  useEffect(() => { const t = setInterval(() => cid && posts.reload(), 15000); return () => clearInterval(t); }, [cid, posts.reload]); // eslint-disable-line react-hooks/exhaustive-deps
  const canPost = ch && (ch.kind !== 'announcement' || staff);
  const [body, setBody] = useState('');
  const [img, setImg] = useState<File | null>(null);
  const [notifyAll, setNotifyAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const hubInfo = HUBS.find((h) => h.key === hub) ?? HUBS[0];

  const post = async () => {
    if (!body.trim() && !img) return;
    setBusy(true);
    let path: string | null = null;
    if (img) {
      path = `${user.id}/community/${Date.now()}-${img.name.replace(/[^\w.-]/g, '_')}`;
      const up = await supabase.storage.from('uploads').upload(path, img);
      if (up.error) { setBusy(false); return toast.err(up.error.message); }
    }
    const { error } = await supabase.from('community_posts').insert({ author_id: user.id, channel_id: cid, channel: hub, body: body.trim(), image_url: path });
    if (!error && notifyAll && isAcademicLead(user.role)) await supabase.rpc('broadcast', { p_title: `📢 ${ch?.name}`, p_body: body.trim().slice(0, 140), p_role: null, p_link: null });
    setBusy(false);
    if (error) return toast.err(error.message);
    setBody(''); setImg(null); setNotifyAll(false); posts.reload();
  };

  const icon = (c: Ch) => c.kind === 'announcement' ? <Megaphone size={15} /> : c.kind === 'batch' ? <Lock size={14} /> : <Hash size={15} />;
  const live = user.role === 'student' ? '/student/live-sessions' : user.role === 'instructor' ? '/instructor/live-sessions' : '/admin/live-sessions';
  return (
    <div className="w-full bg-[#fafafa] min-h-[calc(100vh-77px)] grid grid-cols-12">
      <aside className="col-span-12 md:col-span-3 xl:col-span-2 bg-white border-r border-slate-100 p-4">
        <button onClick={() => nav(`/${user.role}/community`)} className="text-[11px] font-black uppercase text-slate-400 flex items-center gap-1 mb-3"><ArrowLeft size={13} />Back</button>
        <h2 className="font-extrabold text-slate-900">{hub === 'LANGUAGE' ? 'Global Hub' : 'Professional'}</h2><p className="text-xs text-slate-400 mb-4">{chans.data?.length ?? 0} Channels</p>
        <button onClick={() => nav(live)} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 mb-4"><Video size={15} className="text-red-500" />Live Events</button>
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2 px-1">Channels</p>
        <div className="space-y-1">{(chans.data ?? []).map((c) => (
          <button key={c.id} onClick={() => setCid(c.id)} className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-left ${c.id === cid ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>
            <span className={c.kind === 'batch' ? 'text-orange-500' : 'text-slate-400'}>{icon(c)}</span><span className="truncate">{c.name}</span></button>
        ))}</div>
      </aside>
      <section className="col-span-12 md:col-span-9 xl:col-span-7 flex flex-col">
        <div className="px-6 py-4 border-b border-slate-100 bg-white"><h1 className="text-lg font-extrabold text-slate-900">{ch?.name ?? '…'}</h1><p className="text-xs text-slate-400">Welcome to the channel</p></div>
        <div className="flex-1 p-6 space-y-4 max-w-3xl w-full mx-auto">
          {user.demo && <DemoNotice />}
          {ch && !canPost && <div className="mx-auto max-w-md text-center p-4 rounded-2xl border border-slate-200 bg-white"><p className="font-bold text-slate-800 flex items-center justify-center gap-2"><Lock size={16} className="text-red-500" />{ch.name} 📢</p><p className="text-xs text-slate-500">Only Instructors and Admins can post here.</p></div>}
          {canPost && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4">
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder={`Share something in #${ch?.name}…`} className="w-full resize-none outline-none text-sm text-slate-800 placeholder-slate-400" />
              {img && <div className="flex items-center gap-2 text-xs text-slate-500 mb-2"><ImagePlus size={14} />{img.name}<button onClick={() => setImg(null)}><X size={14} /></button></div>}
              <div className="flex items-center gap-2 pt-3 border-t border-slate-50">
                <button onClick={() => fileRef.current?.click()} className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"><ImagePlus size={18} /></button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => setImg(e.target.files?.[0] ?? null)} />
                {isAcademicLead(user.role) && ch?.kind === 'announcement' && <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500"><input type="checkbox" checked={notifyAll} onChange={(e) => setNotifyAll(e.target.checked)} className="accent-orange-500" />Notify everyone</label>}
                <button disabled={busy || user.demo || (!body.trim() && !img)} onClick={post} className="ml-auto flex items-center gap-2 px-5 py-2 rounded-xl bg-slate-900 hover:bg-orange-500 text-white text-sm font-bold disabled:opacity-40">{busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}Post</button>
              </div>
            </div>
          )}
          {posts.loading && !posts.data ? <Spinner /> : !posts.data?.length ? (
            <div className="text-center py-16 text-slate-400"><MessageCircle size={36} className="mx-auto text-slate-300 mb-3" />No posts yet. Start the conversation!</div>
          ) : posts.data.map((p) => <PostCard key={p.id} p={p} onChange={posts.reload} />)}
        </div>
      </section>
      <aside className="hidden xl:block col-span-3 bg-white border-l border-slate-100 p-6">
        <h3 className="font-extrabold text-slate-900 flex items-center gap-2"><Users size={18} className="text-indigo-600" />Community Info</h3>
        <p className="text-sm text-slate-500 mt-2">Welcome to the official <b>{hubInfo.title}</b>. Connect, share, and learn with your peers.</p>
        <div className="mt-5 p-4 rounded-2xl bg-slate-50 border border-slate-100">
          <p className="font-bold text-slate-800 flex items-center gap-2 mb-2"><ShieldCheck size={16} className="text-orange-500" />Community Rules</p>
          <ul className="text-sm text-slate-600 space-y-1.5 list-disc pl-5"><li>Be respectful to everyone.</li><li>No hate speech or bullying.</li><li>Keep content relevant to the channel.</li><li>No spam or self-promotion.</li><li>Practise your English — mistakes are welcome!</li></ul>
        </div>
      </aside>
    </div>
  );
}

function PostCard({ p, onChange }: { p: Post; onChange: () => void }) {
  const user = useAuth((s) => s.user)!;
  const [img, setImg] = useState<string | null>(null);
  const [showC, setShowC] = useState(false);
  const [c, setC] = useState('');
  const liked = p.community_likes.some((l) => l.user_id === user.id);
  useEffect(() => { if (p.image_url) supabase.storage.from('uploads').createSignedUrl(p.image_url, 3600).then(({ data }) => setImg(data?.signedUrl ?? null)); }, [p.image_url]);
  const like = async () => {
    if (user.demo) return;
    const r = liked ? await supabase.from('community_likes').delete().eq('post_id', p.id).eq('user_id', user.id) : await supabase.from('community_likes').insert({ post_id: p.id, user_id: user.id });
    if (r.error) toast.err(r.error.message); else onChange();
  };
  const comment = async () => {
    if (!c.trim()) return;
    const { error } = await supabase.from('community_comments').insert({ post_id: p.id, author_id: user.id, body: c.trim() });
    if (error) toast.err(error.message); else { setC(''); onChange(); }
  };
  const del = async () => { if (!await askConfirm('Delete this post?')) return; const { error } = await supabase.from('community_posts').delete().eq('id', p.id); if (error) toast.err(error.message); else onChange(); };
  const comments = useMemo(() => [...p.community_comments].sort((a, b) => a.created_at.localeCompare(b.created_at)), [p.community_comments]);
  return (
    <article className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 grid place-items-center font-black">{(p.author_name ?? '?')[0]?.toUpperCase()}</span>
        <div className="flex-1"><p className="font-bold text-slate-900 text-sm flex items-center gap-2">{p.author_name ?? 'Member'}<span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${roleTint[p.author_role ?? 'student']}`}>{p.author_role}</span></p><p className="text-[11px] text-slate-400">{ago(p.created_at)}</p></div>
        {(p.author_id === user.id || isAcademicLead(user.role)) && <button onClick={del} className="p-1.5 text-slate-300 hover:text-red-500"><Trash2 size={15} /></button>}
      </div>
      {p.body && <p className="mt-3 text-slate-700 whitespace-pre-line leading-relaxed">{p.body}</p>}
      {img && <img src={img} alt="" className="mt-3 rounded-2xl max-h-96 w-full object-cover" />}
      <div className="flex gap-4 mt-4 pt-3 border-t border-slate-50 text-sm">
        <button onClick={like} className={`flex items-center gap-1.5 font-semibold ${liked ? 'text-red-500' : 'text-slate-400 hover:text-red-500'}`}><Heart size={16} className={liked ? 'fill-red-500' : ''} />{p.community_likes.length}</button>
        <button onClick={() => setShowC(!showC)} className="flex items-center gap-1.5 font-semibold text-slate-400 hover:text-indigo-600"><MessageCircle size={16} />{comments.length}</button>
        {p.author_id !== user.id && <span className="ml-auto self-center"><ReportPostButton postId={p.id} /></span>}
      </div>
      {showC && (
        <div className="mt-3 space-y-2">
          {comments.map((x) => (
            <div key={x.id} className="flex gap-2"><span className="w-7 h-7 rounded-full bg-slate-100 grid place-items-center text-xs font-bold text-slate-500 shrink-0">{(x.author_name ?? '?')[0]}</span>
              <div className="bg-slate-50 rounded-2xl px-3 py-2 text-sm"><p className="font-bold text-slate-800 text-xs">{x.author_name} <span className="font-normal text-slate-400">· {ago(x.created_at)}</span></p><p className="text-slate-700">{x.body}</p></div></div>
          ))}
          <div className="flex gap-2"><input value={c} onChange={(e) => setC(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && comment()} placeholder="Write a comment…" className="flex-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm outline-none" />
            <button disabled={user.demo} onClick={comment} className="px-3 rounded-xl bg-slate-900 text-white"><Send size={14} /></button></div>
        </div>
      )}
    </article>
  );
}

/** Button shown under a community post. */
function ReportPostButton({ postId }: { postId: number }) {
  const user = useAuth((s) => s.user)!;
  const report = async () => {
    if (user.demo) return;
    const reason = await askText('Why are you reporting this post? (for example spam, rude, wrong information)');
    if (reason === null) return;
    if (reason.trim().length < 3) return toast.err('Please write a short reason.');
    const { error } = await supabase.from('community_reports').insert({ post_id: postId, reporter_id: user.id, reason: reason.trim() });
    if (error) toast.err(error.code === '23505' ? 'You already reported this post.' : error.message); else toast.ok('Thank you. A moderator will look at it.');
  };
  return <button onClick={report} className="text-[11px] font-bold text-slate-400 hover:text-red-500">Report</button>;
}

