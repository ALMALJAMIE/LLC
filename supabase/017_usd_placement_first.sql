-- =====================================================================
-- LLC — migration 017: US dollar pricing + placement test before studying
-- Run once in Supabase → SQL Editor (after 015 / 016). Safe to re-run.
--
-- 1. Currency: every price, payment, commission and payout is in USD from now on.
--    Course prices keep their NUMBER — review each course price in the admin after running this.
--    Payments already recorded keep the currency they were made in.
-- 2. Placement first: a student can browse courses and their details, but cannot request an
--    enrollment, open lessons, mark progress or take a lesson quiz until they have submitted a
--    placement test. Staff can exempt a student (e.g. placed by interview).
--    Students who are already enrolled are exempted automatically, so nobody loses access.
-- =====================================================================

-- ---------- 1. USD ----------
alter table public.courses alter column currency set default 'USD';
update public.courses set currency = 'USD' where currency is distinct from 'USD';
alter table public.payments alter column currency set default 'USD';
alter table public.agent_profiles alter column payout_currency set default 'USD';
update public.agent_profiles set payout_currency = 'USD' where payout_currency is distinct from 'USD';
alter table public.agent_payouts alter column currency set default 'USD';
alter table public.agent_earnings alter column currency set default 'USD';

-- commission is recorded in the course's currency
create or replace function public.create_agent_earning() returns trigger
  language plpgsql security definer set search_path = public as
$$
declare r public.commission_rules; price numeric; cur text; amt numeric;
begin
  if new.agent_id is null or new.status <> 'active' then return new; end if;
  if exists (select 1 from public.agent_earnings where enrollment_id = new.id) then return new; end if;
  select * into r from public.commission_rules
   where is_active and (course_id = new.course_id or course_id is null)
   order by (course_id is null), id limit 1;
  if r.id is null then return new; end if;
  select c.price, c.currency into price, cur from public.courses c where c.id = new.course_id;
  amt := case when r.kind = 'percent' then round(coalesce(price, 0) * r.value / 100, 2) else r.value end;
  if amt > 0 then
    insert into public.agent_earnings (agent_id, enrollment_id, rule_id, amount, currency) values (new.agent_id, new.id, r.id, amt, coalesce(cur, 'USD'));
  end if;
  return new;
end $$;

create or replace function public.request_payout() returns bigint
  language plpgsql security definer set search_path = public as
$$
declare total numeric; pid bigint;
begin
  if public.my_role() <> 'agent' then raise exception 'Only agents can request payouts.'; end if;
  select coalesce(sum(amount), 0) into total from public.agent_earnings where agent_id = auth.uid() and status = 'approved' and payout_id is null;
  if total <= 0 then raise exception 'You have no approved earnings to withdraw.'; end if;
  insert into public.agent_payouts (agent_id, amount, currency, method) values (auth.uid(), total, 'USD', 'bank_transfer') returning id into pid;
  update public.agent_earnings set payout_id = pid where agent_id = auth.uid() and status = 'approved' and payout_id is null;
  return pid;
end $$;

-- ---------- 2. Placement first ----------
alter table public.profiles add column if not exists placement_exempt boolean not null default false;
alter table public.profiles add column if not exists placement_exempt_note text;

-- grandfather students who already study
update public.profiles p set placement_exempt = true, placement_exempt_note = coalesce(placement_exempt_note, 'Enrolled before placement became mandatory')
where p.role = 'student' and not p.placement_exempt
  and exists (select 1 from public.enrollments e where e.student_id = p.id and e.status in ('active', 'completed'))
  and not exists (select 1 from public.placement_attempts a where a.student_id = p.id and a.status <> 'in_progress');

-- students cannot exempt themselves (profiles are updatable by their owner)
create or replace function public.guard_placement_exempt() returns trigger
  language plpgsql security definer set search_path = public as
$$
begin
  if auth.uid() is not null and not public.is_staff()
     and (new.placement_exempt is distinct from old.placement_exempt or new.placement_exempt_note is distinct from old.placement_exempt_note) then
    new.placement_exempt := old.placement_exempt;
    new.placement_exempt_note := old.placement_exempt_note;
  end if;
  return new;
end $$;
drop trigger if exists profiles_guard_placement on public.profiles;
create trigger profiles_guard_placement before update on public.profiles
  for each row execute function public.guard_placement_exempt();

-- has this student done placement? (submitted, reviewed, or exempted by staff)
create or replace function public.placement_done(p_student uuid default auth.uid()) returns boolean
  language sql stable security definer set search_path = public as
$$
  select coalesce((select placement_exempt from public.profiles where id = p_student), false)
      or exists (select 1 from public.placement_attempts where student_id = p_student and status in ('submitted', 'reviewed'))
$$;
grant execute on function public.placement_done(uuid) to authenticated;

-- a student's own enrollment request needs placement first (staff and agents can still register students)
create or replace function public.guard_enrollment_placement() returns trigger
  language plpgsql security definer set search_path = public as
$$
begin
  if auth.uid() = new.student_id and public.my_role() = 'student' and not public.placement_done(new.student_id) then
    raise exception 'Please take the placement test before enrolling in a course.';
  end if;
  return new;
end $$;
drop trigger if exists enrollments_placement_first on public.enrollments;
create trigger enrollments_placement_first before insert on public.enrollments
  for each row execute function public.guard_enrollment_placement();

-- lesson content opens only after placement
drop policy if exists "lessons: read" on public.lessons;
create policy "lessons: read" on public.lessons for select to authenticated using (
  public.is_staff() or (
    status = 'approved' and public.placement_done() and exists (
      select 1 from public.course_units u join public.enrollments e on e.course_id = u.course_id
      where u.id = lessons.unit_id and e.student_id = auth.uid() and e.status in ('active', 'completed'))));

create or replace function public.complete_lesson(p_lesson bigint, p_done boolean default true)
returns int
language plpgsql security definer set search_path = public as
$$
declare cid bigint; total int; done int; pct int;
begin
  if not public.placement_done() then raise exception 'Please take the placement test first.'; end if;
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

create or replace function public.submit_lesson_quiz(p_lesson bigint, p_answers jsonb)
returns table (score int, total int, keys jsonb)
language plpgsql security definer set search_path = public as
$$
declare k jsonb; n int; s int := 0; i int;
begin
  if not public.placement_done() then raise exception 'Please take the placement test first.'; end if;
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
