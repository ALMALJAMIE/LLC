import { useState } from 'react';
import { ChevronDown, Mail, MessageCircle, Phone, Search } from 'lucide-react';
import { CENTER } from '../../lib/site';
import { SiteShell, WhatsAppFab } from './Site';

const ITEMS: { cat: string; q: string; a: string }[] = [
  { cat: 'Getting started', q: 'How do I join a course?', a: 'Create a free account, take the placement test to find your level, then open “Buy Courses” in your portal, choose a course and batch, and send your enrollment request. We confirm it after checking your payment.' },
  { cat: 'Getting started', q: 'Is the placement test free?', a: 'Yes. The online placement test is free and takes about 30 minutes. Your suggested level appears as soon as you submit; our academic team then confirms it.' },
  { cat: 'Getting started', q: 'Which levels do you teach?', a: 'From complete beginners (A1) to advanced learners (C1), plus IELTS preparation, Business English and a kids programme.' },
  { cat: 'Payments', q: 'How do I pay?', a: 'By bank transfer. When you enroll, attach a photo or PDF of your transfer receipt. Once we verify it, your enrollment becomes active and your invoice is available under “Payment History”.' },
  { cat: 'Payments', q: 'Can I get an invoice?', a: 'Yes. Every confirmed payment has a downloadable PDF invoice in “Payment History”.' },
  { cat: 'Classes', q: 'Do you offer online and face-to-face classes?', a: 'Both. Online classes run live on Google Meet; the “Join” button opens 15 minutes before class. Face-to-face classes take place at our centre in Kuala Lumpur.' },
  { cat: 'Classes', q: 'How is attendance recorded?', a: 'For face-to-face classes, scan the QR code shown by your teacher with your phone camera, or type the class code in “Live Attendance”. Arriving more than 10 minutes late is recorded as late.' },
  { cat: 'Classes', q: 'What if I am sick and miss a class?', a: 'Submit a medical certificate under “Medical Leave & MC”. Approved dates are marked as excused and do not count against your attendance.' },
  { cat: 'Certificates', q: 'Will I get a certificate?', a: 'Yes. When you complete your course and final evaluation, your certificate appears in “My Certificates” and can be downloaded as a PDF.' },
  { cat: 'Account', q: 'I forgot my password.', a: 'Click “Forgot password?” on the sign-in page and we will email you a reset link.' },
  { cat: 'Agents', q: 'How do I become an agent?', a: 'Register and choose “Apply as Agent”. After we approve your application and you sign the agreement online, you can enroll students and earn commission from your agent portal.' },
];

export function FAQ({ limit, q = '' }: { limit?: number; q?: string }) {
  const [open, setOpen] = useState<number | null>(0);
  const list = ITEMS.filter((i) => `${i.q} ${i.a}`.toLowerCase().includes(q.toLowerCase())).slice(0, limit);
  return (
    <div className="space-y-3">
      {list.map((it, i) => (
        <div key={it.q} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <button onClick={() => setOpen(open === i ? null : i)} className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left">
            <span className="font-bold text-slate-900">{it.q}</span>
            <ChevronDown size={18} className={`text-slate-400 shrink-0 transition-transform ${open === i ? 'rotate-180' : ''}`} />
          </button>
          {open === i && <p className="px-6 pb-5 -mt-1 text-slate-600 leading-relaxed">{it.a}</p>}
        </div>
      ))}
      {!list.length && <p className="text-center text-slate-400 py-8">No answer matches your search. Contact us below.</p>}
    </div>
  );
}

export default function Help() {
  const [q, setQ] = useState('');
  return (
    <SiteShell>
      <section className="bg-[#0b1a3a] text-white">
        <div className="max-w-3xl mx-auto px-5 py-16 text-center">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-orange-400">Help centre</p>
          <h1 className="text-4xl lg:text-5xl font-extrabold mt-3 tracking-tight">How can we help?</h1>
          <div className="relative mt-8 max-w-xl mx-auto"><Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search questions…" className="w-full pl-11 pr-4 py-4 rounded-2xl bg-white text-slate-900 outline-none focus:ring-4 focus:ring-orange-400/30" /></div>
        </div>
      </section>
      <section className="max-w-3xl mx-auto px-5 py-14"><FAQ q={q} /></section>
      <section className="max-w-5xl mx-auto px-5 pb-20 grid sm:grid-cols-3 gap-5">
        <a href={`https://wa.me/${CENTER.whatsapp}`} target="_blank" rel="noreferrer" className="bg-white rounded-4xl p-7 border border-slate-100 shadow-sm hover:shadow-lg transition-all"><span className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 grid place-items-center mb-4"><MessageCircle size={22} /></span><p className="font-extrabold text-slate-900">WhatsApp</p><p className="text-sm text-slate-500">{CENTER.phone}</p></a>
        <a href={`mailto:${CENTER.email}`} className="bg-white rounded-4xl p-7 border border-slate-100 shadow-sm hover:shadow-lg transition-all"><span className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-600 grid place-items-center mb-4"><Mail size={22} /></span><p className="font-extrabold text-slate-900">Email</p><p className="text-sm text-slate-500">{CENTER.email}</p></a>
        <a href={`tel:${CENTER.phone.replace(/[^\d+]/g, '')}`} className="bg-white rounded-4xl p-7 border border-slate-100 shadow-sm hover:shadow-lg transition-all"><span className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 grid place-items-center mb-4"><Phone size={22} /></span><p className="font-extrabold text-slate-900">Call</p><p className="text-sm text-slate-500">{CENTER.phone}</p></a>
      </section>
      <WhatsAppFab />
    </SiteShell>
  );
}
