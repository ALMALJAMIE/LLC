import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, CheckCircle2, ChevronDown, Clock, Download, ExternalLink, Loader2, Mic, Send, Square, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { answerText, type QuizItem, type QuizKey } from '../../lib/questions';
import { askConfirm } from '../../components/dialogs';

export type QuizQ = QuizItem;
export type LessonKind = 'text' | 'video' | 'image' | 'audio' | 'pdf' | 'pptx' | 'docx' | 'quiz' | 'vocabulary' | 'writing' | 'speaking';
export type LessonData = { transcript?: string; min_words?: number; vocab?: { term: string; definition: string; example?: string }[] };
type L = { id?: number; title: string; content: string | null; video_url: string | null; resource_url: string | null; duration_min: number | null; kind?: LessonKind | null; file_url?: string | null; quiz?: QuizQ[] | null; data?: LessonData | null };

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

/** Renders one content element. `quizMode`: 'take' lets an enrolled student answer (graded on the server) and hand in
 *  writing / speaking work; 'preview' shows the content (and quiz answers when `quizKeys` are given). */
export function LessonView({ lesson: l, quizMode = 'preview', quizKeys, quizExplanations }: { lesson: L; quizMode?: 'take' | 'preview'; quizKeys?: QuizKey[]; quizExplanations?: (string | null)[] }) {
  const kind = l.kind ?? 'text';
  const video = l.video_url || (kind === 'video' ? l.file_url : null);
  const embed = video ? embedUrl(video) : null;
  const file = l.file_url;
  const isVideoFile = !!video && !embed && /\.(mp4|webm|ogg|mov)(\?|$)/i.test(video);
  const data = l.data ?? {};
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
      {data.transcript && <details className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 group"><summary className="px-4 py-3 cursor-pointer text-sm font-bold text-slate-700 flex items-center gap-2"><ChevronDown size={16} className="group-open:rotate-180 transition-transform" />Transcript</summary><div className="px-4 pb-4 text-sm"><RichText text={data.transcript} /></div></details>}
      {l.duration_min && <p className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-1"><Clock size={12} />{l.duration_min} min</p>}
      {l.content ? <RichText text={l.content} /> : kind === 'text' && !video && <p className="text-slate-400 text-sm">This lesson has no content yet.</p>}
      {kind === 'vocabulary' && <VocabList items={data.vocab ?? []} />}
      {kind === 'quiz' && <QuizBlock key={JSON.stringify(l.quiz)} lessonId={l.id} quiz={l.quiz ?? []} mode={quizMode} keys={quizKeys} explanations={quizExplanations} />}
      {(kind === 'writing' || kind === 'speaking') && (quizMode === 'take' && l.id ? <StudentWork lessonId={l.id} kind={kind} minWords={data.min_words} />
        : <p className="mt-4 p-4 rounded-2xl bg-amber-50 border border-amber-100 text-sm text-amber-800">{kind === 'writing' ? `Students write their answer here${data.min_words ? ` (at least ${data.min_words} words)` : ''} and the teacher reviews it.` : 'Students record their voice here and the teacher reviews the recording.'}</p>)}
      {l.resource_url && <a href={l.resource_url} target="_blank" rel="noreferrer" className="mt-6 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-50 text-orange-600 text-sm font-bold border border-orange-100"><ExternalLink size={16} />Worksheet / resource</a>}
    </div>
  );
}

function VocabList({ items }: { items: { term: string; definition: string; example?: string }[] }) {
  const [open, setOpen] = useState<Set<number>>(new Set());
  if (!items.length) return <p className="text-slate-400 text-sm mt-4">No words yet.</p>;
  return (
    <div className="mt-6 grid sm:grid-cols-2 gap-3">
      {items.map((v, i) => (
        <button key={i} onClick={() => setOpen((o) => { const n = new Set(o); n.has(i) ? n.delete(i) : n.add(i); return n; })} className="text-left p-4 rounded-2xl border border-slate-200 bg-white hover:border-indigo-200">
          <p className="text-lg font-extrabold text-indigo-700">{v.term}</p>
          {open.has(i) ? <><p className="text-sm text-slate-700 mt-1">{v.definition}</p>{v.example && <p className="text-sm text-slate-500 italic mt-1">“{v.example}”</p>}</>
            : <p className="text-xs text-slate-400 mt-1">Tap to see the meaning</p>}
        </button>
      ))}
    </div>
  );
}

const countWords = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

function StudentWork({ lessonId, kind, minWords }: { lessonId: number; kind: 'writing' | 'speaking'; minWords?: number }) {
  const user = useAuth((s) => s.user)!;
  type R = { id: number; body: string | null; audio_path: string | null; status: string; score: number | null; feedback: string | null; submitted_at: string };
  const [r, setR] = useState<R | null | undefined>(undefined);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [secs, setSecs] = useState(0);
  const chunks = useRef<Blob[]>([]);
  const load = async () => {
    const { data } = await supabase.from('lesson_responses').select('*').eq('lesson_id', lessonId).eq('student_id', user.id).maybeSingle();
    setR((data as R) ?? null); setBody((data as R | null)?.body ?? '');
    if ((data as R | null)?.audio_path) { const s = await supabase.storage.from('uploads').createSignedUrl((data as R).audio_path!, 600); setAudioUrl(s.data?.signedUrl ?? null); }
  };
  useEffect(() => { if (!user.demo) load(); else setR(null); }, [lessonId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!rec) return; const t = setInterval(() => setSecs((x) => x + 1), 1000); return () => clearInterval(t); }, [rec]);
  const locked = r?.status === 'reviewed';
  const start = async () => {
    setMsg('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream); chunks.current = [];
      mr.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      mr.onstop = () => { stream.getTracks().forEach((t) => t.stop()); const b = new Blob(chunks.current, { type: mr.mimeType || 'audio/webm' }); setBlob(b); setAudioUrl(URL.createObjectURL(b)); };
      mr.start(); setSecs(0); setRec(mr);
    } catch { setMsg('The microphone is not available. Allow microphone access in your browser and try again.'); }
  };
  const stop = () => { rec?.stop(); setRec(null); };
  const submit = async () => {
    setMsg('');
    if (user.demo) return setMsg('Sign in with a real account to submit.');
    let audio_path = r?.audio_path ?? null;
    if (kind === 'writing') {
      if (!body.trim()) return setMsg('Write your answer first.');
      if (minWords && countWords(body) < minWords) return setMsg(`Write at least ${minWords} words (you have ${countWords(body)}).`);
    } else {
      if (!blob && !audio_path) return setMsg('Record your answer first.');
      if (r && blob && !(await askConfirm('Replace your previous recording with the new one?'))) return;
    }
    setBusy(true);
    if (kind === 'speaking' && blob) {
      const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm';
      const path = `${user.id}/speaking/${lessonId}-${Date.now()}.${ext}`;
      const up = await supabase.storage.from('uploads').upload(path, blob, { contentType: blob.type });
      if (up.error) { setBusy(false); return setMsg(up.error.message); }
      audio_path = path;
    }
    const row = { lesson_id: lessonId, student_id: user.id, body: kind === 'writing' ? body.trim() : null, audio_path: kind === 'speaking' ? audio_path : null };
    const { error } = r ? await supabase.from('lesson_responses').update(row).eq('id', r.id) : await supabase.from('lesson_responses').insert(row);
    setBusy(false);
    if (error) return setMsg(error.message);
    setBlob(null); setMsg('Submitted. Your teacher will review it.'); load();
  };
  if (r === undefined) return <Loader2 className="animate-spin text-slate-300 mt-4" />;
  return (
    <div className="mt-6 p-5 rounded-3xl border border-slate-200 bg-white space-y-3">
      <div className="flex items-center gap-2"><p className="flex-1 text-xs font-black uppercase tracking-wider text-slate-500">{kind === 'writing' ? 'Your answer' : 'Your recording'}</p>
        {r && <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-md ${locked ? 'bg-emerald-50 text-emerald-700' : 'bg-sky-50 text-sky-700'}`}>{locked ? 'Reviewed' : 'Submitted'}</span>}</div>
      {kind === 'writing' ? (
        <>
          <textarea rows={8} disabled={locked} value={body} onChange={(e) => setBody(e.target.value)} className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm disabled:bg-slate-50" placeholder="Write your answer here" />
          <p className="text-[11px] text-slate-400">{countWords(body)} words{minWords ? ` · at least ${minWords}` : ''}</p>
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          {!locked && (rec ? <button onClick={stop} className="px-4 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold flex items-center gap-2"><Square size={14} />Stop · {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}</button>
            : <button onClick={start} className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold flex items-center gap-2"><Mic size={15} />{audioUrl ? 'Record again' : 'Start recording'}</button>)}
          {audioUrl && !rec && <audio controls src={audioUrl} className="flex-1 min-w-56" />}
        </div>
      )}
      {locked && <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 text-sm"><p className="font-bold text-emerald-800">Teacher feedback{r?.score != null ? ` · ${r.score}` : ''}</p><p className="text-slate-700 whitespace-pre-line mt-1">{r?.feedback || '—'}</p></div>}
      {!locked && <button disabled={busy || !!rec} onClick={submit} className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-60">{busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}{r ? 'Submit again' : 'Submit to teacher'}</button>}
      {msg && <p className="text-sm text-slate-600">{msg}</p>}
    </div>
  );
}

type Ans = number | number[] | string | string[] | null;
const initialAnswer = (q: QuizItem): Ans => {
  switch (q.type ?? 'single') {
    case 'multiple': return [];
    case 'short': return '';
    case 'gap': return (q.prompt.match(/_{3,}/g) ?? []).map(() => '');
    case 'match': return (q.left ?? []).map(() => -1);
    case 'order': return (q.items ?? []).map((_, i) => i);
    default: return null;
  }
};

function QuizBlock({ lessonId, quiz, mode, keys: givenKeys, explanations: givenEx }: { lessonId?: number; quiz: QuizItem[]; mode: 'take' | 'preview'; keys?: QuizKey[]; explanations?: (string | null)[] }) {
  const [ans, setAns] = useState<Ans[]>(() => quiz.map(initialAnswer));
  const [res, setRes] = useState<{ score: number; total: number; keys: QuizKey[]; explanations: (string | null)[]; results: boolean[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (!quiz.length) return <p className="text-slate-400 text-sm mt-4">This quiz has no questions yet.</p>;
  const keys = res?.keys ?? (mode === 'preview' ? givenKeys : undefined);
  const ex = res?.explanations ?? (mode === 'preview' ? givenEx : undefined);
  const set = (i: number, v: Ans) => setAns(ans.map((a, k) => (k === i ? v : a)));
  const unanswered = (a: Ans) => a == null || (Array.isArray(a) && (a.length === 0 || (a as unknown[]).some((x) => x === '' || x === -1))) || a === '';
  const submit = async () => {
    if (!lessonId) return;
    if (quiz.some((q, i) => (q.type ?? 'single') !== 'order' && unanswered(ans[i])) && !(await askConfirm('Some questions are not answered. Submit anyway?'))) return;
    setBusy(true); setErr('');
    const payload = ans.map((a) => (Array.isArray(a) && a.every((x) => x === -1) ? null : a));
    const { data, error } = await supabase.rpc('submit_lesson_quiz', { p_lesson: lessonId, p_answers: payload });
    setBusy(false);
    if (error) return setErr(error.message);
    setRes((data as typeof res[])[0]);
  };
  const done = !!res || mode !== 'take';
  let lastPassage: string | null = null;
  return (
    <div className="mt-6 space-y-4">
      {res && <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-900 font-bold">Your score: {res.score} / {res.total} ({res.total ? Math.round((res.score * 100) / res.total) : 0}%)</div>}
      {quiz.map((q, i) => {
        const t = q.type ?? 'single';
        const a = ans[i];
        const showPassage = q.passage && q.passage !== lastPassage; lastPassage = q.passage ?? null;
        const ok = res?.results?.[i];
        return (
          <div key={i}>
            {showPassage && <div className="mb-3 p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100 text-sm"><RichText text={q.passage!} /></div>}
            <div className={`p-5 rounded-3xl border bg-white shadow-sm ${res ? (ok ? 'border-emerald-200' : 'border-red-200') : 'border-slate-100'}`}>
              {t !== 'gap' && <p className="font-bold text-slate-900 mb-3"><span className="text-slate-400 mr-2">{i + 1}.</span>{q.prompt}</p>}
              {(t === 'single' || t === 'multiple') && (
                <div className="grid sm:grid-cols-2 gap-2">{(q.options ?? []).map((o, j) => {
                  const chosen = t === 'single' ? a === j : (a as number[]).includes(j);
                  const k = keys?.[i];
                  const correct = k !== undefined && (Array.isArray(k) ? (k as number[]).includes(j) : k === j);
                  const wrong = !!res && chosen && !correct;
                  return (
                    <button key={j} disabled={done} onClick={() => set(i, t === 'single' ? j : chosen ? (a as number[]).filter((x) => x !== j) : [...(a as number[]), j])}
                      className={`text-left px-4 py-3 rounded-2xl border text-sm font-medium flex items-center gap-2 ${correct ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : wrong ? 'border-red-300 bg-red-50 text-red-700' : chosen ? 'border-orange-400 bg-orange-50 text-orange-800' : 'border-slate-200 text-slate-700'}`}>
                      <span className={`w-5 h-5 shrink-0 grid place-items-center border ${t === 'multiple' ? 'rounded-md' : 'rounded-full'} ${chosen ? 'bg-orange-500 border-orange-500 text-white' : 'border-slate-300'}`}>{chosen && <CheckCircle2 size={12} />}</span>
                      <span className="flex-1">{o}</span>{correct && <CheckCircle2 size={16} />}{wrong && <XCircle size={16} />}
                    </button>
                  );
                })}</div>
              )}
              {t === 'multiple' && !done && <p className="text-[11px] text-slate-400 mt-2">Choose all that apply.</p>}
              {t === 'short' && <input disabled={done} value={(a as string) ?? ''} onChange={(e) => set(i, e.target.value)} className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm" placeholder="Type your answer" />}
              {t === 'gap' && (
                <p className="font-bold text-slate-900 leading-[2.6]"><span className="text-slate-400 mr-2">{i + 1}.</span>
                  {q.prompt.split(/_{3,}/).map((part, g, arr) => (
                    <span key={g}>{part}{g < arr.length - 1 && <input disabled={done} value={((a as string[]) ?? [])[g] ?? ''} onChange={(e) => set(i, (a as string[]).map((x, y) => (y === g ? e.target.value : x)))}
                      className="mx-1 w-32 px-2 py-1 rounded-lg border-b-2 border-orange-300 bg-orange-50/50 text-center text-sm font-semibold focus:outline-none" />}</span>
                  ))}
                </p>
              )}
              {t === 'match' && (
                <div className="space-y-2">{(q.left ?? []).map((l, li) => (
                  <div key={li} className="grid grid-cols-2 gap-2 items-center"><span className="px-4 py-2.5 rounded-xl bg-slate-50 text-sm font-semibold">{l}</span>
                    <select disabled={done} value={(a as number[])[li]} onChange={(e) => set(i, (a as number[]).map((x, y) => (y === li ? Number(e.target.value) : x)))} className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm">
                      <option value={-1}>— Choose —</option>{(q.right ?? []).map((r, ri) => <option key={ri} value={ri}>{r}</option>)}</select></div>
                ))}</div>
              )}
              {t === 'order' && (
                <div className="space-y-1.5">{(a as number[]).map((idx, pos, arr) => (
                  <div key={idx} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold"><span className="text-slate-400 w-5">{pos + 1}.</span><span className="flex-1">{(q.items ?? [])[idx]}</span>
                    {!done && <><button disabled={pos === 0} onClick={() => { const n = [...arr]; [n[pos - 1], n[pos]] = [n[pos], n[pos - 1]]; set(i, n); }} className="p-1 text-slate-400 disabled:opacity-30"><ArrowUp size={14} /></button>
                      <button disabled={pos === arr.length - 1} onClick={() => { const n = [...arr]; [n[pos + 1], n[pos]] = [n[pos], n[pos + 1]]; set(i, n); }} className="p-1 text-slate-400 disabled:opacity-30"><ArrowDown size={14} /></button></>}</div>
                ))}</div>
              )}
              {keys && t !== 'single' && t !== 'multiple' && <p className="mt-3 text-sm text-emerald-700"><b>Answer:</b> {answerText(q, keys[i])}</p>}
              {ex?.[i] && <p className="mt-2 text-sm text-slate-600 p-3 rounded-xl bg-slate-50"><b>Why:</b> {ex[i]}</p>}
            </div>
          </div>
        );
      })}
      {mode === 'take' && !res && <button disabled={busy} onClick={submit} className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold flex items-center justify-center gap-2">{busy && <Loader2 size={16} className="animate-spin" />}Submit Quiz</button>}
      {mode === 'take' && res && <button onClick={() => { setRes(null); setAns(quiz.map(initialAnswer)); }} className="w-full py-3 rounded-xl border border-slate-200 font-bold text-slate-600">Try again</button>}
      {err && <p className="text-sm text-red-600">{err}</p>}
    </div>
  );
}
