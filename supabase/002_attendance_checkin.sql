-- =====================================================================
-- LLC — migration 002: QR / code check-in for face-to-face classes
-- Run in Supabase → SQL Editor after schema.sql. Safe to re-run.
-- =====================================================================

-- Students check in with the 10-character code shown by the instructor.
-- The code is only accepted from 15 minutes before the class until it ends,
-- and only for students actively enrolled in that batch.
create or replace function public.check_in(p_code text)
returns table (session_id bigint, title text, status text)
language plpgsql security definer set search_path = public as
$$
declare s public.class_sessions;
declare st text;
begin
  select * into s from public.class_sessions cs
   where cs.qr_token = lower(trim(p_code))
     and now() between cs.starts_at - interval '15 minutes' and cs.ends_at
   limit 1;
  if s.id is null then
    raise exception 'This code is not valid right now. Check it with your instructor.';
  end if;
  if not exists (select 1 from public.enrollments e where e.batch_id = s.batch_id and e.student_id = auth.uid() and e.status = 'active') then
    raise exception 'You are not enrolled in this class.';
  end if;
  st := case when now() > s.starts_at + interval '10 minutes' then 'late' else 'present' end;
  insert into public.attendance (session_id, student_id, status) values (s.id, auth.uid(), st)
  on conflict on constraint attendance_session_id_student_id_key do nothing;
  return query select s.id, s.title, coalesce((select a.status from public.attendance a where a.session_id = s.id and a.student_id = auth.uid()), st);
end $$;

grant execute on function public.check_in(text) to authenticated;

-- Students should not insert attendance directly any more (only through check_in).
drop policy if exists "attendance: student check-in" on public.attendance;
