-- =====================================================================
-- LLC — 012: the Finance Officer role ("finance")
-- Run in Supabase → SQL Editor after 011. Safe to re-run.
--
-- A finance officer handles money, without teaching, users or settings:
--   ✓ enrollment approval with payment verification, payments and receipts,
--     invoices, agent commissions (approve / cancel), agent payouts,
--     commission rules, agents' bank details (to pay them)
--   ✗ courses, batches, lessons, exams, attendance, placement, users and
--     roles, agent applications and contracts, CMS, audit log
-- Comparisons use role::text so this file works in one run.
-- =====================================================================

alter type public.app_role add value if not exists 'finance';

create or replace function public.is_finance() returns boolean
  language sql stable security definer set search_path = public as
$$ select coalesce((select role::text in ('admin', 'finance') from public.profiles where id = auth.uid()), false) $$;
grant execute on function public.is_finance() to authenticated;

-- see who is paying: student and agent profiles
drop policy if exists "profiles: finance read" on public.profiles;
create policy "profiles: finance read" on public.profiles for select to authenticated using (public.is_finance());

-- enrollments: read and approve (activating an enrollment verifies its payment)
drop policy if exists "enrollments: finance" on public.enrollments;
create policy "enrollments: finance" on public.enrollments for all to authenticated
  using (public.is_finance()) with check (public.is_finance());

-- payments: full control
drop policy if exists "payments: finance" on public.payments;
create policy "payments: finance" on public.payments for all to authenticated
  using (public.is_finance()) with check (public.is_finance());

-- activating an enrollment with a pending payment: admin or finance
create or replace function public.guard_enrollment_activation() returns trigger
  language plpgsql security definer set search_path = public as
$$
begin
  if auth.uid() is not null and not public.is_finance()
     and new.status = 'active' and old.status is distinct from 'active'
     and exists (select 1 from public.payments p where p.enrollment_id = new.id and p.status = 'pending') then
    raise exception 'This enrollment has a payment waiting for verification. Finance or an admin must approve it.';
  end if;
  return new;
end $$;

-- agents' money: commissions, payouts, commission rules; read referrals and bank details
do $$
declare t text;
begin
  foreach t in array array['agent_earnings', 'agent_payouts', 'commission_rules'] loop
    execute format('drop policy if exists "%1$s: finance" on public.%1$s', t);
    execute format('create policy "%1$s: finance" on public.%1$s for all to authenticated using (public.is_finance()) with check (public.is_finance())', t);
  end loop;
end $$;
drop policy if exists "agent_referrals: finance read" on public.agent_referrals;
create policy "agent_referrals: finance read" on public.agent_referrals for select to authenticated using (public.is_finance());
drop policy if exists "agent_profiles: finance read" on public.agent_profiles;
create policy "agent_profiles: finance read" on public.agent_profiles for select to authenticated using (public.is_finance());

-- batches list with seat counts on the enrollment screen
-- (batches are public already; nothing to add)

-- notifications: finance tells students and agents about payments and payouts
drop policy if exists "notifications: finance send" on public.notifications;
create policy "notifications: finance send" on public.notifications for insert to authenticated with check (public.is_finance());

-- receipts: finance opens the files students uploaded
drop policy if exists "uploads: finance read" on storage.objects;
create policy "uploads: finance read" on storage.objects for select to authenticated
  using (bucket_id = 'uploads' and public.is_finance());

-- To make someone a finance officer (or use Users → role in the admin portal):
--   update public.profiles set role = 'finance' where email = 'name@example.com';
