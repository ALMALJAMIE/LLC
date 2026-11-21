-- =====================================================================
-- LLC — migration 018: richer lessons
-- Run once in Supabase → SQL Editor (after 017). Safe to re-run.
--
-- • New content types: vocabulary list, writing task, speaking task (student records their voice)
-- • Transcript for audio / video, minimum words for writing (lessons.data)
-- • Quiz question types graded on the server: single, multiple, gap fill, matching, ordering,
--   short answer — with an explanation shown after checking
-- • Student work (writing / recordings) reviewed by the teacher with feedback
-- • Private notes and bookmarks per lesson; "ask your teacher" questions and answers
-- =====================================================================

-- ---------- content types ----------
alter table public.lessons add column if not exists data jsonb not null default '{}';
alter table public.lessons drop constraint if exists lessons_kind_chk;
alter table public.lessons add constraint lessons_kind_chk
  check (kind in ('text', 'video', 'image', 'audio', 'pdf', 'pptx', 'docx', 'quiz', 'vocabulary', 'writing', 'speaking'));

-- edited approved content (now including data) goes back for review
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
      or new.resource_url is distinct from old.resource_url or new.data is distinct from old.data) then
      new.status := 'pending';
    end if;
    if new.status = 'pending' and (tg_op = 'INSERT' or old.status <> 'pending') then
      new.submitted_at := now();
    end if;
  end if;
  return new;
end $$;

-- ---------- typed quiz questions ----------
-- lessons.quiz:            [{type, prompt, passage?, options? | left?+right? | items?}]  (never the answers)
-- lesson_quiz_keys.keys:   one key per question (single: index; multiple: [indexes]; short: [accepted answers];
--                          gap: [[accepted answers per gap]]; match: [right index per left]; order: [item indexes in order])
alter table public.lesson_quiz_keys add column if not exists explanations jsonb not null default '[]';
alter table public.lesson_quiz_attempts add column if not exists results jsonb not null default '[]';

create or replace function public.norm_answer(t text) returns text
  language sql immutable as
$$
  select regexp_replace(lower(regexp_replace(btrim(translate(coalesce(t, ''), '‘’ʼ“”', '''''''""')), '\s+', ' ', 'g')), '[.!?]+$', '')
$$;

create or replace function public.quiz_item_correct(p_type text, p_key jsonb, p_ans jsonb) returns boolean
  language plpgsql immutable as
