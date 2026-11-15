import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Award, BookOpen, BrainCircuit, CalendarCheck, CircleCheck, Globe, GraduationCap, Handshake, Laptop, MapPin, PlayCircle, QrCode, Sparkles, Star, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { money } from '../../lib/db';
import { useEffect, useState } from 'react';
import { CoverImg } from '../../components/media';
import { SiteShell, WhatsAppFab } from './Site';
import { FAQ } from './Help';

type C = { id: number; code: string; title: string; description: string | null; price: number; currency: string; delivery: string; duration_weeks: number | null; level: { name: string; cefr: string | null } | null };

export function usePublicCourses(limit?: number) {
  const [data, setData] = useState<C[] | null>(null);
  useEffect(() => {
    let q = supabase.from('courses').select('id,code,title,description,price,currency,delivery,duration_weeks, level:levels(name,cefr)').eq('status', 'published').order('code');
    if (limit) q = q.limit(limit);
    q.then(({ data }) => setData((data ?? []) as unknown as C[]));
  }, [limit]);
  return data;
}

const LEVELS = [['A1', 'Beginner'], ['A2', 'Elementary'], ['A2+', 'Pre-Intermediate'], ['B1', 'Intermediate'], ['B2', 'Upper-Int.'], ['C1', 'Advanced']];

export function CourseCard({ c }: { c: C }) {
  return (
    <Link to={`/courses?c=${c.id}`} className="group bg-white rounded-4xl p-4 border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all flex flex-col">
      <div className="relative h-44 rounded-3xl overflow-hidden mb-4"><CoverImg className="w-full h-full group-hover:scale-110 transition-transform duration-700" alt={c.title} />
        {c.level?.cefr && <span className="absolute top-3 left-3 bg-white/90 text-indigo-700 text-[10px] font-black px-2 py-0.5 rounded-full">{c.level.cefr}</span>}</div>
      <div className="px-2 flex-1 flex flex-col">
        <p className="text-[10px] font-black uppercase tracking-wider text-orange-500">{c.delivery.replace(/_/g, ' ')} · {c.duration_weeks ?? '—'} weeks</p>
        <h3 className="text-lg font-extrabold text-slate-900 mt-1 group-hover:text-indigo-700">{c.title}</h3>
        <p className="text-sm text-slate-500 line-clamp-2 mt-1 flex-1">{c.description}</p>
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-50"><span className="font-black text-slate-900">{Number(c.price) ? money(c.price, c.currency) : 'Free'}</span><span className="text-xs font-black uppercase text-indigo-600 flex items-center gap-1">Details <ArrowRight size={14} /></span></div>
      </div>
    </Link>
  );
}

