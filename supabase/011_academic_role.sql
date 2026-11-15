-- =====================================================================
-- LLC — 011: the Academic Supervisor role ("academic")
-- Run in Supabase → SQL Editor after 010. Safe to re-run.
--
-- An academic supervisor runs teaching, without money, users or agents:
--   ✓ categories, levels, sessions, calendar, courses, batches, curriculum,
--     lesson approval, timetable, substitutes, medical leave, placement tests
--     and levels, exams, grading scales, templates, rubrics, certificates,
--     reviews, community moderation and announcements
--   ✗ payments and financials, users and roles, agents and commissions,
--     website settings (CMS), audit log
--
-- Also tightens two old rules: payments can now be written only by an admin,
-- and enrollments only by an admin or academic supervisor (not by teachers,
-- whose pages never needed it).
-- Comparisons use role::text so this file works in one run, right after the
-- new role value is added.
-- =====================================================================

alter type public.app_role add value if not exists 'academic';

-- who counts as staff (can see students, classes, results)
create or replace function public.is_staff() returns boolean
  language sql stable security definer set search_path = public as
$$ select coalesce((select role::text in ('admin', 'instructor', 'academic') from public.profiles where id = auth.uid()), false) $$;

-- who runs the academic side (admin or academic supervisor)
create or replace function public.is_academic() returns boolean
  language sql stable security definer set search_path = public as
$$ select coalesce((select role::text in ('admin', 'academic') from public.profiles where id = auth.uid()), false) $$;
grant execute on function public.is_academic() to authenticated;

-- staff names are visible to signed-in users (teacher names on timetables, etc.)
drop policy if exists "profiles: staff visible" on public.profiles;
create policy "profiles: staff visible" on public.profiles for select to authenticated
  using (role::text in ('instructor', 'admin', 'academic'));

-- academic catalogue: anyone reads, admin or academic writes
do $$
declare t text;
begin
  foreach t in array array['categories', 'levels', 'academic_sessions', 'courses', 'course_units', 'batches', 'calendar_events',
                           'grading_scales', 'exam_templates', 'rubrics', 'placement_bands'] loop
    execute format('drop policy if exists "%1$s: admin write" on public.%1$s', t);
    execute format('create policy "%1$s: admin write" on public.%1$s for all to authenticated using (public.is_academic()) with check (public.is_academic())', t);
  end loop;
end $$;

-- lessons: teachers edit their own, admin/academic edit and approve all
drop policy if exists "lessons: staff write" on public.lessons;
create policy "lessons: staff write" on public.lessons for all to authenticated
  using (public.is_academic() or created_by = auth.uid()) with check (public.is_staff());

create or replace function public.guard_lesson() returns trigger
  language plpgsql security definer set search_path = public as
$$
begin
  if auth.uid() is not null and not public.is_academic() then
    if new.status = 'approved' and (tg_op = 'INSERT' or old.status <> 'approved') then
      new.status := 'pending';
    end if;
    if tg_op = 'UPDATE' and old.status = 'approved' and (new.content is distinct from old.content or new.video_url is distinct from old.video_url or new.title is distinct from old.title) then
      new.status := 'pending';   -- edited approved lesson goes back for review
    end if;
    if new.status = 'pending' and (tg_op = 'INSERT' or old.status <> 'pending') then
      new.submitted_at := now();
    end if;
  end if;
  return new;
end $$;

-- substitutes: admin or academic assigns
drop policy if exists "substitute: admin" on public.substitute_requests;
create policy "substitute: admin" on public.substitute_requests for all to authenticated
  using (public.is_academic()) with check (public.is_academic());

-- community: admin or academic moderates and announces
drop policy if exists "posts: delete own or admin" on public.community_posts;
create policy "posts: delete own or admin" on public.community_posts for delete to authenticated
  using (author_id = auth.uid() or public.is_academic());
drop policy if exists "comments: delete own or admin" on public.community_comments;
create policy "comments: delete own or admin" on public.community_comments for delete to authenticated
  using (author_id = auth.uid() or public.is_academic());

create or replace function public.broadcast(p_title text, p_body text, p_role text default null, p_link text default null) returns int
  language plpgsql security definer set search_path = public as
$$
declare n int;
begin
  if not public.is_academic() then raise exception 'Only admins and academic supervisors can broadcast.'; end if;
  insert into public.notifications (user_id, title, body, link)
  select id, p_title, p_body, p_link from public.profiles where is_active and (p_role is null or role::text = p_role);
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function public.broadcast(text, text, text, text) to authenticated;

-- money: payments are written by admins only
drop policy if exists "payments: staff write" on public.payments;
create policy "payments: staff write" on public.payments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- enrollments: admin or academic (batch changes, completion with certificates)
drop policy if exists "enrollments: staff write" on public.enrollments;
create policy "enrollments: staff write" on public.enrollments for all to authenticated
  using (public.is_academic()) with check (public.is_academic());

-- an academic supervisor may not approve payments through an enrollment either:
-- moving an enrollment with an unpaid payment to "active" stays an admin decision
create or replace function public.guard_enrollment_activation() returns trigger
  language plpgsql security definer set search_path = public as
$$
begin
  if auth.uid() is not null and not public.is_admin()
     and new.status = 'active' and old.status is distinct from 'active'
     and exists (select 1 from public.payments p where p.enrollment_id = new.id and p.status = 'pending') then
    raise exception 'This enrollment has a payment waiting for verification. An admin must approve it.';
  end if;
  return new;
end $$;
drop trigger if exists enrollments_activation_guard on public.enrollments;
create trigger enrollments_activation_guard before update on public.enrollments
  for each row execute function public.guard_enrollment_activation();

-- To make someone an academic supervisor (or use Users → role in the admin portal):
--   update public.profiles set role = 'academic' where email = 'name@example.com';
