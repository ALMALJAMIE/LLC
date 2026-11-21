// Quiz questions written as plain text, one block per question, a blank line between blocks.
//
//   [single] She ___ to work by bus.        one correct option, marked with *
//   * goes
//   - go
//   ? Third person singular takes -es.      optional explanation shown after checking
//
//   [multiple] Which are fruits?            several options marked with *
//   * apple
//   * pear
//   - carrot
//
//   [short] Past simple of "see"?           typed answer; one "=" line per accepted answer
//   = saw
//
//   [gap] Yesterday I ___ and ___ milk.     one "=" line per gap, alternatives separated by |
//   = went
//   = bought | got
//
//   [match] Match the opposites.            left => right
//   hot => cold
//   big => small
//
//   [order] Put the words in order.         lines in the CORRECT order (they are shuffled for students)
//   I
//   am
//   a student
//
//   > A passage shown above the question (may repeat for several lines)

export type QType = 'single' | 'multiple' | 'short' | 'gap' | 'match' | 'order';
export type QuizItem = { type?: QType; prompt: string; passage?: string | null; options?: string[]; left?: string[]; right?: string[]; items?: string[] };
export type QuizKey = number | number[] | string[] | string[][];
export type Parsed = { quiz: QuizItem[]; keys: QuizKey[]; explanations: (string | null)[]; errors: string[] };

export const QTYPES: { k: QType; label: string }[] = [
  { k: 'single', label: 'One answer' }, { k: 'multiple', label: 'Several answers' }, { k: 'short', label: 'Short answer' },
  { k: 'gap', label: 'Fill the gaps' }, { k: 'match', label: 'Matching' }, { k: 'order', label: 'Ordering' },
];

const gaps = (s: string) => (s.match(/_{3,}/g) ?? []).length;

function shuffle<T>(arr: T[]): number[] {
  const idx = arr.map((_, i) => i);
  for (let tries = 0; tries < 5; tries++) {
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    if (idx.length < 2 || idx.some((v, i) => v !== i)) break; // avoid showing the answer order
  }
  return idx;
}

/** Text → questions, answer keys and explanations. Never throws; problems are listed in `errors`. */
export function parseQuiz(text: string): Parsed {
  const out: Parsed = { quiz: [], keys: [], explanations: [], errors: [] };
  const blocks = text.replace(/\r/g, '').split(/\n\s*\n/).map((b) => b.split('\n').map((l) => l.trimEnd()).filter((l) => l.trim())).filter((b) => b.length);
  let pendingPassage: string[] = [];
  blocks.forEach((lines, bi) => {
    const n = bi + 1;
    const passage = [...pendingPassage]; pendingPassage = [];
    let i = 0;
    while (i < lines.length && lines[i].trim().startsWith('>')) { passage.push(lines[i].trim().replace(/^>\s?/, '')); i++; }
    if (i >= lines.length) { pendingPassage = passage; return; } // a block with only a passage belongs to the next question
    const head = lines[i].trim().match(/^\[(single|multiple|short|gap|match|order)\]\s*(.*)$/i);
    if (!head) { out.errors.push(`Block ${n}: start the question with [single], [multiple], [short], [gap], [match] or [order].`); return; }
    const type = head[1].toLowerCase() as QType;
    const prompt = head[2].trim();
    if (!prompt) { out.errors.push(`Block ${n}: write the question after [${type}].`); return; }
    const body = lines.slice(i + 1).map((l) => l.trim());
    const expl = body.filter((l) => l.startsWith('?')).map((l) => l.replace(/^\?\s?/, '')).join(' ') || null;
    const rest = body.filter((l) => !l.startsWith('?'));
    const item: QuizItem = { type, prompt, passage: passage.length ? passage.join('\n') : null };
    let key: QuizKey | null = null;
    if (type === 'single' || type === 'multiple') {
      const opts = rest.filter((l) => /^[*-]\s?/.test(l)).map((l) => ({ ok: l.startsWith('*'), t: l.replace(/^[*-]\s?/, '').trim() }));
      const correct = opts.map((o, k) => (o.ok ? k : -1)).filter((k) => k >= 0);
      if (opts.length < 2) { out.errors.push(`Block ${n}: give at least two options (lines starting with * or -).`); return; }
      if (type === 'single' && correct.length !== 1) { out.errors.push(`Block ${n}: mark exactly one correct option with *.`); return; }
      if (type === 'multiple' && correct.length < 1) { out.errors.push(`Block ${n}: mark the correct options with *.`); return; }
      item.options = opts.map((o) => o.t);
      key = type === 'single' ? correct[0] : correct;
    } else if (type === 'short') {
      const ans = rest.filter((l) => l.startsWith('=')).flatMap((l) => l.replace(/^=\s?/, '').split('|')).map((s) => s.trim()).filter(Boolean);
      if (!ans.length) { out.errors.push(`Block ${n}: add the accepted answer on a line starting with =.`); return; }
      key = ans;
    } else if (type === 'gap') {
      const g = rest.filter((l) => l.startsWith('=')).map((l) => l.replace(/^=\s?/, '').split('|').map((s) => s.trim()).filter(Boolean));
      const count = gaps(prompt);
      if (!count) { out.errors.push(`Block ${n}: mark each gap in the sentence with ___ (three underscores).`); return; }
      if (g.length !== count || g.some((x) => !x.length)) { out.errors.push(`Block ${n}: the sentence has ${count} gap(s); add one = line for each.`); return; }
      key = g;
    } else if (type === 'match') {
      const pairs = rest.filter((l) => l.includes('=>')).map((l) => l.split('=>').map((s) => s.trim()));
      if (pairs.length < 2 || pairs.some((p) => !p[0] || !p[1])) { out.errors.push(`Block ${n}: write at least two pairs as  left => right.`); return; }
      const order = shuffle(pairs);
      item.left = pairs.map((p) => p[0]);
      item.right = order.map((o) => pairs[o][1]);
      key = pairs.map((_, li) => order.indexOf(li));
    } else if (type === 'order') {
      const parts = rest.map((l) => l.replace(/^\d+[.)]\s*/, '')).filter(Boolean);
      if (parts.length < 2) { out.errors.push(`Block ${n}: write at least two lines in the correct order.`); return; }
      const order = shuffle(parts);
      item.items = order.map((o) => parts[o]);
      key = parts.map((_, k) => order.indexOf(k));
    }
    out.quiz.push(item); out.keys.push(key!); out.explanations.push(expl);
  });
  if (pendingPassage.length) out.errors.push('A passage (> lines) at the end has no question after it.');
  return out;
}

