import {  useMemo, useState } from 'react';
import {  ExternalLink, EyeOff, FileText, History, LifeBuoy, Loader2, Lock, Plus, Save, Send, SquarePen, Trash2 } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { fmtDateTime, useData } from '../../lib/db';
import { uploadMedia } from '../../lib/media';
import { DemoNotice, Field, Modal, Page, PageHero, SearchInput, Spinner, StatusPill, btnGhost, btnPrimary, inputCls, toast } from '../../components/ui';
import { askConfirm, askText } from '../../components/dialogs';
import { RichText } from './LessonView';
import type { CmsPage } from '../../pages/public/Content';

// ---------------------------------------------------------------- website pages (blog, help, legal, other)
const KIND_LABEL: Record<CmsPage['kind'], string> = { blog: 'Blog post', help: 'Help article', legal: 'Legal page', page: 'Page' };
const pathOf = (p: Pick<CmsPage, 'kind' | 'slug'>) => ({ blog: '/blog/', help: '/help/', legal: '/legal/', page: '/p/' }[p.kind] + p.slug);
const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

export function WebsitePages() {
  const user = useAuth((s) => s.user)!;
  const { data, loading, reload } = useData<CmsPage[]>(() => supabase.from('cms_pages').select('*').order('kind').order('sort_order').order('updated_at', { ascending: false }));
  const [kind, setKind] = useState<'all' | CmsPage['kind']>('all');
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Partial<CmsPage> | null>(null);
  const list = (data ?? []).filter((p) => (kind === 'all' || p.kind === kind) && `${p.title} ${p.slug}`.toLowerCase().includes(q.toLowerCase()));
  const del = async (p: CmsPage) => { if (!(await askConfirm(`Delete "${p.title}"?`))) return; const { error } = await supabase.from('cms_pages').delete().eq('id', p.id); if (error) toast.err(error.message); else reload(); };
  return (
    <Page wide>
      {user.demo && <DemoNotice />}
      <PageHero badge="Content" badgeColor="indigo" title="Website Pages" illus="cms" subtitle="Write blog posts, help guides and legal pages (privacy, terms, refunds) for the public website. Every change keeps the previous text, so you can go back.">
        <div className="flex flex-wrap gap-2 items-center">
          <SearchInput value={q} onChange={setQ} placeholder="Search pages..." />
          <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold"><option value="all">All</option>{(Object.keys(KIND_LABEL) as CmsPage['kind'][]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select>
          <button onClick={() => setEdit({ kind: kind === 'all' ? 'blog' : kind, status: 'draft', body: '', show_in_footer: false, sort_order: 0 })} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-orange-500 text-white text-sm font-bold"><Plus size={16} /> New Page</button>
        </div>
      </PageHero>
      {loading ? <Spinner /> : !list.length ? <p className="text-center text-slate-400 py-12">No pages yet.</p> : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm divide-y divide-slate-100">{list.map((p) => (
          <div key={p.id} className="px-5 py-4 flex flex-wrap items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 grid place-items-center"><FileText size={18} /></span>
            <div className="flex-1 min-w-56"><p className="font-bold text-slate-800">{p.title}</p><p className="text-[11px] text-slate-400"><span className="uppercase font-bold">{KIND_LABEL[p.kind]}</span> · <span data-no-i18n>{pathOf(p)}</span> · {`updated ${fmtDateTime(p.updated_at)}`}</p></div>
            {p.show_in_footer && <span className="text-[10px] font-bold text-slate-400 uppercase">In footer</span>}
            <StatusPill status={p.status} />
            {p.status === 'published' && <a href={`${import.meta.env.BASE_URL}${pathOf(p).slice(1)}`} target="_blank" rel="noreferrer" className="p-1.5 text-slate-400 hover:text-indigo-600"><ExternalLink size={16} /></a>}
            <button onClick={() => setEdit(p)} className="p-1.5 text-slate-400 hover:text-blue-600"><SquarePen size={16} /></button>
            <button onClick={() => del(p)} className="p-1.5 text-slate-400 hover:text-red-500"><Trash2 size={16} /></button>
          </div>
        ))}</div>
      )}
      {edit && <PageEditor p={edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); reload(); }} />}
    </Page>
  );
}

