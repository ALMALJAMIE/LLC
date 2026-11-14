import { lazy } from 'react';
import type { Role } from '../lib/nav';

type C = ReturnType<typeof lazy>;
const ManageProfile = lazy(() => import('./shared/ManageProfile'));
const TaskManager = lazy(() => import('./shared/TaskManager'));
const AcademicCalendar = lazy(() => import('./shared/AcademicCalendar'));

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
  '/student/courses': { student: lazy(() => import('./student/StudentCourses')) },
  '/student/my-learning': { student: lazy(() => import('./student/StudentMyLearning')) },
  '/student/finances': { student: lazy(() => import('./student/StudentFinances')) },
};
