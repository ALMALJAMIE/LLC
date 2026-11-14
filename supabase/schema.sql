-- =====================================================================
-- LLC — Language Leap Center : database schema (v1)
-- Run once in Supabase → SQL Editor → New query → paste → Run.
-- Safe to re-run: every object is created "if not exists" / "or replace".
-- =====================================================================

-- ---------- Roles & profiles ------------------------------------------
do $$ begin
  create type public.app_role as enum ('student', 'instructor', 'agent', 'admin');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '',
  email       text not null default '',
  phone       text,
  country     text,
  date_of_birth date,
  gender      text,
  address     text,
  city        text,
  state       text,
  postcode    text,
  nationality text,
  education_level text,
  occupation  text,
  learning_goals text,
  bio         text,
  avatar_url  text,
  student_no  text unique,
  role        public.app_role not null default 'student',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create sequence if not exists public.student_no_seq start 1001;

-- Helpers used by row-level security (security definer avoids RLS recursion)
create or replace function public.my_role() returns public.app_role
  language sql stable security definer set search_path = public as
$$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.is_admin() returns boolean
  language sql stable security definer set search_path = public as
$$ select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false) $$;

create or replace function public.is_staff() returns boolean
  language sql stable security definer set search_path = public as
$$ select coalesce((select role in ('admin', 'instructor') from public.profiles where id = auth.uid()), false) $$;

-- New sign-ups always start as students; admins promote users afterwards.
create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as
$$
begin
  insert into public.profiles (id, full_name, email, phone, country, role, student_no)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data ->> 'phone',
    new.raw_user_meta_data ->> 'country',
    'student',
    'LLC' || lpad(nextval('public.student_no_seq')::text, 5, '0')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Users may edit their own profile but never their own role/status.
create or replace function public.guard_profile_update() returns trigger
  language plpgsql security definer set search_path = public as
$$
begin
  if not public.is_admin() then
    new.role := old.role;
    new.is_active := old.is_active;
    new.student_no := old.student_no;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_update();

-- ---------- Academic structure ----------------------------------------
create table if not exists public.categories (
  id bigint generated always as identity primary key,
  name text not null unique,
  description text,
  color text default 'indigo',
  created_at timestamptz not null default now()
);

create table if not exists public.levels (
  id bigint generated always as identity primary key,
  name text not null unique,
  cefr text,
  sort_order int not null default 0
);

