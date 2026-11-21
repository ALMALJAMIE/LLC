import { create } from 'zustand';
import ar1 from './ar1';
import ar2 from './ar2';
import ar3 from './ar3';
import ar4 from './ar4';
import ar5 from './ar5';
import ar6 from './ar6';

export type Lang = 'en' | 'ar';
const KEY = 'llc-lang';
const AR: Record<string, string> = { ...ar1, ...ar2, ...ar3, ...ar4, ...ar5, ...ar6 };

// Status / enum words, matched case-insensitively ("ACTIVE", "Active", "face_to_face"…)
const WORDS: Record<string, string> = {
  active: 'نشط', pending: 'معلّق', paid: 'مدفوع', approved: 'مقبول', rejected: 'مرفوض', completed: 'مكتمل', cancelled: 'ملغى',
  draft: 'مسودة', scheduled: 'مجدول', closed: 'مغلق', open: 'مفتوح', submitted: 'مُرسل', graded: 'مصحَّح', present: 'حاضر',
  absent: 'غائب', late: 'متأخر', excused: 'بعذر', online: 'أونلاين', face_to_face: 'حضوري', quiz: 'اختبار قصير', midterm: 'نصفي',
  final: 'نهائي', holiday: 'عطلة', intake: 'دفعة جديدة', exam: 'اختبار', event: 'فعالية', high: 'عالية', medium: 'متوسطة', low: 'منخفضة',
  percent: 'نسبة', fixed: 'مبلغ ثابت', withdrawn: 'منسحب', suspended: 'موقوف', archived: 'مؤرشف', waitlisted: 'قائمة انتظار',
  sent: 'مُرسل', failed: 'فشل', refunded: 'مسترد', in_progress: 'قيد التنفيذ', not_started: 'لم يبدأ', expired: 'منتهي',
  published: 'منشور', monday: 'الاثنين', tuesday: 'الثلاثاء', wednesday: 'الأربعاء', thursday: 'الخميس', friday: 'الجمعة', saturday: 'السبت', sunday: 'الأحد',
  active_enrollment: 'تسجيل نشط', active_enrollments: 'تسجيلات نشطة', student: 'طالب', instructor: 'مدرس', agent: 'وكيل', admin: 'مدير', academic: 'مشرف أكاديمي',
  finance: 'المالية', support: 'الدعم', self: 'ذاتي', bank_transfer: 'تحويل بنكي', cash: 'نقدًا', reading: 'القراءة',
  grammar: 'القواعد', vocabulary: 'المفردات', listening: 'الاستماع', writing: 'الكتابة', speaking: 'المحادثة',
  general: 'عام', announcement: 'إعلانات', batch: 'دفعة', insert: 'إضافة', update: 'تعديل', delete: 'حذف',
};

