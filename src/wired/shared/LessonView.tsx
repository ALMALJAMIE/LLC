import { useState, type ReactNode } from 'react';
import { CheckCircle2, Clock, Download, ExternalLink, Loader2, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export type QuizQ = { prompt: string; options: string[] };
export type LessonKind = 'text' | 'video' | 'image' | 'audio' | 'pdf' | 'pptx' | 'docx' | 'quiz';
type L = { id?: number; title: string; content: string | null; video_url: string | null; resource_url: string | null; duration_min: number | null; kind?: LessonKind | null; file_url?: string | null; quiz?: QuizQ[] | null };

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

const officeEmbed = (url: string) => `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;

/** Renders one content element. `quizMode`: 'take' lets an enrolled student answer and get it graded on the server;
 *  'preview' shows the questions (and the answers when `quizKeys` are given). */
export function LessonView({ lesson: l, quizMode = 'preview', quizKeys }: { lesson: L; quizMode?: 'take' | 'preview'; quizKeys?: number[] }) {
  const kind = l.kind ?? 'text';
  const video = l.video_url || (kind === 'video' ? l.file_url : null);
  const embed = video ? embedUrl(video) : null;
  const file = l.file_url;
  const isVideoFile = !!video && !embed && /\.(mp4|webm|ogg|mov)(\?|$)/i.test(video);
  return (
    <div>
      {video && (embed ? (
        <div className="aspect-video w-full rounded-3xl overflow-hidden bg-black mb-6 shadow-lg"><iframe src={embed} title={l.title} className="w-full h-full" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /></div>
      ) : isVideoFile ? <video controls src={video} className="w-full rounded-3xl mb-6 bg-black" />
        : <a href={video} target="_blank" rel="noreferrer" className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-indigo-600"><ExternalLink size={16} />Open video</a>)}
      {kind === 'image' && file && <img src={file} alt={l.title} className="w-full max-h-[70vh] object-contain rounded-3xl mb-6 bg-slate-50" />}
      {kind === 'audio' && file && <audio controls src={file} className="w-full mb-6" />}
      {kind === 'pdf' && file && <iframe src={file} title={l.title} className="w-full h-[75vh] rounded-3xl border border-slate-100 mb-4" />}
      {(kind === 'pptx' || kind === 'docx') && file && <iframe src={officeEmbed(file)} title={l.title} className="w-full h-[70vh] rounded-3xl border border-slate-100 mb-4" />}
      {file && ['pdf', 'pptx', 'docx', 'audio', 'image'].includes(kind) && <a href={file} target="_blank" rel="noreferrer" className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-indigo-600"><Download size={16} />Download / open file</a>}
      {l.duration_min && <p className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-1"><Clock size={12} />{l.duration_min} min</p>}
      {l.content ? <RichText text={l.content} /> : kind === 'text' && !video && <p className="text-slate-400 text-sm">This lesson has no content yet.</p>}
      {kind === 'quiz' && <QuizBlock lessonId={l.id} quiz={l.quiz ?? []} mode={quizMode} keys={quizKeys} />}
      {l.resource_url && <a href={l.resource_url} target="_blank" rel="noreferrer" className="mt-6 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-50 text-orange-600 text-sm font-bold border border-orange-100"><ExternalLink size={16} />Worksheet / resource</a>}
    </div>
  );
}

function QuizBlock({ lessonId, quiz, mode, keys: givenKeys }: { lessonId?: number; quiz: QuizQ[]; mode: 'take' | 'preview'; keys?: number[] }) {
  const [ans, setAns] = useState<(number | null)[]>(() => quiz.map(() => null));
  const [res, setRes] = useState<{ score: number; total: number; keys: number[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (!quiz.length) return <p className="text-slate-400 text-sm mt-4">This quiz has no questions yet.</p>;
  const keys = res?.keys ?? (mode === 'preview' ? givenKeys : undefined);
  const submit = async () => {
    if (!lessonId) return;
    if (ans.some((a) => a == null) && !confirm('Some questions are not answered. Submit anyway?')) return;
    setBusy(true); setErr('');
    const { data, error } = await supabase.rpc('submit_lesson_quiz', { p_lesson: lessonId, p_answers: ans });
    setBusy(false);
    if (error) return setErr(error.message);
    setRes((data as { score: number; total: number; keys: number[] }[])[0]);
  };
  return (
    <div className="mt-6 space-y-4">
      {res && <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-900 font-bold">Your score: {res.score} / {res.total} ({res.total ? Math.round((res.score * 100) / res.total) : 0}%)</div>}
      {quiz.map((q, i) => (
        <div key={i} className="p-5 rounded-3xl border border-slate-100 bg-white shadow-sm">
          <p className="font-bold text-slate-900 mb-3"><span className="text-slate-400 mr-2">{i + 1}.</span>{q.prompt}</p>
          <div className="grid sm:grid-cols-2 gap-2">{q.options.map((o, j) => {
            const chosen = ans[i] === j, correct = keys && keys[i] === j, wrong = keys && res && chosen && keys[i] !== j;
            return (
              <button key={j} disabled={mode !== 'take' || !!res} onClick={() => setAns(ans.map((a, k) => (k === i ? j : a)))}
                className={`text-left px-4 py-3 rounded-2xl border text-sm font-medium flex items-center gap-2 ${correct ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : wrong ? 'border-red-300 bg-red-50 text-red-700' : chosen ? 'border-orange-400 bg-orange-50 text-orange-800' : 'border-slate-200 text-slate-700'}`}>
                <span className="font-black text-slate-400">{String.fromCharCode(65 + j)}</span><span className="flex-1">{o}</span>{correct && <CheckCircle2 size={16} />}{wrong && <XCircle size={16} />}
              </button>
            );
          })}</div>
        </div>
      ))}
      {mode === 'take' && !res && <button disabled={busy} onClick={submit} className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold flex items-center justify-center gap-2">{busy && <Loader2 size={16} className="animate-spin" />}Submit Quiz</button>}
      {mode === 'take' && res && <button onClick={() => { setRes(null); setAns(quiz.map(() => null)); }} className="w-full py-3 rounded-xl border border-slate-200 font-bold text-slate-600">Try again</button>}
      {err && <p className="text-sm text-red-600">{err}</p>}
    </div>
  );
}
