import { lazy } from 'react';
import type { Role } from '../lib/nav';

type C = ReturnType<typeof lazy>;
const ManageProfile = lazy(() => import('./shared/ManageProfile'));
const TaskManager = lazy(() => import('./shared/TaskManager'));
const AcademicCalendar = lazy(() => import('./shared/AcademicCalendar'));
const ClassScheduler = lazy(() => import('./shared/ClassScheduler'));
const AbsenceApprovals = lazy(() => import('./shared/AbsenceApprovals'));
const named = <K extends string>(loader: () => Promise<Record<K, React.ComponentType>>, k: K) => lazy(() => loader().then((m) => ({ default: m[k] })));
const CurriculumList = named(() => import('./shared/Curriculum'), 'CurriculumList');
const CurriculumBuilder = named(() => import('./shared/Curriculum'), 'CurriculumBuilder');
const CurriculumPreview = named(() => import('./shared/Curriculum'), 'CurriculumPreview');
const FormBuilder = lazy(() => import('./forms/Forms'));
const Toolkit = lazy(() => import('./shared/Toolkit'));

/** Screens that are connected to the database. They replace the static layout for the same route. */
export const WIRED: Record<string, Partial<Record<Role, C>>> = {
  '/manage-profile': { student: ManageProfile, instructor: ManageProfile, agent: ManageProfile, admin: ManageProfile },
  '/student/reminders': { student: TaskManager },
  '/instructor/reminders': { instructor: TaskManager },
  '/admin/reminders': { admin: TaskManager },
  '/academic-calendar': { student: AcademicCalendar, instructor: AcademicCalendar, admin: AcademicCalendar },
  '/student-dashboard': { student: lazy(() => import('./student/StudentDashboard')) },
  '/student/timetable': { student: lazy(() => import('./student/StudentTimetable')) },
  '/student/live-sessions': { student: lazy(() => import('./student/StudentLiveSessions')) },
  '/student/attendance': { student: lazy(() => import('./student/StudentAttendance')) },
  '/student/live-attendance': { student: lazy(() => import('./student/StudentLiveAttendance')) },
  '/student/absence-excuse': { student: lazy(() => import('./student/StudentAbsence')) },
  '/student/exams': { student: lazy(() => import('./student/StudentExams')) },
  '/student/exam-results': { student: lazy(() => import('./student/StudentResults')) },
  '/student/certificates': { student: lazy(() => import('./student/StudentCertificates')) },
  '/student/reviews': { student: lazy(() => import('./student/StudentReviews')) },
  '/admin-dashboard': { admin: lazy(() => import('./admin/AdminDashboard')) },
  '/admin-users': { admin: lazy(() => import('./admin/AdminUsers')) },
  '/admin-enrollments': { admin: lazy(() => import('./admin/AdminEnrollments')) },
  '/admin-financials': { admin: lazy(() => import('./admin/AdminFinancials')) },
  '/admin-categories': { admin: named(() => import('./admin/Taxonomy'), 'AdminCategories') },
  '/admin-levels': { admin: named(() => import('./admin/Taxonomy'), 'AdminLevels') },
  '/admin-academic-session': { admin: named(() => import('./admin/Taxonomy'), 'AdminSessions') },
  '/admin-courses': { admin: named(() => import('./admin/Courses'), 'AdminCourses') },
  '/admin-batches': { admin: named(() => import('./admin/Courses'), 'AdminBatches') },
  '/admin/timetable': { admin: ClassScheduler },
  '/admin/absence-approvals': { admin: AbsenceApprovals },
  '/admin-reviews': { admin: named(() => import('./admin/AdminMisc'), 'AdminReviews') },
  '/admin-certificate-templates': { admin: named(() => import('./admin/AdminMisc'), 'AdminCertificates') },
  '/admin/enroll-student': { admin: named(() => import('./admin/AdminMisc'), 'AdminEnrollStudent') },
  '/admin/new-students': { admin: named(() => import('./admin/AdminMisc'), 'AdminNewStudents') },
  '/instructor-dashboard': { instructor: lazy(() => import('./instructor/InstructorDashboard')) },
  '/instructor/batches': { instructor: named(() => import('./instructor/InstructorPages'), 'InstructorBatches') },
  '/instructor/timetable': { instructor: named(() => import('./instructor/InstructorPages'), 'InstructorTimetable') },
  '/instructor/live-sessions': { instructor: ClassScheduler },
  '/instructor/live-attendance': { instructor: named(() => import('./instructor/InstructorPages'), 'InstructorLiveAttendance') },
  '/instructor/absence-approvals': { instructor: AbsenceApprovals },
  '/instructor/exams': { instructor: named(() => import('./instructor/InstructorPages'), 'InstructorExams') },
  '/instructor/grading': { instructor: named(() => import('./instructor/InstructorPages'), 'InstructorGrading') },
  '/instructor/reports': { instructor: named(() => import('./instructor/InstructorPages'), 'InstructorReports') },
  '/instructor/new-students': { instructor: named(() => import('./instructor/InstructorPages'), 'InstructorNewStudents') },
  '/agent-dashboard': { agent: named(() => import('./agent/AgentPages'), 'AgentDashboard') },
  '/agent/contract': { agent: named(() => import('./agent/AgentPages'), 'AgentContract') },
  '/agent/programmes': { agent: named(() => import('./agent/AgentPages'), 'AgentProgrammes') },
  '/agent/timetable': { agent: named(() => import('./agent/AgentPages'), 'AgentTimetable') },
  '/agent/enroll-student': { agent: named(() => import('./agent/AgentPages'), 'AgentEnrollStudent') },
  '/agent/enrollments': { agent: named(() => import('./agent/AgentPages'), 'AgentEnrollments') },
  '/agent/earnings': { agent: named(() => import('./agent/AgentPages'), 'AgentEarnings') },
  '/agent/payouts': { agent: named(() => import('./agent/AgentPages'), 'AgentPayouts') },
  '/agent/bank-details': { agent: named(() => import('./agent/AgentPages'), 'AgentBankDetails') },
  '/admin/agent-applications': { admin: named(() => import('./admin/AgentAdmin'), 'AdminAgentApplications') },
  '/admin/agent-contracts': { admin: named(() => import('./admin/AgentAdmin'), 'AdminAgentContracts') },
  '/admin-document-requirements': { admin: named(() => import('./admin/AgentAdmin'), 'AdminAgentDocs') },
  '/admin-student-document-requirements': { admin: named(() => import('./admin/AgentAdmin'), 'AdminStudentDocs') },
  '/admin/agent-enrollments': { admin: named(() => import('./admin/AgentAdmin'), 'AdminAgentEnrollments') },
  '/admin/agent-earnings': { admin: named(() => import('./admin/AgentAdmin'), 'AdminAgentEarnings') },
  '/admin/agent-payouts': { admin: named(() => import('./admin/AgentAdmin'), 'AdminAgentPayouts') },
  '/admin/commission-rules': { admin: named(() => import('./admin/AgentAdmin'), 'AdminCommissionRules') },
  '/admin-curriculum': { admin: CurriculumList },
  '/admin-curriculum/:id/edit': { admin: CurriculumBuilder },
  '/admin-curriculum/:id/view': { admin: CurriculumPreview },
  '/instructor/lessons': { instructor: CurriculumList },
  '/instructor/lessons/:id/edit': { instructor: CurriculumBuilder },
  '/instructor/lessons/:id/view': { instructor: CurriculumPreview },
  '/admin/lessons/review': { admin: lazy(() => import('./admin/LessonApprovals')) },
  '/student/assignments': { student: named(() => import('./shared/Homework'), 'StudentHomework') },
  '/instructor/assignments': { instructor: named(() => import('./shared/Homework'), 'StaffHomework') },
  '/admin/assignments': { admin: named(() => import('./shared/Homework'), 'StaffHomework') },
  '/student/private-sessions': { student: named(() => import('./shared/PrivateSessions'), 'StudentPrivateSessions') },
  '/instructor/private-sessions': { instructor: named(() => import('./shared/PrivateSessions'), 'StaffPrivateSessions') },
  '/admin/private-sessions': { admin: named(() => import('./shared/PrivateSessions'), 'StaffPrivateSessions') },
  '/admin/rooms': { admin: named(() => import('./shared/Academic'), 'Rooms') },
  '/admin/instructors': { admin: named(() => import('./shared/Academic'), 'InstructorsOverview') },
  '/admin/attendance-corrections': { admin: named(() => import('./shared/Academic'), 'AttendanceCorrections') },
  '/admin/grade-moderation': { admin: named(() => import('./shared/Academic'), 'GradeModeration') },
  '/instructor/availability': { instructor: named(() => import('./shared/Academic'), 'MyAvailability') },
  '/instructor/attendance-corrections': { instructor: named(() => import('./shared/Academic'), 'AttendanceCorrections') },
  '/student/course/:id': { student: lazy(() => import('./student/CoursePlayer')) },
  '/student/assessments': { student: named(() => import('./placement/Student'), 'StudentPlacement') },
  '/student/placement/:id': { student: named(() => import('./placement/Student'), 'PlacementTake') },
  '/admin-placement-tests': { admin: named(() => import('./placement/Tests'), 'PlacementTestsAdmin') },
  '/admin-placement-tests/:id/manage': { admin: named(() => import('./placement/Tests'), 'TestBuilder') },
  '/admin-placement-tests/:id/details': { admin: named(() => import('./placement/Tests'), 'TestDetails') },
  '/instructor/placement-tests': { instructor: named(() => import('./placement/Tests'), 'PlacementTestsAdmin') },
  '/instructor/placement-tests/:id/manage': { instructor: named(() => import('./placement/Tests'), 'TestBuilder') },
  '/instructor/placement-tests/:id/details': { instructor: named(() => import('./placement/Tests'), 'TestDetails') },
  '/admin/level-config': { admin: named(() => import('./placement/Staff'), 'LevelConfig') },
  '/admin-placement-requests': { admin: named(() => import('./placement/Staff'), 'PlacementResults') },
  '/instructor/placement-requests': { instructor: named(() => import('./placement/Staff'), 'PlacementResults') },
  '/student/community': { student: named(() => import('./community/Community'), 'CommunityAccess') },
  '/instructor/community': { instructor: named(() => import('./community/Community'), 'CommunityAccess') },
  '/admin/community': { admin: named(() => import('./community/Community'), 'CommunityAccess') },
  '/agent/community': { agent: named(() => import('./community/Community'), 'CommunityAccess') },
  '/student/community/feed/:hub': { student: named(() => import('./community/Community'), 'CommunityHub') },
  '/instructor/community/feed/:hub': { instructor: named(() => import('./community/Community'), 'CommunityHub') },
  '/admin/community/feed/:hub': { admin: named(() => import('./community/Community'), 'CommunityHub') },
  '/agent/community/feed/:hub': { agent: named(() => import('./community/Community'), 'CommunityHub') },
  '/student/courses': { student: lazy(() => import('./student/StudentCourses')) },
  '/student/my-learning': { student: lazy(() => import('./student/StudentMyLearning')) },
  '/student/finances': { student: lazy(() => import('./student/StudentFinances')) },
  '/admin/cms': { admin: named(() => import('./admin/AdminTools'), 'AdminCms') },
  '/admin-accreditations': { admin: named(() => import('./admin/AdminTools'), 'AdminAccreditations') },
  '/admin-grading-scales': { admin: named(() => import('./admin/AdminTools'), 'AdminGradingScales') },
  '/admin/exam-templates': { admin: named(() => import('./admin/AdminTools'), 'AdminExamTemplates') },
  '/admin-rubrics-bank': { admin: named(() => import('./admin/AdminTools'), 'AdminRubrics') },
  '/admin/substitutes': { admin: named(() => import('./admin/AdminTools'), 'AdminSubstitutes') },
  '/admin/master-timetable': { admin: named(() => import('./admin/AdminTools'), 'AdminMasterTimetable') },
  '/admin/live-sessions': { admin: named(() => import('./admin/AdminTools'), 'AdminLiveSessions') },
  '/admin-audit-logs': { admin: named(() => import('./admin/AdminTools'), 'AdminAuditLogs') },
  '/admin/forms': { admin: FormBuilder },
  '/agent/forms': { agent: FormBuilder },
  '/student/toolkit': { student: Toolkit },
  '/instructor/toolkit': { instructor: Toolkit },
  '/admin/toolkit': { admin: Toolkit },
  '/student/class-report': { student: named(() => import('./student/StudentReports'), 'StudentClassReport') },
  '/student/language-report': { student: named(() => import('./student/StudentReports'), 'StudentLanguageReport') },
};

