import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, CalendarDays, Loader2, Search, ShieldAlert, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { fmtDate } from '../../lib/db';
import { SiteShell } from './Site';
import { RichText } from '../../wired/shared/LessonView';

export type CmsPage = { id: number; kind: 'blog' | 'help' | 'legal' | 'page'; slug: string; title: string; excerpt: string | null; body: string; cover_url: string | null; status: string; show_in_footer: boolean; sort_order: number; published_at: string | null; updated_at: string };

/** Published pages of one kind (public, read without signing in). */
export function usePublished(kind?: CmsPage['kind'], footerOnly = false) {
  const [rows, setRows] = useState<CmsPage[] | null>(null);
  useEffect(() => {
    let q = supabase.from('cms_pages').select('*').eq('status', 'published').order('sort_order').order('published_at', { ascending: false });
    if (kind) q = q.eq('kind', kind);
    if (footerOnly) q = q.eq('show_in_footer', true);
    q.then(({ data }) => setRows((data as CmsPage[]) ?? []));
  }, [kind, footerOnly]);
  return rows;
}

const LABEL: Record<CmsPage['kind'], string> = { blog: 'Blog', help: 'Help centre', legal: 'Legal', page: 'Language Leap Center' };
const BACK: Record<CmsPage['kind'], string> = { blog: '/blog', help: '/help', legal: '/', page: '/' };

/** One published page: /blog/:slug, /help/:slug, /legal/:slug, /p/:slug */
export function ContentPage({ kind }: { kind: CmsPage['kind'] }) {
  const { slug } = useParams();
  const [p, setP] = useState<CmsPage | null | undefined>(undefined);
  useEffect(() => { supabase.from('cms_pages').select('*').eq('slug', slug ?? '').eq('kind', kind).eq('status', 'published').maybeSingle().then(({ data }) => setP((data as CmsPage) ?? null)); }, [slug, kind]);
  return (
    <SiteShell>
      <section className="bg-[#0b1a3a] text-white"><div className="max-w-3xl mx-auto px-5 py-14">
        <Link to={BACK[kind]} className="text-xs font-bold text-orange-300 flex items-center gap-1"><ArrowLeft size={14} />{LABEL[kind]}</Link>
        <h1 className="text-3xl lg:text-4xl font-extrabold mt-3 tracking-tight">{p === undefined ? '…' : p?.title ?? 'Page not found'}</h1>
        {p && kind === 'blog' && p.published_at && <p className="text-sm text-slate-300 mt-2 flex items-center gap-1"><CalendarDays size={14} />{fmtDate(p.published_at)}</p>}
        {p && kind === 'legal' && <p className="text-xs text-slate-400 mt-2">Last updated {fmtDate(p.updated_at)}</p>}
      </div></section>
      <article className="max-w-3xl mx-auto px-5 py-12">
        {p === undefined ? <Loader2 className="animate-spin text-slate-300 mx-auto" /> : !p ? <p className="text-slate-500">This page does not exist or is not published.</p> : <>
          {p.cover_url && <img src={p.cover_url} alt="" className="w-full rounded-3xl mb-8" />}
          <RichText text={p.body} />
        </>}
      </article>
    </SiteShell>
  );
}

/** Blog list: /blog */
export function BlogList() {
  const rows = usePublished('blog');
  return (
    <SiteShell>
      <section className="bg-[#0b1a3a] text-white"><div className="max-w-5xl mx-auto px-5 py-14 text-center">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-orange-400">Blog</p>
        <h1 className="text-4xl font-extrabold mt-3 tracking-tight">News and English tips</h1>
      </div></section>
      <div className="max-w-5xl mx-auto px-5 py-12">
        {rows === null ? <Loader2 className="animate-spin text-slate-300 mx-auto" /> : !rows.length ? <p className="text-center text-slate-400">No posts yet.</p> : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">{rows.map((p) => (
            <Link key={p.id} to={`/blog/${p.slug}`} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-lg transition-all">
              {p.cover_url ? <img src={p.cover_url} alt="" className="w-full h-44 object-cover" /> : <div className="h-44 bg-gradient-to-br from-indigo-600 to-indigo-900" />}
              <div className="p-5"><p className="text-[11px] text-slate-400">{fmtDate(p.published_at)}</p><h2 className="font-extrabold text-slate-900 mt-1">{p.title}</h2>{p.excerpt && <p className="text-sm text-slate-500 mt-2 line-clamp-3">{p.excerpt}</p>}</div>
            </Link>
          ))}</div>
        )}
      </div>
    </SiteShell>
  );
}

