-- =====================================================================
-- LLC — remove ALL test data before launch
-- Run once in Supabase → SQL Editor (project LLC / hmrivomeomhpeevydand).
-- Safe to re-run: a second run finds nothing and changes nothing.
--
-- What it removes
--   • the four test accounts (*@llc.com) and everything that belongs to them:
--     enrollments, payments, attendance, exam results, certificates, reviews,
--     placement attempts, lesson progress, agent file, referrals, commissions,
--     payouts, substitute requests, forms + responses, community posts,
--     comments and likes, tasks, notifications
--   • test content they created that would otherwise stay behind:
--     exams written by the test teacher, lessons written by the test teacher
--     (and units left empty by that), the class "Grammar (test class)"
--   • the empty placement test "llc" (no questions)
--   • every notification on the platform (nothing real exists before launch)
--   • audit-log lines written by the test accounts or by this clean-up
--
-- What it keeps
--   • your own admin account and everything you set up: courses, batches,
--     levels, categories, sessions, the placement test with its 22 questions,
--     grading scales, exam templates, rubrics, community channels, CMS settings
--
-- After running: delete the uploaded test files by hand (see the last query).
-- =====================================================================

-- 1) Preview — run this part alone first if you want to see what will go.
select 'test accounts' as item, count(*) from auth.users where email like '%@llc.com'
union all select 'their enrollments', count(*) from public.enrollments e join public.profiles p on p.id = e.student_id where p.email like '%@llc.com'
union all select 'their payments', count(*) from public.payments x join public.profiles p on p.id = x.student_id where p.email like '%@llc.com'
union all select 'exams by test teacher', count(*) from public.exams x join public.profiles p on p.id = x.created_by where p.email like '%@llc.com'
union all select 'lessons by test teacher', count(*) from public.lessons x join public.profiles p on p.id = x.created_by where p.email like '%@llc.com'
union all select 'test class sessions', count(*) from public.class_sessions where title = 'Grammar (test class)'
union all select 'empty placement test "llc"', count(*) from public.placement_tests t where t.title = 'llc' and not exists (select 1 from public.placement_questions q where q.test_id = t.id)
union all select 'notifications (all)', count(*) from public.notifications;

-- 2) Clean-up — everything in one transaction: all of it happens, or none.
do $$
declare
  test_ids uuid[];
  emptied_units bigint[];
  n int;
begin
  select coalesce(array_agg(id), '{}') into test_ids from auth.users where email like '%@llc.com';
  raise notice 'Test accounts found: %', coalesce(array_length(test_ids, 1), 0);

  -- content the test accounts wrote that is not deleted with them (its author is only set to empty)
  delete from public.exams where created_by = any (test_ids);
  get diagnostics n = row_count; raise notice 'Exams removed: %', n;

  select coalesce(array_agg(distinct unit_id), '{}') into emptied_units from public.lessons where created_by = any (test_ids);
  delete from public.lessons where created_by = any (test_ids);
  get diagnostics n = row_count; raise notice 'Lessons removed: %', n;
  delete from public.course_units u where u.id = any (emptied_units) and not exists (select 1 from public.lessons l where l.unit_id = u.id);
  get diagnostics n = row_count; raise notice 'Empty units removed: %', n;

  delete from public.class_sessions where title = 'Grammar (test class)';
  get diagnostics n = row_count; raise notice 'Test class sessions removed: %', n;

  delete from public.placement_tests t where t.title = 'llc' and not exists (select 1 from public.placement_questions q where q.test_id = t.id);
  get diagnostics n = row_count; raise notice 'Empty placement tests removed: %', n;

  -- the accounts themselves; their profile and everything linked to it goes with them
  delete from auth.users where id = any (test_ids);
  get diagnostics n = row_count; raise notice 'Accounts removed: %', n;

  -- pre-launch notifications (welcome / approved / broadcast tests)
  delete from public.notifications;
  get diagnostics n = row_count; raise notice 'Notifications removed: %', n;

  -- audit lines by the test accounts, and the ones this clean-up just wrote (same transaction time)
  delete from public.audit_log where actor_id = any (test_ids) or (actor_id is null and created_at = now())
    or (table_name in ('profiles', 'agent_profiles') and row_id = any (test_ids::text[]));
  get diagnostics n = row_count; raise notice 'Audit lines removed: %', n;
end $$;

-- 3) Check — every line should show 0.
select 'test accounts left' as item, count(*) from auth.users where email like '%@llc.com'
union all select 'test profiles left', count(*) from public.profiles where email like '%@llc.com'
union all select 'test class sessions left', count(*) from public.class_sessions where title = 'Grammar (test class)';

-- 4) Uploaded test files (receipts, passport images) are NOT removed by SQL: Supabase only
--    lets files be deleted from the Storage screen. This lists the folders to delete in
--    Storage → uploads. Each folder is named after the user id that uploaded it.
select split_part(name, '/', 1) as folder_to_delete, count(*) as files
from storage.objects o
where bucket_id = 'uploads'
  and not exists (select 1 from public.profiles p where p.id::text = split_part(o.name, '/', 1))
group by 1;
