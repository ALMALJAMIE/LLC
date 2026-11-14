-- =====================================================================
-- LLC — migration 003: agents (applications, contracts, referrals,
-- commissions, earnings, payouts) + course units for instructors.
-- Run in Supabase → SQL Editor after 002. Safe to re-run.
-- =====================================================================

-- ---------- Fix: allow role changes made from the SQL editor -----------
-- (auth.uid() is null there; before this fix such changes were reverted.)
create or replace function public.guard_profile_update() returns trigger
  language plpgsql security definer set search_path = public as
$$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.role := old.role;
    new.is_active := old.is_active;
    new.student_no := old.student_no;
  end if;
  new.updated_at := now();
  return new;
end $$;

-- ---------- Agent profile (one row per agent / applicant) --------------
create table if not exists public.agent_profiles (
  id uuid primary key references public.profiles (id) on delete cascade,
  company text,
  country text,
  address text,
  registration_no text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'suspended')),
  review_note text,
  contract_version int,
  contract_signed_at timestamptz,
  signature_name text,
  payout_currency text not null default 'MYR',
  paypal_email text,
  bank_name text,
  bank_account_name text,
  bank_account_no text,
  swift text,
  iban text,
  bank_address text,
  created_at timestamptz not null default now()
);

create or replace function public.guard_agent_profile() returns trigger
  language plpgsql security definer set search_path = public as
$$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.status := old.status;
    new.review_note := old.review_note;
  end if;
  return new;
end $$;
drop trigger if exists agent_profiles_guard on public.agent_profiles;
create trigger agent_profiles_guard before update on public.agent_profiles
  for each row execute function public.guard_agent_profile();

-- Sign-ups that tick "apply as agent" get an application row.
create or replace function public.handle_agent_application() returns trigger
  language plpgsql security definer set search_path = public as
$$
begin
  if coalesce((new.raw_user_meta_data ->> 'apply_agent')::boolean, false) then
    insert into public.agent_profiles (id, company, country)
    values (new.id, new.raw_user_meta_data ->> 'company', new.raw_user_meta_data ->> 'country')
    on conflict (id) do nothing;
  end if;
  return new;
end $$;
drop trigger if exists on_auth_user_agent on auth.users;
drop trigger if exists on_auth_user_zz_agent on auth.users;
-- named "zz" so it runs after on_auth_user_created (triggers fire alphabetically)
create trigger on_auth_user_zz_agent after insert on auth.users
  for each row execute function public.handle_agent_application();

-- Approving an application turns the account into an agent.
create or replace function public.sync_agent_role() returns trigger
  language plpgsql security definer set search_path = public as
$$
begin
  if new.status = 'approved' and (old.status is distinct from 'approved') then
    update public.profiles set role = 'agent' where id = new.id and role = 'student';
  end if;
  return new;
end $$;
drop trigger if exists agent_role_sync on public.agent_profiles;
create trigger agent_role_sync after update on public.agent_profiles
  for each row execute function public.sync_agent_role();