export default function Home() {
  const courses = usePublicCourses(6);
  const { hash } = useLocation();
  useEffect(() => { if (hash) setTimeout(() => document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth' }), 100); }, [hash]);
  return (
    <SiteShell>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-indigo-100/60 blur-3xl" />
        <div className="absolute top-40 -left-40 w-[400px] h-[400px] rounded-full bg-orange-100/60 blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-5 lg:px-8 pt-16 pb-20 lg:pt-24 lg:pb-28 grid lg:grid-cols-2 gap-14 items-center">
          <div>
            <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-full text-xs font-bold text-slate-600 shadow-sm"><Sparkles size={14} className="text-orange-500" />Online & face-to-face in Kuala Lumpur</span>
            <h1 className="mt-6 text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.05]">Your leap to <span className="text-indigo-600">fluent</span> <span className="relative whitespace-nowrap">English<svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 12" fill="none"><path d="M2 9C50 3 150 3 198 9" stroke="#e9a823" strokeWidth="5" strokeLinecap="round" /></svg></span></h1>
            <p className="mt-6 text-lg text-slate-500 leading-relaxed max-w-lg">Structured courses from beginner to advanced, small classes with qualified teachers, and an online platform that keeps your lessons, timetable and progress in one place.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/placement" className="inline-flex items-center gap-2 px-6 py-4 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-bold shadow-xl shadow-orange-200 transition-all"><BrainCircuit size={18} /> Take the free placement test</Link>
              <Link to="/courses" className="inline-flex items-center gap-2 px-6 py-4 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 text-slate-800 font-bold shadow-sm">Browse courses <ArrowRight size={18} /></Link>
            </div>
            <div className="mt-10 flex flex-wrap gap-6 text-sm text-slate-500">{['Certificates on completion', 'Small classes', 'Flexible schedules'].map((t) => <span key={t} className="flex items-center gap-2"><CircleCheck size={16} className="text-emerald-500" />{t}</span>)}</div>
          </div>
          <div className="relative hidden lg:block">
            <div className="bg-[#0b1a3a] rounded-[2.5rem] p-8 text-white shadow-2xl rotate-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-orange-400">My Learning</p>
              <p className="text-2xl font-extrabold mt-1">English Intermediate</p>
              <div className="mt-6 space-y-3">{['Unit 4 · Talking about the past', 'Unit 5 · Making plans', 'Unit 6 · At work'].map((u, i) => (
                <div key={u} className="flex items-center gap-3 p-3 rounded-2xl bg-white/5"><span className={`w-8 h-8 rounded-full grid place-items-center ${i === 0 ? 'bg-emerald-500' : 'bg-white/10'}`}>{i === 0 ? <CircleCheck size={16} /> : <PlayCircle size={16} />}</span><span className="text-sm font-semibold">{u}</span></div>
              ))}</div>
              <div className="mt-6"><div className="flex justify-between text-xs text-slate-300 mb-1.5"><span>Progress</span><span>64%</span></div><div className="h-2.5 rounded-full bg-white/10"><div className="h-full w-[64%] rounded-full bg-orange-500" /></div></div>
            </div>
            <div className="absolute -bottom-8 -left-10 bg-white rounded-3xl p-5 shadow-xl border border-slate-100 -rotate-2 w-72">
              <p className="text-[10px] font-black uppercase text-slate-400">Placement result</p>
              <p className="text-xl font-black text-indigo-700 whitespace-nowrap">B1 · Intermediate</p>
              <div className="flex gap-0.5 mt-2">{[1, 2, 3, 4, 5].map((i) => <Star key={i} size={14} className="fill-orange-400 text-orange-400" />)}</div>
            </div>
            <div className="absolute -top-6 -right-4 bg-white rounded-2xl p-4 shadow-xl border border-slate-100 flex items-center gap-3"><span className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 grid place-items-center"><QrCode size={20} /></span><div><p className="text-xs font-black text-slate-800">Checked in</p><p className="text-[11px] text-slate-400">Speaking · 10:00</p></div></div>
          </div>
        </div>
      </section>

      {/* Levels strip */}
      <section className="bg-white border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 py-10">
          <p className="text-center text-xs font-black uppercase tracking-[0.25em] text-slate-400 mb-6">Courses for every level (CEFR)</p>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">{LEVELS.map(([c, n], i) => (
            <div key={c} className="text-center p-4 rounded-2xl bg-slate-50 border border-slate-100"><p className="text-2xl font-black" style={{ color: `hsl(${215 - i * 4} 70% ${42 - i * 3}%)` }}>{c}</p><p className="text-xs font-bold text-slate-500">{n}</p></div>
          ))}</div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="max-w-7xl mx-auto px-5 lg:px-8 py-24">
        <div className="text-center max-w-2xl mx-auto mb-14"><p className="text-xs font-black uppercase tracking-[0.25em] text-orange-500">How it works</p><h2 className="text-4xl font-extrabold text-slate-900 mt-3 tracking-tight">From your first test to your certificate</h2></div>
        <div className="grid md:grid-cols-4 gap-6">{[
          { i: Users, t: 'Create your account', d: 'Sign up in a minute with your email.' },
          { i: BrainCircuit, t: 'Find your level', d: 'Take the online placement test — graded instantly.' },
          { i: CalendarCheck, t: 'Join a batch', d: 'Pick a course and schedule; pay by bank transfer.' },
          { i: Award, t: 'Learn & get certified', d: 'Attend classes, follow lessons, earn your certificate.' },
        ].map(({ i: I, t, d }, k) => (
          <div key={t} className="relative bg-white rounded-4xl p-7 border border-slate-100 shadow-sm">
            <span className="absolute top-6 right-6 text-5xl font-black text-slate-100">{k + 1}</span>
            <span className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 grid place-items-center mb-5"><I size={24} /></span>
            <h3 className="font-extrabold text-slate-900 text-lg">{t}</h3><p className="text-sm text-slate-500 mt-1">{d}</p>
          </div>
        ))}</div>
      </section>

      {/* Courses */}
      <section className="bg-white border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 py-24">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10"><div><p className="text-xs font-black uppercase tracking-[0.25em] text-orange-500">Our courses</p><h2 className="text-4xl font-extrabold text-slate-900 mt-3 tracking-tight">Start where you are</h2></div>
            <Link to="/courses" className="inline-flex items-center gap-2 text-sm font-bold text-indigo-600">See all courses <ArrowRight size={16} /></Link></div>
          {courses === null ? <p className="text-slate-400">Loading courses…</p> : <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">{courses.map((c) => <CourseCard key={c.id} c={c} />)}</div>}
        </div>
      </section>

      {/* Ways to learn */}
      <section className="max-w-7xl mx-auto px-5 lg:px-8 py-24 grid lg:grid-cols-3 gap-6">
        {[
          { i: Laptop, t: 'Live online classes', d: 'Join from anywhere on Google Meet. The link opens 15 minutes before class.', c: 'bg-sky-50 text-sky-600' },
          { i: MapPin, t: 'Face to face in KL', d: 'Small classrooms, real conversation, QR check-in in seconds.', c: 'bg-orange-50 text-orange-600' },
          { i: BookOpen, t: 'Lessons any time', d: 'Videos, notes and worksheets for every unit — study at your own pace.', c: 'bg-emerald-50 text-emerald-600' },
        ].map(({ i: I, t, d, c }) => (
          <div key={t} className="bg-white rounded-4xl p-8 border border-slate-100 shadow-sm"><span className={`w-14 h-14 rounded-2xl grid place-items-center mb-5 ${c}`}><I size={26} /></span><h3 className="text-xl font-extrabold text-slate-900">{t}</h3><p className="text-slate-500 mt-2">{d}</p></div>
        ))}
      </section>

      {/* Agents */}
      <section className="max-w-7xl mx-auto px-5 lg:px-8 pb-24">
        <div className="bg-[#0b1a3a] rounded-[2.5rem] p-10 lg:p-14 text-white grid lg:grid-cols-2 gap-8 items-center relative overflow-hidden">
          <div className="absolute -right-20 -bottom-20 w-80 h-80 rounded-full bg-orange-500/15" />
          <div className="relative"><span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-orange-400"><Handshake size={16} />Partner program</span>
            <h2 className="text-4xl font-extrabold mt-3 tracking-tight">Refer students. Earn commission.</h2>
            <p className="text-slate-300 mt-3 max-w-md">Education agents can enroll students, track each application and withdraw their earnings from their own portal.</p></div>
          <div className="relative flex lg:justify-end"><Link to="/agents" className="inline-flex items-center gap-2 px-6 py-4 rounded-2xl bg-orange-500 hover:bg-orange-600 font-bold shadow-xl">Become an agent <ArrowRight size={18} /></Link></div>
        </div>
      </section>

      {/* FAQ preview */}
      <section className="bg-white border-t border-slate-100">
        <div className="max-w-3xl mx-auto px-5 lg:px-8 py-24">
          <div className="text-center mb-10"><p className="text-xs font-black uppercase tracking-[0.25em] text-orange-500">Questions</p><h2 className="text-4xl font-extrabold text-slate-900 mt-3 tracking-tight">Frequently asked</h2></div>
          <FAQ limit={5} />
          <div className="text-center mt-8"><Link to="/help" className="text-sm font-bold text-indigo-600">See all questions →</Link></div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-5 lg:px-8 py-20 text-center">
        <GraduationCap size={40} className="mx-auto text-indigo-600" />
        <h2 className="text-4xl font-extrabold text-slate-900 mt-4 tracking-tight">Ready to take the leap?</h2>
        <p className="text-slate-500 mt-3">Create your free account and find your level today.</p>
        <div className="mt-8 flex justify-center gap-3 flex-wrap"><Link to="/register" className="px-7 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-xl shadow-indigo-200">Create free account</Link>
          <a href="#how" className="px-7 py-4 rounded-2xl bg-white border border-slate-200 font-bold text-slate-700 flex items-center gap-2"><Globe size={18} />How it works</a></div>
      </section>
      <WhatsAppFab />
    </SiteShell>
  );
}