/** Help articles block, used on the help page. */
export function HelpArticles() {
  const rows = usePublished('help');
  if (!rows?.length) return null;
  return (
    <div className="mt-12">
      <h2 className="text-xl font-extrabold text-slate-900 mb-4">Guides</h2>
      <div className="grid sm:grid-cols-2 gap-3">{rows.map((p) => (
        <Link key={p.id} to={`/help/${p.slug}`} className="p-5 rounded-2xl bg-white border border-slate-100 hover:border-orange-300"><p className="font-bold text-slate-800">{p.title}</p>{p.excerpt && <p className="text-sm text-slate-500 mt-1">{p.excerpt}</p>}</Link>
      ))}</div>
    </div>
  );
}

type V = { serial: string; student_name: string; title: string; course: string | null; issued_at: string; revoked: boolean };
/** Public certificate check: /verify?c=LLC-CERT-XXXX */
export function VerifyCertificate() {
  const [params] = useSearchParams();
  const [code, setCode] = useState(params.get('c') ?? '');
  const [res, setRes] = useState<V | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const check = async (c = code) => {
    if (!c.trim()) return;
    setBusy(true);
    const { data } = await supabase.rpc('verify_certificate', { p_serial: c.trim() });
    setBusy(false);
    setRes(((data as V[] | null) ?? [])[0] ?? null);
  };
  useEffect(() => { if (params.get('c')) check(params.get('c')!); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <SiteShell>
      <section className="bg-[#0b1a3a] text-white"><div className="max-w-2xl mx-auto px-5 py-16 text-center">
        <ShieldCheck size={40} className="mx-auto text-orange-400" />
        <h1 className="text-3xl lg:text-4xl font-extrabold mt-3 tracking-tight">Check a certificate</h1>
        <p className="text-slate-300 mt-2">Enter the certificate number printed on the certificate, or scan its QR code.</p>
        <form onSubmit={(e) => { e.preventDefault(); check(); }} className="relative mt-8 max-w-lg mx-auto flex gap-2">
          <div className="relative flex-1"><Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="LLC-CERT-XXXXXXXX" className="w-full pl-11 pr-4 py-4 rounded-2xl bg-white text-slate-900 outline-none uppercase" data-no-i18n /></div>
          <button disabled={busy} className="px-6 rounded-2xl bg-orange-500 font-bold">{busy ? <Loader2 className="animate-spin" size={18} /> : 'Check'}</button>
        </form>
      </div></section>
      <div className="max-w-2xl mx-auto px-5 py-12">
        {res === null && <div className="p-6 rounded-3xl bg-red-50 border border-red-100 text-center"><ShieldAlert className="mx-auto text-red-500" size={32} /><p className="font-bold text-red-700 mt-2">No certificate was found with this number.</p><p className="text-sm text-slate-600">Check the number and try again, or contact us.</p></div>}
        {res && (res.revoked
          ? <div className="p-6 rounded-3xl bg-red-50 border border-red-100 text-center"><ShieldAlert className="mx-auto text-red-500" size={32} /><p className="font-bold text-red-700 mt-2">This certificate has been withdrawn and is no longer valid.</p></div>
          : <div className="p-8 rounded-3xl bg-white border border-emerald-200 shadow-sm text-center">
              <BadgeCheck className="mx-auto text-emerald-500" size={44} />
              <p className="text-xs font-black uppercase tracking-widest text-emerald-600 mt-2">Valid certificate</p>
              <p className="text-2xl font-extrabold text-slate-900 mt-4" data-no-i18n>{res.student_name}</p>
              <p className="text-slate-500 mt-1">completed</p>
              <p className="text-xl font-bold text-indigo-700 mt-1" data-no-i18n>{res.title}</p>
              <p className="text-sm text-slate-500 mt-4">Issued {fmtDate(res.issued_at)} · <span data-no-i18n>{res.serial}</span></p>
              <p className="text-xs text-slate-400 mt-1">Language Leap Center</p>
            </div>)}
      </div>
    </SiteShell>
  );
}
