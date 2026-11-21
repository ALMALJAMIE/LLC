-- =====================================================================
-- LLC — migration 021: certificate check, support tickets, website pages,
--                      community reports, privacy (PDPA) consents and requests
-- Run once in Supabase → SQL Editor (after 020). Safe to re-run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Public certificate check (anyone with the certificate number)
-- ---------------------------------------------------------------------
alter table public.certificates add column if not exists revoked boolean not null default false;
alter table public.certificates add column if not exists revoked_reason text;

create or replace function public.verify_certificate(p_serial text)
returns table (serial text, student_name text, title text, course text, issued_at date, revoked boolean)
language sql stable security definer set search_path = public as
$$
  select c.serial, p.full_name, c.title, co.title, c.issued_at, c.revoked
  from public.certificates c
  join public.profiles p on p.id = c.student_id
  left join public.courses co on co.id = c.course_id
  where upper(btrim(c.serial)) = upper(btrim(p_serial))
  limit 1
$$;
grant execute on function public.verify_certificate(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Support tickets
-- ---------------------------------------------------------------------
create table if not exists public.support_tickets (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  subject text not null check (char_length(subject) between 3 and 200),
  category text not null default 'general' check (category in ('general', 'technical', 'payment', 'course', 'account', 'other')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  status text not null default 'open' check (status in ('open', 'waiting', 'resolved', 'closed')),
  assigned_to uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists support_tickets_user_idx on public.support_tickets (user_id, updated_at desc);

create table if not exists public.ticket_messages (
  id bigint generated always as identity primary key,
  ticket_id bigint not null references public.support_tickets (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  body text not null check (char_length(body) between 1 and 5000),
  attachment_path text,
  internal boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists ticket_messages_ticket_idx on public.ticket_messages (ticket_id, created_at);

create or replace function public.is_helpdesk() returns boolean
  language sql stable security definer set search_path = public as
$$ select coalesce((select role::text in ('admin', 'support') from public.profiles where id = auth.uid()), false) $$;
grant execute on function public.is_helpdesk() to authenticated;

alter table public.support_tickets enable row level security;
drop policy if exists "tickets: own or helpdesk read" on public.support_tickets;
create policy "tickets: own or helpdesk read" on public.support_tickets for select to authenticated using (user_id = auth.uid() or public.is_helpdesk());
drop policy if exists "tickets: open own" on public.support_tickets;
create policy "tickets: open own" on public.support_tickets for insert to authenticated with check (user_id = auth.uid() and status = 'open');
drop policy if exists "tickets: update" on public.support_tickets;
create policy "tickets: update" on public.support_tickets for update to authenticated using (user_id = auth.uid() or public.is_helpdesk());

-- the owner can only close / reopen; the helpdesk can change everything
create or replace function public.guard_ticket() returns trigger
  language plpgsql security definer set search_path = public as
$$
begin
  new.user_id := old.user_id; new.created_at := old.created_at;
  if not public.is_helpdesk() then
    new.subject := old.subject; new.category := old.category; new.priority := old.priority; new.assigned_to := old.assigned_to;
    if new.status not in ('closed', 'open') then new.status := old.status; end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists tickets_guard on public.support_tickets;
create trigger tickets_guard before update on public.support_tickets for each row execute function public.guard_ticket();

alter table public.ticket_messages enable row level security;
drop policy if exists "ticket_messages: read" on public.ticket_messages;
create policy "ticket_messages: read" on public.ticket_messages for select to authenticated using (
  public.is_helpdesk() or (not internal and exists (select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = auth.uid())));
drop policy if exists "ticket_messages: write" on public.ticket_messages;
create policy "ticket_messages: write" on public.ticket_messages for insert to authenticated with check (
  author_id = auth.uid() and (public.is_helpdesk()
    or (not internal and exists (select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = auth.uid() and t.status <> 'closed'))));

-- a new message updates the ticket and tells the other side
create or replace function public.on_ticket_message() returns trigger
  language plpgsql security definer set search_path = public as
$$
declare t public.support_tickets;
begin
  select * into t from public.support_tickets where id = new.ticket_id;
  if new.author_id = t.user_id then
    update public.support_tickets set status = 'open', updated_at = now() where id = t.id;
    insert into public.notifications (user_id, title, body, link)
    select coalesce(t.assigned_to, p.id), 'Support ticket #' || t.id || ': ' || t.subject, left(new.body, 140), '/support/tickets'
    from public.profiles p where (t.assigned_to is null and p.role::text in ('support', 'admin') and p.is_active) or p.id = t.assigned_to
    group by coalesce(t.assigned_to, p.id);
  elsif not new.internal then
    update public.support_tickets set status = case when status = 'closed' then status else 'waiting' end, updated_at = now() where id = t.id;
    insert into public.notifications (user_id, title, body, link)
    values (t.user_id, 'Reply to your support request #' || t.id, left(new.body, 140), '/help-desk');
  end if;
  return new;
end $$;
drop trigger if exists ticket_messages_after on public.ticket_messages;
create trigger ticket_messages_after after insert on public.ticket_messages for each row execute function public.on_ticket_message();

-- ---------------------------------------------------------------------
-- 3. Website pages: blog posts, help articles, legal pages, other pages
-- ---------------------------------------------------------------------
create table if not exists public.cms_pages (
  id bigint generated always as identity primary key,
  kind text not null default 'page' check (kind in ('blog', 'help', 'legal', 'page')),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null,
  excerpt text,
  body text not null default '',
  cover_url text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  show_in_footer boolean not null default false,
  sort_order int not null default 0,
  published_at timestamptz,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.cms_page_versions (
  id bigint generated always as identity primary key,
  page_id bigint not null references public.cms_pages (id) on delete cascade,
  title text not null,
  body text not null,
  saved_by uuid references public.profiles (id) on delete set null,
  saved_at timestamptz not null default now()
);

create or replace function public.can_edit_content() returns boolean
  language sql stable security definer set search_path = public as
$$ select coalesce((select role::text in ('admin', 'academic', 'support') from public.profiles where id = auth.uid()), false) $$;
grant execute on function public.can_edit_content() to authenticated;

alter table public.cms_pages enable row level security;
drop policy if exists "cms_pages: public read" on public.cms_pages;
create policy "cms_pages: public read" on public.cms_pages for select to anon, authenticated using (status = 'published' or public.can_edit_content());
drop policy if exists "cms_pages: edit" on public.cms_pages;
create policy "cms_pages: edit" on public.cms_pages for all to authenticated using (public.can_edit_content()) with check (public.can_edit_content());
alter table public.cms_page_versions enable row level security;
drop policy if exists "cms_versions: editors" on public.cms_page_versions;
create policy "cms_versions: editors" on public.cms_page_versions for select to authenticated using (public.can_edit_content());

-- keep the previous text each time a page changes
create or replace function public.cms_page_saved() returns trigger
  language plpgsql security definer set search_path = public as
$$
begin
  new.updated_at := now(); new.updated_by := auth.uid();
  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then new.published_at := coalesce(new.published_at, now()); end if;
  if tg_op = 'UPDATE' and (new.body is distinct from old.body or new.title is distinct from old.title) then
    insert into public.cms_page_versions (page_id, title, body, saved_by) values (old.id, old.title, old.body, auth.uid());
  end if;
  return new;
end $$;
drop trigger if exists cms_pages_saved on public.cms_pages;
create trigger cms_pages_saved before insert or update on public.cms_pages for each row execute function public.cms_page_saved();

-- starter legal pages as DRAFTS (they must be reviewed before publishing)
insert into public.cms_pages (kind, slug, title, excerpt, body, status, show_in_footer, sort_order) values
 ('legal', 'privacy', 'Privacy Notice', 'How Language Leap Center collects and uses personal data.',
  E'# Privacy Notice\n\n**Draft — to be reviewed before publishing.**\n\n## What we collect\n- Your name, email, phone, nationality and date of birth\n- Your course, attendance, test and exam records\n- Payment records (we do not store card numbers)\n\n## Why we use it\n- To place you at the right level, run your classes and issue certificates\n- To process payments and answer your questions\n\n## Your rights (PDPA 2010)\nYou can ask to see, correct or delete your data from **My Profile → Privacy**, or by contacting us.\n\n## Contact\n[[Company name, address, email]]', 'draft', true, 1),
 ('legal', 'terms', 'Terms of Use', 'The rules for using the platform and our courses.',
  E'# Terms of Use\n\n**Draft — to be reviewed before publishing.**\n\n- Accounts are personal and must not be shared.\n- Course materials are for your own study only.\n- Be respectful in the community; posts that break the rules are removed.\n\n[[Company details]]', 'draft', true, 2),
 ('legal', 'refunds', 'Refund Policy', 'When and how course fees are refunded.',
  E'# Refund Policy\n\n**Draft — to be reviewed before publishing.**\n\n- Self-paced courses: within 14 days of purchase and before 20% of the course is completed.\n- Live and blended courses: up to 7 days before the first class of your batch.\n- Later requests are reviewed case by case.\n\nTo ask for a refund, open a support request from your portal.', 'draft', true, 3)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- 4. Community reports
-- ---------------------------------------------------------------------
alter table public.community_posts add column if not exists hidden boolean not null default false;
create table if not exists public.community_reports (
  id bigint generated always as identity primary key,
  post_id bigint not null references public.community_posts (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  reason text not null check (char_length(reason) between 3 and 500),
  status text not null default 'open' check (status in ('open', 'dismissed', 'actioned')),
  handled_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (post_id, reporter_id)
);
alter table public.community_reports enable row level security;
drop policy if exists "reports: file" on public.community_reports;
create policy "reports: file" on public.community_reports for insert to authenticated with check (reporter_id = auth.uid() and status = 'open');
drop policy if exists "reports: moderators" on public.community_reports;
create policy "reports: moderators" on public.community_reports for select to authenticated using (reporter_id = auth.uid() or public.is_academic() or public.is_helpdesk());
drop policy if exists "reports: handle" on public.community_reports;
create policy "reports: handle" on public.community_reports for update to authenticated using (public.is_academic() or public.is_helpdesk());

-- hidden posts disappear for everyone except their author and moderators
drop policy if exists "posts: read" on public.community_posts;
create policy "posts: read" on public.community_posts for select to authenticated using (
  (channel_id is null or public.can_see_channel(channel_id))
  and (not hidden or author_id = auth.uid() or public.is_academic() or public.is_helpdesk()));
drop policy if exists "posts: moderate" on public.community_posts;
create policy "posts: moderate" on public.community_posts for update to authenticated using (public.is_academic() or public.is_helpdesk());

-- three separate reports hide a post automatically until a moderator looks at it
create or replace function public.on_community_report() returns trigger
  language plpgsql security definer set search_path = public as
$$
begin
  if (select count(*) from public.community_reports where post_id = new.post_id and status = 'open') >= 3 then
    update public.community_posts set hidden = true where id = new.post_id;
  end if;
  return new;
end $$;
drop trigger if exists community_reports_after on public.community_reports;
create trigger community_reports_after after insert on public.community_reports for each row execute function public.on_community_report();

-- ---------------------------------------------------------------------
-- 5. Privacy (PDPA): consents and data requests
-- ---------------------------------------------------------------------
create table if not exists public.consents (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  kind text not null check (kind in ('privacy', 'terms', 'marketing', 'recording')),
  version text not null default '1',
  granted boolean not null,
  created_at timestamptz not null default now()
);
create index if not exists consents_user_idx on public.consents (user_id, kind, created_at desc);
alter table public.consents enable row level security;
drop policy if exists "consents: own or staff read" on public.consents;
create policy "consents: own or staff read" on public.consents for select to authenticated using (user_id = auth.uid() or public.is_admin() or public.is_helpdesk());
drop policy if exists "consents: record own" on public.consents;
create policy "consents: record own" on public.consents for insert to authenticated with check (user_id = auth.uid());

create table if not exists public.data_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  kind text not null check (kind in ('access', 'correction', 'deletion')),
  details text,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'rejected')),
  response text,
  handled_by uuid references public.profiles (id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.data_requests enable row level security;
drop policy if exists "data_requests: own or admin read" on public.data_requests;
create policy "data_requests: own or admin read" on public.data_requests for select to authenticated using (user_id = auth.uid() or public.is_admin() or public.is_helpdesk());
drop policy if exists "data_requests: file own" on public.data_requests;
create policy "data_requests: file own" on public.data_requests for insert to authenticated with check (user_id = auth.uid() and status = 'pending');
drop policy if exists "data_requests: handle" on public.data_requests;
create policy "data_requests: handle" on public.data_requests for update to authenticated using (public.is_admin() or public.is_helpdesk());

create or replace function public.on_data_request() returns trigger
  language plpgsql security definer set search_path = public as
$$
begin
  if tg_op = 'INSERT' then
    insert into public.notifications (user_id, title, body, link)
    select p.id, 'New privacy request (' || new.kind || ')', (select full_name from public.profiles where id = new.user_id), '/admin/privacy'
    from public.profiles p where p.role::text = 'admin' and p.is_active;
    return new;
  end if;
  new.user_id := old.user_id; new.kind := old.kind; new.details := old.details;
  if new.status <> old.status then
    new.handled_by := auth.uid(); new.handled_at := now();
    insert into public.notifications (user_id, title, body, link) values (new.user_id, 'Your privacy request is ' || replace(new.status, '_', ' '), new.response, '/manage-profile');
  end if;
  return new;
end $$;
drop trigger if exists data_requests_trg on public.data_requests;
create trigger data_requests_trg before insert or update on public.data_requests for each row execute function public.on_data_request();

-- export of the signed-in user's own data (for an access request)
create or replace function public.my_data_export() returns jsonb
  language sql stable security definer set search_path = public as
$$
  select jsonb_build_object(
    'profile', (select to_jsonb(p) - 'placement_exempt_note' from public.profiles p where p.id = auth.uid()),
    'enrollments', (select coalesce(jsonb_agg(to_jsonb(e)), '[]') from public.enrollments e where e.student_id = auth.uid()),
    'payments', (select coalesce(jsonb_agg(to_jsonb(x) - 'receipt_url'), '[]') from public.payments x where x.student_id = auth.uid()),
    'attendance', (select coalesce(jsonb_agg(to_jsonb(a)), '[]') from public.attendance a where a.student_id = auth.uid()),
    'exam_results', (select coalesce(jsonb_agg(to_jsonb(r)), '[]') from public.exam_results r where r.student_id = auth.uid()),
    'placement', (select coalesce(jsonb_agg(to_jsonb(pa) - 'answers'), '[]') from public.placement_attempts pa where pa.student_id = auth.uid()),
    'certificates', (select coalesce(jsonb_agg(to_jsonb(c)), '[]') from public.certificates c where c.student_id = auth.uid()),
    'consents', (select coalesce(jsonb_agg(to_jsonb(c)), '[]') from public.consents c where c.user_id = auth.uid()),
    'exported_at', now())
$$;
grant execute on function public.my_data_export() to authenticated;