// ---------------- Academic supervisor ----------------
// Their own pages…
Object.assign(WIRED, {
  '/academic-dashboard': { academic: lazy(() => import('./academic/AcademicDashboard')) },
  '/academic/toolkit': { academic: Toolkit },
  '/academic/reminders': { academic: TaskManager },
  '/academic/community': { academic: named(() => import('./community/Community'), 'CommunityAccess') },
  '/academic/community/feed/:hub': { academic: named(() => import('./community/Community'), 'CommunityHub') },
});
// …and the admin's academic pages, shared with the same screens. Money, users, agents, CMS and the audit log stay admin-only.
for (const path of [
  '/manage-profile', '/academic-calendar', '/admin/live-sessions',
  '/admin-academic-session', '/admin-categories', '/admin-levels', '/admin-courses', '/admin-batches',
  '/admin-curriculum', '/admin-curriculum/:id/edit', '/admin-curriculum/:id/view', '/admin/lessons/review', '/admin/timetable', '/admin/master-timetable', '/admin/substitutes', '/admin/absence-approvals',
  '/admin-placement-tests', '/admin-placement-tests/:id/manage', '/admin-placement-tests/:id/details', '/admin/level-config', '/admin-placement-requests',
  '/admin/assignments', '/admin/private-sessions', '/admin/rooms', '/admin/instructors', '/admin/attendance-corrections', '/admin/grade-moderation', '/admin/exam-templates', '/admin-grading-scales', '/admin-rubrics-bank', '/admin-certificate-templates', '/admin-reviews',
]) {
  const c = WIRED[path]?.admin;
  if (c) WIRED[path] = { ...WIRED[path], academic: c };
  else console.warn('academic route has no admin screen:', path);
}

