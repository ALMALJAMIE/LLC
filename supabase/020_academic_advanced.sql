-- =====================================================================
-- LLC — migration 020: advanced academic tools
-- Run once in Supabase → SQL Editor (after 019). Safe to re-run.
--
-- Placement:  level history, a written reason when the level differs from the suggestion,
--             student appeals, "new version" copy of a test
-- Timetable:  rooms list; the database refuses a room or instructor booked twice at the same time
-- Instructors: qualifications, weekly availability, leave requests approved by the academic team
-- Attendance: students ask for a correction; the instructor / academic team approves
-- Grades:     mid-term and final results are moderated and released by the academic team
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Placement
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists level_id bigint references public.levels (id) on delete set null;

-- students cannot change their own level or exemption
create or replace function public.guard_placement_exempt() returns trigger
  language plpgsql security definer set search_path = public as
$$
begin
  if auth.uid() is not null and not public.is_staff() then
    new.placement_exempt := old.placement_exempt;
    new.placement_exempt_note := old.placement_exempt_note;
    new.level_id := old.level_id;
  end if;
  return new;
end $$;

create table if not exists public.student_level_history (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.profiles (id) on delete cascade,
  level_id bigint references public.levels (id) on delete set null,
  previous_level_id bigint references public.levels (id) on delete set null,
  source text not null default 'placement' check (source in ('placement', 'override', 'appeal', 'manual')),
  note text,
  attempt_id bigint references public.placement_attempts (id) on delete set null,
  changed_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.student_level_history enable row level security;
drop policy if exists "level_history: own or staff read" on public.student_level_history;
create policy "level_history: own or staff read" on public.student_level_history for select to authenticated
  using (student_id = auth.uid() or public.is_staff() or public.is_support());
drop policy if exists "level_history: academic write" on public.student_level_history;
create policy "level_history: academic write" on public.student_level_history for insert to authenticated with check (public.is_academic());

-- confirming a level: a different level than suggested needs a reason; every change is recorded
create or replace function public.placement_level_confirmed() returns trigger
  language plpgsql security definer set search_path = public as
$$
declare prev bigint;
begin
  if new.final_level_id is not null and new.final_level_id is distinct from old.final_level_id then
    if new.suggested_level_id is not null and new.final_level_id <> new.suggested_level_id and coalesce(btrim(new.review_note), '') = '' then
      raise exception 'Write the reason for choosing a different level than the suggested one.';
    end if;
    select level_id into prev from public.profiles where id = new.student_id;
    insert into public.student_level_history (student_id, level_id, previous_level_id, source, note, attempt_id)
    values (new.student_id, new.final_level_id, prev,
            case when exists (select 1 from public.placement_appeals a where a.attempt_id = new.id and a.status = 'pending') then 'appeal'
                 when new.suggested_level_id is distinct from new.final_level_id then 'override' else 'placement' end,
            new.review_note, new.id);
    update public.profiles set level_id = new.final_level_id where id = new.student_id;
  end if;
  return new;
end $$;

create table if not exists public.placement_appeals (
  id bigint generated always as identity primary key,
  attempt_id bigint not null references public.placement_attempts (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  reason text not null check (char_length(reason) between 10 and 2000),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  response text,
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (attempt_id)
);
alter table public.placement_appeals enable row level security;
drop policy if exists "appeals: own or staff read" on public.placement_appeals;
create policy "appeals: own or staff read" on public.placement_appeals for select to authenticated
  using (student_id = auth.uid() or public.is_staff());
drop policy if exists "appeals: student file" on public.placement_appeals;
create policy "appeals: student file" on public.placement_appeals for insert to authenticated
  with check (student_id = auth.uid() and status = 'pending'
    and exists (select 1 from public.placement_attempts a where a.id = attempt_id and a.student_id = auth.uid() and a.status = 'reviewed'));
drop policy if exists "appeals: staff decide" on public.placement_appeals;
create policy "appeals: staff decide" on public.placement_appeals for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

create or replace function public.guard_appeal() returns trigger
  language plpgsql security definer set search_path = public as
$$
begin
  if tg_op = 'INSERT' then
    insert into public.notifications (user_id, title, body, link)
    select p.id, 'New placement appeal', (select full_name from public.profiles where id = new.student_id), '/admin-placement-requests'
    from public.profiles p where p.role::text in ('admin', 'academic') and p.is_active;
    return new;
  end if;
  new.attempt_id := old.attempt_id; new.student_id := old.student_id; new.reason := old.reason; new.created_at := old.created_at;
  if new.status <> old.status then
    new.decided_by := auth.uid(); new.decided_at := now();
    insert into public.notifications (user_id, title, body, link)
    values (new.student_id, case when new.status = 'accepted' then 'Your placement appeal was accepted' else 'Your placement appeal was answered' end, new.response, '/student/assessments');
  end if;
  return new;
end $$;
drop trigger if exists appeals_guard on public.placement_appeals;
create trigger appeals_guard before insert or update on public.placement_appeals for each row execute function public.guard_appeal();

drop trigger if exists placement_level_confirmed on public.placement_attempts;
create trigger placement_level_confirmed before update of final_level_id on public.placement_attempts
  for each row execute function public.placement_level_confirmed();

-- copy a test as a new draft version (sections, passages, questions)
create or replace function public.duplicate_placement_test(p_test bigint) returns bigint
  language plpgsql security definer set search_path = public as
$$
declare t public.placement_tests; nid bigint; s record; nsid bigint; g record; ngid bigint; ver text;
begin
  if not public.is_staff() then raise exception 'Not allowed.'; end if;
  select * into t from public.placement_tests where id = p_test;
  if t.id is null then raise exception 'Test not found.'; end if;
  ver := case when coalesce(t.version, '1') ~ '^\d+$' then (coalesce(t.version, '1')::int + 1)::text else t.version || '-copy' end;
  insert into public.placement_tests (title, description, duration_min, is_active, category, course_id, config, version, priority, assigned_to, agent_ids, approval)
  values (t.title, t.description, t.duration_min, false, t.category, t.course_id, t.config, ver, t.priority, t.assigned_to, t.agent_ids, 'draft')
  returning id into nid;
  for s in select * from public.placement_sections where test_id = p_test order by sort_order, id loop
    insert into public.placement_sections (test_id, title, skill, description, time_min, scoring, instructions, images, sort_order)
    values (nid, s.title, s.skill, s.description, s.time_min, s.scoring, s.instructions, s.images, s.sort_order) returning id into nsid;
    for g in select * from public.placement_groups where section_id = s.id order by sort_order, id loop
      insert into public.placement_groups (section_id, title, passage, audio_url, image_url, sort_order)
      values (nsid, g.title, g.passage, g.audio_url, g.image_url, g.sort_order) returning id into ngid;
      insert into public.placement_questions (test_id, section, section_id, group_id, context, prompt, options, correct_index, points, qtype, sort_order, passage, audio_url)
      select nid, q.section, nsid, ngid, q.context, q.prompt, q.options, q.correct_index, q.points, q.qtype, q.sort_order, q.passage, q.audio_url
      from public.placement_questions q where q.group_id = g.id;
    end loop;
    insert into public.placement_questions (test_id, section, section_id, group_id, context, prompt, options, correct_index, points, qtype, sort_order, passage, audio_url)
    select nid, q.section, nsid, null, q.context, q.prompt, q.options, q.correct_index, q.points, q.qtype, q.sort_order, q.passage, q.audio_url
    from public.placement_questions q where q.section_id = s.id and q.group_id is null;
  end loop;
  return nid;
end $$;
grant execute on function public.duplicate_placement_test(bigint) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Rooms and clash rules
-- ---------------------------------------------------------------------
create table if not exists public.rooms (
  id bigint generated always as identity primary key,
  name text not null unique,
  capacity int,
  location text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.rooms enable row level security;
drop policy if exists "rooms: read" on public.rooms;
create policy "rooms: read" on public.rooms for select to authenticated using (true);
drop policy if exists "rooms: academic write" on public.rooms;
create policy "rooms: academic write" on public.rooms for all to authenticated using (public.is_academic()) with check (public.is_academic());

-- the room and the instructor of a class cannot be booked twice at overlapping times
create or replace function public.guard_session_clash() returns trigger
  language plpgsql security definer set search_path = public as
$$
declare who uuid; other text;
begin
  if new.status is not distinct from 'cancelled' then return new; end if;
  if new.mode = 'face_to_face' and coalesce(btrim(new.room), '') <> '' then
    select s.title || ' (' || b.name || ')' into other from public.class_sessions s join public.batches b on b.id = s.batch_id
     where s.id is distinct from new.id and lower(btrim(s.room)) = lower(btrim(new.room)) and s.mode = 'face_to_face'
       and s.starts_at < new.ends_at and new.starts_at < s.ends_at limit 1;
    if other is not null then
      raise exception 'Room % is already booked at % for %.', btrim(new.room), to_char(new.starts_at at time zone 'Asia/Kuala_Lumpur', 'DD Mon HH24:MI'), other;
    end if;
  end if;
  select coalesce(new.substitute_id, b.instructor_id) into who from public.batches b where b.id = new.batch_id;
  if who is not null then
    select s.title || ' (' || b.name || ')' into other from public.class_sessions s join public.batches b on b.id = s.batch_id
     where s.id is distinct from new.id and coalesce(s.substitute_id, b.instructor_id) = who
       and s.starts_at < new.ends_at and new.starts_at < s.ends_at limit 1;
    if other is not null then
      raise exception 'The instructor already teaches % at %.', other, to_char(new.starts_at at time zone 'Asia/Kuala_Lumpur', 'DD Mon HH24:MI');
    end if;
  end if;
  return new;
end $$;
alter table public.class_sessions add column if not exists status text not null default 'scheduled';
drop trigger if exists class_sessions_clash on public.class_sessions;
create trigger class_sessions_clash before insert or update of starts_at, ends_at, room, mode, substitute_id, batch_id on public.class_sessions
  for each row execute function public.guard_session_clash();

-- ---------------------------------------------------------------------
-- 3. Instructors: qualifications, availability, leave
-- ---------------------------------------------------------------------
create table if not exists public.instructor_profiles (
  id uuid primary key references public.profiles (id) on delete cascade,
  qualifications text,
  experience_years int,
  level_ids bigint[] not null default '{}',
  course_ids bigint[] not null default '{}',
  max_hours_week int,
  updated_at timestamptz not null default now()
);
alter table public.instructor_profiles enable row level security;
drop policy if exists "instructor_profiles: read" on public.instructor_profiles;
create policy "instructor_profiles: read" on public.instructor_profiles for select to authenticated using (public.is_staff() or public.is_support());
drop policy if exists "instructor_profiles: own or academic" on public.instructor_profiles;
create policy "instructor_profiles: own or academic" on public.instructor_profiles for all to authenticated
  using (id = auth.uid() or public.is_academic()) with check ((id = auth.uid() and public.is_staff()) or public.is_academic());

create table if not exists public.instructor_availability (
  id bigint generated always as identity primary key,
  instructor_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  weekday int not null check (weekday between 0 and 6),   -- 0 = Sunday
  start_time time not null,
  end_time time not null,
  check (end_time > start_time)
);
alter table public.instructor_availability enable row level security;
drop policy if exists "availability: read" on public.instructor_availability;
create policy "availability: read" on public.instructor_availability for select to authenticated using (public.is_staff() or public.is_support());
drop policy if exists "availability: own or academic" on public.instructor_availability;
create policy "availability: own or academic" on public.instructor_availability for all to authenticated
  using (instructor_id = auth.uid() or public.is_academic()) with check ((instructor_id = auth.uid() and public.is_staff()) or public.is_academic());

create table if not exists public.instructor_leave (
  id bigint generated always as identity primary key,
  instructor_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  date_from date not null,
  date_to date not null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (date_to >= date_from)
);
alter table public.instructor_leave enable row level security;
drop policy if exists "instructor_leave: read" on public.instructor_leave;
create policy "instructor_leave: read" on public.instructor_leave for select to authenticated using (instructor_id = auth.uid() or public.is_academic());
drop policy if exists "instructor_leave: request" on public.instructor_leave;
create policy "instructor_leave: request" on public.instructor_leave for insert to authenticated
  with check (instructor_id = auth.uid() and status = 'pending' and public.is_staff());
drop policy if exists "instructor_leave: withdraw" on public.instructor_leave;
create policy "instructor_leave: withdraw" on public.instructor_leave for delete to authenticated
  using ((instructor_id = auth.uid() and status = 'pending') or public.is_academic());
drop policy if exists "instructor_leave: decide" on public.instructor_leave;
create policy "instructor_leave: decide" on public.instructor_leave for update to authenticated using (public.is_academic()) with check (public.is_academic());

create or replace function public.notify_instructor_leave() returns trigger
  language plpgsql security definer set search_path = public as
$$
begin
  if tg_op = 'INSERT' then
    insert into public.notifications (user_id, title, body, link)
    select p.id, 'Instructor leave request', (select full_name from public.profiles where id = new.instructor_id) || ' · ' || new.date_from || ' – ' || new.date_to, '/admin/instructors'
    from public.profiles p where p.role::text in ('admin', 'academic') and p.is_active;
  elsif new.status <> old.status then
    new.reviewed_by := auth.uid();
    insert into public.notifications (user_id, title, body, link)
    values (new.instructor_id, 'Your leave request was ' || new.status, new.review_note, '/instructor/availability');
  end if;
  return new;
end $$;
drop trigger if exists instructor_leave_notify on public.instructor_leave;
create trigger instructor_leave_notify before insert or update on public.instructor_leave for each row execute function public.notify_instructor_leave();

-- ---------------------------------------------------------------------
-- 4. Attendance corrections
-- ---------------------------------------------------------------------
create table if not exists public.attendance_corrections (
  id bigint generated always as identity primary key,
  session_id bigint not null references public.class_sessions (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  requested_status text not null check (requested_status in ('present', 'late', 'excused')),
  reason text not null check (char_length(reason) between 5 and 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists attendance_corrections_one_open on public.attendance_corrections (session_id, student_id) where status = 'pending';

create or replace function public.can_manage_session(p_session bigint) returns boolean
  language sql stable security definer set search_path = public as
$$ select public.is_academic() or exists (select 1 from public.class_sessions s join public.batches b on b.id = s.batch_id
     where s.id = p_session and (b.instructor_id = auth.uid() or s.substitute_id = auth.uid())) $$;
grant execute on function public.can_manage_session(bigint) to authenticated;

alter table public.attendance_corrections enable row level security;
drop policy if exists "corrections: read" on public.attendance_corrections;
create policy "corrections: read" on public.attendance_corrections for select to authenticated
  using (student_id = auth.uid() or public.can_manage_session(session_id) or public.is_support());
drop policy if exists "corrections: student request" on public.attendance_corrections;
create policy "corrections: student request" on public.attendance_corrections for insert to authenticated
  with check (student_id = auth.uid() and status = 'pending'
    and exists (select 1 from public.class_sessions s join public.enrollments e on e.batch_id = s.batch_id
                where s.id = session_id and e.student_id = auth.uid() and s.starts_at < now()));
drop policy if exists "corrections: decide" on public.attendance_corrections;
create policy "corrections: decide" on public.attendance_corrections for update to authenticated
  using (public.can_manage_session(session_id)) with check (public.can_manage_session(session_id));

-- approving a correction updates the attendance record and tells the student
create or replace function public.apply_attendance_correction() returns trigger
  language plpgsql security definer set search_path = public as
$$
begin
  new.session_id := old.session_id; new.student_id := old.student_id; new.requested_status := old.requested_status; new.reason := old.reason;
  if new.status <> old.status then
    new.reviewed_by := auth.uid(); new.reviewed_at := now();
    if new.status = 'approved' then
      insert into public.attendance (session_id, student_id, status) values (new.session_id, new.student_id, new.requested_status)
      on conflict (session_id, student_id) do update set status = excluded.status, marked_at = now();
    end if;
    insert into public.notifications (user_id, title, body, link)
    values (new.student_id, 'Attendance correction ' || new.status, new.review_note, '/student/attendance');
  end if;
  return new;
end $$;
drop trigger if exists attendance_corrections_apply on public.attendance_corrections;
create trigger attendance_corrections_apply before update on public.attendance_corrections for each row execute function public.apply_attendance_correction();

-- ---------------------------------------------------------------------
-- 5. Grade moderation: mid-term and final results are released by the academic team
-- ---------------------------------------------------------------------
alter table public.exams add column if not exists results_released boolean not null default true;   -- existing exams stay visible
alter table public.exams add column if not exists released_at timestamptz;
alter table public.exams add column if not exists released_by uuid references public.profiles (id) on delete set null;
alter table public.exams add column if not exists moderation_note text;

create or replace function public.exam_needs_moderation() returns trigger
  language plpgsql security definer set search_path = public as
$$
begin
  if tg_op = 'INSERT' then
    new.results_released := new.kind not in ('midterm', 'final');
  elsif new.results_released is distinct from old.results_released then
    if not public.is_academic() then new.results_released := old.results_released;
    elsif new.results_released then new.released_at := now(); new.released_by := auth.uid();
    end if;
  end if;
  return new;
end $$;
drop trigger if exists exams_moderation on public.exams;
create trigger exams_moderation before insert or update on public.exams for each row execute function public.exam_needs_moderation();

-- students see their result only after release
drop policy if exists "exam_results: read own or staff" on public.exam_results;
create policy "exam_results: read own or staff" on public.exam_results for select to authenticated
  using (public.is_staff() or (student_id = auth.uid() and exists (select 1 from public.exams x where x.id = exam_id and x.results_released)));

-- releasing notifies every student with a graded result
create or replace function public.notify_results_released() returns trigger
  language plpgsql security definer set search_path = public as
$$
begin
  if new.results_released and not old.results_released then
    insert into public.notifications (user_id, title, body, link)
    select r.student_id, 'New result published', new.title || ': ' || r.score || '/' || new.total_marks || coalesce(' (' || r.grade || ')', ''), '/student/exam-results'
    from public.exam_results r where r.exam_id = new.id and r.status = 'graded';
  end if;
  return new;
end $$;
drop trigger if exists exams_release_notify on public.exams;
create trigger exams_release_notify after update of results_released on public.exams for each row execute function public.notify_results_released();
