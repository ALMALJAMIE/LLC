import { lazy } from 'react';
import type { Role } from '../lib/nav';

type C = ReturnType<typeof lazy>;
const ManageProfile = lazy(() => import('./shared/ManageProfile'));
const TaskManager = lazy(() => import('./shared/TaskManager'));

/** Screens that are connected to the database. They replace the static layout for the same route. */
export const WIRED: Record<string, Partial<Record<Role, C>>> = {
  '/manage-profile': { student: ManageProfile, instructor: ManageProfile, agent: ManageProfile, admin: ManageProfile },
  '/student/reminders': { student: TaskManager },
  '/instructor/reminders': { instructor: TaskManager },
  '/admin/reminders': { admin: TaskManager },
  '/student/courses': { student: lazy(() => import('./student/StudentCourses')) },
  '/student/my-learning': { student: lazy(() => import('./student/StudentMyLearning')) },
  '/student/finances': { student: lazy(() => import('./student/StudentFinances')) },
};
