-- =====================================================================
-- LLC — 013: the Student Support role ("support")
-- Run in Supabase → SQL Editor after 012. Safe to re-run.
--
-- A support officer answers students and follows them up, read-only:
--   ✓ student directory with contact details, their enrollments, attendance,
--     results summary and placement results (read only); messages to
--     students (notifications); every form and its responses
--   ✗ changing anything academic or financial, users and roles, agents,
--     CMS, audit log
-- Comparisons use role::text so this file works in one run.
-- =====================================================================

alter type public.app_role add value if not exists 'support';

create or replace function public.is_support() returns boolean
  language sql stable security definer set search_path = public as
$$ select coalesce((select role::text in ('admin', 'support') from public.profiles where id = auth.uid()), false) $$;
grant execute on function public.is_support() to authenticated;

-- read what a student's file is made of
drop policy if exists "profiles: support read" on public.profiles;
create policy "profiles: support read" on public.profiles for select to authenticated using (public.is_support());

do $$
declare t text;
begin
  foreach t in array array['enrollments', 'attendance', 'exam_results', 'certificates', 'placement_attempts', 'absence_requests', 'class_sessions', 'exams'] loop
    execute format('drop policy if exists "%1$s: support read" on public.%1$s', t);
    execute format('create policy "%1$s: support read" on public.%1$s for select to authenticated using (public.is_support())', t);
  end loop;
end $$;

-- message students
drop policy if exists "notifications: support send" on public.notifications;
create policy "notifications: support send" on public.notifications for insert to authenticated with check (public.is_support());

-- forms: support builds forms and handles every form's responses
drop policy if exists "forms: support all" on public.forms;
create policy "forms: support all" on public.forms for all to authenticated
  using (public.is_support()) with check (public.is_support());
drop policy if exists "responses: support read" on public.form_responses;
create policy "responses: support read" on public.form_responses for select to authenticated using (public.is_support());
drop policy if exists "responses: support delete" on public.form_responses;
create policy "responses: support delete" on public.form_responses for delete to authenticated using (public.is_support());

-- To make someone a support officer (or use Users → role in the admin portal):
--   update public.profiles set role = 'support' where email = 'name@example.com';
