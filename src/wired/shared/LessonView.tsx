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
/** Tiny markdown: # / ## headings, - or * bullets, 1. numbered lists, **bold**, *italic*, links.
 *  Works line by line, so teachers don't need blank lines between blocks. */
export function RichText({ text }: { text: string }) {
  type B = { k: 'h1' | 'h2' | 'p' | 'ul' | 'ol'; lines: string[] };
  const blocks: B[] = [];
  const push = (k: B['k'], l: string) => { const last = blocks[blocks.length - 1]; if (last && last.k === k && (k === 'ul' || k === 'ol' || k === 'p')) last.lines.push(l); else blocks.push({ k, lines: [l] }); };
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const l = raw.trimEnd();
    if (!l.trim()) { blocks.push({ k: 'p', lines: [] }); continue; } // blank line ends the paragraph
    let m;
    if ((m = l.match(/^\s*(#{1,3})\s+(.*)$/))) blocks.push({ k: m[1].length === 1 ? 'h1' : 'h2', lines: [m[2]] });
    else if ((m = l.match(/^\s*[-*•]\s+(.*)$/))) push('ul', m[1]);
    else if ((m = l.match(/^\s*\d+[.)]\s+(.*)$/))) push('ol', m[1]);
    else push('p', l);
  }
  return (
    <div className="space-y-4 text-slate-700 leading-relaxed">
      {blocks.filter((b) => b.lines.length).map((b, i) =>
        b.k === 'h1' ? <h2 key={i} className="text-2xl font-extrabold text-slate-900">{inline(b.lines[0])}</h2>
        : b.k === 'h2' ? <h3 key={i} className="text-lg font-bold text-slate-900">{inline(b.lines[0])}</h3>
        : b.k === 'ul' ? <ul key={i} className="list-disc pl-6 space-y-1">{b.lines.map((l, j) => <li key={j}>{inline(l)}</li>)}</ul>
        : b.k === 'ol' ? <ol key={i} className="list-decimal pl-6 space-y-1">{b.lines.map((l, j) => <li key={j}>{inline(l)}</li>)}</ol>
        : <p key={i}>{b.lines.map((l, j) => <span key={j}>{inline(l)}{j < b.lines.length - 1 && <br />}</span>)}</p>,
      )}
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
