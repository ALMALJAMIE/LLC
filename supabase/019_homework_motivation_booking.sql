-- =====================================================================
-- LLC — migration 019: homework, study streaks & badges, one-to-one booking
-- Run once in Supabase → SQL Editor (after 018). Safe to re-run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Homework (assignments to a batch)
-- ---------------------------------------------------------------------
create table if not exists public.assignments (
  id bigint generated always as identity primary key,
  batch_id bigint not null references public.batches (id) on delete cascade,
  title text not null check (char_length(title) between 2 and 200),
  instructions text,
  attachment_url text,
  due_at timestamptz,
  max_points numeric(6, 1) not null default 10 check (max_points > 0),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists assignments_batch_idx on public.assignments (batch_id, due_at);

create table if not exists public.assignment_submissions (
  id bigint generated always as identity primary key,
  assignment_id bigint not null references public.assignments (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  body text check (char_length(body) <= 20000),
  file_path text,
  status text not null default 'submitted' check (status in ('submitted', 'graded')),
  score numeric(6, 1),
  feedback text,
  graded_by uuid references public.profiles (id) on delete set null,
  graded_at timestamptz,
  submitted_at timestamptz not null default now(),
  unique (assignment_id, student_id),
  check (body is not null or file_path is not null)
);

-- may this staff member manage homework for this batch? (its instructor, or the academic team)
create or replace function public.can_manage_batch(p_batch bigint) returns boolean
  language sql stable security definer set search_path = public as
$$ select public.is_academic() or exists (select 1 from public.batches where id = p_batch and instructor_id = auth.uid()) $$;
grant execute on function public.can_manage_batch(bigint) to authenticated;

-- is the signed-in student in this batch?
create or replace function public.in_batch(p_batch bigint) returns boolean
  language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.enrollments where batch_id = p_batch and student_id = auth.uid() and status in ('active', 'completed')) $$;
grant execute on function public.in_batch(bigint) to authenticated;

alter table public.assignments enable row level security;
drop policy if exists "assignments: read" on public.assignments;
create policy "assignments: read" on public.assignments for select to authenticated
  using (public.is_staff() or public.is_support() or (public.in_batch(batch_id) and public.placement_done()));
drop policy if exists "assignments: manage" on public.assignments;
create policy "assignments: manage" on public.assignments for all to authenticated
  using (public.can_manage_batch(batch_id)) with check (public.can_manage_batch(batch_id));

alter table public.assignment_submissions enable row level security;
drop policy if exists "submissions: read" on public.assignment_submissions;
create policy "submissions: read" on public.assignment_submissions for select to authenticated
  using (student_id = auth.uid() or public.is_staff() or public.is_support());
drop policy if exists "submissions: student submit" on public.assignment_submissions;
create policy "submissions: student submit" on public.assignment_submissions for insert to authenticated
  with check (student_id = auth.uid() and exists (select 1 from public.assignments a where a.id = assignment_id and public.in_batch(a.batch_id)) and public.placement_done());
drop policy if exists "submissions: edit or grade" on public.assignment_submissions;
create policy "submissions: edit or grade" on public.assignment_submissions for update to authenticated
  using ((student_id = auth.uid() and status = 'submitted')
      or exists (select 1 from public.assignments a where a.id = assignment_id and public.can_manage_batch(a.batch_id)));

create or replace function public.guard_submission() returns trigger
  language plpgsql security definer set search_path = public as
$$
declare staff boolean;
begin
  staff := exists (select 1 from public.assignments a where a.id = coalesce(new.assignment_id, old.assignment_id) and public.can_manage_batch(a.batch_id));
  if tg_op = 'INSERT' then
    if not staff then
      new.status := 'submitted'; new.score := null; new.feedback := null; new.graded_by := null; new.graded_at := null; new.submitted_at := now();
    end if;
    return new;
  end if;
  new.assignment_id := old.assignment_id; new.student_id := old.student_id;
  if staff and auth.uid() <> old.student_id then
    new.body := old.body; new.file_path := old.file_path; new.submitted_at := old.submitted_at;
    if new.status = 'graded' then new.graded_by := auth.uid(); new.graded_at := now(); end if;
  else
    new.status := old.status; new.score := old.score; new.feedback := old.feedback;
    new.graded_by := old.graded_by; new.graded_at := old.graded_at; new.submitted_at := now();
  end if;
  return new;
end $$;
drop trigger if exists submissions_guard on public.assignment_submissions;
create trigger submissions_guard before insert or update on public.assignment_submissions
  for each row execute function public.guard_submission();

-- tell the batch's students about new homework
create or replace function public.notify_assignment() returns trigger
  language plpgsql security definer set search_path = public as
$$
begin
  insert into public.notifications (user_id, title, body, link)
  select e.student_id, 'New homework: ' || new.title,
         case when new.due_at is not null then 'Due ' || to_char(new.due_at at time zone 'Asia/Kuala_Lumpur', 'DD Mon YYYY HH24:MI') else null end,
         '/student/assignments'
  from public.enrollments e where e.batch_id = new.batch_id and e.status = 'active';
  return new;
end $$;
drop trigger if exists assignments_notify on public.assignments;
create trigger assignments_notify after insert on public.assignments for each row execute function public.notify_assignment();

-- ---------------------------------------------------------------------
-- 2. Study time, streaks and badges
-- ---------------------------------------------------------------------
create table if not exists public.study_days (
  student_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  seconds int not null default 0 check (seconds >= 0),
  primary key (student_id, day)
);
alter table public.study_days enable row level security;
drop policy if exists "study_days: own or staff read" on public.study_days;
create policy "study_days: own or staff read" on public.study_days for select to authenticated
  using (student_id = auth.uid() or public.is_staff() or public.is_support());

-- called by the lesson page every minute while the student is on it (at most 90 s are counted per call)
create or replace function public.log_study_time(p_seconds int) returns void
  language sql security definer set search_path = public as
$$
  insert into public.study_days (student_id, day, seconds)
  select auth.uid(), (now() at time zone 'Asia/Kuala_Lumpur')::date, least(greatest(coalesce(p_seconds, 0), 0), 90)
  where auth.uid() is not null
  on conflict (student_id, day) do update set seconds = least(public.study_days.seconds + excluded.seconds, 86400)
$$;
grant execute on function public.log_study_time(int) to authenticated;

create table if not exists public.achievements (
  code text primary key,
  title text not null,
  description text not null,
  icon text not null default 'award',
  sort_order int not null default 0
);
alter table public.achievements enable row level security;
drop policy if exists "achievements: read" on public.achievements;
create policy "achievements: read" on public.achievements for select to authenticated using (true);
drop policy if exists "achievements: admin" on public.achievements;
create policy "achievements: admin" on public.achievements for all to authenticated using (public.is_academic()) with check (public.is_academic());

insert into public.achievements (code, title, description, icon, sort_order) values
  ('placement', 'Level found', 'Finished the placement test', 'compass', 1),
  ('first_lesson', 'First step', 'Completed your first lesson', 'footprints', 2),
  ('ten_lessons', 'Ten lessons', 'Completed 10 lessons', 'book', 3),
  ('fifty_lessons', 'Fifty lessons', 'Completed 50 lessons', 'library', 4),
  ('perfect_quiz', 'Perfect score', 'Got every answer right in a quiz', 'target', 5),
  ('streak_3', '3-day streak', 'Studied 3 days in a row', 'flame', 6),
  ('streak_7', '7-day streak', 'Studied 7 days in a row', 'flame', 7),
  ('streak_30', '30-day streak', 'Studied 30 days in a row', 'crown', 8),
  ('first_homework', 'Homework hero', 'Handed in your first homework', 'pencil', 9),
  ('course_complete', 'Course finished', 'Completed a whole course', 'graduation', 10)
on conflict (code) do nothing;

create table if not exists public.student_achievements (
  student_id uuid not null references public.profiles (id) on delete cascade,
  code text not null references public.achievements (code) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (student_id, code)
);
alter table public.student_achievements enable row level security;
drop policy if exists "student_achievements: own or staff read" on public.student_achievements;
create policy "student_achievements: own or staff read" on public.student_achievements for select to authenticated
  using (student_id = auth.uid() or public.is_staff() or public.is_support());

-- current streak: consecutive days (ending today or yesterday) with at least one minute of study
create or replace function public.study_streak(p_student uuid) returns int
  language plpgsql stable security definer set search_path = public as
$$
declare d date := (now() at time zone 'Asia/Kuala_Lumpur')::date; n int := 0;
begin
  if not exists (select 1 from public.study_days where student_id = p_student and day = d and seconds >= 60) then d := d - 1; end if;
  while exists (select 1 from public.study_days where student_id = p_student and day = d and seconds >= 60) loop
    n := n + 1; d := d - 1;
  end loop;
  return n;
end $$;

-- the student's learning summary (and any badges newly earned)
create or replace function public.my_learning_stats()
returns table (streak int, week jsonb, minutes_week int, minutes_total int, lessons_done int, badges jsonb, new_badges jsonb)
language plpgsql security definer set search_path = public as
$$
declare u uuid := auth.uid(); s int; ld int; today date := (now() at time zone 'Asia/Kuala_Lumpur')::date; earned text[] := '{}'; c text;
begin
  if u is null then return; end if;
  s := public.study_streak(u);
  select count(*) into ld from public.lesson_progress where student_id = u;
  -- award badges
  for c in
    select x from (values
      ('placement', exists (select 1 from public.placement_attempts where student_id = u and status <> 'in_progress')),
      ('first_lesson', ld >= 1), ('ten_lessons', ld >= 10), ('fifty_lessons', ld >= 50),
      ('perfect_quiz', exists (select 1 from public.lesson_quiz_attempts where student_id = u and total > 0 and score = total)),
      ('streak_3', s >= 3), ('streak_7', s >= 7), ('streak_30', s >= 30),
      ('first_homework', exists (select 1 from public.assignment_submissions where student_id = u)),
      ('course_complete', exists (select 1 from public.enrollments where student_id = u and (status = 'completed' or progress >= 100)))
    ) v(x, ok) where ok and not exists (select 1 from public.student_achievements where student_id = u and code = v.x)
  loop
    insert into public.student_achievements (student_id, code) values (u, c) on conflict do nothing;
    earned := earned || c;
  end loop;
  return query select s,
    (select jsonb_agg(jsonb_build_object('day', g::date, 'minutes', coalesce(round(sd.seconds / 60.0), 0)) order by g)
       from generate_series(today - 6, today, interval '1 day') g left join public.study_days sd on sd.student_id = u and sd.day = g::date),
    (select coalesce(round(sum(seconds) / 60.0), 0)::int from public.study_days where student_id = u and day > today - 7),
    (select coalesce(round(sum(seconds) / 60.0), 0)::int from public.study_days where student_id = u),
    ld,
    (select coalesce(jsonb_agg(jsonb_build_object('code', a.code, 'title', a.title, 'description', a.description, 'icon', a.icon, 'earned_at', sa.earned_at) order by a.sort_order), '[]')
       from public.achievements a left join public.student_achievements sa on sa.code = a.code and sa.student_id = u),
    to_jsonb(earned);
end $$;
grant execute on function public.my_learning_stats() to authenticated;

-- ---------------------------------------------------------------------
-- 3. One-to-one sessions booked from the instructor's free slots
-- ---------------------------------------------------------------------
create table if not exists public.private_slots (
  id bigint generated always as identity primary key,
  instructor_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  mode text not null default 'online' check (mode in ('online', 'face_to_face')),
  meeting_url text,
  room text,
  note text,
  status text not null default 'open' check (status in ('open', 'booked', 'cancelled', 'done')),
  booked_by uuid references public.profiles (id) on delete set null,
  booked_at timestamptz,
  student_note text,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists private_slots_time_idx on public.private_slots (starts_at);
alter table public.private_slots enable row level security;
-- students see open future slots and their own bookings; staff see everything
drop policy if exists "private_slots: read" on public.private_slots;
create policy "private_slots: read" on public.private_slots for select to authenticated
  using (public.is_staff() or public.is_support() or booked_by = auth.uid() or (status = 'open' and starts_at > now()));
drop policy if exists "private_slots: instructor manage" on public.private_slots;
create policy "private_slots: instructor manage" on public.private_slots for all to authenticated
  using (instructor_id = auth.uid() or public.is_academic()) with check ((instructor_id = auth.uid() and public.is_staff()) or public.is_academic());

-- book / cancel through functions so two students can never take the same slot
create or replace function public.book_private_slot(p_slot bigint, p_note text default null) returns void
  language plpgsql security definer set search_path = public as
$$
declare sl public.private_slots;
begin
  if public.my_role() <> 'student' then raise exception 'Only students can book a session.'; end if;
  if not public.placement_done() then raise exception 'Please take the placement test first.'; end if;
  if not exists (select 1 from public.enrollments where student_id = auth.uid() and status = 'active') then
    raise exception 'Private sessions are for students with an active course.';
  end if;
  update public.private_slots set status = 'booked', booked_by = auth.uid(), booked_at = now(), student_note = nullif(btrim(p_note), '')
   where id = p_slot and status = 'open' and starts_at > now() + interval '2 hours'
   returning * into sl;
  if sl.id is null then raise exception 'This time is no longer available. Please choose another.'; end if;
  insert into public.notifications (user_id, title, body, link)
  values (sl.instructor_id, 'New private session booked',
          (select full_name from public.profiles where id = auth.uid()) || ' · ' || to_char(sl.starts_at at time zone 'Asia/Kuala_Lumpur', 'DD Mon HH24:MI'),
          '/instructor/private-sessions');
end $$;
grant execute on function public.book_private_slot(bigint, text) to authenticated;

create or replace function public.cancel_private_booking(p_slot bigint) returns void
  language plpgsql security definer set search_path = public as
$$
declare sl public.private_slots;
begin
  select * into sl from public.private_slots where id = p_slot;
  if sl.id is null or sl.status <> 'booked' then raise exception 'Booking not found.'; end if;
  if sl.booked_by = auth.uid() then
    if sl.starts_at < now() + interval '24 hours' then raise exception 'Bookings can be cancelled up to 24 hours before the session. Please contact your instructor.'; end if;
    update public.private_slots set status = 'open', booked_by = null, booked_at = null, student_note = null where id = p_slot;
    insert into public.notifications (user_id, title, body, link)
    values (sl.instructor_id, 'Private session cancelled by the student', to_char(sl.starts_at at time zone 'Asia/Kuala_Lumpur', 'DD Mon HH24:MI'), '/instructor/private-sessions');
  elsif sl.instructor_id = auth.uid() or public.is_academic() then
    update public.private_slots set status = 'cancelled' where id = p_slot;
    insert into public.notifications (user_id, title, body, link)
    values (sl.booked_by, 'Your private session was cancelled', to_char(sl.starts_at at time zone 'Asia/Kuala_Lumpur', 'DD Mon HH24:MI'), '/student/private-sessions');
  else
    raise exception 'Not allowed.';
  end if;
end $$;
grant execute on function public.cancel_private_booking(bigint) to authenticated;
