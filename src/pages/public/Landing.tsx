import { Link } from 'react-router-dom';
import { ArrowRight, BrainCircuit, Briefcase, CircleCheck, Clock, FileSignature, Percent, Users, Wallet } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { SiteShell, WhatsAppFab } from './Site';

function Hero({ kicker, title, text, cta, to, icon: I, points }: { kicker: string; title: string; text: string; cta: string; to: string; icon: typeof Clock; points: { i: typeof Clock; t: string; d: string }[] }) {
  return (
    <SiteShell>
      <section className="max-w-6xl mx-auto px-5 lg:px-8 py-16 lg:py-24 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <span className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 grid place-items-center mb-6"><I size={26} /></span>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-orange-500">{kicker}</p>
          <h1 className="text-4xl lg:text-5xl font-extrabold text-slate-900 mt-3 tracking-tight">{title}</h1>
          <p className="text-lg text-slate-500 mt-5 leading-relaxed">{text}</p>
          <Link to={to} className="mt-8 inline-flex items-center gap-2 px-7 py-4 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-bold shadow-xl shadow-orange-200">{cta} <ArrowRight size={18} /></Link>
        </div>
        <div className="space-y-4">{points.map(({ i: P, t, d }) => (
          <div key={t} className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex gap-4"><span className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-600 grid place-items-center shrink-0"><P size={22} /></span><div><p className="font-extrabold text-slate-900">{t}</p><p className="text-sm text-slate-500">{d}</p></div></div>
        ))}</div>
      </section>
      <WhatsAppFab />
    </SiteShell>
  );
}

export function PlacementLanding() {
  const user = useAuth((s) => s.user);
  return <Hero kicker="Free placement test" title="Find your English level in 30 minutes" icon={BrainCircuit}
    text="Answer grammar, vocabulary and reading questions online. Your result is graded instantly and our teachers confirm the level that suits you best."
    cta={user ? 'Start the test' : 'Create a free account to start'} to={user?.role === 'student' ? '/student/assessments' : '/register'}
    points={[{ i: Clock, t: '30 minutes, online', d: 'Take it from home on your phone or laptop.' }, { i: CircleCheck, t: 'Instant result', d: 'See your score and suggested CEFR level right away.' }, { i: Users, t: 'Confirmed by a teacher', d: 'Our academic team reviews your result and advises the right course.' }]} />;
}

export function AgentsLanding() {
  return <Hero kicker="Partner program" title="Become an LLC education agent" icon={Briefcase}
    text="Introduce students to Language Leap Center and earn commission on every confirmed enrollment — all managed from your own agent portal."
    cta="Apply as an agent" to="/register?as=agent"
    points={[{ i: FileSignature, t: 'Apply & sign online', d: 'Register, upload your ID and sign the agreement electronically.' }, { i: Percent, t: 'Clear commission', d: 'See the commission on every course before you refer a student.' }, { i: Wallet, t: 'Withdraw your earnings', d: 'Request payouts to your bank or PayPal and track each payment.' }]} />;
}