function PageEditor({ p, onClose, onDone }: { p: Partial<CmsPage>; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ kind: p.kind ?? 'blog', title: p.title ?? '', slug: p.slug ?? '', excerpt: p.excerpt ?? '', body: p.body ?? '', cover_url: p.cover_url ?? '', status: p.status ?? 'draft', show_in_footer: !!p.show_in_footer, sort_order: String(p.sort_order ?? 0) });
  const [slugTouched, setSlugTouched] = useState(!!p.id);
  const [tab, setTab] = useState<'write' | 'preview' | 'history'>('write');
  const [busy, setBusy] = useState(false);
  const versions = useData<{ id: number; title: string; body: string; saved_at: string }[]>(() => (p.id ? supabase.from('cms_page_versions').select('id,title,body,saved_at').eq('page_id', p.id).order('saved_at', { ascending: false }).limit(30) : Promise.resolve({ data: [], error: null })), [p.id]);
  const save = async (status?: string) => {
    const slug = f.slug || slugify(f.title);
    if (!f.title.trim()) return toast.err('Title is required');
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return toast.err('The web address can use small English letters, numbers and dashes only.');
    if (f.body.includes('[[') && (status ?? f.status) === 'published' && !(await askConfirm('The text still has [[ ]] placeholders (for example company details). Publish anyway?'))) return;
    setBusy(true);
    const row = { kind: f.kind, title: f.title.trim(), slug, excerpt: f.excerpt.trim() || null, body: f.body, cover_url: f.cover_url || null, status: status ?? f.status, show_in_footer: f.show_in_footer, sort_order: Number(f.sort_order) || 0 };
    const { error } = p.id ? await supabase.from('cms_pages').update(row).eq('id', p.id) : await supabase.from('cms_pages').insert(row);
    setBusy(false);
    if (error) toast.err(error.code === '23505' ? 'Another page already uses this web address.' : error.message); else { toast.ok(row.status === 'published' ? 'Published' : 'Saved as draft'); onDone(); }
  };
  const cover = async (file?: File) => { if (!file) return; const r = await uploadMedia(file, 'website'); if (r.error) toast.err(r.error); else setF((x) => ({ ...x, cover_url: r.url! })); };
  return (
    <Modal open onClose={onClose} title={p.id ? 'Edit Page' : 'New Page'} wide>
      <div className="space-y-4">
        <div className="inline-flex bg-slate-50 p-1 rounded-xl border border-slate-200">{(['write', 'preview', ...(p.id ? ['history'] : [])] as ('write' | 'preview' | 'history')[]).map((t) => <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-xs font-bold capitalize ${tab === t ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>{t === 'history' ? 'Earlier versions' : t}</button>)}</div>
        {tab === 'preview' ? <div className="p-5 rounded-2xl border border-slate-100"><h1 className="text-2xl font-extrabold mb-4">{f.title}</h1><RichText text={f.body} /></div>
        : tab === 'history' ? (
          <div className="space-y-2">{(versions.data ?? []).map((v) => (
            <div key={v.id} className="p-3 rounded-xl border border-slate-100 flex items-center gap-3"><History size={16} className="text-slate-400" /><div className="flex-1"><p className="text-sm font-bold">{v.title}</p><p className="text-[11px] text-slate-400">{fmtDateTime(v.saved_at)} · {v.body.length} characters</p></div>
              <button onClick={() => { setF({ ...f, title: v.title, body: v.body }); setTab('write'); toast.ok('Earlier text loaded — save to keep it'); }} className="text-xs font-bold text-indigo-600">Use this text</button></div>
          ))}{!(versions.data ?? []).length && <p className="text-sm text-slate-400">No earlier versions yet.</p>}</div>
        ) : <>
          <div className="grid sm:grid-cols-3 gap-3">
            <Field label="Type"><select className={inputCls} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as CmsPage['kind'] })}>{(Object.keys(KIND_LABEL) as CmsPage['kind'][]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select></Field>
            <div className="sm:col-span-2"><Field label="Title"><input className={inputCls} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value, slug: slugTouched ? f.slug : slugify(e.target.value) })} /></Field></div>
          </div>
          <Field label="Web address" hint={`The page will open at ${pathOf({ kind: f.kind, slug: f.slug || 'your-address' })}`}><input className={`${inputCls} font-mono`} value={f.slug} onChange={(e) => { setSlugTouched(true); setF({ ...f, slug: e.target.value.toLowerCase() }); }} data-no-i18n /></Field>
          <Field label="Short summary (shown in lists)"><input className={inputCls} value={f.excerpt} onChange={(e) => setF({ ...f, excerpt: e.target.value })} /></Field>
          <Field label="Text" hint="Use # for headings, - for bullet points, **bold**. Blank line = new paragraph."><textarea rows={14} className={`${inputCls} font-mono text-[13px]`} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>
          {f.kind === 'blog' && <Field label="Cover image (optional)"><div className="flex gap-2"><input className={inputCls} value={f.cover_url} onChange={(e) => setF({ ...f, cover_url: e.target.value })} placeholder="Paste a link or upload →" /><label className={`${btnGhost} cursor-pointer`}>Upload<input type="file" accept="image/*" className="hidden" onChange={(e) => cover(e.target.files?.[0])} /></label></div></Field>}
          <div className="flex flex-wrap gap-4 items-center">
            <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="accent-orange-500" checked={f.show_in_footer} onChange={(e) => setF({ ...f, show_in_footer: e.target.checked })} />Link in the website footer</label>
            <label className="flex items-center gap-2 text-sm font-semibold">Order <input type="number" className="w-20 px-2 py-1.5 rounded-lg border border-slate-200 text-sm" value={f.sort_order} onChange={(e) => setF({ ...f, sort_order: e.target.value })} /></label>
          </div>
        </>}
        <div className="flex flex-wrap gap-2 justify-end">
          <button disabled={busy} onClick={() => save('draft')} className={btnGhost}>Save as draft</button>
          <button disabled={busy} onClick={() => save('published')} className={btnPrimary}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Publish</button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- support tickets