create table if not exists public.academic_sessions (
  id bigint generated always as identity primary key,
  name text not null,
  start_date date not null,
  end_date date not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.courses (
  id bigint generated always as identity primary key,
  code text not null unique,
  title text not null,
  description text,
  category_id bigint references public.categories (id) on delete set null,
  level_id bigint references public.levels (id) on delete set null,
  units_count int not null default 0,
  duration_weeks int,
  delivery text not null default 'online' check (delivery in ('online', 'face_to_face', 'hybrid')),
  price numeric(10, 2) not null default 0,
  currency text not null default 'MYR',
  cover_url text,
  tags text[] default '{}',
  status text not null default 'published' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now()
);

create table if not exists public.course_units (
  id bigint generated always as identity primary key,
  course_id bigint not null references public.courses (id) on delete cascade,
  title text not null,
  sort_order int not null default 0
);

create table if not exists public.lessons (
  id bigint generated always as identity primary key,
  unit_id bigint not null references public.course_units (id) on delete cascade,
  title text not null,
  content text,
  video_url text,
  sort_order int not null default 0,
  status text not null default 'draft' check (status in ('draft', 'pending', 'approved', 'rejected')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.batches (
  id bigint generated always as identity primary key,
  code text not null unique,
  name text not null,
  course_id bigint not null references public.courses (id) on delete cascade,
  session_id bigint references public.academic_sessions (id) on delete set null,
  instructor_id uuid references public.profiles (id) on delete set null,
  start_date date,
  end_date date,
  capacity int not null default 20,
  mode text not null default 'online' check (mode in ('online', 'face_to_face', 'hybrid')),
  status text not null default 'active' check (status in ('upcoming', 'active', 'completed', 'cancelled')),
  created_at timestamptz not null default now()
);

-- ---------- Enrollment & finance ---------------------------------------
create table if not exists public.enrollments (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.profiles (id) on delete cascade,
  course_id bigint not null references public.courses (id) on delete cascade,
  batch_id bigint references public.batches (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'active', 'completed', 'rejected', 'cancelled')),
  progress int not null default 0 check (progress between 0 and 100),
  source text not null default 'self' check (source in ('self', 'agent', 'admin')),
  agent_id uuid references public.profiles (id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  unique (student_id, course_id, batch_id)
);

create table if not exists public.payments (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.profiles (id) on delete cascade,
  enrollment_id bigint references public.enrollments (id) on delete set null,
  amount numeric(10, 2) not null,
  currency text not null default 'MYR',
  method text default 'bank_transfer',
  reference text,
  receipt_url text,
  invoice_no text unique default ('INV-' || to_char(now(), 'YYMMDD') || '-' || substr(md5(random()::text), 1, 6)),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'refunded')),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- Classes, attendance, leave ---------------------------------
create table if not exists public.class_sessions (
  id bigint generated always as identity primary key,
  batch_id bigint not null references public.batches (id) on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  mode text not null default 'online' check (mode in ('online', 'face_to_face')),
  meeting_url text,
  room text,
  qr_token text default substr(md5(random()::text), 1, 10),
  created_at timestamptz not null default now()
);

create table if not exists public.attendance (
  id bigint generated always as identity primary key,
  session_id bigint not null references public.class_sessions (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'present' check (status in ('present', 'late', 'absent', 'excused')),
  marked_at timestamptz not null default now(),
  unique (session_id, student_id)
);

create table if not exists public.absence_requests (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.profiles (id) on delete cascade,
  batch_id bigint references public.batches (id) on delete set null,
  date_from date not null,
  date_to date not null,
  reason text not null,
  attachment_url text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles (id) on delete set null,
  review_note text,
  created_at timestamptz not null default now()
);

-- ---------- Exams, results, certificates, reviews ----------------------
create table if not exists public.exams (
  id bigint generated always as identity primary key,
  batch_id bigint references public.batches (id) on delete cascade,
  course_id bigint references public.courses (id) on delete cascade,
  title text not null,
  kind text not null default 'final' check (kind in ('quiz', 'midterm', 'final', 'placement')),
  starts_at timestamptz,
  duration_min int not null default 60,
  total_marks numeric(6, 2) not null default 100,
  status text not null default 'scheduled' check (status in ('draft', 'scheduled', 'open', 'closed')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.exam_results (
  id bigint generated always as identity primary key,
  exam_id bigint not null references public.exams (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  score numeric(6, 2),
  grade text,
  feedback text,
  status text not null default 'submitted' check (status in ('in_progress', 'submitted', 'graded')),
  graded_by uuid references public.profiles (id) on delete set null,
  submitted_at timestamptz default now(),
  graded_at timestamptz,
  unique (exam_id, student_id)
);

create table if not exists public.certificates (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.profiles (id) on delete cascade,
  course_id bigint references public.courses (id) on delete set null,
  serial text unique not null default ('LLC-CERT-' || upper(substr(md5(random()::text), 1, 8))),
  title text not null,
  issued_at date not null default current_date
);

create table if not exists public.reviews (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.profiles (id) on delete cascade,
  course_id bigint references public.courses (id) on delete cascade,
  instructor_id uuid references public.profiles (id) on delete set null,
  rating int not null check (rating between 1 and 5),
  comment text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'hidden')),
  created_at timestamptz not null default now()
);

-- ---------- Productivity & community ------------------------------------
create table if not exists public.tasks (
  id bigint generated always as identity primary key,
  owner_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  title text not null,
  notes text,
  link text,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  due_at timestamptz,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.calendar_events (
  id bigint generated always as identity primary key,
  title text not null,
  description text,
  kind text not null default 'event' check (kind in ('event', 'holiday', 'exam', 'intake', 'deadline')),
  starts_on date not null,
  ends_on date,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.community_posts (
  id bigint generated always as identity primary key,
  author_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  channel text not null default 'general',
  body text not null,
  image_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.community_comments (
  id bigint generated always as identity primary key,
  post_id bigint not null references public.community_posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.community_likes (
  post_id bigint not null references public.community_posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  primary key (post_id, user_id)
);

create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- Row-level security ----------------------------------------
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.levels enable row level security;
alter table public.academic_sessions enable row level security;
alter table public.courses enable row level security;
alter table public.course_units enable row level security;
alter table public.lessons enable row level security;
alter table public.batches enable row level security;
alter table public.enrollments enable row level security;
alter table public.payments enable row level security;
alter table public.class_sessions enable row level security;
alter table public.attendance enable row level security;
alter table public.absence_requests enable row level security;
alter table public.exams enable row level security;
alter table public.exam_results enable row level security;
alter table public.certificates enable row level security;
alter table public.reviews enable row level security;
alter table public.tasks enable row level security;
alter table public.calendar_events enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_comments enable row level security;
alter table public.community_likes enable row level security;
alter table public.notifications enable row level security;

-- profiles
drop policy if exists "profiles: read own or staff" on public.profiles;
create policy "profiles: read own or staff" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff() or public.my_role() = 'agent');
drop policy if exists "profiles: staff visible" on public.profiles;
create policy "profiles: staff visible" on public.profiles for select to authenticated using (role in ('instructor', 'admin'));
drop policy if exists "profiles: update own or admin" on public.profiles;
create policy "profiles: update own or admin" on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());
drop policy if exists "profiles: admin delete" on public.profiles;
create policy "profiles: admin delete" on public.profiles for delete to authenticated using (public.is_admin());

-- public catalogue: anyone can read, admins write
do $$
declare t text;
begin
  foreach t in array array['categories', 'levels', 'academic_sessions', 'courses', 'course_units', 'batches', 'calendar_events'] loop
    execute format('drop policy if exists "%1$s: read" on public.%1$s', t);
    execute format('create policy "%1$s: read" on public.%1$s for select to anon, authenticated using (true)', t);
    execute format('drop policy if exists "%1$s: admin write" on public.%1$s', t);
    execute format('create policy "%1$s: admin write" on public.%1$s for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- lessons: students see approved lessons; instructors manage their own; admins all
drop policy if exists "lessons: read" on public.lessons;
create policy "lessons: read" on public.lessons for select to authenticated
  using (status = 'approved' or public.is_staff());
drop policy if exists "lessons: staff write" on public.lessons;
create policy "lessons: staff write" on public.lessons for all to authenticated
  using (public.is_admin() or created_by = auth.uid()) with check (public.is_staff());

-- student-owned records: owner reads; staff reads/writes everything
do $$
declare t text;
begin
  foreach t in array array['enrollments', 'payments', 'attendance', 'absence_requests', 'exam_results', 'certificates', 'reviews'] loop
    execute format('drop policy if exists "%1$s: read own or staff" on public.%1$s', t);
    execute format('create policy "%1$s: read own or staff" on public.%1$s for select to authenticated using (student_id = auth.uid() or public.is_staff())', t);
    execute format('drop policy if exists "%1$s: staff write" on public.%1$s', t);
    execute format('create policy "%1$s: staff write" on public.%1$s for all to authenticated using (public.is_staff()) with check (public.is_staff())', t);
  end loop;
end $$;

-- what students may create themselves
drop policy if exists "enrollments: student request" on public.enrollments;
create policy "enrollments: student request" on public.enrollments for insert to authenticated
  with check (student_id = auth.uid() and status = 'pending' and source = 'self');
drop policy if exists "enrollments: agent read" on public.enrollments;
create policy "enrollments: agent read" on public.enrollments for select to authenticated using (agent_id = auth.uid());
drop policy if exists "payments: student submit" on public.payments;
create policy "payments: student submit" on public.payments for insert to authenticated
  with check (student_id = auth.uid() and status = 'pending');
drop policy if exists "absence: student submit" on public.absence_requests;
create policy "absence: student submit" on public.absence_requests for insert to authenticated
  with check (student_id = auth.uid() and status = 'pending');
drop policy if exists "attendance: student check-in" on public.attendance;
create policy "attendance: student check-in" on public.attendance for insert to authenticated
  with check (student_id = auth.uid());
drop policy if exists "reviews: student write" on public.reviews;
create policy "reviews: student write" on public.reviews for insert to authenticated
  with check (student_id = auth.uid() and status = 'pending');

-- class sessions & exams: enrolled students + staff read; staff write
drop policy if exists "class_sessions: read" on public.class_sessions;
create policy "class_sessions: read" on public.class_sessions for select to authenticated using (
  public.is_staff() or exists (select 1 from public.enrollments e where e.batch_id = class_sessions.batch_id and e.student_id = auth.uid() and e.status = 'active'));
drop policy if exists "class_sessions: staff write" on public.class_sessions;
create policy "class_sessions: staff write" on public.class_sessions for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "exams: read" on public.exams;
create policy "exams: read" on public.exams for select to authenticated using (
  public.is_staff() or exists (select 1 from public.enrollments e where e.student_id = auth.uid() and e.status = 'active'
    and (e.batch_id = exams.batch_id or e.course_id = exams.course_id)));
drop policy if exists "exams: staff write" on public.exams;
create policy "exams: staff write" on public.exams for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- personal tasks & notifications
drop policy if exists "tasks: own" on public.tasks;
create policy "tasks: own" on public.tasks for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "notifications: own" on public.notifications;
create policy "notifications: own" on public.notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists "notifications: mark read" on public.notifications;
create policy "notifications: mark read" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "notifications: staff send" on public.notifications;
create policy "notifications: staff send" on public.notifications for insert to authenticated with check (public.is_staff());

-- community
drop policy if exists "posts: read" on public.community_posts;
create policy "posts: read" on public.community_posts for select to authenticated using (true);
drop policy if exists "posts: write own" on public.community_posts;
create policy "posts: write own" on public.community_posts for insert to authenticated with check (author_id = auth.uid());
drop policy if exists "posts: delete own or admin" on public.community_posts;
create policy "posts: delete own or admin" on public.community_posts for delete to authenticated using (author_id = auth.uid() or public.is_admin());
drop policy if exists "comments: read" on public.community_comments;
create policy "comments: read" on public.community_comments for select to authenticated using (true);
drop policy if exists "comments: write own" on public.community_comments;
create policy "comments: write own" on public.community_comments for insert to authenticated with check (author_id = auth.uid());
drop policy if exists "comments: delete own or admin" on public.community_comments;
create policy "comments: delete own or admin" on public.community_comments for delete to authenticated using (author_id = auth.uid() or public.is_admin());
drop policy if exists "likes: read" on public.community_likes;
create policy "likes: read" on public.community_likes for select to authenticated using (true);
drop policy if exists "likes: own" on public.community_likes;
create policy "likes: own" on public.community_likes for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "likes: unlike own" on public.community_likes;
create policy "likes: unlike own" on public.community_likes for delete to authenticated using (user_id = auth.uid());

-- ---------- Storage bucket for receipts, MC letters, avatars ------------
insert into storage.buckets (id, name, public) values ('uploads', 'uploads', false)
  on conflict (id) do nothing;
drop policy if exists "uploads: own folder" on storage.objects;
create policy "uploads: own folder" on storage.objects for all to authenticated
  using (bucket_id = 'uploads' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()))
  with check (bucket_id = 'uploads' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()));

-- ---------- Starter catalogue (edit freely later from the admin portal) --
insert into public.categories (name, description, color) values
  ('General English', 'Core English skills from beginner to advanced.', 'indigo'),
  ('Exam Preparation', 'IELTS and placement preparation.', 'orange'),
  ('Kids English', 'Fun, structured English for young learners.', 'emerald'),
  ('Business English', 'English for the workplace.', 'sky')
on conflict (name) do nothing;

insert into public.levels (name, cefr, sort_order) values
  ('Beginner', 'A1', 1), ('Elementary', 'A2', 2), ('Pre-Intermediate', 'A2+', 3),
  ('Intermediate', 'B1', 4), ('Upper-Intermediate', 'B2', 5), ('Advanced', 'C1', 6)
on conflict (name) do nothing;

insert into public.academic_sessions (name, start_date, end_date, is_active)
select 'November 2026', date '2026-11-01', date '2026-12-31', true
where not exists (select 1 from public.academic_sessions);

insert into public.courses (code, title, description, category_id, level_id, units_count, duration_weeks, delivery, price)
select v.code, v.title, v.descr, c.id, l.id, v.units, v.weeks, v.delivery, v.price
from (values
  ('LLC-GE01', 'English Beginner', 'Start your English journey with confidence: everyday words, simple grammar and daily phrases.', 'General English', 'Beginner', 9, 8, 'online', 450),
  ('LLC-GE02', 'English Elementary', 'Build sentences, talk about your routine and understand short conversations.', 'General English', 'Elementary', 9, 8, 'online', 450),
  ('LLC-GE03', 'English Pre-Intermediate', 'Grow vocabulary and fluency for travel, study and work.', 'General English', 'Pre-Intermediate', 9, 8, 'hybrid', 500),
  ('LLC-GE04', 'English Intermediate', 'Express opinions, write clear paragraphs and follow longer talks.', 'General English', 'Intermediate', 9, 10, 'hybrid', 550),
  ('LLC-GE05', 'English Upper-Intermediate', 'Discuss complex topics and write structured essays.', 'General English', 'Upper-Intermediate', 9, 10, 'face_to_face', 600),
  ('LLC-GE06', 'English Advanced', 'Polish accuracy and style for academic and professional English.', 'General English', 'Advanced', 9, 10, 'face_to_face', 650),
  ('LLC-IELTS', 'IELTS Preparation', 'Strategies and practice for all four IELTS papers.', 'Exam Preparation', 'Upper-Intermediate', 8, 8, 'online', 800),
  ('LLC-KIDS', 'LLC Kids English', 'Stories, songs and games that teach English to children aged 7–12.', 'Kids English', 'Beginner', 10, 12, 'face_to_face', 400),
  ('LLC-BE01', 'Business English', 'Emails, meetings and presentations in English.', 'Business English', 'Intermediate', 8, 8, 'online', 700),
  ('LLC-PT', 'English Placement Test', 'Written test plus a short interview to find your level.', 'Exam Preparation', null, 3, 1, 'online', 0)
) as v(code, title, descr, cat, lvl, units, weeks, delivery, price)
left join public.categories c on c.name = v.cat
left join public.levels l on l.name = v.lvl
on conflict (code) do nothing;

insert into public.batches (code, name, course_id, session_id, start_date, end_date, capacity, mode, status)
select 'B-' || c.code || '-NOV26', c.title || ' - November 2026', c.id, s.id, s.start_date, s.end_date, 20,
       case when c.delivery = 'face_to_face' then 'face_to_face' else 'online' end, 'active'
from public.courses c cross join lateral (select * from public.academic_sessions where is_active limit 1) s
where c.code <> 'LLC-PT'
on conflict (code) do nothing;

-- =====================================================================
-- After running: sign up on the platform with your own email, then make
-- yourself admin by running (replace the email):
--   update public.profiles set role = 'admin' where email = 'you@example.com';
-- =====================================================================
