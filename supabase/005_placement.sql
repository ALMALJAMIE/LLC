-- =====================================================================
-- LLC — migration 005: online placement tests (auto-graded)
-- Run in Supabase → SQL Editor after 004. Safe to re-run.
-- =====================================================================

create table if not exists public.placement_tests (
  id bigint generated always as identity primary key,
  title text not null,
  description text,
  duration_min int not null default 40,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.placement_questions (
  id bigint generated always as identity primary key,
  test_id bigint not null references public.placement_tests (id) on delete cascade,
  section text not null default 'grammar' check (section in ('grammar', 'vocabulary', 'reading', 'listening')),
  passage text,
  audio_url text,
  prompt text not null,
  options jsonb not null default '[]',
  correct_index int not null default 0,
  points int not null default 1,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Score bands: which level a percentage maps to.
create table if not exists public.placement_bands (
  id bigint generated always as identity primary key,
  level_id bigint not null references public.levels (id) on delete cascade,
  min_pct int not null check (min_pct between 0 and 100),
  max_pct int not null check (max_pct between 0 and 100),
  unique (level_id)
);

create table if not exists public.placement_attempts (
  id bigint generated always as identity primary key,
  test_id bigint not null references public.placement_tests (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  answers jsonb not null default '{}',
  score numeric(6, 2),
  total numeric(6, 2),
  pct int,
  section_scores jsonb,
  suggested_level_id bigint references public.levels (id) on delete set null,
  final_level_id bigint references public.levels (id) on delete set null,
  status text not null default 'in_progress' check (status in ('in_progress', 'submitted', 'reviewed')),
  late boolean not null default false,
  reviewer_id uuid references public.profiles (id) on delete set null,
  review_note text
);

alter table public.placement_tests enable row level security;
alter table public.placement_questions enable row level security;
alter table public.placement_bands enable row level security;
alter table public.placement_attempts enable row level security;

drop policy if exists "placement_tests: read" on public.placement_tests;
create policy "placement_tests: read" on public.placement_tests for select to authenticated using (is_active or public.is_staff());
drop policy if exists "placement_tests: staff write" on public.placement_tests;
create policy "placement_tests: staff write" on public.placement_tests for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- Questions (with answers) are never readable by students; they get them through start_placement().
drop policy if exists "placement_questions: staff" on public.placement_questions;
create policy "placement_questions: staff" on public.placement_questions for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "placement_bands: read" on public.placement_bands;
create policy "placement_bands: read" on public.placement_bands for select to authenticated using (true);
drop policy if exists "placement_bands: admin write" on public.placement_bands;
create policy "placement_bands: admin write" on public.placement_bands for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "placement_attempts: own or staff read" on public.placement_attempts;
create policy "placement_attempts: own or staff read" on public.placement_attempts for select to authenticated using (student_id = auth.uid() or public.is_staff());
drop policy if exists "placement_attempts: staff write" on public.placement_attempts;
create policy "placement_attempts: staff write" on public.placement_attempts for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- Start (or resume) an attempt; returns the attempt id.
create or replace function public.start_placement(p_test bigint) returns bigint
language plpgsql security definer set search_path = public as
$$
declare aid bigint;
begin
  if not exists (select 1 from public.placement_tests where id = p_test and is_active) then raise exception 'This test is not available.'; end if;
  select id into aid from public.placement_attempts where test_id = p_test and student_id = auth.uid() and status = 'in_progress' limit 1;
  if aid is null then
    if exists (select 1 from public.placement_attempts where test_id = p_test and student_id = auth.uid() and status <> 'in_progress') then
      raise exception 'You have already taken this test. Contact LLC if you need to retake it.';
    end if;
    insert into public.placement_attempts (test_id, student_id) values (p_test, auth.uid()) returning id into aid;
  end if;
  return aid;
end $$;

-- Questions for an attempt WITHOUT the correct answers.
create or replace function public.placement_paper(p_attempt bigint)
returns table (id bigint, section text, passage text, audio_url text, prompt text, options jsonb, points int, title text, duration_min int, started_at timestamptz, answers jsonb)
language sql stable security definer set search_path = public as
$$
  select q.id, q.section, q.passage, q.audio_url, q.prompt, q.options, q.points, t.title, t.duration_min, a.started_at, a.answers
  from public.placement_attempts a
  join public.placement_tests t on t.id = a.test_id
  join public.placement_questions q on q.test_id = a.test_id
  where a.id = p_attempt and a.student_id = auth.uid() and a.status = 'in_progress'
  order by q.section, q.sort_order, q.id
$$;

-- Save progress without submitting.
create or replace function public.save_placement(p_attempt bigint, p_answers jsonb) returns void
language sql security definer set search_path = public as
$$ update public.placement_attempts set answers = p_answers where id = p_attempt and student_id = auth.uid() and status = 'in_progress' $$;

-- Grade on the server and suggest a level.
create or replace function public.submit_placement(p_attempt bigint, p_answers jsonb)
returns table (score numeric, total numeric, pct int, level_name text)
language plpgsql security definer set search_path = public as
$$
declare a public.placement_attempts; t public.placement_tests; s numeric := 0; tot numeric := 0; p int; lvl bigint; secs jsonb;
begin
  select * into a from public.placement_attempts where id = p_attempt and student_id = auth.uid();
  if a.id is null or a.status <> 'in_progress' then raise exception 'This attempt is already submitted.'; end if;
  select * into t from public.placement_tests where id = a.test_id;
  select coalesce(sum(q.points) filter (where (p_answers ->> q.id::text)::int = q.correct_index), 0), coalesce(sum(q.points), 0)
    into s, tot from public.placement_questions q where q.test_id = a.test_id;
  select jsonb_object_agg(section, jsonb_build_object('score', sc, 'total', tt)) into secs from (
    select q.section, coalesce(sum(q.points) filter (where (p_answers ->> q.id::text)::int = q.correct_index), 0) sc, sum(q.points) tt
    from public.placement_questions q where q.test_id = a.test_id group by q.section) x;
  p := case when tot = 0 then 0 else round(s * 100 / tot) end;
  select b.level_id into lvl from public.placement_bands b where p between b.min_pct and b.max_pct order by b.min_pct desc limit 1;
  update public.placement_attempts set answers = p_answers, submitted_at = now(), score = s, total = tot, pct = p, section_scores = secs,
    suggested_level_id = lvl, status = 'submitted', late = now() > a.started_at + make_interval(mins => t.duration_min + 2)
  where id = p_attempt;
  return query select s, tot, p, (select name from public.levels where id = lvl);
end $$;

grant execute on function public.start_placement(bigint) to authenticated;
grant execute on function public.placement_paper(bigint) to authenticated;
grant execute on function public.save_placement(bigint, jsonb) to authenticated;
grant execute on function public.submit_placement(bigint, jsonb) to authenticated;

-- ---------- Starter test & bands -----------------------------------------
insert into public.placement_bands (level_id, min_pct, max_pct)
select l.id, v.mn, v.mx from (values ('Beginner', 0, 20), ('Elementary', 21, 35), ('Pre-Intermediate', 36, 50), ('Intermediate', 51, 65), ('Upper-Intermediate', 66, 80), ('Advanced', 81, 100)) v(n, mn, mx)
join public.levels l on l.name = v.n
on conflict (level_id) do nothing;

do $$
declare tid bigint;
begin
  if exists (select 1 from public.placement_tests) then return; end if;
  insert into public.placement_tests (title, description, duration_min)
  values ('LLC English Placement Test', 'Grammar, vocabulary and reading. About 30 minutes. Answer every question; there is no penalty for guessing.', 30)
  returning id into tid;
  insert into public.placement_questions (test_id, section, prompt, options, correct_index, sort_order) values
  (tid, 'grammar', 'She ___ a teacher.', '["am","is","are","be"]', 1, 1),
  (tid, 'grammar', 'I ___ to work every day.', '["go","goes","going","gone"]', 0, 2),
  (tid, 'grammar', 'They ___ watching TV when I arrived.', '["was","were","are","have"]', 1, 3),
  (tid, 'grammar', 'If it rains tomorrow, we ___ at home.', '["stay","stayed","will stay","would stay"]', 2, 4),
  (tid, 'grammar', 'I have lived here ___ 2019.', '["for","since","from","ago"]', 1, 5),
  (tid, 'grammar', 'The report ___ by the manager yesterday.', '["wrote","was written","has written","is writing"]', 1, 6),
  (tid, 'grammar', 'If I ___ more time, I would learn Spanish.', '["have","had","will have","would have"]', 1, 7),
  (tid, 'grammar', 'By next June, she ___ her degree.', '["finishes","will finish","will have finished","has finished"]', 2, 8),
  (tid, 'grammar', 'Hardly ___ the station when the train left.', '["I had reached","had I reached","I reached","did I reached"]', 1, 9),
  (tid, 'grammar', 'I wish I ___ that email; it caused a lot of trouble.', '["didn''t send","hadn''t sent","wouldn''t send","haven''t sent"]', 1, 10),
  (tid, 'vocabulary', 'The opposite of "expensive" is ___.', '["cheap","rich","poor","small"]', 0, 1),
  (tid, 'vocabulary', 'You use an ___ when it rains.', '["oven","umbrella","envelope","engine"]', 1, 2),
  (tid, 'vocabulary', 'Please ___ the form and return it to reception.', '["fill in","fill up","fill out of","fill on"]', 0, 3),
  (tid, 'vocabulary', 'The meeting was ___ until next week.', '["put off","put on","put up","put away"]', 0, 4),
  (tid, 'vocabulary', 'Her explanation was so ___ that everyone understood it.', '["vague","lucid","dense","obscure"]', 1, 5),
  (tid, 'vocabulary', 'The company had to ___ 200 workers because of losses.', '["lay off","lay down","lay out","lay by"]', 0, 6),
  (tid, 'vocabulary', 'A person who is "meticulous" is very ___.', '["careless","careful","angry","generous"]', 1, 7),
  (tid, 'vocabulary', 'The new policy will ___ affect small businesses.', '["adversely","adverse","adversity","adversary"]', 0, 8);
  insert into public.placement_questions (test_id, section, passage, prompt, options, correct_index, sort_order) values
  (tid, 'reading', 'Maria moved to Kuala Lumpur last year to study. At first she found the city noisy and hot, but she soon made friends at her language class. Now she enjoys trying street food every weekend and plans to stay after she graduates.', 'Why did Maria move to Kuala Lumpur?', '["To work","To study","To visit friends","To open a restaurant"]', 1, 1),
  (tid, 'reading', 'Maria moved to Kuala Lumpur last year to study. At first she found the city noisy and hot, but she soon made friends at her language class. Now she enjoys trying street food every weekend and plans to stay after she graduates.', 'How does Maria feel about the city now?', '["She wants to leave","She still dislikes it","She enjoys living there","She has not decided"]', 2, 2),
  (tid, 'reading', 'Remote work has grown rapidly. Supporters argue it saves commuting time and widens the pool of candidates employers can hire. Critics counter that it weakens team culture and blurs the line between home and office, which can lead to longer working hours.', 'According to critics, one risk of remote work is ___.', '["higher salaries","fewer candidates","longer working hours","more commuting"]', 2, 3),
  (tid, 'reading', 'Remote work has grown rapidly. Supporters argue it saves commuting time and widens the pool of candidates employers can hire. Critics counter that it weakens team culture and blurs the line between home and office, which can lead to longer working hours.', 'The word "counter" in the text is closest in meaning to ___.', '["agree","reply against","count","calculate"]', 1, 4);
end $$;