type Ticket = { id: number; user_id: string; subject: string; category: string; priority: string; status: string; assigned_to: string | null; created_at: string; updated_at: string; user?: { full_name: string; email: string; role: string } | null };
type Msg = { id: number; ticket_id: number; author_id: string; body: string; internal: boolean; created_at: string; attachment_path: string | null; author?: { full_name: string; role: string } | null };
const CATS = ['general', 'technical', 'payment', 'course', 'account', 'other'];

/** Any signed-in user: open and follow their own support requests. */
export function HelpDesk() {
  const user = useAuth((s) => s.user)!;
  const { data, loading, reload } = useData<Ticket[]>(() => supabase.from('support_tickets').select('*').eq('user_id', user.id).order('updated_at', { ascending: false }));
  const [open, setOpen] = useState<Ticket | null>(null);
  const [create, setCreate] = useState(false);
  const [f, setF] = useState({ subject: '', category: 'general', body: '' });
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (user.demo) return toast.err('Sign in with a real account to ask for help.');
    if (f.subject.trim().length < 3 || !f.body.trim()) return toast.err('Write a subject and describe the problem.');
    setBusy(true);
    const { data: t, error } = await supabase.from('support_tickets').insert({ user_id: user.id, subject: f.subject.trim(), category: f.category }).select('*').single();
    if (!error) await supabase.from('ticket_messages').insert({ ticket_id: t.id, author_id: user.id, body: f.body.trim() });
    setBusy(false);
    if (error) return toast.err(error.message);
    toast.ok('Request sent. We will answer you here.'); setCreate(false); setF({ subject: '', category: 'general', body: '' }); reload();
  };
  return (
    <Page>
      {user.demo && <DemoNotice />}
      <PageHero badge="Support" badgeColor="indigo" title="Help Desk" illus="feedback" subtitle="Ask the LLC team for help with your account, payments, courses or anything else. You get a notification when we reply.">
        <button onClick={() => setCreate(true)} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-orange-500 text-white text-sm font-bold"><Plus size={16} /> New Request</button>
      </PageHero>
      {loading ? <Spinner /> : !(data ?? []).length ? <p className="text-center text-slate-400 py-12">You have no support requests.</p> : (
        <div className="space-y-2">{(data ?? []).map((t) => (
          <button key={t.id} onClick={() => setOpen(t)} className="w-full text-left bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-wrap items-center gap-3 hover:border-orange-200">
            <LifeBuoy size={20} className="text-indigo-500" />
            <div className="flex-1 min-w-48"><p className="font-bold text-slate-800">#{t.id} · {t.subject}</p><p className="text-[11px] text-slate-400">{t.category} · {`updated ${fmtDateTime(t.updated_at)}`}</p></div>
            <StatusPill status={t.status} />{t.status === 'waiting' && <span className="text-[10px] font-black uppercase text-emerald-600">Reply waiting</span>}
          </button>
        ))}</div>
      )}
      {create && <Modal open onClose={() => setCreate(false)} title="New support request">
        <div className="space-y-4">
          <Field label="Subject"><input className={inputCls} value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} placeholder="e.g. I cannot open lesson 3" /></Field>
          <Field label="Topic"><select className={`${inputCls} capitalize`} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{CATS.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
          <Field label="Describe the problem"><textarea rows={5} className={inputCls} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>
          <p className="text-[11px] text-slate-400">Never send passwords or card numbers here.</p>
          <button disabled={busy} onClick={submit} className={`${btnPrimary} w-full`}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Send</button>
        </div>
      </Modal>}
      {open && <TicketThread t={open} staff={false} onClose={() => { setOpen(null); reload(); }} />}
    </Page>
  );
}

