-- =====================================================================
-- LLC — migration 004: lesson content, approvals and student progress
-- Run in Supabase → SQL Editor after 003. Safe to re-run.
-- =====================================================================

alter table public.lessons add column if not exists duration_min int;
alter table public.lessons add column if not exists resource_url text;
alter table public.lessons add column if not exists review_note text;
alter table public.lessons add column if not exists submitted_at timestamptz;

create table if not exists public.lesson_progress (
  student_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  lesson_id bigint not null references public.lessons (id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (student_id, lesson_id)
);
alter table public.lesson_progress enable row level security;

drop policy if exists "lesson_progress: own or staff read" on public.lesson_progress;
create policy "lesson_progress: own or staff read" on public.lesson_progress for select to authenticated
  using (student_id = auth.uid() or public.is_staff());

-- Students see approved lessons only for courses they are actively enrolled in.
drop policy if exists "lessons: read" on public.lessons;
create policy "lessons: read" on public.lessons for select to authenticated using (
  public.is_staff() or (
    status = 'approved' and exists (
      select 1 from public.course_units u join public.enrollments e on e.course_id = u.course_id
      where u.id = lessons.unit_id and e.student_id = auth.uid() and e.status in ('active', 'completed'))));

-- Instructors edit their own lessons; admins edit all. Instructors can never approve.
create or replace function public.guard_lesson() returns trigger
  language plpgsql security definer set search_path = public as
$$
begin
  if auth.uid() is not null and not public.is_admin() then
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
drop trigger if exists lessons_guard on public.lessons;
create trigger lessons_guard before insert or update on public.lessons
  for each row execute function public.guard_lesson();

-- Mark a lesson complete and refresh the enrollment's progress percentage.
create or replace function public.complete_lesson(p_lesson bigint, p_done boolean default true)
returns int
language plpgsql security definer set search_path = public as
$$
declare cid bigint; total int; done int; pct int;
begin
  select u.course_id into cid from public.lessons l join public.course_units u on u.id = l.unit_id where l.id = p_lesson and l.status = 'approved';
  if cid is null then raise exception 'Lesson not found.'; end if;
  if not exists (select 1 from public.enrollments where student_id = auth.uid() and course_id = cid and status in ('active', 'completed')) then
    raise exception 'You are not enrolled in this course.';
  end if;
  if p_done then
    insert into public.lesson_progress (student_id, lesson_id) values (auth.uid(), p_lesson) on conflict do nothing;
  else
    delete from public.lesson_progress where student_id = auth.uid() and lesson_id = p_lesson;
  end if;
  select count(*) into total from public.lessons l join public.course_units u on u.id = l.unit_id where u.course_id = cid and l.status = 'approved';
  select count(*) into done from public.lesson_progress p join public.lessons l on l.id = p.lesson_id join public.course_units u on u.id = l.unit_id
   where p.student_id = auth.uid() and u.course_id = cid and l.status = 'approved';
  pct := case when total = 0 then 0 else least(100, round(done * 100.0 / total)) end;
  update public.enrollments set progress = pct where student_id = auth.uid() and course_id = cid and status in ('active', 'completed');
  return pct;
end $$;
grant execute on function public.complete_lesson(bigint, boolean) to authenticated;