// ---------------- Finance officer ----------------
Object.assign(WIRED, {
  '/finance-dashboard': { finance: lazy(() => import('./finance/FinanceDashboard')) },
  '/finance/toolkit': { finance: Toolkit },
  '/finance/reminders': { finance: TaskManager },
  '/finance/community': { finance: named(() => import('./community/Community'), 'CommunityAccess') },
  '/finance/community/feed/:hub': { finance: named(() => import('./community/Community'), 'CommunityHub') },
});
for (const path of ['/manage-profile', '/admin-enrollments', '/admin-financials', '/admin/agent-earnings', '/admin/agent-payouts', '/admin/commission-rules']) {
  const c = WIRED[path]?.admin;
  if (c) WIRED[path] = { ...WIRED[path], finance: c };
}

// ---------------- Student support ----------------
Object.assign(WIRED, {
  '/support-dashboard': { support: named(() => import('./support/Support'), 'SupportDashboard') },
  '/support/students': { support: named(() => import('./support/Support'), 'StudentDirectory') },
  '/support/toolkit': { support: Toolkit },
  '/support/reminders': { support: TaskManager },
  '/support/community': { support: named(() => import('./community/Community'), 'CommunityAccess') },
  '/support/community/feed/:hub': { support: named(() => import('./community/Community'), 'CommunityHub') },
  '/admin/forms': { ...WIRED['/admin/forms'], support: FormBuilder },
});
for (const path of ['/manage-profile', '/admin/new-students']) {
  const c = WIRED[path]?.admin;
  if (c) WIRED[path] = { ...WIRED[path], support: c };
}

