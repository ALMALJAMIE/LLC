import { Clock, ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';

type L = { title: string; content: string | null; video_url: string | null; resource_url: string | null; duration_min: number | null };

/** Turns a YouTube / Vimeo / Drive link into an embeddable URL. */
export function embedUrl(url: string) {
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  const gd = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
  if (gd) return `https://drive.google.com/file/d/${gd[1]}/preview`;
  return null;
}

function inline(t: string): ReactNode[] {
  return t.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith('**') && p.endsWith('**') ? <b key={i}>{p.slice(2, -2)}</b> : p));
}

/** Minimal, safe text formatting: headings, bullets, bold, paragraphs (no HTML injection). */
export function RichText({ text }: { text: string }) {
  const blocks = text.replace(/\r/g, '').split(/\n{2,}/);
  return (
    <div className="space-y-4 text-slate-700 leading-relaxed">
      {blocks.map((b, i) => {
        const lines = b.split('\n');
        if (lines.every((l) => /^\s*[-*]\s+/.test(l))) return <ul key={i} className="list-disc pl-6 space-y-1">{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*[-*]\s+/, ''))}</li>)}</ul>;
        if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) return <ol key={i} className="list-decimal pl-6 space-y-1">{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*\d+[.)]\s+/, ''))}</li>)}</ol>;
        const h = b.match(/^(#{1,3})\s+(.*)$/);
        if (h && lines.length === 1) return h[1].length === 1 ? <h2 key={i} className="text-2xl font-extrabold text-slate-900">{h[2]}</h2> : <h3 key={i} className="text-lg font-bold text-slate-900">{h[2]}</h3>;
        return <p key={i}>{lines.map((l, j) => <span key={j}>{inline(l)}{j < lines.length - 1 && <br />}</span>)}</p>;
      })}
    </div>
  );
}

export function LessonView({ lesson: l }: { lesson: L }) {
  const embed = l.video_url ? embedUrl(l.video_url) : null;
  return (
    <div>
      {l.video_url && (embed ? (
        <div className="aspect-video w-full rounded-3xl overflow-hidden bg-black mb-6 shadow-lg"><iframe src={embed} title={l.title} className="w-full h-full" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /></div>
      ) : <a href={l.video_url} target="_blank" rel="noreferrer" className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-indigo-600"><ExternalLink size={16} />Open video</a>)}
      {l.duration_min && <p className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-1"><Clock size={12} />{l.duration_min} min</p>}
      {l.content ? <RichText text={l.content} /> : !l.video_url && <p className="text-slate-400 text-sm">This lesson has no content yet.</p>}
      {l.resource_url && <a href={l.resource_url} target="_blank" rel="noreferrer" className="mt-6 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-50 text-orange-600 text-sm font-bold border border-orange-100"><ExternalLink size={16} />Worksheet / resource</a>}
    </div>
  );
}