/** Support / admin: every ticket. */
export function TicketQueue() {
  const user = useAuth((s) => s.user)!;
  const { data, loading, reload } = useData<Ticket[]>(() => supabase.from('support_tickets').select('*, user:profiles!support_tickets_user_id_fkey(full_name,email,role)').order('updated_at', { ascending: false }));
  const [tab, setTab] = useState('open');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Ticket | null>(null);
  const list = (data ?? []).filter((t) => (tab === 'all' || t.status === tab || (tab === 'mine' && t.assigned_to === user.id)) && `${t.id} ${t.subject} ${t.user?.full_name} ${t.user?.email}`.toLowerCase().includes(q.toLowerCase()));
  const count = (s: string) => (data ?? []).filter((t) => t.status === s).length;
  return (
    <Page wide>
      {user.demo && <DemoNotice />}
      <PageHero badge="Support" badgeColor="indigo" title="Support Tickets" illus="feedback" subtitle="Requests from students, instructors and agents. Reply, add internal notes the user cannot see, and close a request when it is solved.">
        <div className="flex flex-wrap gap-2 items-center">
          <SearchInput value={q} onChange={setQ} placeholder="Search by number, subject or person..." />
          <div className="inline-flex bg-slate-50 p-1 rounded-xl border border-slate-200">{[['open', `Open (${count('open')})`], ['waiting', `Waiting for user (${count('waiting')})`], ['mine', 'Assigned to me'], ['resolved', 'Resolved'], ['all', 'All']].map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`px-3 py-2 rounded-lg text-xs font-bold ${tab === k ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>{l}</button>)}</div>
        </div>
      </PageHero>
      {loading ? <Spinner /> : !list.length ? <p className="text-center text-slate-400 py-12">Nothing here.</p> : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm divide-y divide-slate-100">{list.map((t) => (
          <button key={t.id} onClick={() => setOpen(t)} className="w-full text-left px-5 py-3.5 flex flex-wrap items-center gap-3 hover:bg-slate-50">
            <span className="font-mono text-xs text-slate-400 w-10">#{t.id}</span>
            <div className="flex-1 min-w-56"><p className="font-bold text-slate-800">{t.subject}</p><p className="text-[11px] text-slate-400"><span className="capitalize">{t.user?.role}</span> · {t.user?.full_name} · <span className="capitalize">{t.category}</span> · {fmtDateTime(t.updated_at)}</p></div>
            {t.priority === 'high' && <span className="text-[10px] font-black uppercase text-red-500">High</span>}
            <StatusPill status={t.status} />
          </button>
        ))}</div>
      )}
      {open && <TicketThread t={open} staff onClose={() => { setOpen(null); reload(); }} />}
    </Page>
  );
}

function TicketThread({ t, staff, onClose }: { t: Ticket; staff: boolean; onClose: () => void }) {
  const user = useAuth((s) => s.user)!;
  const msgs = useData<Msg[]>(() => supabase.from('ticket_messages').select('*, author:profiles!ticket_messages_author_id_fkey(full_name,role)').eq('ticket_id', t.id).order('created_at'), [t.id]);
  const [cur, setCur] = useState(t);
  const [body, setBody] = useState('');
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!body.trim()) return;
    setBusy(true);
    const { error } = await supabase.from('ticket_messages').insert({ ticket_id: t.id, author_id: user.id, body: body.trim(), internal: staff && internal });
    setBusy(false);
    if (error) return toast.err(error.message);
    setBody(''); msgs.reload();
  };
  const set = async (patch: Partial<Ticket>) => {
    const { data, error } = await supabase.from('support_tickets').update(patch).eq('id', t.id).select('*').single();
    if (error) toast.err(error.message); else setCur({ ...cur, ...(data as Ticket) });
  };
  return (
    <Modal open onClose={onClose} title={`#${t.id} · ${t.subject}`} wide>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2 items-center text-xs">
          <StatusPill status={cur.status} /><span className="capitalize text-slate-500">{cur.category}</span>
          {staff && <>
            <select value={cur.status} onChange={(e) => set({ status: e.target.value })} className="ml-auto px-2 py-1.5 rounded-lg border border-slate-200 capitalize">{['open', 'waiting', 'resolved', 'closed'].map((s) => <option key={s}>{s}</option>)}</select>
            <select value={cur.priority} onChange={(e) => set({ priority: e.target.value })} className="px-2 py-1.5 rounded-lg border border-slate-200 capitalize">{['low', 'normal', 'high'].map((s) => <option key={s}>{s}</option>)}</select>
            <button onClick={() => set({ assigned_to: cur.assigned_to === user.id ? null : user.id })} className="px-2 py-1.5 rounded-lg border border-slate-200 font-bold">{cur.assigned_to === user.id ? 'Unassign me' : 'Assign to me'}</button>
          </>}
          {!staff && cur.status !== 'closed' && <button onClick={() => set({ status: 'closed' })} className="ml-auto px-3 py-1.5 rounded-lg border border-slate-200 font-bold">Close request</button>}
          {!staff && cur.status === 'closed' && <button onClick={() => set({ status: 'open' })} className="ml-auto px-3 py-1.5 rounded-lg border border-slate-200 font-bold">Reopen</button>}
        </div>
        <div className="space-y-2 max-h-[50vh] overflow-y-auto">{msgs.loading ? <Spinner /> : (msgs.data ?? []).map((m) => {
          const mine = m.author_id === user.id;
          return (
            <div key={m.id} className={`p-3 rounded-2xl text-sm max-w-[85%] ${m.internal ? 'bg-amber-50 border border-amber-200 mx-auto' : mine ? 'bg-indigo-600 text-white ml-auto' : 'bg-slate-100'}`}>
              <p className={`text-[10px] font-bold mb-1 ${mine && !m.internal ? 'text-indigo-200' : 'text-slate-400'}`}>{m.internal && <Lock size={10} className="inline mr-1" />}{m.author?.full_name} · {fmtDateTime(m.created_at)}{m.internal ? ' · internal note' : ''}</p>
              <p className="whitespace-pre-line">{m.body}</p>
            </div>
          );
        })}</div>
        {(staff || cur.status !== 'closed') && <div className="space-y-2">
          <textarea rows={3} className={inputCls} value={body} onChange={(e) => setBody(e.target.value)} placeholder={internal ? 'Internal note — only staff can see it' : 'Write your reply'} />
          <div className="flex items-center gap-3">{staff && <label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" className="accent-amber-500" checked={internal} onChange={(e) => setInternal(e.target.checked)} />Internal note</label>}
            <button disabled={busy} onClick={send} className={`${btnPrimary} ml-auto`}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Send</button></div>
        </div>}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- community reports
type Report = { id: number; post_id: number; reason: string; status: string; created_at: string; reporter: { full_name: string } | null; post: { id: number; body: string; hidden: boolean; author_name?: string | null; author_id: string; created_at: string } | null };
export function CommunityReports() {
  const user = useAuth((s) => s.user)!;
  const { data, loading, reload } = useData<Report[]>(() => supabase.from('community_reports').select('*, reporter:profiles!community_reports_reporter_id_fkey(full_name), post:community_posts(id,body,hidden,author_name,author_id,created_at)').order('created_at', { ascending: false }));
  const [tab, setTab] = useState('open');
  const groups = useMemo(() => {
    const m = new Map<number, Report[]>();
    (data ?? []).filter((r) => tab === 'all' || r.status === tab).forEach((r) => m.set(r.post_id, [...(m.get(r.post_id) ?? []), r]));
    return [...m.values()];
  }, [data, tab]);
  const resolve = async (rs: Report[], action: 'dismiss' | 'hide' | 'delete') => {
    const post = rs[0].post;
    if (action === 'delete') { if (!(await askConfirm('Delete this post for good?'))) return; const { error } = await supabase.from('community_posts').delete().eq('id', rs[0].post_id); if (error) return toast.err(error.message); }
    else { const { error } = await supabase.from('community_posts').update({ hidden: action === 'hide' }).eq('id', rs[0].post_id); if (error) return toast.err(error.message); }
    if (action !== 'delete') await supabase.from('community_reports').update({ status: action === 'dismiss' ? 'dismissed' : 'actioned', handled_by: user.id }).in('id', rs.map((r) => r.id));
    toast.ok(action === 'dismiss' ? 'Post kept and visible' : action === 'hide' ? 'Post hidden' : 'Post deleted'); void post; reload();
  };
  return (
    <Page wide>
      {user.demo && <DemoNotice />}
      <PageHero badge="Community" badgeColor="indigo" title="Reported Posts" illus="feedback" subtitle="Posts that members reported. A post reported by three people is hidden automatically until you decide.">
        <div className="inline-flex bg-slate-50 p-1 rounded-xl border border-slate-200">{['open', 'dismissed', 'actioned', 'all'].map((t) => <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-xs font-bold capitalize ${tab === t ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>{t}</button>)}</div>
      </PageHero>
      {loading ? <Spinner /> : !groups.length ? <p className="text-center text-slate-400 py-12">Nothing here.</p> : (
        <div className="space-y-4">{groups.map((rs) => (
          <div key={rs[0].post_id} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5">
            {rs[0].post ? <>
              <div className="flex items-center gap-2 mb-2"><p className="flex-1 text-xs text-slate-400"><b className="text-slate-600">{rs[0].post.author_name ?? 'Member'}</b> · {fmtDateTime(rs[0].post.created_at)}</p>{rs[0].post.hidden && <span className="text-[10px] font-black uppercase text-amber-600 flex items-center gap-1"><EyeOff size={12} />Hidden</span>}</div>
              <p className="text-sm text-slate-800 whitespace-pre-line p-3 rounded-xl bg-slate-50">{rs[0].post.body}</p>
            </> : <p className="text-sm text-slate-400">This post was deleted.</p>}
            <div className="mt-3 space-y-1">{rs.map((r) => <p key={r.id} className="text-xs text-slate-600"><b>{r.reporter?.full_name}</b>: {r.reason} <span className="text-slate-400">· {fmtDateTime(r.created_at)}</span></p>)}</div>
            {rs[0].post && rs.some((r) => r.status === 'open') && <div className="flex flex-wrap gap-2 mt-4">
              <button onClick={() => resolve(rs, 'dismiss')} className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold">Keep the post</button>
              <button onClick={() => resolve(rs, 'hide')} className="px-3 py-2 rounded-xl bg-amber-500 text-white text-xs font-bold">Hide the post</button>
              <button onClick={() => resolve(rs, 'delete')} className="px-3 py-2 rounded-xl bg-red-500 text-white text-xs font-bold">Delete</button>
            </div>}
          </div>
        ))}</div>
      )}
    </Page>
  );
}

// ---------------------------------------------------------------- privacy (PDPA)
type DR = { id: number; user_id: string; kind: string; details: string | null; status: string; response: string | null; created_at: string; handled_at: string | null; user?: { full_name: string; email: string } | null };
/** Admin: privacy requests. */
export function PrivacyRequests() {
  const user = useAuth((s) => s.user)!;
  const { data, loading, reload } = useData<DR[]>(() => supabase.from('data_requests').select('*, user:profiles!data_requests_user_id_fkey(full_name,email)').order('created_at', { ascending: false }));
  const [tab, setTab] = useState('pending');
  const list = (data ?? []).filter((r) => tab === 'all' || r.status === tab);
  const decide = async (r: DR, status: string) => {
    const response = await askText(status === 'completed' ? 'Message to the person (what was done):' : status === 'rejected' ? 'Reason (shown to the person):' : 'Note to the person (optional):');
    if (response === null) return;
    const { error } = await supabase.from('data_requests').update({ status, response: response || null }).eq('id', r.id);
    if (error) toast.err(error.message); else { toast.ok('Updated — the person was notified'); reload(); }
  };
  const overdue = (r: DR) => r.status !== 'completed' && r.status !== 'rejected' && Date.now() - new Date(r.created_at).getTime() > 21 * 86400000;
  return (
    <Page wide>
      {user.demo && <DemoNotice />}
      <PageHero badge="Compliance" badgeColor="indigo" title="Privacy Requests" illus="rules" subtitle="Requests to see, correct or delete personal data (PDPA). Answer within 21 days. For a deletion, archive the account from Users and remove what the law does not require you to keep.">
        <div className="inline-flex bg-slate-50 p-1 rounded-xl border border-slate-200">{['pending', 'in_progress', 'completed', 'rejected', 'all'].map((t) => <button key={t} onClick={() => setTab(t)} className={`px-3 py-2 rounded-lg text-xs font-bold capitalize ${tab === t ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>{t.replace('_', ' ')}</button>)}</div>
      </PageHero>
      {loading ? <Spinner /> : !list.length ? <p className="text-center text-slate-400 py-12">Nothing here.</p> : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm divide-y divide-slate-100">{list.map((r) => (
          <div key={r.id} className="px-5 py-4 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-56"><p className="font-bold text-slate-800"><span className="capitalize">{r.kind}</span> · {r.user?.full_name}</p><p className="text-[11px] text-slate-400">{r.user?.email} · {fmtDateTime(r.created_at)}</p>
              {r.details && <p className="text-sm text-slate-600 mt-1">“{r.details}”</p>}{r.response && <p className="text-xs text-slate-500 mt-1">Answer: {r.response}</p>}
              {overdue(r) && <p className="text-xs font-bold text-red-500 mt-1">More than 21 days old</p>}</div>
            <StatusPill status={r.status} />
            {r.status === 'pending' && <button onClick={() => decide(r, 'in_progress')} className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold">Start</button>}
            {(r.status === 'pending' || r.status === 'in_progress') && <>
              <button onClick={() => decide(r, 'completed')} className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold">Done</button>
              <button onClick={() => decide(r, 'rejected')} className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold">Decline</button></>}
          </div>
        ))}</div>
      )}
    </Page>
  );
}