/** Questions + keys → editable text (used when opening an existing quiz). */
export function quizToText(quiz: QuizItem[], keys: QuizKey[], explanations: (string | null)[] = []): string {
  let lastPassage: string | null = null;
  return quiz.map((q, i) => {
    const type = q.type ?? 'single';
    const k = keys[i];
    const lines: string[] = [];
    if (q.passage && q.passage !== lastPassage) q.passage.split('\n').forEach((l) => lines.push(`> ${l}`));
    lastPassage = q.passage ?? null;
    lines.push(`[${type}] ${q.prompt}`);
    if (type === 'single' || type === 'multiple') {
      const ok = new Set(Array.isArray(k) ? (k as number[]) : [k as number]);
      (q.options ?? []).forEach((o, j) => lines.push(`${ok.has(j) ? '*' : '-'} ${o}`));
    } else if (type === 'short') lines.push(`= ${((k as string[]) ?? []).join(' | ')}`);
    else if (type === 'gap') ((k as string[][]) ?? []).forEach((g) => lines.push(`= ${g.join(' | ')}`));
    else if (type === 'match') (q.left ?? []).forEach((l, j) => lines.push(`${l} => ${(q.right ?? [])[(k as number[])?.[j]] ?? ''}`));
    else if (type === 'order') ((k as number[]) ?? []).forEach((idx) => lines.push((q.items ?? [])[idx] ?? ''));
    if (explanations[i]) lines.push(`? ${explanations[i]}`);
    return lines.join('\n');
  }).join('\n\n');
}

/** Human-readable correct answer (shown after checking). */
export function answerText(q: QuizItem, k: QuizKey | undefined): string {
  if (k === undefined || k === null) return '';
  switch (q.type ?? 'single') {
    case 'single': return (q.options ?? [])[k as number] ?? '';
    case 'multiple': return (k as number[]).map((i) => (q.options ?? [])[i]).join(', ');
    case 'short': return (k as string[])[0] ?? '';
    case 'gap': return (k as string[][]).map((g) => g[0]).join(' … ');
    case 'match': return (q.left ?? []).map((l, i) => `${l} → ${(q.right ?? [])[(k as number[])[i]]}`).join(' · ');
    case 'order': return (k as number[]).map((i) => (q.items ?? [])[i]).join(' ');
  }
}

export const QUIZ_HELP = `[single] She ___ to work by bus.
* goes
- go
? Third person singular takes -es.

[multiple] Which are fruits?
* apple
* pear
- carrot

[short] Past simple of "see"?
= saw

[gap] Yesterday I ___ to the shop and ___ some milk.
= went
= bought | got

[match] Match the opposites.
hot => cold
big => small

[order] Put the words in order.
I
am
a student`;
