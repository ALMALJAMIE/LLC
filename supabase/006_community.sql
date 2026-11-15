-- =====================================================================
-- LLC — migration 006: community hubs & channels, notification helpers
-- Run in Supabase → SQL Editor after 005. Safe to re-run.
-- =====================================================================

create table if not exists public.community_channels (
  id bigint generated always as identity primary key,
  hub text not null default 'LANGUAGE' check (hub in ('LANGUAGE', 'PROFESSIONAL')),
  name text not null,
  kind text not null default 'general' check (kind in ('announcement', 'general', 'batch')),
  batch_id bigint unique references public.batches (id) on delete cascade,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.community_posts add column if not exists channel_id bigint references public.community_channels (id) on delete cascade;
alter table public.community_posts add column if not exists author_name text;
alter table public.community_posts add column if not exists author_role text;
alter table public.community_comments add column if not exists author_name text;
alter table public.community_comments add column if not exists author_role text;

-- Store the author's display name/role on each post so members can see who wrote it
-- without being able to read other people's profiles.
create or replace function public.stamp_author() returns trigger
  language plpgsql security definer set search_path = public as
$$
begin
  select full_name, role::text into new.author_name, new.author_role from public.profiles where id = new.author_id;
  return new;
end $$;
drop trigger if exists posts_stamp on public.community_posts;
create trigger posts_stamp before insert on public.community_posts for each row execute function public.stamp_author();
drop trigger if exists comments_stamp on public.community_comments;
create trigger comments_stamp before insert on public.community_comments for each row execute function public.stamp_author();

create or replace function public.can_see_channel(p_channel bigint) returns boolean
  language sql stable security definer set search_path = public as
$$
  select public.is_staff() or exists (
    select 1 from public.community_channels c where c.id = p_channel and (
      c.batch_id is null
      or exists (select 1 from public.enrollments e where e.batch_id = c.batch_id and e.student_id = auth.uid() and e.status in ('active', 'completed'))))
$$;

create or replace function public.can_post_channel(p_channel bigint) returns boolean
  language sql stable security definer set search_path = public as
$$
  select public.can_see_channel(p_channel) and (
    public.is_staff() or not exists (select 1 from public.community_channels c where c.id = p_channel and c.kind = 'announcement'))
$$;

alter table public.community_channels enable row level security;
drop policy if exists "channels: visible" on public.community_channels;
create policy "channels: visible" on public.community_channels for select to authenticated using (public.can_see_channel(id));
drop policy if exists "channels: admin write" on public.community_channels;
create policy "channels: admin write" on public.community_channels for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "posts: read" on public.community_posts;
create policy "posts: read" on public.community_posts for select to authenticated using (channel_id is null or public.can_see_channel(channel_id));
drop policy if exists "posts: write own" on public.community_posts;
create policy "posts: write own" on public.community_posts for insert to authenticated with check (author_id = auth.uid() and public.can_post_channel(channel_id));

-- One private channel per batch, created automatically.
create or replace function public.batch_channel() returns trigger
  language plpgsql security definer set search_path = public as
$$
begin
  insert into public.community_channels (hub, name, kind, batch_id, sort_order)
  values ('LANGUAGE', new.name, 'batch', new.id, 100) on conflict (batch_id) do update set name = excluded.name;
  return new;
end $$;
drop trigger if exists batches_channel on public.batches;
create trigger batches_channel after insert or update of name on public.batches for each row execute function public.batch_channel();

insert into public.community_channels (hub, name, kind, batch_id, sort_order)
select 'LANGUAGE', b.name, 'batch', b.id, 100 from public.batches b on conflict (batch_id) do nothing;

insert into public.community_channels (hub, name, kind, sort_order)
select * from (values ('LANGUAGE', 'Announcements', 'announcement', 1), ('LANGUAGE', 'General', 'general', 2), ('LANGUAGE', 'Challenges', 'general', 3),
                      ('PROFESSIONAL', 'Announcements', 'announcement', 1), ('PROFESSIONAL', 'Networking', 'general', 2)) v(h, n, k, s)
where not exists (select 1 from public.community_channels where batch_id is null);

-- ---------- Notifications ------------------------------------------------
-- Let users clear their own notifications.
drop policy if exists "notifications: delete own" on public.notifications;
create policy "notifications: delete own" on public.notifications for delete to authenticated using (user_id = auth.uid());

-- Admin broadcast: notify every active user of a role (or everyone).
create or replace function public.broadcast(p_title text, p_body text, p_role text default null, p_link text default null) returns int
  language plpgsql security definer set search_path = public as
$$
declare n int;
begin
  if not public.is_admin() then raise exception 'Only admins can broadcast.'; end if;
  insert into public.notifications (user_id, title, body, link)
  select id, p_title, p_body, p_link from public.profiles where is_active and (p_role is null or role::text = p_role);
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function public.broadcast(text, text, text, text) to authenticated;
