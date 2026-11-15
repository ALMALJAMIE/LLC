-- =====================================================================
-- LLC — 008: fixes found while testing on the live site
-- Run in Supabase → SQL Editor after 007. Safe to re-run.
-- =====================================================================

-- A placement test with no questions yet is hidden from students
-- (staff still see it so they can add questions).
create or replace function public.placement_has_questions(p_test bigint) returns boolean
  language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.placement_questions where test_id = p_test) $$;
grant execute on function public.placement_has_questions(bigint) to authenticated;

drop policy if exists "placement_tests: read" on public.placement_tests;
create policy "placement_tests: read" on public.placement_tests for select to authenticated
  using (public.is_staff() or (is_active and public.placement_has_questions(id)));

create or replace function public.start_placement(p_test bigint) returns bigint
language plpgsql security definer set search_path = public as
$$
declare aid bigint;
begin
  if not exists (select 1 from public.placement_tests where id = p_test and is_active) then raise exception 'This test is not available.'; end if;
  if not public.placement_has_questions(p_test) then raise exception 'This test has no questions yet.'; end if;
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
