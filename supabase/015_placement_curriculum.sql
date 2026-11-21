-- =====================================================================
-- LLC — migration 015: placement tests v2 + curriculum builder v2
-- Run once in Supabase → SQL Editor (after 014). Safe to re-run.
--
-- Placement tests
--   • test settings: category, target course, written / interview / both,
--     version, priority, assigned instructor, restrict to agents, approval
--   • sections (title, skill, time, auto/manual scoring, instructions, images)
--   • passage groups (one text → many questions), per-question context
--   • written answers (short / long) marked by staff, interview score
--   • existing questions are moved into sections automatically (nothing deleted)
-- Curriculum
--   • module summary, syllabus topics, book pages
--   • content elements: text, video, image, audio, PDF, PowerPoint, Word, quiz
--   • quiz answer keys hidden from students; attempts graded on the server
--   • public "course-media" storage bucket for uploaded course files
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Placement tests
-- ---------------------------------------------------------------------
alter table public.placement_tests add column if not exists category text not null default 'language';
alter table public.placement_tests add column if not exists course_id bigint references public.courses (id) on delete set null;
alter table public.placement_tests add column if not exists config text not null default 'written';
alter table public.placement_tests add column if not exists version text;
alter table public.placement_tests add column if not exists priority int not null default 5;
alter table public.placement_tests add column if not exists assigned_to uuid references public.profiles (id) on delete set null;
alter table public.placement_tests add column if not exists agent_ids uuid[] not null default '{}';
alter table public.placement_tests add column if not exists approval text not null default 'approved'; -- existing tests stay live
alter table public.placement_tests add column if not exists created_by uuid references public.profiles (id) on delete set null;
alter table public.placement_tests alter column approval set default 'draft';
alter table public.placement_tests alter column created_by set default auth.uid();
do $$ begin
  alter table public.placement_tests add constraint placement_tests_category_chk check (category in ('language', 'professional'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.placement_tests add constraint placement_tests_config_chk check (config in ('written', 'interview', 'both'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.placement_tests add constraint placement_tests_priority_chk check (priority between 1 and 10);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.placement_tests add constraint placement_tests_approval_chk check (approval in ('draft', 'approved'));
exception when duplicate_object then null; end $$;

create table if not exists public.placement_sections (
  id bigint generated always as identity primary key,
  test_id bigint not null references public.placement_tests (id) on delete cascade,
  title text not null,
  skill text not null default 'reading' check (skill in ('grammar', 'vocabulary', 'reading', 'listening', 'writing', 'speaking')),
  description text,
  time_min int,
  scoring text not null default 'auto' check (scoring in ('auto', 'manual')),
  instructions jsonb not null default '[]',
  images jsonb not null default '[]',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.placement_groups (
  id bigint generated always as identity primary key,
  section_id bigint not null references public.placement_sections (id) on delete cascade,
  title text,
  passage text,
  audio_url text,
  image_url text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.placement_questions add column if not exists section_id bigint references public.placement_sections (id) on delete cascade;
alter table public.placement_questions add column if not exists group_id bigint references public.placement_groups (id) on delete set null;
alter table public.placement_questions add column if not exists context text;
alter table public.placement_questions add column if not exists qtype text not null default 'mcq';
alter table public.placement_questions drop constraint if exists placement_questions_section_check;
do $$ begin
  alter table public.placement_questions add constraint placement_questions_section_chk check (section in ('grammar', 'vocabulary', 'reading', 'listening', 'writing', 'speaking'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.placement_questions add constraint placement_questions_qtype_chk check (qtype in ('mcq', 'short', 'long'));
exception when duplicate_object then null; end $$;

alter table public.placement_attempts add column if not exists manual_scores jsonb not null default '{}';
alter table public.placement_attempts add column if not exists interview_score numeric(6, 2);
alter table public.placement_attempts add column if not exists interview_total numeric(6, 2);
alter table public.placement_attempts add column if not exists interview_note text;
alter table public.placement_attempts add column if not exists needs_marking boolean not null default false;

alter table public.placement_sections enable row level security;
alter table public.placement_groups enable row level security;
drop policy if exists "placement_sections: staff" on public.placement_sections;
create policy "placement_sections: staff" on public.placement_sections for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "placement_groups: staff" on public.placement_groups;
create policy "placement_groups: staff" on public.placement_groups for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- Move existing questions into sections and passage groups (only those not moved yet).
do $$
declare r record; sid bigint; gid bigint;
begin
  for r in select distinct q.test_id, q.section from public.placement_questions q where q.section_id is null loop
    insert into public.placement_sections (test_id, title, skill, sort_order)
    values (r.test_id, initcap(r.section), r.section, array_position(array['grammar', 'vocabulary', 'reading', 'listening', 'writing', 'speaking'], r.section))
    returning id into sid;
    update public.placement_questions set section_id = sid where test_id = r.test_id and section = r.section and section_id is null;
  end loop;
  for r in select distinct q.section_id, q.passage, q.audio_url from public.placement_questions q
           where q.group_id is null and q.section_id is not null and (q.passage is not null or q.audio_url is not null) loop
    insert into public.placement_groups (section_id, passage, audio_url, sort_order)
    values (r.section_id, r.passage, r.audio_url, (select count(*) + 1 from public.placement_groups where section_id = r.section_id))
    returning id into gid;
    update public.placement_questions set group_id = gid
     where section_id = r.section_id and group_id is null and passage is not distinct from r.passage and audio_url is not distinct from r.audio_url;
  end loop;
end $$;

-- Instructors (not admin / academic) cannot approve tests; their new tests start as drafts.
create or replace function public.guard_placement_test() returns trigger
  language plpgsql security definer set search_path = public as
$$
begin
  if auth.uid() is not null and not public.is_academic() then
    if tg_op = 'INSERT' then
      new.approval := 'draft';
      new.created_by := auth.uid();
    elsif new.approval is distinct from old.approval then
      new.approval := old.approval;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists placement_tests_guard on public.placement_tests;
create trigger placement_tests_guard before insert or update on public.placement_tests
  for each row execute function public.guard_placement_test();

-- Who may take a test: active, approved, has questions, and (no agent restriction, or the student came through one of those agents).
create or replace function public.placement_visible(p_test bigint) returns boolean
  language sql stable security definer set search_path = public as
$$
  select exists (
    select 1 from public.placement_tests t
    where t.id = p_test and t.is_active and t.approval = 'approved'
      and exists (select 1 from public.placement_questions q where q.test_id = t.id)
      and (cardinality(t.agent_ids) = 0 or exists (
        select 1 from public.enrollments e where e.student_id = auth.uid() and e.agent_id = any (t.agent_ids))))
$$;
grant execute on function public.placement_visible(bigint) to authenticated;

drop policy if exists "placement_tests: read" on public.placement_tests;
create policy "placement_tests: read" on public.placement_tests for select to authenticated
  using (public.is_staff() or public.placement_visible(id));

create or replace function public.start_placement(p_test bigint) returns bigint
  language plpgsql security definer set search_path = public as
$$
declare aid bigint;
begin
  if not public.placement_visible(p_test) then raise exception 'This test is not available.'; end if;
  select id into aid from public.placement_attempts where test_id = p_test and student_id = auth.uid() and status = 'in_progress' limit 1;
  if aid is null then
    if exists (select 1 from public.placement_attempts where test_id = p_test and student_id = auth.uid() and status <> 'in_progress') then
      raise exception 'You have already taken this test. Contact LLC if you need to retake it.';
    end if;
    insert into public.placement_attempts (test_id, student_id) values (p_test, auth.uid()) returning id into aid;
  end if;
  return aid;
end $$;
grant execute on function public.start_placement(bigint) to authenticated;

-- The paper for an attempt, WITHOUT correct answers, in section → group → question order.
drop function if exists public.placement_paper(bigint);
create or replace function public.placement_paper(p_attempt bigint)
returns table (
  id bigint, section text, section_id bigint, section_title text, section_desc text, section_time int, section_instructions jsonb, section_images jsonb,
  group_id bigint, group_title text, passage text, audio_url text, image_url text,
  context text, prompt text, options jsonb, qtype text, points int,
  title text, duration_min int, started_at timestamptz, answers jsonb)
language sql stable security definer set search_path = public as
$$
  select q.id, s.skill, s.id, s.title, s.description, s.time_min, s.instructions, s.images,
         g.id, g.title, coalesce(g.passage, q.passage), coalesce(g.audio_url, q.audio_url), g.image_url,
         q.context, q.prompt, case when q.qtype = 'mcq' then q.options else '[]'::jsonb end, q.qtype, q.points,
         t.title, t.duration_min, a.started_at, a.answers
  from public.placement_attempts a
  join public.placement_tests t on t.id = a.test_id
  join public.placement_questions q on q.test_id = a.test_id
  left join public.placement_sections s on s.id = q.section_id
  left join public.placement_groups g on g.id = q.group_id
  where a.id = p_attempt and a.student_id = auth.uid() and a.status = 'in_progress'
  order by s.sort_order nulls last, s.id, g.sort_order nulls first, g.id nulls first, q.sort_order, q.id
$$;
grant execute on function public.placement_paper(bigint) to authenticated;

-- (Re)compute score, percentage, section scores and suggested level for an attempt.
create or replace function public.placement_compute(p_attempt bigint) returns void
  language plpgsql security definer set search_path = public as
$$
declare a public.placement_attempts; s numeric; tot numeric; p int; lvl bigint; secs jsonb; pending boolean;
begin
  select * into a from public.placement_attempts where id = p_attempt;
  with sc as (
    select coalesce(sec.title, initcap(q.section)) sname, coalesce(sec.sort_order, 0) so, q.points::numeric pts,
      case when q.qtype = 'mcq' then
             case when jsonb_typeof(a.answers -> q.id::text) = 'number' and (a.answers ->> q.id::text)::int = q.correct_index then q.points::numeric else 0 end
           else least(q.points::numeric, greatest(0, coalesce((a.manual_scores ->> q.id::text)::numeric, 0))) end got,
      (q.qtype <> 'mcq' and not (a.manual_scores ? q.id::text)) unmarked
    from public.placement_questions q left join public.placement_sections sec on sec.id = q.section_id
    where q.test_id = a.test_id)
  select coalesce(sum(got), 0), coalesce(sum(pts), 0), coalesce(bool_or(unmarked), false) into s, tot, pending from sc;
  select jsonb_object_agg(sname, jsonb_build_object('score', sg, 'total', st)) into secs from (
    select sname, min(so) so, sum(got) sg, sum(pts) st from (
      select coalesce(sec.title, initcap(q.section)) sname, coalesce(sec.sort_order, 0) so, q.points::numeric pts,
        case when q.qtype = 'mcq' then
               case when jsonb_typeof(a.answers -> q.id::text) = 'number' and (a.answers ->> q.id::text)::int = q.correct_index then q.points::numeric else 0 end
             else least(q.points::numeric, greatest(0, coalesce((a.manual_scores ->> q.id::text)::numeric, 0))) end got
      from public.placement_questions q left join public.placement_sections sec on sec.id = q.section_id
      where q.test_id = a.test_id) x group by sname) y;
  if a.interview_total is not null and a.interview_total > 0 then
    s := s + least(a.interview_total, greatest(0, coalesce(a.interview_score, 0)));
    tot := tot + a.interview_total;
    secs := coalesce(secs, '{}'::jsonb) || jsonb_build_object('Interview', jsonb_build_object('score', coalesce(a.interview_score, 0), 'total', a.interview_total));
  end if;
  p := case when tot = 0 then 0 else round(s * 100 / tot) end;
  select b.level_id into lvl from public.placement_bands b where p between b.min_pct and b.max_pct order by b.min_pct desc limit 1;
  update public.placement_attempts set score = s, total = tot, pct = p, section_scores = secs, suggested_level_id = lvl, needs_marking = pending
  where id = p_attempt;
end $$;
revoke all on function public.placement_compute(bigint) from public, anon, authenticated;

drop function if exists public.submit_placement(bigint, jsonb);
create or replace function public.submit_placement(p_attempt bigint, p_answers jsonb)
returns table (score numeric, total numeric, pct int, level_name text, needs_marking boolean)
language plpgsql security definer set search_path = public as
$$
declare a public.placement_attempts; t public.placement_tests;
begin
  select * into a from public.placement_attempts where id = p_attempt and student_id = auth.uid();
  if a.id is null or a.status <> 'in_progress' then raise exception 'This attempt is already submitted.'; end if;
  select * into t from public.placement_tests where id = a.test_id;
  update public.placement_attempts set answers = p_answers, submitted_at = now(), status = 'submitted',
    late = now() > a.started_at + make_interval(mins => t.duration_min + 2)
  where id = p_attempt;
  perform public.placement_compute(p_attempt);
  return query select x.score, x.total, x.pct, (select name from public.levels where id = x.suggested_level_id), x.needs_marking
    from public.placement_attempts x where x.id = p_attempt;
end $$;
grant execute on function public.submit_placement(bigint, jsonb) to authenticated;

-- Staff mark written answers and record the interview; the score and suggested level are recalculated.
create or replace function public.mark_placement(p_attempt bigint, p_manual jsonb, p_interview numeric, p_interview_total numeric, p_interview_note text)
returns void
language plpgsql security definer set search_path = public as
$$
begin
  if not public.is_staff() then raise exception 'Not allowed.'; end if;
  update public.placement_attempts set manual_scores = coalesce(p_manual, '{}'), interview_score = p_interview,
    interview_total = p_interview_total, interview_note = nullif(p_interview_note, '')
  where id = p_attempt and status <> 'in_progress';
  if not found then raise exception 'Attempt not found or not submitted.'; end if;
  perform public.placement_compute(p_attempt);
end $$;
grant execute on function public.mark_placement(bigint, jsonb, numeric, numeric, text) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Curriculum
-- ---------------------------------------------------------------------
alter table public.course_units add column if not exists summary text;
alter table public.course_units add column if not exists topics jsonb not null default '[]';
alter table public.course_units add column if not exists pages text;

alter table public.lessons add column if not exists kind text not null default 'text';
alter table public.lessons add column if not exists file_url text;
alter table public.lessons add column if not exists quiz jsonb not null default '[]';   -- [{prompt, options[]}] — no answers
do $$ begin
  alter table public.lessons add constraint lessons_kind_chk check (kind in ('text', 'video', 'image', 'audio', 'pdf', 'pptx', 'docx', 'quiz'));
exception when duplicate_object then null; end $$;
update public.lessons set kind = 'video' where kind = 'text' and video_url is not null and coalesce(content, '') = '';

-- quiz answer keys: staff only
create table if not exists public.lesson_quiz_keys (
  lesson_id bigint primary key references public.lessons (id) on delete cascade,
  keys jsonb not null default '[]'          -- [correct option index per question]
);
alter table public.lesson_quiz_keys enable row level security;
drop policy if exists "lesson_quiz_keys: staff" on public.lesson_quiz_keys;
create policy "lesson_quiz_keys: staff" on public.lesson_quiz_keys for all to authenticated
  using (public.is_staff()) with check (public.is_academic() or exists (select 1 from public.lessons l where l.id = lesson_id and l.created_by = auth.uid()));

create table if not exists public.lesson_quiz_attempts (
  id bigint generated always as identity primary key,
  lesson_id bigint not null references public.lessons (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  answers jsonb not null default '[]',
  score int not null default 0,
  total int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.lesson_quiz_attempts enable row level security;
drop policy if exists "lesson_quiz_attempts: own or staff read" on public.lesson_quiz_attempts;
create policy "lesson_quiz_attempts: own or staff read" on public.lesson_quiz_attempts for select to authenticated
  using (student_id = auth.uid() or public.is_staff() or public.is_support());

-- A student submits a lesson quiz; graded here. Returns score, total and the correct answers.
create or replace function public.submit_lesson_quiz(p_lesson bigint, p_answers jsonb)
returns table (score int, total int, keys jsonb)
language plpgsql security definer set search_path = public as
$$
declare k jsonb; n int; s int := 0; i int;
begin
  if not exists (
    select 1 from public.lessons l join public.course_units u on u.id = l.unit_id
    join public.enrollments e on e.course_id = u.course_id
    where l.id = p_lesson and l.kind = 'quiz' and l.status = 'approved' and e.student_id = auth.uid() and e.status in ('active', 'completed'))
  then raise exception 'This quiz is not available.'; end if;
  select coalesce(q.keys, '[]') into k from public.lesson_quiz_keys q where q.lesson_id = p_lesson;
  k := coalesce(k, '[]');
  n := jsonb_array_length(k);
  for i in 0 .. n - 1 loop
    if jsonb_typeof(p_answers -> i) = 'number' and (p_answers ->> i)::int = (k ->> i)::int then s := s + 1; end if;
  end loop;
  insert into public.lesson_quiz_attempts (lesson_id, student_id, answers, score, total) values (p_lesson, auth.uid(), coalesce(p_answers, '[]'), s, n);
  return query select s, n, k;
end $$;
grant execute on function public.submit_lesson_quiz(bigint, jsonb) to authenticated;

-- Edited approved content goes back for review (now also covers files, type and quizzes).
create or replace function public.guard_lesson() returns trigger
  language plpgsql security definer set search_path = public as
$$
begin
  if auth.uid() is not null and not public.is_academic() then
    if new.status = 'approved' and (tg_op = 'INSERT' or old.status <> 'approved') then
      new.status := 'pending';
    end if;
    if tg_op = 'UPDATE' and old.status = 'approved' and (
         new.content is distinct from old.content or new.video_url is distinct from old.video_url or new.title is distinct from old.title
      or new.kind is distinct from old.kind or new.file_url is distinct from old.file_url or new.quiz is distinct from old.quiz
      or new.resource_url is distinct from old.resource_url) then
      new.status := 'pending';
    end if;
    if new.status = 'pending' and (tg_op = 'INSERT' or old.status <> 'pending') then
      new.submitted_at := now();
    end if;
  end if;
  return new;
end $$;

-- Storage for course files (public links; only staff can upload)
insert into storage.buckets (id, name, public) values ('course-media', 'course-media', true) on conflict (id) do nothing;
drop policy if exists "course-media: staff write" on storage.objects;
create policy "course-media: staff write" on storage.objects for insert to authenticated
  with check (bucket_id = 'course-media' and public.is_staff());
drop policy if exists "course-media: staff update" on storage.objects;
create policy "course-media: staff update" on storage.objects for update to authenticated
  using (bucket_id = 'course-media' and public.is_staff());
drop policy if exists "course-media: staff delete" on storage.objects;
create policy "course-media: staff delete" on storage.objects for delete to authenticated
  using (bucket_id = 'course-media' and public.is_staff());
drop policy if exists "course-media: read" on storage.objects;
create policy "course-media: read" on storage.objects for select to anon, authenticated
  using (bucket_id = 'course-media');

-- audit important tables too
do $$ begin
  if to_regprocedure('public.audit()') is not null then
    drop trigger if exists audit_placement_tests on public.placement_tests;
    create trigger audit_placement_tests after insert or update or delete on public.placement_tests for each row execute function public.audit();
  end if;
end $$;