$$
declare g int;
begin
  if p_ans is null or p_key is null then return false; end if;
  case coalesce(p_type, 'single')
    when 'single' then
      return jsonb_typeof(p_ans) = 'number' and p_ans = p_key;
    when 'multiple' then
      if jsonb_typeof(p_ans) <> 'array' then return false; end if;
      return (select coalesce(jsonb_agg(x order by x::text), '[]') from (select distinct x from jsonb_array_elements(p_ans) x) s)
           = (select coalesce(jsonb_agg(x order by x::text), '[]') from (select distinct x from jsonb_array_elements(p_key) x) s);
    when 'short' then
      return jsonb_typeof(p_ans) = 'string'
        and exists (select 1 from jsonb_array_elements_text(p_key) alt where public.norm_answer(alt) = public.norm_answer(p_ans #>> '{}'));
    when 'gap' then
      if jsonb_typeof(p_ans) <> 'array' or jsonb_array_length(p_ans) <> jsonb_array_length(p_key) then return false; end if;
      for g in 0 .. jsonb_array_length(p_key) - 1 loop
        if not exists (select 1 from jsonb_array_elements_text(p_key -> g) alt where public.norm_answer(alt) = public.norm_answer(p_ans ->> g)) then
          return false;
        end if;
      end loop;
      return true;
    when 'match', 'order' then
      return jsonb_typeof(p_ans) = 'array' and p_ans = p_key;
    else
      return false;
  end case;
end $$;

drop function if exists public.submit_lesson_quiz(bigint, jsonb);
create or replace function public.submit_lesson_quiz(p_lesson bigint, p_answers jsonb)
returns table (score int, total int, keys jsonb, explanations jsonb, results jsonb)
language plpgsql security definer set search_path = public as
$$
declare qz jsonb; k jsonb; ex jsonb; n int; s int := 0; i int; ok boolean; res jsonb := '[]';
begin
  if not public.placement_done() then raise exception 'Please take the placement test first.'; end if;
  select l.quiz into qz from public.lessons l join public.course_units u on u.id = l.unit_id
    join public.enrollments e on e.course_id = u.course_id
   where l.id = p_lesson and l.kind = 'quiz' and l.status = 'approved' and e.student_id = auth.uid() and e.status in ('active', 'completed')
   limit 1;
  if qz is null then raise exception 'This quiz is not available.'; end if;
  select coalesce(q.keys, '[]'), coalesce(q.explanations, '[]') into k, ex from public.lesson_quiz_keys q where q.lesson_id = p_lesson;
  k := coalesce(k, '[]'); ex := coalesce(ex, '[]');
  n := least(jsonb_array_length(k), jsonb_array_length(qz));
  for i in 0 .. n - 1 loop
    ok := public.quiz_item_correct(qz -> i ->> 'type', k -> i, p_answers -> i);
    if ok then s := s + 1; end if;
    res := res || to_jsonb(ok);
  end loop;
  insert into public.lesson_quiz_attempts (lesson_id, student_id, answers, score, total, results)
  values (p_lesson, auth.uid(), coalesce(p_answers, '[]'), s, n, res);
  return query select s, n, k, ex, res;
end $$;
grant execute on function public.submit_lesson_quiz(bigint, jsonb) to authenticated;

-- ---------- student work: writing and speaking ----------
create table if not exists public.lesson_responses (
  id bigint generated always as identity primary key,
  lesson_id bigint not null references public.lessons (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  body text check (char_length(body) <= 20000),
  audio_path text,
  status text not null default 'submitted' check (status in ('submitted', 'reviewed')),
  score numeric(5, 1),
  feedback text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  submitted_at timestamptz not null default now(),
  unique (lesson_id, student_id),
  check (body is not null or audio_path is not null)
);
alter table public.lesson_responses enable row level security;
drop policy if exists "lesson_responses: own or staff read" on public.lesson_responses;
create policy "lesson_responses: own or staff read" on public.lesson_responses for select to authenticated
  using (student_id = auth.uid() or public.is_staff());
drop policy if exists "lesson_responses: student submit" on public.lesson_responses;
create policy "lesson_responses: student submit" on public.lesson_responses for insert to authenticated
  with check (student_id = auth.uid() and status = 'submitted' and public.placement_done());
drop policy if exists "lesson_responses: student edit or staff review" on public.lesson_responses;
create policy "lesson_responses: student edit or staff review" on public.lesson_responses for update to authenticated
  using ((student_id = auth.uid() and status = 'submitted') or public.is_staff());

-- students can only change their answer (and re-submitting clears nothing a teacher wrote);
-- staff can only change the review fields
create or replace function public.guard_lesson_response() returns trigger
  language plpgsql security definer set search_path = public as
$$
begin
  if tg_op = 'INSERT' then
    if not public.is_staff() then
      new.status := 'submitted'; new.score := null; new.feedback := null; new.reviewed_by := null; new.reviewed_at := null; new.submitted_at := now();
    end if;
    return new;
  end if;
  new.lesson_id := old.lesson_id; new.student_id := old.student_id;
  if public.is_staff() and auth.uid() <> old.student_id then
    new.body := old.body; new.audio_path := old.audio_path; new.submitted_at := old.submitted_at;
    if new.status = 'reviewed' then new.reviewed_by := auth.uid(); new.reviewed_at := now(); end if;
  else
    new.status := old.status; new.score := old.score; new.feedback := old.feedback;
    new.reviewed_by := old.reviewed_by; new.reviewed_at := old.reviewed_at; new.submitted_at := now();
  end if;
  return new;
end $$;
drop trigger if exists lesson_responses_guard on public.lesson_responses;
create trigger lesson_responses_guard before insert or update on public.lesson_responses
  for each row execute function public.guard_lesson_response();

-- ---------- notes and bookmarks (private to the student) ----------
create table if not exists public.lesson_notes (
  student_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  lesson_id bigint not null references public.lessons (id) on delete cascade,
  body text not null default '' check (char_length(body) <= 10000),
  bookmarked boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (student_id, lesson_id)
);
alter table public.lesson_notes enable row level security;
drop policy if exists "lesson_notes: own" on public.lesson_notes;
create policy "lesson_notes: own" on public.lesson_notes for all to authenticated
  using (student_id = auth.uid()) with check (student_id = auth.uid());

-- ---------- ask your teacher ----------
create table if not exists public.lesson_questions (
  id bigint generated always as identity primary key,
  lesson_id bigint not null references public.lessons (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  body text not null check (char_length(body) between 3 and 2000),
  answer text check (char_length(answer) <= 4000),
  answered_by uuid references public.profiles (id) on delete set null,
  answered_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists lesson_questions_lesson_idx on public.lesson_questions (lesson_id, created_at desc);
alter table public.lesson_questions enable row level security;
drop policy if exists "lesson_questions: own or staff read" on public.lesson_questions;
create policy "lesson_questions: own or staff read" on public.lesson_questions for select to authenticated
  using (student_id = auth.uid() or public.is_staff());
drop policy if exists "lesson_questions: student ask" on public.lesson_questions;
create policy "lesson_questions: student ask" on public.lesson_questions for insert to authenticated
  with check (student_id = auth.uid() and answer is null);
drop policy if exists "lesson_questions: staff answer" on public.lesson_questions;
create policy "lesson_questions: staff answer" on public.lesson_questions for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
drop policy if exists "lesson_questions: delete own unanswered" on public.lesson_questions;
create policy "lesson_questions: delete own unanswered" on public.lesson_questions for delete to authenticated
  using ((student_id = auth.uid() and answer is null) or public.is_academic());

create or replace function public.guard_lesson_question() returns trigger
  language plpgsql security definer set search_path = public as
$$
begin
  new.lesson_id := old.lesson_id; new.student_id := old.student_id; new.body := old.body; new.created_at := old.created_at;
  if new.answer is distinct from old.answer then new.answered_by := auth.uid(); new.answered_at := now(); end if;
  return new;
end $$;
drop trigger if exists lesson_questions_guard on public.lesson_questions;
create trigger lesson_questions_guard before update on public.lesson_questions
  for each row execute function public.guard_lesson_question();