-- ---------- Contract, document rules ------------------------------------
create table if not exists public.contract_templates (
  id bigint generated always as identity primary key,
  version int not null unique,
  title text not null default 'Agent Appointment Agreement',
  body text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.agent_doc_requirements (
  id bigint generated always as identity primary key,
  name text not null,
  description text,
  required boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.agent_documents (
  id bigint generated always as identity primary key,
  agent_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  requirement_id bigint references public.agent_doc_requirements (id) on delete set null,
  file_url text not null,
  status text not null default 'submitted' check (status in ('submitted', 'accepted', 'rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.student_doc_requirements (
  id bigint generated always as identity primary key,
  name text not null,
  description text,
  required boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- Referrals (agent enrolls a student) ------------------------
create table if not exists public.agent_referrals (
  id bigint generated always as identity primary key,
  agent_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  student_name text not null,
  student_email text not null,
  student_phone text,
  student_country text,
  course_id bigint not null references public.courses (id) on delete cascade,
  documents jsonb not null default '{}',
  status text not null default 'submitted' check (status in ('submitted', 'approved', 'rejected')),
  review_note text,
  student_id uuid references public.profiles (id) on delete set null,
  enrollment_id bigint references public.enrollments (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- Commission, earnings, payouts -------------------------------
create table if not exists public.commission_rules (
  id bigint generated always as identity primary key,
  name text not null,
  course_id bigint references public.courses (id) on delete cascade,
  kind text not null default 'percent' check (kind in ('percent', 'fixed')),
  value numeric(10, 2) not null check (value >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.agent_payouts (
  id bigint generated always as identity primary key,
  agent_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  amount numeric(10, 2) not null check (amount > 0),
  currency text not null default 'MYR',
  status text not null default 'requested' check (status in ('requested', 'paid', 'rejected')),
  method text,
  reference text,
  note text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.agent_earnings (
  id bigint generated always as identity primary key,
  agent_id uuid not null references public.profiles (id) on delete cascade,
  enrollment_id bigint unique references public.enrollments (id) on delete set null,
  rule_id bigint references public.commission_rules (id) on delete set null,
  amount numeric(10, 2) not null,
  currency text not null default 'MYR',
  status text not null default 'pending' check (status in ('pending', 'approved', 'paid', 'cancelled')),
  payout_id bigint references public.agent_payouts (id) on delete set null,
  created_at timestamptz not null default now()
);

-- When an agent's enrollment becomes active, calculate the commission once.
create or replace function public.create_agent_earning() returns trigger
  language plpgsql security definer set search_path = public as
$$
declare r public.commission_rules; price numeric; amt numeric;
begin
  if new.agent_id is null or new.status <> 'active' then return new; end if;
  if exists (select 1 from public.agent_earnings where enrollment_id = new.id) then return new; end if;
  select * into r from public.commission_rules
   where is_active and (course_id = new.course_id or course_id is null)
   order by (course_id is null), id limit 1;
  if r.id is null then return new; end if;
  select c.price into price from public.courses c where c.id = new.course_id;
  amt := case when r.kind = 'percent' then round(coalesce(price, 0) * r.value / 100, 2) else r.value end;
  if amt > 0 then
    insert into public.agent_earnings (agent_id, enrollment_id, rule_id, amount) values (new.agent_id, new.id, r.id, amt);
  end if;
  return new;
end $$;
drop trigger if exists enrollment_agent_earning on public.enrollments;
create trigger enrollment_agent_earning after insert or update of status on public.enrollments
  for each row execute function public.create_agent_earning();

-- Agents request a payout of their approved, unpaid earnings.
create or replace function public.request_payout() returns bigint
  language plpgsql security definer set search_path = public as
$$
declare total numeric; pid bigint;
begin
  if public.my_role() <> 'agent' then raise exception 'Only agents can request payouts.'; end if;
  select coalesce(sum(amount), 0) into total from public.agent_earnings where agent_id = auth.uid() and status = 'approved' and payout_id is null;
  if total <= 0 then raise exception 'You have no approved earnings to withdraw.'; end if;
  insert into public.agent_payouts (agent_id, amount, currency, method)
  values (auth.uid(), total, coalesce((select payout_currency from public.agent_profiles where id = auth.uid()), 'MYR'), 'bank_transfer')
  returning id into pid;
  update public.agent_earnings set payout_id = pid where agent_id = auth.uid() and status = 'approved' and payout_id is null;
  return pid;
end $$;
grant execute on function public.request_payout() to authenticated;

-- Paying (or rejecting) a payout updates the linked earnings.
create or replace function public.sync_payout() returns trigger
  language plpgsql security definer set search_path = public as
$$
begin
  if new.status = 'paid' and old.status <> 'paid' then
    update public.agent_earnings set status = 'paid' where payout_id = new.id;
    new.paid_at := coalesce(new.paid_at, now());
  elsif new.status = 'rejected' and old.status <> 'rejected' then
    update public.agent_earnings set payout_id = null where payout_id = new.id;
  end if;
  return new;
end $$;
drop trigger if exists payout_sync on public.agent_payouts;
create trigger payout_sync before update on public.agent_payouts
  for each row execute function public.sync_payout();

-- ---------- Row-level security ----------------------------------------
alter table public.agent_profiles enable row level security;
alter table public.contract_templates enable row level security;
alter table public.agent_doc_requirements enable row level security;
alter table public.agent_documents enable row level security;
alter table public.student_doc_requirements enable row level security;
alter table public.agent_referrals enable row level security;
alter table public.commission_rules enable row level security;
alter table public.agent_payouts enable row level security;
alter table public.agent_earnings enable row level security;

do $$
declare t text;
begin
  -- reference data: everyone signed in reads, admin writes
  foreach t in array array['contract_templates', 'agent_doc_requirements', 'student_doc_requirements', 'commission_rules'] loop
    execute format('drop policy if exists "%1$s: read" on public.%1$s', t);
    execute format('create policy "%1$s: read" on public.%1$s for select to authenticated using (true)', t);
    execute format('drop policy if exists "%1$s: admin write" on public.%1$s', t);
    execute format('create policy "%1$s: admin write" on public.%1$s for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
  -- agent-owned rows: owner reads, admin does everything
  foreach t in array array['agent_documents', 'agent_referrals', 'agent_payouts', 'agent_earnings'] loop
    execute format('drop policy if exists "%1$s: own read" on public.%1$s', t);
    execute format('create policy "%1$s: own read" on public.%1$s for select to authenticated using (agent_id = auth.uid() or public.is_admin())', t);
    execute format('drop policy if exists "%1$s: admin write" on public.%1$s', t);
    execute format('create policy "%1$s: admin write" on public.%1$s for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

drop policy if exists "agent_profiles: own or admin read" on public.agent_profiles;
create policy "agent_profiles: own or admin read" on public.agent_profiles for select to authenticated using (id = auth.uid() or public.is_admin());
drop policy if exists "agent_profiles: own update" on public.agent_profiles;
create policy "agent_profiles: own update" on public.agent_profiles for update to authenticated using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());
drop policy if exists "agent_profiles: apply" on public.agent_profiles;
create policy "agent_profiles: apply" on public.agent_profiles for insert to authenticated with check (id = auth.uid() and status = 'pending');
drop policy if exists "agent_profiles: admin all" on public.agent_profiles;
create policy "agent_profiles: admin all" on public.agent_profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "agent_documents: own write" on public.agent_documents;
create policy "agent_documents: own write" on public.agent_documents for insert to authenticated with check (agent_id = auth.uid() and status = 'submitted');
drop policy if exists "agent_documents: own delete" on public.agent_documents;
create policy "agent_documents: own delete" on public.agent_documents for delete to authenticated using (agent_id = auth.uid() and status = 'submitted');

drop policy if exists "agent_referrals: agent submit" on public.agent_referrals;
create policy "agent_referrals: agent submit" on public.agent_referrals for insert to authenticated
  with check (agent_id = auth.uid() and status = 'submitted' and public.my_role() = 'agent');

-- Admin may also view agents' uploaded files (already covered by staff rule on storage).

-- Instructors may build course units (lessons already allowed).
drop policy if exists "course_units: staff write" on public.course_units;
create policy "course_units: staff write" on public.course_units for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ---------- Starter data -------------------------------------------------
insert into public.contract_templates (version, title, body)
select 1, 'Agent Appointment Agreement',
'Section 1 — Appointment
Language Leap Center ("LLC") appoints the Agent as a non-exclusive representative to introduce students to LLC courses.

Section 2 — Duties of the Agent
The Agent will give students accurate information about courses, fees and schedules, submit complete and genuine documents, and follow LLC policies.

Section 3 — Commission
LLC pays commission on each student who is enrolled and has paid in full, according to the commission rules published in the Agent portal at the time of enrollment. Commission is cancelled if the fee is refunded.

Section 4 — Payment
Approved commission can be withdrawn from the Agent portal and is paid to the bank account the Agent provides.

Section 5 — Term and termination
This agreement continues until either party ends it with 30 days'' written notice. LLC may suspend the Agent immediately for misconduct.

Section 6 — Confidentiality
The Agent keeps student personal data confidential and uses it only for enrollment with LLC.'
where not exists (select 1 from public.contract_templates);

insert into public.student_doc_requirements (name, description, required)
select * from (values ('Passport / Government ID', 'Clear copy of the photo page.', true), ('Recent photo', 'Passport-size photo, white background.', false)) v(n, d, r)
where not exists (select 1 from public.student_doc_requirements);

insert into public.agent_doc_requirements (name, description, required)
select * from (values ('Passport / Government ID', 'Photo page of the agent or company representative.', true), ('Company registration', 'Business licence if applying as a company.', false)) v(n, d, r)
where not exists (select 1 from public.agent_doc_requirements);

insert into public.commission_rules (name, course_id, kind, value)
select 'Default commission', null, 'percent', 10
where not exists (select 1 from public.commission_rules);

-- ---------- Privacy: agents only see the students they referred ---------
drop policy if exists "profiles: read own or staff" on public.profiles;
create policy "profiles: read own or staff" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff());
drop policy if exists "profiles: agent's students" on public.profiles;
create policy "profiles: agent's students" on public.profiles for select to authenticated
  using (exists (select 1 from public.enrollments e where e.student_id = profiles.id and e.agent_id = auth.uid()));
