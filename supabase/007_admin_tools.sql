-- =====================================================================
-- LLC — migration 007: site settings (CMS), accreditations, grading scales,
-- exam templates, rubrics, substitute requests, forms, audit log.
-- Run in Supabase → SQL Editor after 006. Safe to re-run.
-- =====================================================================

-- ---------- CMS / site settings (public read) --------------------------
create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;
drop policy if exists "site_settings: read" on public.site_settings;
create policy "site_settings: read" on public.site_settings for select to anon, authenticated using (true);
drop policy if exists "site_settings: admin write" on public.site_settings;
create policy "site_settings: admin write" on public.site_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- Accreditations (public read) ---------------------------------
create table if not exists public.accreditations (
  id bigint generated always as identity primary key,
  name text not null,
  issuer text,
  reference_no text,
  valid_until date,
  link text,
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.accreditations enable row level security;
drop policy if exists "accreditations: read" on public.accreditations;
create policy "accreditations: read" on public.accreditations for select to anon, authenticated using (is_public or public.is_admin());
drop policy if exists "accreditations: admin write" on public.accreditations;
create policy "accreditations: admin write" on public.accreditations for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- Grading scales, exam templates, rubrics (staff) ----------------
create table if not exists public.grading_scales (
  id bigint generated always as identity primary key,
  grade text not null unique,
  min_pct int not null check (min_pct between 0 and 100),
  label text,
  is_pass boolean not null default true
);
create table if not exists public.exam_templates (
  id bigint generated always as identity primary key,
  name text not null,
  kind text not null default 'quiz' check (kind in ('quiz', 'midterm', 'final')),
  duration_min int not null default 60,
  total_marks numeric(6, 2) not null default 100,
  instructions text,
  created_at timestamptz not null default now()
);
create table if not exists public.rubrics (
  id bigint generated always as identity primary key,
  name text not null,
  skill text not null default 'writing',
  criteria text not null, -- one criterion per line: "Task achievement | 5"
  created_at timestamptz not null default now()
);
do $$
declare t text;
begin
  foreach t in array array['grading_scales', 'exam_templates', 'rubrics'] loop
    execute format('alter table public.%1$s enable row level security', t);
    execute format('drop policy if exists "%1$s: read" on public.%1$s', t);
    execute format('create policy "%1$s: read" on public.%1$s for select to authenticated using (true)', t);
    execute format('drop policy if exists "%1$s: admin write" on public.%1$s', t);
    execute format('create policy "%1$s: admin write" on public.%1$s for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

insert into public.grading_scales (grade, min_pct, label, is_pass)
select * from (values ('A+', 90, 'Outstanding', true), ('A', 80, 'Excellent', true), ('B', 70, 'Very good', true), ('C', 60, 'Good', true), ('D', 50, 'Pass', true), ('F', 0, 'Not yet', false)) v(g, m, l, p)
where not exists (select 1 from public.grading_scales);

insert into public.exam_templates (name, kind, duration_min, total_marks, instructions)
select * from (values ('Unit quiz', 'quiz', 30, 20, 'Grammar and vocabulary from the last two units.'), ('Mid-term exam', 'midterm', 90, 100, 'Reading 30, Writing 30, Listening 20, Speaking 20.'), ('Final exam', 'final', 120, 100, 'All four skills. Speaking is assessed in a short interview.')) v(n, k, d, t, i)
where not exists (select 1 from public.exam_templates);

insert into public.rubrics (name, skill, criteria)
select 'Writing (B1–B2)', 'writing', E'Task achievement | 5\nCoherence & cohesion | 5\nVocabulary range | 5\nGrammar accuracy | 5'
where not exists (select 1 from public.rubrics);

-- ---------- Substitute requests -------------------------------------------
alter table public.class_sessions add column if not exists substitute_id uuid references public.profiles (id) on delete set null;
create table if not exists public.substitute_requests (
  id bigint generated always as identity primary key,
  session_id bigint not null references public.class_sessions (id) on delete cascade,
  requested_by uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  reason text not null,
  substitute_id uuid references public.profiles (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note text,
  created_at timestamptz not null default now()
);
alter table public.substitute_requests enable row level security;
drop policy if exists "substitute: read" on public.substitute_requests;
create policy "substitute: read" on public.substitute_requests for select to authenticated using (requested_by = auth.uid() or substitute_id = auth.uid() or public.is_admin());
drop policy if exists "substitute: request" on public.substitute_requests;
create policy "substitute: request" on public.substitute_requests for insert to authenticated with check (requested_by = auth.uid() and status = 'pending' and public.is_staff());
drop policy if exists "substitute: admin" on public.substitute_requests;
create policy "substitute: admin" on public.substitute_requests for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- Form builder ---------------------------------------------------
create table if not exists public.forms (
  id bigint generated always as identity primary key,
  owner_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  title text not null,
  description text,
  fields jsonb not null default '[]', -- [{key,label,type,required,options[]}]
  is_open boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.form_responses (
  id bigint generated always as identity primary key,
  form_id bigint not null references public.forms (id) on delete cascade,
  answers jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.forms enable row level security;
alter table public.form_responses enable row level security;
drop policy if exists "forms: public read open" on public.forms;
create policy "forms: public read open" on public.forms for select to anon, authenticated using (is_open or owner_id = auth.uid() or public.is_admin());
drop policy if exists "forms: owner write" on public.forms;
create policy "forms: owner write" on public.forms for all to authenticated
  using (owner_id = auth.uid() or public.is_admin()) with check ((owner_id = auth.uid() and public.my_role() in ('admin', 'agent', 'instructor')) or public.is_admin());
drop policy if exists "responses: submit" on public.form_responses;
create policy "responses: submit" on public.form_responses for insert to anon, authenticated
  with check (exists (select 1 from public.forms f where f.id = form_id and f.is_open));
drop policy if exists "responses: owner read" on public.form_responses;
create policy "responses: owner read" on public.form_responses for select to authenticated
  using (exists (select 1 from public.forms f where f.id = form_id and (f.owner_id = auth.uid() or public.is_admin())));
drop policy if exists "responses: owner delete" on public.form_responses;
create policy "responses: owner delete" on public.form_responses for delete to authenticated
  using (exists (select 1 from public.forms f where f.id = form_id and (f.owner_id = auth.uid() or public.is_admin())));
grant insert on public.form_responses to anon;
grant select on public.forms to anon;

-- ---------- Audit log ---------------------------------------------------------
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  actor_name text,
  action text not null,
  table_name text not null,
  row_id text,
  changes jsonb,
  created_at timestamptz not null default now()
);
alter table public.audit_log enable row level security;
drop policy if exists "audit: admin read" on public.audit_log;
create policy "audit: admin read" on public.audit_log for select to authenticated using (public.is_admin());

create or replace function public.audit() returns trigger
  language plpgsql security definer set search_path = public as
$$
declare diff jsonb; o jsonb; n jsonb; k text;
begin
  if tg_op = 'UPDATE' then
    o := to_jsonb(old); n := to_jsonb(new); diff := '{}';
    for k in select jsonb_object_keys(n) loop
      if k not in ('updated_at') and (o -> k) is distinct from (n -> k) then
        diff := diff || jsonb_build_object(k, jsonb_build_object('from', o -> k, 'to', n -> k));
      end if;
    end loop;
    if diff = '{}' then return new; end if;
  elsif tg_op = 'INSERT' then diff := to_jsonb(new);
  else diff := to_jsonb(old);
  end if;
  insert into public.audit_log (actor_id, actor_name, action, table_name, row_id, changes)
  values (auth.uid(), (select full_name from public.profiles where id = auth.uid()), lower(tg_op), tg_table_name,
          coalesce(case when tg_op = 'DELETE' then to_jsonb(old) ->> 'id' else to_jsonb(new) ->> 'id' end, ''), diff);
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles', 'enrollments', 'payments', 'courses', 'batches', 'certificates', 'agent_profiles', 'agent_earnings', 'agent_payouts', 'commission_rules', 'lessons', 'placement_attempts', 'site_settings', 'exam_results', 'substitute_requests'] loop
    execute format('drop trigger if exists audit_%1$s on public.%1$s', t);
    execute format('create trigger audit_%1$s after insert or update or delete on public.%1$s for each row execute function public.audit()', t);
  end loop;
end $$;
