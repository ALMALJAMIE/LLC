import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Search } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { NAV, type NavItem } from '../../lib/nav';
import { DemoNotice, Page, PageHero } from '../../components/ui';

/** Short descriptions taken from the reference toolkit cards. */
const DESC: Record<string, string> = {
  '/student/live-sessions': 'Access and join your scheduled live video sessions and virtual meetings.',
  '/student/live-attendance': "Scan your instructor's QR code to record your physical class attendance securely.",
  '/student/absence-excuse': 'Submit medical certificates and absence excuses securely for admin approval.',
  '/student/courses': 'Browse programmes and enrol with your payment receipt.',
  '/student/assessments': 'Take a placement test to find the right level for you.',
  '/student/my-learning': 'Continue your lessons and track your progress.',
  '/student/timetable': 'All your upcoming classes, day by day.',
  '/student/attendance': 'Your attendance record across all courses.',
  '/student/exams': 'Upcoming and open exams for your batches.',
  '/student/exam-results': 'Scores, grades and teacher feedback.',
  '/student/certificates': 'Download your completion certificates.',
  '/student/language-report': 'Detailed performance and teacher evaluations per course.',
  '/student/class-report': 'Attendance, exam averages and final grade for each class.',
  '/student/finances': 'Payments, receipts and printable invoices.',
  '/instructor/absence-approvals': 'Review and approve student medical certificates and absence excuses for your batches.',
  '/instructor/live-sessions': 'Schedule, manage, and host live video sessions with your students in real-time.',
  '/instructor/live-attendance': 'Generate dynamic QR codes for students to check into physical classes securely.',
  '/instructor/lessons': 'Write lessons and send them for approval.',
  '/instructor/grading': 'Enter scores and feedback, then publish results.',
  '/instructor/reports': 'Attendance and performance summaries for your batches.',
  '/admin/live-sessions': 'Monitor ongoing virtual classes and make sure every class has a meeting link.',
  '/admin-academic-session': 'Define global academic terms, semesters, and years to establish the operational timeline.',
  '/academic-calendar': 'Synchronize institutional holidays, exam periods, and campus events centrally.',
  '/admin-categories': 'Structurally organize the curriculum into distinct subjects, departments, and branches.',
  '/admin-levels': 'Configure standardized proficiency tiers to categorize students accurately.',
  '/admin-batches': 'Orchestrate class groups, assign faculty leads, and monitor student capacity.',
  '/admin-curriculum': 'Architect detailed syllabi and learning roadmaps with clear educational outcomes.',
  '/admin/lessons/review': 'Review and approve lesson content submitted by instructors before publication.',
  '/admin/master-timetable': 'Global view of all active classes happening across the institution.',
  '/admin/substitutes': 'Manage and approve instructor requests for class cover and substitutions.',
  '/admin/absence-approvals': 'Process student absence excuses and medical certificates to update attendance.',
  '/admin-placement-tests': 'Engineer diagnostic entrance examinations to evaluate student proficiency levels.',
  '/admin/level-config': 'Define logic and scoring thresholds mapping placement results to specific tiers.',
  '/admin-rubrics-bank': 'Access a repository of standardized evaluation criteria to ensure consistent grading.',
  '/admin-placement-requests': 'Analyze and process student performance in diagnostic tests to finalize enrollment.',
  '/admin/exam-templates': 'Reusable exam blueprints for instructors.',
  '/admin-grading-scales': 'Letter grades and pass marks used across all exams.',
  '/admin-audit-logs': 'Who changed what and when.',
  '/admin/cms': 'Edit the public website, contacts and bank details.',
  '/admin/forms': 'Build forms and collect responses with a public link.',
  '/admin-accreditations': 'Licences and recognitions shown on the website.',
};
const TONES = ['bg-orange-50 text-orange-600', 'bg-indigo-50 text-indigo-600', 'bg-emerald-50 text-emerald-600', 'bg-pink-50 text-pink-600', 'bg-sky-50 text-sky-600', 'bg-purple-50 text-purple-600'];

export default function Toolkit() {
  const user = useAuth((s) => s.user);
  const [q, setQ] = useState('');
  if (!user) return null;
  const title = { student: 'Student Toolkit', instructor: 'Teacher Toolkit', agent: 'Agent Toolkit', admin: 'System Toolkit', academic: 'Academic Toolkit', finance: 'Finance Toolkit' }[user.role];
  const items = NAV[user.role].filter((n) => !n.to?.includes('toolkit'));
  const groups: [string, NavItem[]][] = [['Main Operations', items.filter((n) => n.to)], ...items.filter((n) => n.children).map((n) => [n.label, n.children!] as [string, NavItem[]])];
  const match = (n: NavItem) => `${n.label} ${DESC[n.to ?? ''] ?? ''}`.toLowerCase().includes(q.toLowerCase());
  let k = 0;
  return (
    <Page>
      {user.demo && <DemoNotice />}
      <PageHero badge={`${user.role === 'admin' ? 'Admin Console' : user.role === 'academic' ? 'Academic Office' : user.role === 'finance' ? 'Finance Office' : user.role[0].toUpperCase() + user.role.slice(1) + ' Portal'}`} title={title} illus="catalogue" subtitle="Every tool in your portal in one place. Search or pick a card to open it.">
        <div className="relative max-w-md"><Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tools..." className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-orange-200" /></div>
      </PageHero>
      {groups.map(([g, list]) => {
        const l = list.filter(match);
        if (!l.length) return null;
        return (
          <section key={g} className="mb-10">
            {groups.length > 1 && <h2 className="text-sm font-black uppercase tracking-wider text-slate-500 mb-4">{g}</h2>}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">{l.map((n) => {
              const I = n.icon; const tone = TONES[k++ % TONES.length];
              return (
                <Link key={n.to + n.label} to={n.to!} className="group bg-white rounded-3xl border border-slate-100 shadow-sm p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all flex flex-col">
                  <span className={`w-12 h-12 rounded-2xl grid place-items-center ${tone}`}><I size={22} /></span>
                  <p className="font-extrabold text-slate-900 mt-4">{n.label}</p>
                  {DESC[n.to!] && <p className="text-xs text-slate-500 mt-1 leading-relaxed">{DESC[n.to!]}</p>}
                  <span className="mt-auto pt-4 text-xs font-bold text-slate-400 group-hover:text-orange-600 flex items-center gap-1">Open <ArrowRight size={12} /></span>
                </Link>
              );
            })}</div>
          </section>
        );
      })}
    </Page>
  );
}
