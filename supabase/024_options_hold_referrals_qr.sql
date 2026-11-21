-- =====================================================================
-- LLC — migration 024
--   1. Course options: one course, several ways to study it (self-paced, live, blended…), each with its price
--   2. Payment deadline: an unpaid order holds the student's seat until the deadline, then is cancelled
--   3. A confirmed course payment activates the enrollment straight away
--   4. Agent referral links
--   5. Rotating attendance code (changes every 20 seconds, so a photo of it cannot be shared)
-- Run in Supabase → SQL Editor after 023. Safe to re-run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Course options
-- ---------------------------------------------------------------------
create table if not exists public.course_options (
  id bigint generated always as identity primary key,
  course_id bigint not null references public.courses (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  kind text not null default 'live' check (kind in ('self_paced', 'live', 'blended', 'private', 'other')),
  description text,
  price numeric(10, 2) not null check (price >= 0),
  needs_batch boolean not null default true,       -- live / blended options are taught in a batch; self-paced is not
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists course_options_course_idx on public.course_options (course_id);
alter table public.course_options enable row level security;
drop policy if exists "course_options: read" on public.course_options;
create policy "course_options: read" on public.course_options for select to anon, authenticated using (is_active or public.is_staff() or public.is_finance());
drop policy if exists "course_options: manage" on public.course_options;
create policy "course_options: manage" on public.course_options for all to authenticated
  using (public.is_academic() or public.is_finance()) with check (public.is_academic() or public.is_finance());

alter table public.enrollments add column if not exists option_id bigint references public.course_options (id) on delete set null;
alter table public.payments add column if not exists option_id bigint references public.course_options (id) on delete set null;

insert into public.site_settings (key, value) values ('billing', '{}'::jsonb) on conflict (key) do nothing;
update public.site_settings set value = jsonb_build_object('paymentWindowHours', 72) || value where key = 'billing' and not value ? 'paymentWindowHours';

-- the old versions had fewer arguments; remove them so the app always calls the new ones
drop function if exists public.price_quote(text, bigint, text);
drop function if exists public.checkout(text, bigint, text, text, text, text, bigint);

create or replace function public.price_quote(p_kind text, p_item bigint, p_code text default null, p_option bigint default null)
  returns table (description text, subtotal numeric, discount numeric, tax numeric, total numeric, currency text, code_id bigint, code_error text)
  language plpgsql stable security definer set search_path = public as
$$
declare base numeric; cur text; d public.discount_codes; disc numeric := 0; rate numeric; err text; descr text; o public.course_options;
begin
  if p_kind = 'course' then
    select c.price, coalesce(c.currency, 'USD'), c.title into base, cur, descr from public.courses c where c.id = p_item and c.status = 'published';
    if p_option is not null then
      select * into o from public.course_options where id = p_option and course_id = p_item and is_active;
      if o.id is null then raise exception 'This study option is not available.'; end if;
      base := o.price; descr := descr || ' · ' || o.name;
    elsif exists (select 1 from public.course_options where course_id = p_item and is_active) then
      raise exception 'Please choose how you want to study this course.';
    end if;
  elsif p_kind = 'plan' then
    select p.price, 'USD', p.name into base, cur, descr from public.plans p where p.id = p_item and p.is_active;
  elsif p_kind = 'package' then
    select k.price, 'USD', k.name into base, cur, descr from public.session_packages k where k.id = p_item and k.is_active;
  end if;
  if base is null then raise exception 'This item is not available.'; end if;

  if nullif(btrim(p_code), '') is not null then
    select * into d from public.discount_codes where code = upper(btrim(p_code));
    if d.id is null or not d.is_active then err := 'This discount code is not valid.';
    elsif d.valid_from is not null and now() < d.valid_from then err := 'This discount code is not active yet.';
    elsif d.valid_until is not null and now() > d.valid_until then err := 'This discount code has expired.';
    elsif d.applies_to <> 'all' and d.applies_to <> p_kind then err := 'This discount code cannot be used for this item.';
    elsif d.course_id is not null and (p_kind <> 'course' or d.course_id <> p_item) then err := 'This discount code is for another course.';
    elsif base < d.min_amount then err := 'The price is below the minimum for this code.';
    elsif d.max_uses is not null and public.code_uses(d.id) >= d.max_uses then err := 'This discount code has been fully used.';
    elsif public.code_uses(d.id, auth.uid()) >= d.max_per_user then err := 'You have already used this discount code.';
    else
      disc := least(base, round(coalesce(base * d.percent_off / 100, d.amount_off), 2));
    end if;
  end if;

  rate := coalesce((public.billing('taxRate'))::text::numeric, 0);
  return query select descr, base, disc, round((base - disc) * rate / 100, 2), round((base - disc) * (1 + rate / 100), 2), cur,
                      case when err is null and disc > 0 then d.id end, err;
end $$;
grant execute on function public.price_quote(text, bigint, text, bigint) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Seats held by unpaid orders, and the payment deadline
-- ---------------------------------------------------------------------
-- unpaid course/plan/package orders whose deadline passed (and no receipt was sent) are cancelled
create or replace function public.expire_unpaid() returns int
  language plpgsql security definer set search_path = public as
$$
declare n int;
begin
  with x as (
    update public.payments set status = 'cancelled', note = coalesce(note || ' · ', '') || 'not paid in time'
     where status = 'pending' and kind in ('course', 'plan', 'package') and due_at is not null and due_at < now() and receipt_url is null
    returning id, enrollment_id, student_id, description)
  , e as (update public.enrollments en set status = 'cancelled', note = coalesce(en.note || ' · ', '') || 'not paid in time'
           from x where en.id = x.enrollment_id and en.status = 'pending' returning en.id)
  , nt as (insert into public.notifications (user_id, title, body, link)
           select student_id, 'Order cancelled — not paid in time', coalesce(description, ''), '/student/finances' from x returning 1)
  select count(*) into n from x;
  return n;
end $$;
grant execute on function public.expire_unpaid() to authenticated;

-- seats taken in a batch: active students plus pending orders still inside their deadline
create or replace function public.batch_seats_taken(p_batch bigint) returns int
  language sql stable security definer set search_path = public as
$$ select count(*)::int from public.enrollments e where e.batch_id = p_batch and (
     e.status in ('active', 'completed')
     or (e.status = 'pending' and exists (select 1 from public.payments p where p.enrollment_id = e.id and p.status = 'pending'
                                            and (p.due_at is null or p.due_at > now() or p.receipt_url is not null)))) $$;
grant execute on function public.batch_seats_taken(bigint) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 4 (used by checkout). Referral: the agent who brought the student
-- ---------------------------------------------------------------------
alter table public.agent_profiles add column if not exists ref_code text unique;
update public.agent_profiles set ref_code = upper(substr(md5(id::text || random()::text), 1, 8)) where ref_code is null;
alter table public.agent_profiles alter column ref_code set default upper(substr(md5(random()::text), 1, 8));
alter table public.profiles add column if not exists referred_by uuid references public.profiles (id) on delete set null;
alter table public.profiles add column if not exists referred_at timestamptz;

-- the new student's account remembers the agent link they arrived with (only once, only for new students)
create or replace function public.claim_referral(p_code text) returns boolean
  language plpgsql security definer set search_path = public as
$$
declare a public.agent_profiles; me public.profiles;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null or me.role::text <> 'student' or me.referred_by is not null then return false; end if;
  if me.created_at < now() - interval '30 days' then return false; end if;
  if exists (select 1 from public.enrollments where student_id = me.id and status <> 'cancelled') then return false; end if;
  select * into a from public.agent_profiles where ref_code = upper(btrim(p_code)) and status = 'approved';
  if a.id is null or a.id = me.id then return false; end if;
  update public.profiles set referred_by = a.id, referred_at = now() where id = me.id;
  insert into public.notifications (user_id, title, body, link)
  values (a.id, 'A new student joined with your link', me.full_name, '/agent/referrals');
  return true;
end $$;
grant execute on function public.claim_referral(text) to authenticated;

-- agents see the students who joined with their link
create or replace function public.my_referrals() returns table (student_id uuid, full_name text, email text, joined_at timestamptz, placed boolean, courses jsonb)
  language sql stable security definer set search_path = public as
$$ select p.id, p.full_name, p.email, p.referred_at, public.placement_done(p.id),
          coalesce((select jsonb_agg(jsonb_build_object('course', c.title, 'status', e.status) order by e.created_at)
                      from public.enrollments e join public.courses c on c.id = e.course_id where e.student_id = p.id), '[]'::jsonb)
     from public.profiles p where p.referred_by = auth.uid() order by p.referred_at desc $$;
grant execute on function public.my_referrals() to authenticated;

-- ---------------------------------------------------------------------
-- Checkout (new version): option, seat check, deadline, referral
-- ---------------------------------------------------------------------
create or replace function public.checkout(p_kind text, p_item bigint, p_code text default null, p_method text default 'bank_transfer',
                                           p_reference text default null, p_receipt text default null, p_batch bigint default null, p_option bigint default null)
  returns jsonb
  language plpgsql security definer set search_path = public as
$$
declare q record; en_id bigint; pay_id bigint; st text; o public.course_options; cap int; due timestamptz; ag uuid;
        hrs int := coalesce((public.billing('paymentWindowHours'))::text::int, 72);
begin
  if auth.uid() is null then raise exception 'Please sign in.'; end if;
  if public.my_role() <> 'student' then raise exception 'Only student accounts can buy.'; end if;
  if not public.placement_done() then raise exception 'Please take the placement test first.'; end if;
  if p_kind not in ('course', 'plan', 'package') then raise exception 'Unknown item.'; end if;
  if p_method not in ('bank_transfer', 'card') then raise exception 'Unknown payment method.'; end if;
  if p_receipt is not null and split_part(p_receipt, '/', 1) <> auth.uid()::text then raise exception 'Receipt not found.'; end if;
  perform public.expire_unpaid();

  select * into q from public.price_quote(p_kind, p_item, p_code, p_option);
  if q.code_error is not null then raise exception '%', q.code_error; end if;

  if p_kind = 'course' then
    if p_option is not null then select * into o from public.course_options where id = p_option; end if;
    if o.id is not null and not o.needs_batch then p_batch := null; end if;
    if p_batch is not null then
      select capacity into cap from public.batches where id = p_batch and course_id = p_item and status in ('upcoming', 'active');
      if cap is null then raise exception 'This batch is not open.'; end if;
      if public.batch_seats_taken(p_batch) >= cap then raise exception 'This batch is full. Please choose another batch, or send your request without a batch and we will place you.'; end if;
    end if;
    select p.referred_by into ag from public.profiles p join public.agent_profiles a on a.id = p.referred_by and a.status = 'approved' where p.id = auth.uid();
    insert into public.enrollments (student_id, course_id, batch_id, option_id, status, source, agent_id)
    values (auth.uid(), p_item, p_batch, p_option, 'pending', 'self', ag) returning id into en_id;
  elsif exists (select 1 from public.payments where student_id = auth.uid() and kind = p_kind
                  and coalesce(plan_id, package_id) = p_item and status = 'pending') then
    raise exception 'You already have a payment waiting for this item. Pay it from Payment History, or wait for the office to confirm it.';
  end if;

  if q.total = 0 and p_kind = 'course' and q.subtotal = 0 then
    st := 'free';
  elsif q.total = 0 then
    insert into public.payments (student_id, enrollment_id, kind, plan_id, package_id, option_id, description, subtotal, discount, tax, amount, currency,
                                 discount_code_id, method, status, paid_at)
    values (auth.uid(), en_id, p_kind, case when p_kind = 'plan' then p_item end, case when p_kind = 'package' then p_item end, p_option, q.description,
            q.subtotal, q.discount, q.tax, 0, q.currency, q.code_id, 'free', 'paid', now())
    returning id into pay_id;
    st := 'paid';
  else
    due := now() + make_interval(hours => hrs);
    insert into public.payments (student_id, enrollment_id, kind, plan_id, package_id, option_id, description, subtotal, discount, tax, amount, currency,
                                 discount_code_id, method, reference, receipt_url, status, due_at)
    values (auth.uid(), en_id, p_kind, case when p_kind = 'plan' then p_item end, case when p_kind = 'package' then p_item end, p_option, q.description,
            q.subtotal, q.discount, q.tax, q.total, q.currency, q.code_id, p_method, nullif(btrim(p_reference), ''), p_receipt, 'pending', due)
    returning id into pay_id;
    st := 'pending';
    if p_receipt is not null then
      insert into public.notifications (user_id, title, body, link)
      select id, 'New payment to verify', q.description || ' · ' || q.total || ' ' || q.currency, '/admin-financials'
        from public.profiles where role::text in ('admin', 'finance') and is_active;
    end if;
  end if;
  return jsonb_build_object('payment_id', pay_id, 'enrollment_id', en_id, 'status', st, 'total', q.total, 'due_at', due);
end $$;
grant execute on function public.checkout(text, bigint, text, text, text, text, bigint, bigint) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Payment confirmed → course enrollment active (plans and packages were already handled)
-- ---------------------------------------------------------------------
create or replace function public.activate_paid_enrollment() returns trigger
  language plpgsql security definer set search_path = public as
$$
declare c text;
begin
  if new.status <> 'paid' or (tg_op = 'UPDATE' and old.status = 'paid') or new.kind <> 'course' or new.enrollment_id is null then return new; end if;
  update public.enrollments set status = 'active' where id = new.enrollment_id and status = 'pending';
  if found then
    select co.title into c from public.enrollments e join public.courses co on co.id = e.course_id where e.id = new.enrollment_id;
    insert into public.notifications (user_id, title, body, link)
    values (new.student_id, 'Enrollment approved 🎉', coalesce(c, '') || ' · your receipt is in Payment History', '/student/my-learning');
  end if;
  return new;
end $$;
drop trigger if exists payments_activate_enrollment on public.payments;
create trigger payments_activate_enrollment after insert or update of status on public.payments
  for each row execute function public.activate_paid_enrollment();

-- ---------------------------------------------------------------------
-- 5. Rotating attendance code
-- ---------------------------------------------------------------------
create or replace function public.rotating_code(p_token text, p_window bigint) returns text
  language sql immutable as
$$ select upper(substr(md5(p_token || ':' || p_window::text), 1, 6)) $$;
revoke execute on function public.rotating_code(text, bigint) from public, anon, authenticated;

-- the instructor's screen asks for the current code every few seconds
create or replace function public.attendance_code(p_session bigint) returns jsonb
  language plpgsql stable security definer set search_path = public as
$$
declare s public.class_sessions; w bigint := floor(extract(epoch from now()) / 20);
begin
  if not public.can_manage_session(p_session) then raise exception 'Not allowed.'; end if;
  select * into s from public.class_sessions where id = p_session;
  return jsonb_build_object('code', public.rotating_code(s.qr_token, w),
                            'seconds_left', 20 - (floor(extract(epoch from now()))::bigint % 20),
                            'open', now() between s.starts_at - interval '15 minutes' and s.ends_at);
end $$;
grant execute on function public.attendance_code(bigint) to authenticated;

-- students check in with the code on screen now (or in the last 40 seconds)
create or replace function public.check_in(p_code text)
returns table (session_id bigint, title text, status text)
language plpgsql security definer set search_path = public as
$$
declare s public.class_sessions; st text; w bigint := floor(extract(epoch from now()) / 20); c text := upper(btrim(p_code));
begin
  select cs.* into s from public.class_sessions cs
   where now() between cs.starts_at - interval '15 minutes' and cs.ends_at
     and c in (public.rotating_code(cs.qr_token, w), public.rotating_code(cs.qr_token, w - 1), public.rotating_code(cs.qr_token, w - 2))
   limit 1;
  if s.id is null then
    raise exception 'This code has expired or is not valid. Scan the code on your instructor''s screen again.';
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
