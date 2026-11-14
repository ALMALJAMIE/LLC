import type { CSSProperties } from 'react';
import {
  Award, BarChart3, BookOpen, Bell, CalendarDays, ClipboardCheck, ClipboardList, Coins, FileCheck2, FileText,
  GraduationCap, Handshake, Layers, LayoutDashboard, LibraryBig, ListChecks, MessageSquareHeart, NotebookPen,
  PenLine, Presentation, Receipt, ScrollText, ShieldCheck, Star, UserCheck, UserPlus, Users, Wallet, type LucideIcon,
} from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import mark from '../assets/llc-mark.png';

type Common = { className?: string; style?: CSSProperties };

/** LLC mark (used wherever the reference layout shows its logo). */
export function BrandLogo({ className, style }: Common) {
  return <img src={mark} alt="Language Leap Center" className={className} style={style} />;
}

/** Full horizontal lock-up: mark + LANGUAGE LEAP / CENTER (as in the LLC logo). */
export function BrandLockup({ className = '', dark = false }: { className?: string; dark?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <img src={mark} alt="" className="h-10 w-auto" />
      <span className="flex flex-col leading-none">
        <span className={`font-brand font-extrabold tracking-[0.12em] text-[15px] ${dark ? 'text-white' : 'text-indigo-800'}`}>LANGUAGE LEAP</span>
        <span className="font-brand font-bold tracking-[0.32em] text-[12px] text-orange-500 mt-1">CENTER</span>
      </span>
    </span>
  );
}

const ILLUS: Record<string, LucideIcon> = {
  calendar: CalendarDays, certificate: Award, academic: GraduationCap, accredration: ShieldCheck, agreement: Handshake,
  applications: ClipboardCheck, attendance: UserCheck, audit: ScrollText, batch: Layers, catalogue: LibraryBig,
  cms: PenLine, commission: Coins, courses: BookOpen, curriculum: NotebookPen, dashboard: LayoutDashboard,
  documents: FileText, earnings: Wallet, enrollment: UserPlus, exam: ClipboardList, feedback: MessageSquareHeart,
  finance: BarChart3, grade: FileCheck2, grading: ListChecks, lesson: Presentation, levels: Layers, my_batches: Layers,
  new: UserPlus, notifiaction: Bell, payment: Receipt, payouts: Wallet, profile_new: Users, reports: BarChart3,
  results: FileCheck2, review: Star, rules: ScrollText, session: CalendarDays, users: Users,
};

/** Header illustration slot: LLC-styled artwork in place of the reference illustrations.
 *  Rendered as an <img> with intrinsic size so the original sizing classes behave the same. */
const illusCache: Record<string, string> = {};
function illusUrl(name: string) {
  if (illusCache[name]) return illusCache[name];
  const Icon = ILLUS[name] ?? GraduationCap;
  const svg = renderToStaticMarkup(
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1f66c8" />
          <stop offset="1" stopColor="#0a2852" />
        </linearGradient>
      </defs>
      <circle cx="200" cy="150" r="128" fill="#eef4fc" />
      <circle cx="318" cy="64" r="22" fill="#fbeec6" />
      <circle cx="78" cy="236" r="14" fill="#d9e6f8" />
      <rect x="120" y="78" width="160" height="150" rx="28" fill="url(#g)" />
      <rect x="150" y="226" width="100" height="14" rx="7" fill="#e9a823" />
      <path d="M70 92 l10 -18 l10 18 z" fill="#e9a823" opacity=".8" />
      <rect x="300" y="200" width="26" height="26" rx="6" fill="#4a86d6" opacity=".35" transform="rotate(18 313 213)" />
      <g transform="translate(160 113) scale(3.333)">
        <Icon color="#ffffff" strokeWidth={1.6} width={24} height={24} />
      </g>
    </svg>,
  );
  return (illusCache[name] = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
}

export function Illus({ name, className = '', style }: Common & { name: string }) {
  return <img src={illusUrl(name)} alt="" aria-hidden className={className} style={style} />;
}

function initials(name: string) {
  return (name || 'U').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export function AvatarImg({ className = '', name = '', style }: Common & { name?: string }) {
  return (
    <span className={`${className} inline-grid place-items-center bg-indigo-100 text-indigo-700 font-bold`} style={style}>
      <span className="text-[0.8em]">{initials(name)}</span>
    </span>
  );
}

/** Course/category cover placeholder (reference cover images are not reused). */
export function CoverImg({ className = '', alt = '', style }: Common & { alt?: string }) {
  return (
    <div className={`${className} relative overflow-hidden bg-gradient-to-br from-indigo-700 via-indigo-600 to-indigo-900`} style={style} role="img" aria-label={alt}>
      <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-orange-400/30" />
      <div className="absolute -left-4 -bottom-8 w-28 h-28 rounded-full bg-white/10" />
      <BookOpen className="absolute inset-0 m-auto w-1/4 h-1/4 text-white/80" strokeWidth={1.5} />
    </div>
  );
}
