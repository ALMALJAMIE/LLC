import { lazy } from 'react';
import type { Role } from '../lib/nav';

type C = ReturnType<typeof lazy>;
const ManageProfile = lazy(() => import('./shared/ManageProfile'));
const TaskManager = lazy(() => import('./shared/TaskManager'));
const AcademicCalendar = lazy(() => import('./shared/AcademicCalendar'));
const ClassScheduler = lazy(() => import('./shared/ClassScheduler'));
const AbsenceApprovals = lazy(() => import('./shared/AbsenceApprovals'));
const named = <K extends string>(loader: () => Promise<Record<K, React.ComponentType>>, k: K) => lazy(() => loader().then((m) => ({ default: m[k] })));

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
  '/student/courses': { student: lazy(() => import('./student/StudentCourses')) },
  '/student/my-learning': { student: lazy(() => import('./student/StudentMyLearning')) },
  '/student/finances': { student: lazy(() => import('./student/StudentFinances')) },
};