// ---------------- Services: website pages, help desk, reported posts, privacy (all roles) ----------------
{
  const svc = (n: string) => named(() => import('./shared/Services'), n);
  const pages = svc('WebsitePages'), desk = svc('HelpDesk'), queue = svc('TicketQueue'), reports = svc('CommunityReports'), privacy = svc('PrivacyRequests');
  Object.assign(WIRED, {
    '/admin/pages': { admin: pages, academic: pages, support: pages },
    '/help-desk': { student: desk, instructor: desk, agent: desk, finance: desk, academic: desk },
    '/support/tickets': { support: queue, admin: queue },
    '/admin/community-reports': { admin: reports, academic: reports, support: reports },
    '/admin/privacy': { admin: privacy },
  });
}

// ---------------- Billing (admin + finance), plans, institutions ----------------
{
  const com = (n: string) => named(() => import('./finance/Commerce'), n);
  const inst = (n: string) => named(() => import('./institution/Institution'), n);
  const money2 = { admin: 1, finance: 1 } as const;
  for (const [path, comp] of [['/admin/discount-codes', com('DiscountCodes')], ['/admin/refunds', com('Refunds')], ['/admin/invoices', com('Invoices')], ['/admin/plans', com('PlansAdmin')], ['/admin/billing-settings', com('BillingSettings')]] as const) {
    WIRED[path] = Object.fromEntries(Object.keys(money2).map((r) => [r, comp]));
  }
  const orgs = inst('Organisations'), reqs = inst('TrainingRequests');
  Object.assign(WIRED, {
    '/student/plans': { student: lazy(() => import('./student/StudentPlans')) },
    '/admin/organisations': { admin: orgs, finance: orgs, support: orgs },
    '/admin/training-requests': { admin: reqs, finance: reqs, support: reqs },
    '/institution-dashboard': { institution: inst('InstitutionDashboard') },
    '/institution/finances': { institution: lazy(() => import('./student/StudentFinances')) },
  });
  WIRED['/help-desk'] = { ...WIRED['/help-desk'], institution: WIRED['/help-desk'].student };
  WIRED['/manage-profile'] = { ...WIRED['/manage-profile'], institution: WIRED['/manage-profile'].admin };
}
