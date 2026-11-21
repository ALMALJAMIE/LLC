-- =====================================================================
-- LLC — migration 023: institutions (companies, schools, embassies…)
--   • a new account type "institution" for the person who manages an organisation's learners
--   • organisations, their managers, licences (seats on a course) and seat assignments
--   • training requests from the public website
-- Run in Supabase → SQL Editor after 022. Safe to re-run.
-- =====================================================================

alter type public.app_role add value if not exists 'institution';

alter table public.enrollments drop constraint if exists enrollments_source_check;
alter table public.enrollments add constraint enrollments_source_check check (source in ('self', 'agent', 'admin', 'organisation'));

create table if not exists public.organisations (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 2 and 200),
  kind text not null default 'company' check (kind in ('company', 'school', 'university', 'government', 'other')),
  contact_name text,
  email text,
  phone text,
  country text,
  address text,
  tax_id text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.organisation_managers (
  organisation_id bigint not null references public.organisations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (organisation_id, user_id)
);

create table if not exists public.licences (
  id bigint generated always as identity primary key,
  organisation_id bigint not null references public.organisations (id) on delete cascade,
  course_id bigint not null references public.courses (id) on delete restrict,
  batch_id bigint references public.batches (id) on delete set null,
  seats int not null check (seats > 0),
  valid_from date not null default current_date,
  valid_until date,
  payment_id bigint references public.payments (id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.seat_assignments (
  id bigint generated always as identity primary key,
  licence_id bigint not null references public.licences (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  enrollment_id bigint references public.enrollments (id) on delete set null,
  assigned_by uuid references public.profiles (id) on delete set null default auth.uid(),
  assigned_at timestamptz not null default now(),
  revoked_at timestamptz
);
create unique index if not exists seat_one_active on public.seat_assignments (licence_id, student_id) where revoked_at is null;

create table if not exists public.training_requests (
  id bigint generated always as identity primary key,
  organisation_name text not null check (char_length(organisation_name) between 2 and 200),
  contact_name text not null check (char_length(contact_name) between 2 and 120),
  email text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text,
  country text,
  learners int check (learners between 1 and 100000),
  needs text check (char_length(needs) <= 3000),
  preferred_mode text check (preferred_mode in ('online', 'face_to_face', 'hybrid')),
  status text not null default 'new' check (status in ('new', 'contacted', 'won', 'lost')),
  staff_note text,
  organisation_id bigint references public.organisations (id) on delete set null,
  created_at timestamptz not null default now()
);

create or replace function public.is_org_manager(p_org bigint) returns boolean
  language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.organisation_managers where organisation_id = p_org and user_id = auth.uid()) $$;
grant execute on function public.is_org_manager(bigint) to authenticated;

-- who runs institutions: admin and finance (contracts, invoices) and support (follow-up)
create or replace function public.can_manage_orgs() returns boolean
  language sql stable security definer set search_path = public as
$$ select coalesce((select role::text in ('admin', 'finance', 'support') from public.profiles where id = auth.uid()), false) $$;
grant execute on function public.can_manage_orgs() to authenticated;

alter table public.organisations enable row level security;
alter table public.organisation_managers enable row level security;
alter table public.licences enable row level security;
alter table public.seat_assignments enable row level security;
alter table public.training_requests enable row level security;

drop policy if exists "orgs: read" on public.organisations;
create policy "orgs: read" on public.organisations for select to authenticated using (public.can_manage_orgs() or public.is_org_manager(id));
drop policy if exists "orgs: manage" on public.organisations;
create policy "orgs: manage" on public.organisations for all to authenticated using (public.can_manage_orgs()) with check (public.can_manage_orgs());

drop policy if exists "org_managers: read" on public.organisation_managers;
create policy "org_managers: read" on public.organisation_managers for select to authenticated using (public.can_manage_orgs() or user_id = auth.uid());
drop policy if exists "org_managers: manage" on public.organisation_managers;
create policy "org_managers: manage" on public.organisation_managers for all to authenticated using (public.can_manage_orgs()) with check (public.can_manage_orgs());

drop policy if exists "licences: read" on public.licences;
create policy "licences: read" on public.licences for select to authenticated using (public.can_manage_orgs() or public.is_org_manager(organisation_id));
drop policy if exists "licences: manage" on public.licences;
create policy "licences: manage" on public.licences for all to authenticated using (public.can_manage_orgs()) with check (public.can_manage_orgs());

drop policy if exists "seats: read" on public.seat_assignments;
create policy "seats: read" on public.seat_assignments for select to authenticated using (
  public.can_manage_orgs() or student_id = auth.uid()
  or exists (select 1 from public.licences l where l.id = licence_id and public.is_org_manager(l.organisation_id)));

drop policy if exists "training: public send" on public.training_requests;
create policy "training: public send" on public.training_requests for insert to anon, authenticated with check (status = 'new' and staff_note is null and organisation_id is null);
drop policy if exists "training: staff" on public.training_requests;
create policy "training: staff" on public.training_requests for all to authenticated using (public.can_manage_orgs()) with check (public.can_manage_orgs());

-- tell the office about a new training request
create or replace function public.on_training_request() returns trigger
  language plpgsql security definer set search_path = public as
$$
begin
  insert into public.notifications (user_id, title, body, link)
  select id, 'New training request', new.organisation_name || coalesce(' · ' || new.learners || ' learners', ''), '/admin/training-requests'
    from public.profiles where role::text in ('admin', 'support') and is_active;
  return new;
end $$;
drop trigger if exists training_requests_notify on public.training_requests;
create trigger training_requests_notify after insert on public.training_requests for each row execute function public.on_training_request();

-- make someone (an existing account) the manager of an organisation; their account becomes an institution account
create or replace function public.add_org_manager(p_org bigint, p_email text) returns uuid
  language plpgsql security definer set search_path = public as
$$
declare u public.profiles;
begin
  if not public.can_manage_orgs() then raise exception 'Not allowed.'; end if;
  select * into u from public.profiles where lower(email) = lower(btrim(p_email));
  if u.id is null then raise exception 'No account uses this email. Ask the person to create an account first, then add them.'; end if;
  if u.role::text not in ('student', 'institution') then raise exception 'This email belongs to a % account. Use a separate account for the institution.', u.role; end if;
  if u.role::text = 'student' and exists (select 1 from public.enrollments where student_id = u.id) then
    raise exception 'This account is a student with courses. Use a separate account for the institution.';
  end if;
  update public.profiles set role = 'institution' where id = u.id;
  insert into public.organisation_managers (organisation_id, user_id) values (p_org, u.id) on conflict do nothing;
  insert into public.notifications (user_id, title, body, link)
  values (u.id, 'Institution portal opened', (select name from public.organisations where id = p_org), '/institution-dashboard');
  return u.id;
end $$;
grant execute on function public.add_org_manager(bigint, text) to authenticated;

-- the institution manager gives a seat to a learner (an existing student account)
create or replace function public.assign_seat(p_licence bigint, p_email text) returns bigint
  language plpgsql security definer set search_path = public as
$$
declare l public.licences; u public.profiles; used int; en bigint; sid bigint;
begin
  select * into l from public.licences where id = p_licence;
  if l.id is null or not (public.is_org_manager(l.organisation_id) or public.can_manage_orgs()) then raise exception 'Licence not found.'; end if;
  if (select status from public.organisations where id = l.organisation_id) <> 'active' then raise exception 'This organisation is not active.'; end if;
  if l.valid_until is not null and l.valid_until < current_date then raise exception 'This licence has ended.'; end if;
  select count(*) into used from public.seat_assignments where licence_id = l.id and revoked_at is null;
  if used >= l.seats then raise exception 'All % seats are taken. Free a seat or ask LLC for more.', l.seats; end if;
  select * into u from public.profiles where lower(email) = lower(btrim(p_email));
  if u.id is null then raise exception 'No account uses this email. Ask the learner to create a student account on the LLC website first.'; end if;
  if u.role::text <> 'student' then raise exception 'This email is not a student account.'; end if;
  if exists (select 1 from public.seat_assignments where licence_id = l.id and student_id = u.id and revoked_at is null) then
    raise exception 'This learner already has a seat.';
  end if;
  select id into en from public.enrollments where student_id = u.id and course_id = l.course_id and status in ('active', 'completed') limit 1;
  if en is null then
    insert into public.enrollments (student_id, course_id, batch_id, status, source, note)
    values (u.id, l.course_id, l.batch_id, 'active', 'organisation', (select name from public.organisations where id = l.organisation_id))
    returning id into en;
  end if;
  insert into public.seat_assignments (licence_id, student_id, enrollment_id) values (l.id, u.id, en) returning id into sid;
  insert into public.notifications (user_id, title, body, link)
  values (u.id, 'You have a place on a course', (select title from public.courses where id = l.course_id) || ' · ' ||
          (select name from public.organisations where id = l.organisation_id) ||
          case when public.placement_done(u.id) then '' else ' · take the placement test first' end, '/student/my-learning');
  return sid;
end $$;
grant execute on function public.assign_seat(bigint, text) to authenticated;

create or replace function public.revoke_seat(p_seat bigint) returns void
  language plpgsql security definer set search_path = public as
$$
declare s public.seat_assignments; l public.licences;
begin
  select * into s from public.seat_assignments where id = p_seat and revoked_at is null;
  select * into l from public.licences where id = s.licence_id;
  if s.id is null or not (public.is_org_manager(l.organisation_id) or public.can_manage_orgs()) then raise exception 'Seat not found.'; end if;
  update public.seat_assignments set revoked_at = now() where id = s.id;
  update public.enrollments set status = 'cancelled', note = coalesce(note || ' · ', '') || 'seat removed'
   where id = s.enrollment_id and source = 'organisation' and status = 'active';
end $$;
grant execute on function public.revoke_seat(bigint) to authenticated;

-- what the institution manager sees: licences, learners, progress and attendance
create or replace function public.org_overview(p_org bigint) returns jsonb
  language plpgsql stable security definer set search_path = public as
$$
begin
  if not (public.is_org_manager(p_org) or public.can_manage_orgs()) then raise exception 'Not allowed.'; end if;
  return jsonb_build_object(
    'organisation', (select to_jsonb(o) - 'notes' from public.organisations o where o.id = p_org),
    'licences', coalesce((select jsonb_agg(jsonb_build_object(
        'id', l.id, 'course', c.title, 'course_code', c.code, 'batch', b.name, 'seats', l.seats, 'valid_from', l.valid_from, 'valid_until', l.valid_until,
        'learners', coalesce((select jsonb_agg(jsonb_build_object(
            'seat_id', s.id, 'name', p.full_name, 'email', p.email, 'assigned_at', s.assigned_at,
            'placed', public.placement_done(p.id),
            'level', (select lv.name from public.levels lv where lv.id = p.level_id),
            'progress', e.progress, 'status', e.status,
            'attendance', (select round(100.0 * count(*) filter (where a.status in ('present', 'late')) / nullif(count(*), 0))
                             from public.attendance a join public.class_sessions cs on cs.id = a.session_id
                            where a.student_id = p.id and cs.batch_id = e.batch_id),
            'last_active', (select max(day) from public.study_days d where d.student_id = p.id)
          ) order by p.full_name) from public.seat_assignments s join public.profiles p on p.id = s.student_id
             left join public.enrollments e on e.id = s.enrollment_id
            where s.licence_id = l.id and s.revoked_at is null), '[]'::jsonb)
      ) order by l.created_at desc) from public.licences l join public.courses c on c.id = l.course_id left join public.batches b on b.id = l.batch_id
      where l.organisation_id = p_org), '[]'::jsonb),
    'invoices', coalesce((select jsonb_agg(jsonb_build_object('id', py.id, 'invoice_no', py.invoice_no, 'description', py.description, 'amount', py.amount,
        'currency', py.currency, 'status', py.status, 'created_at', py.created_at, 'due_at', py.due_at) order by py.created_at desc)
      from public.payments py where py.student_id in (select user_id from public.organisation_managers where organisation_id = p_org)), '[]'::jsonb)
  );
end $$;
grant execute on function public.org_overview(bigint) to authenticated;

-- institution managers can read their own invoices (payments billed to them) like any user, and see the courses list