// Dynamic text: patterns tried when there is no exact match.
const PATTERNS: [RegExp, (...m: string[]) => string][] = [
  [/^(\d+) min ago$/, (_, n) => `منذ ${n} د`],
  [/^(\d+)h ago$/, (_, n) => `منذ ${n} س`],
  [/^(\d+)d ago$/, (_, n) => `منذ ${n} يوم`],
  [/^(\d+) active enrollments?$/, (_, n) => `${n} تسجيل نشط`],
  [/^(\d+) students?$/, (_, n) => `${n} طالب`],
  [/^(\d+) class(es)?$/, (_, n) => `${n} حصة`],
  [/^(\d+) lessons?$/, (_, n) => `${n} درس`],
  [/^(\d+) units?$/, (_, n) => `${n} وحدة`],
  [/^(\d+) questions?$/, (_, n) => `${n} سؤال`],
  [/^(\d+) responses?$/, (_, n) => `${n} رد`],
  [/^(\d+) minutes?$/, (_, n) => `${n} دقيقة`],
  [/^(\d+) min$/, (_, n) => `${n} د`],
  [/^(\d+) weeks?$/, (_, n) => `${n} أسابيع`],
  [/^(\d+) days?$/, (_, n) => `${n} أيام`],
  [/^(\d+) days?$/, (_, n) => `${n} يوم`],
  [/^(\d+) min$/, (_, n) => `${n} د`],
  [/^Due (.+)$/, (_, d) => `التسليم ${d}`],
  [/^(\d+) booked$/, (_, n) => `${n} محجوزة`],
  [/^(\d+) free times published$/, (_, n) => `نُشر ${n} وقتًا متاحًا`],
  [/^To do \((\d+)\)$/, (_, n) => `للإنجاز (${n})`],
  [/^Handed in \((\d+)\)$/, (_, n) => `مُسلّمة (${n})`],
  [/^Latest: (.+)$/, (_, n) => `الأحدث: ${n}`],
  [/^New badge: (.+)$/, (_, n) => `وسام جديد: ${n}`],
  [/^Your mark: (.+)$/, (_, n) => `درجتك: ${n}`],
  [/^Marks \(out of (.+)\)$/, (_, n) => `الدرجة (من ${n})`],
  [/^with (.+)$/, (_, n) => `مع ${n}`],
  [/^Words · (\d+)$/, (_, n) => `الكلمات · ${n}`],
  [/^Questions · (\d+)$/, (_, n) => `الأسئلة · ${n}`],
  [/^(\d+) words$/, (_, n) => `${n} كلمة`],
  [/^(\d+) questions ready\.?$/, (_, n) => `${n} سؤالًا جاهزًا.`],
  [/^(\d+) questions added$/, (_, n) => `أُضيف ${n} سؤالًا`],
  [/^Stop · (.+)$/, (_, t) => `إيقاف · ${t}`],
  [/^(\d+) Modules?$/, (_, n) => `${n} وحدات`],
  [/^(\d+) elements?$/, (_, n) => `${n} عناصر`],
  [/^(\d+) (Pts|pts|Points)$/, (_, n) => `${n} درجة`],
  [/^(\d+) Mins?$/, (_, n) => `${n} دقيقة`],
  [/^(\d+) agents only$/, (_, n) => `${n} وكلاء فقط`],
  [/^Version: (.+)$/, (_, v) => `النسخة: ${v}`],
  [/^Content Modules \((\d+)\)$/, (_, n) => `وحدات المحتوى (${n})`],
  [/^Content Elements · (\d+)$/, (_, n) => `عناصر المحتوى · ${n}`],
  [/^Your score: (\d+) \/ (\d+) \((\d+)%\)$/, (_, a, b, c) => `درجتك: ${a} / ${b} (${c}%)`],
  [/^Page (\d+) of (\d+)$/, (_, a, b) => `صفحة ${a} من ${b}`],
  [/^Welcome back, (.+?)( 👋)?$/, (_, n, e) => `مرحبًا بعودتك، ${n}${e ?? ''}`],
  [/^Welcome, (.+)$/, (_, n) => `مرحبًا، ${n}`],
];

export function tr(s: string): string | null {
  if (AR[s] !== undefined) return AR[s];
  // try without a trailing colon / asterisk
  const w = WORDS[s.toLowerCase().replace(/[\s-]+/g, '_')];
  if (w) return w;
  const m = s.match(/^(.*?)(\s*[:*])$/);
  if (m && AR[m[1]] !== undefined) return AR[m[1]] + m[2];
  for (const [re, fn] of PATTERNS) {
    const r = s.match(re);
    if (r) return fn(...r);
  }
  return null;
}

const SKIP = new Set(['SCRIPT', 'STYLE', 'CODE', 'PRE', 'TEXTAREA', 'INPUT', 'SVG', 'NOSCRIPT']);
const ATTRS = ['placeholder', 'title', 'aria-label'] as const;
const origText = new WeakMap<Text, string>(); // original English text of each node we changed
const lastSet = new WeakMap<Text, string>(); // what we last wrote, to tell our writes from React's
const origAttr = new WeakMap<Element, Record<string, string>>();
let lang: Lang = 'en';
let observer: MutationObserver | null = null;
let busy = false;

