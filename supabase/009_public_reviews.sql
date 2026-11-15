-- =====================================================================
-- LLC — 009: approved reviews on the public home page
-- Run in Supabase → SQL Editor after 008. Safe to re-run.
-- Visitors get only what the page shows: first name, course, stars, text.
-- =====================================================================
create or replace function public.public_reviews(p_limit int default 6)
returns table (id bigint, first_name text, course text, rating int, comment text, created_at timestamptz)
language sql stable security definer set search_path = public as
$$
  select r.id, split_part(coalesce(p.full_name, 'Student'), ' ', 1), c.title, r.rating, r.comment, r.created_at
  from public.reviews r
  join public.profiles p on p.id = r.student_id
  left join public.courses c on c.id = r.course_id
  where r.status = 'approved' and coalesce(r.comment, '') <> ''
  order by r.rating desc, r.created_at desc
  limit least(greatest(p_limit, 1), 20)
$$;
grant execute on function public.public_reviews(int) to anon, authenticated;