function skipped(el: Element | null): boolean {
  for (let e = el; e; e = e.parentElement) {
    if (SKIP.has(e.tagName.toUpperCase())) return true;
    if (e.hasAttribute('data-no-i18n')) return true;
  }
  return false;
}

function doText(n: Text) {
  const cur = n.data;
  // React replaced the text since we last translated it → the new value is the English source
  if (lastSet.get(n) !== cur) origText.set(n, cur);
  const src = origText.get(n) ?? cur;
  if (lang === 'en') {
    if (cur !== src) { n.data = src; lastSet.set(n, src); }
    return;
  }
  const t = src.trim();
  if (!t || !/[A-Za-z]/.test(t)) return;
  const ar = tr(t);
  const out = ar == null ? (/^[\u2066]/.test(t) ? src : src.replace(t, '\u2066' + t + '\u2069')) : src.replace(t, ar);
  if (out !== cur) { n.data = out; }
  lastSet.set(n, out);
}

function doEl(el: Element) {
  const o = origAttr.get(el) ?? {};
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (v == null) continue;
    const prev = (el as any).__i18n?.[a];
    if (prev !== v) o[a] = v; // set by React → English source
    const src = o[a] ?? v;
    const out = lang === 'ar' ? (tr(src.trim()) ?? src) : src;
    if (out !== v) el.setAttribute(a, out);
    ((el as any).__i18n ??= {})[a] = out;
  }
  origAttr.set(el, o);
}

function walk(root: Node) {
  if (root.nodeType === 3) { if (!skipped((root as Text).parentElement)) doText(root as Text); return; }
  if (root.nodeType !== 1) return;
  const el = root as Element;
  const tag = el.tagName.toUpperCase();
  if ((tag === 'INPUT' || tag === 'TEXTAREA') && !el.closest('[data-no-i18n]')) { doEl(el); return; }
  if (skipped(el)) return;
  doEl(el);
  const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode: (n) => {
      if (n.nodeType !== 1) return NodeFilter.FILTER_ACCEPT;
      const e = n as Element, t = e.tagName.toUpperCase();
      if (e.hasAttribute('data-no-i18n')) return NodeFilter.FILTER_REJECT;
      if (t === 'INPUT' || t === 'TEXTAREA') { doEl(e); return NodeFilter.FILTER_REJECT; } // placeholder only
      return SKIP.has(t) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    },
  });
  let n: Node | null;
  while ((n = tw.nextNode())) n.nodeType === 3 ? doText(n as Text) : doEl(n as Element);
}

function run(fn: () => void) {
  busy = true;
  try { fn(); } finally { observer?.takeRecords(); busy = false; }
}

function start() {
  if (observer) return;
  observer = new MutationObserver((recs) => {
    if (busy) return;
    run(() => {
      for (const r of recs) {
        if (r.type === 'characterData') doText(r.target as Text);
        else if (r.type === 'attributes') doEl(r.target as Element);
        else r.addedNodes.forEach(walk);
      }
    });
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] });
}

function apply(l: Lang) {
  lang = l;
  const html = document.documentElement;
  html.lang = l;
  html.dir = l === 'ar' ? 'rtl' : 'ltr';
  start();
  run(() => walk(document.body));
}

function initial(): Lang {
  try { return localStorage.getItem(KEY) === 'ar' ? 'ar' : 'en'; } catch { return 'en'; }
}

export const useLang = create<{ lang: Lang; toggle: () => void }>((set, get) => ({
  lang: initial(),
  toggle: () => {
    const next: Lang = get().lang === 'ar' ? 'en' : 'ar';
    try { localStorage.setItem(KEY, next); } catch { /* ignore */ }
    apply(next);
    set({ lang: next });
  },
}));

export function initI18n() { apply(useLang.getState().lang); }
