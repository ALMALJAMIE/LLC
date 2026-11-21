-- =====================================================================
-- LLC — migration 022: payments done properly
--   1. Billing settings (company details, tax, refund window, local-currency rates)
--   2. Prices are always worked out by the server (students can no longer write a payment amount)
--   3. Discount codes
--   4. Bank receipts for any pending payment, custom invoices from finance
--   5. Refund requests (with the refund policy window)
--   6. Plans (subscriptions) and private-session packages with credits
-- Run in Supabase → SQL Editor after 021. Safe to re-run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Billing settings (stored in site_settings under the key 'billing')
-- ---------------------------------------------------------------------
insert into public.site_settings (key, value) values ('billing', jsonb_build_object(
  'companyName', 'Language Leap Center',
  'registrationNo', '',
  'address', '',
  'taxRate', 0,
  'taxLabel', 'Tax',
  'refundDays', 14,
  'privateNeedsCredit', false,
  'fx', jsonb_build_object('MYR', 4.45, 'SAR', 3.75, 'AED', 3.67, 'EUR', 0.92, 'GBP', 0.79, 'IDR', 16000, 'YER', 250)
)) on conflict (key) do nothing;

-- finance may edit the billing settings (the admin already edits everything)
drop policy if exists "site_settings: finance billing" on public.site_settings;
create policy "site_settings: finance billing" on public.site_settings for all to authenticated
  using (key = 'billing' and public.is_finance()) with check (key = 'billing' and public.is_finance());

create or replace function public.billing(p_key text) returns jsonb
  language sql stable security definer set search_path = public as
$$ select value -> p_key from public.site_settings where key = 'billing' $$;

-- ---------------------------------------------------------------------
-- 2. Payments: more detail
-- ---------------------------------------------------------------------
alter table public.payments add column if not exists kind text not null default 'course';
alter table public.payments add column if not exists description text;
alter table public.payments add column if not exists subtotal numeric(10, 2);
alter table public.payments add column if not exists discount numeric(10, 2) not null default 0;
alter table public.payments add column if not exists tax numeric(10, 2) not null default 0;
alter table public.payments add column if not exists lines jsonb not null default '[]'::jsonb;
alter table public.payments add column if not exists due_at timestamptz;
alter table public.payments add column if not exists refunded_amount numeric(10, 2) not null default 0;
alter table public.payments add column if not exists created_by uuid references public.profiles (id) on delete set null;
alter table public.payments add column if not exists note text;
update public.payments set subtotal = amount where subtotal is null;

alter table public.payments drop constraint if exists payments_kind_check;
alter table public.payments add constraint payments_kind_check check (kind in ('course', 'plan', 'package', 'custom'));
alter table public.payments drop constraint if exists payments_status_check;
alter table public.payments add constraint payments_status_check check (status in ('pending', 'paid', 'failed', 'refunded', 'cancelled'));

-- students no longer insert payments themselves: every amount comes from the functions below
drop policy if exists "payments: student submit" on public.payments;

-- ---------------------------------------------------------------------
-- 3. Discount codes
-- ---------------------------------------------------------------------
create table if not exists public.discount_codes (
  id bigint generated always as identity primary key,
  code text not null unique check (code ~ '^[A-Z0-9_-]{3,30}$'),
  description text,
  percent_off numeric(5, 2) check (percent_off > 0 and percent_off <= 100),
  amount_off numeric(10, 2) check (amount_off > 0),
  applies_to text not null default 'all' check (applies_to in ('all', 'course', 'plan', 'package')),
  course_id bigint references public.courses (id) on delete cascade,
  min_amount numeric(10, 2) not null default 0,
  max_uses int check (max_uses > 0),
  max_per_user int not null default 1 check (max_per_user > 0),
  valid_from timestamptz,
  valid_until timestamptz,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  check ((percent_off is null) <> (amount_off is null))
);
alter table public.payments add column if not exists discount_code_id bigint references public.discount_codes (id) on delete set null;

alter table public.discount_codes enable row level security;
drop policy if exists "discount_codes: finance" on public.discount_codes;
create policy "discount_codes: finance" on public.discount_codes for all to authenticated using (public.is_finance()) with check (public.is_finance());

-- how many times a code was used (payments that were not rejected or cancelled)
create or replace function public.code_uses(p_code bigint, p_user uuid default null) returns int
  language sql stable security definer set search_path = public as
$$ select count(*)::int from public.payments where discount_code_id = p_code and status not in ('failed', 'cancelled')
     and (p_user is null or student_id = p_user) $$;

-- price check used by every checkout: returns subtotal, discount, tax, total (and an error when the code cannot be used)
create or replace function public.price_quote(p_kind text, p_item bigint, p_code text default null)
  returns table (description text, subtotal numeric, discount numeric, tax numeric, total numeric, currency text, code_id bigint, code_error text)
  language plpgsql stable security definer set search_path = public as
$$
declare base numeric; cur text; d public.discount_codes; disc numeric := 0; rate numeric; err text; descr text;
begin
  if p_kind = 'course' then
    select c.price, coalesce(c.currency, 'USD'), c.title into base, cur, descr from public.courses c where c.id = p_item and c.status = 'published';
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
grant execute on function public.price_quote(text, bigint, text) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Plans, subscriptions, private-session packages and credits
-- ---------------------------------------------------------------------
create table if not exists public.plans (
  id bigint generated always as identity primary key,
  name text not null,
  description text,
  price numeric(10, 2) not null check (price >= 0),
  period_months int not null default 1 check (period_months between 1 and 24),
  private_credits int not null default 0 check (private_credits >= 0),   -- private sessions included each period
  course_ids bigint[] not null default '{}',                             -- courses opened while the plan is active
  features text,                                                         -- one benefit per line, shown to students
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.subscriptions (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.profiles (id) on delete cascade,
  plan_id bigint not null references public.plans (id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'cancelled', 'expired')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  last_payment_id bigint references public.payments (id) on delete set null,
  cancelled_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists subscriptions_one_active on public.subscriptions (student_id, plan_id) where status = 'active';

create table if not exists public.session_packages (
  id bigint generated always as identity primary key,
  name text not null,
  description text,
  sessions int not null check (sessions > 0),
  price numeric(10, 2) not null check (price >= 0),
  valid_days int not null default 90 check (valid_days > 0),
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- private-session credits: each row is one grant (from a package, a plan or the office)
create table if not exists public.credit_grants (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.profiles (id) on delete cascade,
  source text not null check (source in ('package', 'plan', 'manual')),
  total int not null check (total > 0),
  used int not null default 0 check (used >= 0),
  expires_at timestamptz not null,
  payment_id bigint references public.payments (id) on delete set null,
  note text,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  check (used <= total)
);
alter table public.private_slots add column if not exists credit_grant_id bigint references public.credit_grants (id) on delete set null;
alter table public.payments add column if not exists plan_id bigint references public.plans (id) on delete set null;
alter table public.payments add column if not exists package_id bigint references public.session_packages (id) on delete set null;
alter table public.enrollments add column if not exists subscription_id bigint references public.subscriptions (id) on delete set null;

alter table public.plans enable row level security;
alter table public.session_packages enable row level security;
alter table public.subscriptions enable row level security;
alter table public.credit_grants enable row level security;
drop policy if exists "plans: read" on public.plans;
create policy "plans: read" on public.plans for select to anon, authenticated using (is_active or public.is_finance());
drop policy if exists "plans: finance" on public.plans;
create policy "plans: finance" on public.plans for all to authenticated using (public.is_finance()) with check (public.is_finance());
drop policy if exists "packages: read" on public.session_packages;
create policy "packages: read" on public.session_packages for select to anon, authenticated using (is_active or public.is_finance());
drop policy if exists "packages: finance" on public.session_packages;
create policy "packages: finance" on public.session_packages for all to authenticated using (public.is_finance()) with check (public.is_finance());
drop policy if exists "subscriptions: read" on public.subscriptions;
create policy "subscriptions: read" on public.subscriptions for select to authenticated using (student_id = auth.uid() or public.is_finance() or public.is_support());
drop policy if exists "subscriptions: finance" on public.subscriptions;
create policy "subscriptions: finance" on public.subscriptions for update to authenticated using (public.is_finance());
drop policy if exists "credits: read" on public.credit_grants;
create policy "credits: read" on public.credit_grants for select to authenticated
  using (student_id = auth.uid() or public.is_finance() or public.is_support() or public.is_academic());
drop policy if exists "credits: finance" on public.credit_grants;
create policy "credits: finance" on public.credit_grants for all to authenticated using (public.is_finance()) with check (public.is_finance());

create or replace function public.credits_left(p_student uuid default auth.uid()) returns int
  language sql stable security definer set search_path = public as
$$ select coalesce(sum(total - used), 0)::int from public.credit_grants where student_id = p_student and expires_at > now() $$;
grant execute on function public.credits_left(uuid) to authenticated;

-- subscriptions past their end date close, and the courses they opened close with them
create or replace function public.expire_subscriptions() returns int
  language plpgsql security definer set search_path = public as
$$
declare n int;
begin
  with x as (update public.subscriptions set status = 'expired' where status = 'active' and ends_at < now() returning id)
  select count(*) into n from x;
  update public.enrollments e set status = 'cancelled', note = coalesce(e.note || ' · ', '') || 'plan ended'
   where e.subscription_id is not null and e.status = 'active'
     and not exists (select 1 from public.subscriptions s where s.id = e.subscription_id and s.status = 'active');
  return n;
end $$;
grant execute on function public.expire_subscriptions() to authenticated;

-- ---------------------------------------------------------------------
-- 5. Checkout: one function for courses, plans and packages
-- ---------------------------------------------------------------------
create or replace function public.checkout(p_kind text, p_item bigint, p_code text default null, p_method text default 'bank_transfer',
                                           p_reference text default null, p_receipt text default null, p_batch bigint default null)
  returns jsonb
  language plpgsql security definer set search_path = public as
$$
declare q record; en_id bigint; pay_id bigint; st text;
begin
  if auth.uid() is null then raise exception 'Please sign in.'; end if;
  if public.my_role() <> 'student' then raise exception 'Only student accounts can buy.'; end if;
  if not public.placement_done() then raise exception 'Please take the placement test first.'; end if;
  if p_kind not in ('course', 'plan', 'package') then raise exception 'Unknown item.'; end if;
  if p_method not in ('bank_transfer', 'card') then raise exception 'Unknown payment method.'; end if;
  if p_receipt is not null and split_part(p_receipt, '/', 1) <> auth.uid()::text then raise exception 'Receipt not found.'; end if;

  select * into q from public.price_quote(p_kind, p_item, p_code);
  if q.code_error is not null then raise exception '%', q.code_error; end if;

  if p_kind = 'course' then
    insert into public.enrollments (student_id, course_id, batch_id, status, source)
    values (auth.uid(), p_item, p_batch, 'pending', 'self') returning id into en_id;
  elsif exists (select 1 from public.payments where student_id = auth.uid() and kind = p_kind
                  and coalesce(plan_id, package_id) = p_item and status = 'pending') then
    raise exception 'You already have a payment waiting for this item. Pay it from Payment History, or wait for the office to confirm it.';
  end if;

  if q.total = 0 and p_kind = 'course' and q.subtotal = 0 then
    st := 'free';   -- a free course: just the enrollment request, no payment
  elsif q.total = 0 then
    -- 100% discount or a free plan/package: paid straight away; the fulfilment trigger does the rest
    insert into public.payments (student_id, enrollment_id, kind, plan_id, package_id, description, subtotal, discount, tax, amount, currency,
                                 discount_code_id, method, status, paid_at)
    values (auth.uid(), en_id, p_kind, case when p_kind = 'plan' then p_item end, case when p_kind = 'package' then p_item end, q.description,
            q.subtotal, q.discount, q.tax, 0, q.currency, q.code_id, 'free', 'paid', now())
    returning id into pay_id;
    st := 'paid';
  else
    if p_method = 'bank_transfer' and p_receipt is null then raise exception 'Please attach your payment receipt.'; end if;
    insert into public.payments (student_id, enrollment_id, kind, plan_id, package_id, description, subtotal, discount, tax, amount, currency,
                                 discount_code_id, method, reference, receipt_url, status)
    values (auth.uid(), en_id, p_kind, case when p_kind = 'plan' then p_item end, case when p_kind = 'package' then p_item end, q.description,
            q.subtotal, q.discount, q.tax, q.total, q.currency, q.code_id, p_method, nullif(btrim(p_reference), ''), p_receipt, 'pending')
    returning id into pay_id;
    st := 'pending';
    if p_receipt is not null then
      insert into public.notifications (user_id, title, body, link)
      select id, 'New payment to verify', q.description || ' · ' || q.total || ' ' || q.currency, '/admin-financials'
        from public.profiles where role::text in ('admin', 'finance') and is_active;
    end if;
  end if;
  return jsonb_build_object('payment_id', pay_id, 'enrollment_id', en_id, 'status', st, 'total', q.total);
end $$;
grant execute on function public.checkout(text, bigint, text, text, text, text, bigint) to authenticated;

-- a receipt for a payment that is already waiting (a card payment not finished, or an invoice from the office)
create or replace function public.submit_receipt(p_payment bigint, p_receipt text, p_reference text default null) returns void
  language plpgsql security definer set search_path = public as
$$
declare p public.payments;
begin
  select * into p from public.payments where id = p_payment;
  if p.id is null or p.student_id <> auth.uid() then raise exception 'Payment not found.'; end if;
  if p.status <> 'pending' then raise exception 'This payment is already %.', p.status; end if;
  if split_part(p_receipt, '/', 1) <> auth.uid()::text then raise exception 'Receipt not found.'; end if;
  update public.payments set receipt_url = p_receipt, reference = coalesce(nullif(btrim(p_reference), ''), reference), method = 'bank_transfer'
   where id = p.id;
  insert into public.notifications (user_id, title, body, link)
  select id, 'New payment to verify', coalesce(p.description, p.invoice_no) || ' · ' || p.amount || ' ' || p.currency, '/admin-financials'
    from public.profiles where role::text in ('admin', 'finance') and is_active;
end $$;
grant execute on function public.submit_receipt(bigint, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 6. When a payment becomes paid: open the plan or add the credits
-- ---------------------------------------------------------------------
create or replace function public.fulfil_payment() returns trigger
  language plpgsql security definer set search_path = public as
$$
declare pl public.plans; pk public.session_packages; s public.subscriptions; cid bigint;
begin
  if new.status <> 'paid' or (tg_op = 'UPDATE' and old.status = 'paid') then return new; end if;

  if new.kind = 'plan' and new.plan_id is not null then
    select * into pl from public.plans where id = new.plan_id;
    select * into s from public.subscriptions where student_id = new.student_id and plan_id = pl.id and status = 'active';
    if s.id is null then
      insert into public.subscriptions (student_id, plan_id, starts_at, ends_at, last_payment_id)
      values (new.student_id, pl.id, now(), now() + make_interval(months => pl.period_months), new.id) returning * into s;
    else
      update public.subscriptions set ends_at = greatest(ends_at, now()) + make_interval(months => pl.period_months), last_payment_id = new.id
       where id = s.id returning * into s;
    end if;
    if pl.private_credits > 0 then
      insert into public.credit_grants (student_id, source, total, expires_at, payment_id, note, created_by)
      values (new.student_id, 'plan', pl.private_credits, s.ends_at, new.id, pl.name, null);
    end if;
    foreach cid in array pl.course_ids loop
      if exists (select 1 from public.enrollments where student_id = new.student_id and course_id = cid and status in ('active', 'completed')) then continue; end if;
      update public.enrollments set status = 'active', subscription_id = s.id
       where id = (select id from public.enrollments where student_id = new.student_id and course_id = cid and status in ('pending', 'cancelled') order by id desc limit 1);
      if not found then
        insert into public.enrollments (student_id, course_id, status, source, subscription_id, note)
        values (new.student_id, cid, 'active', 'admin', s.id, 'Included in ' || pl.name);
      end if;
    end loop;
    insert into public.notifications (user_id, title, body, link)
    values (new.student_id, 'Your plan is active', pl.name || ' · until ' || to_char(s.ends_at at time zone 'Asia/Kuala_Lumpur', 'DD Mon YYYY'), '/student/plans');

  elsif new.kind = 'package' and new.package_id is not null then
    select * into pk from public.session_packages where id = new.package_id;
    insert into public.credit_grants (student_id, source, total, expires_at, payment_id, note, created_by)
    values (new.student_id, 'package', pk.sessions, now() + make_interval(days => pk.valid_days), new.id, pk.name, null);
    insert into public.notifications (user_id, title, body, link)
    values (new.student_id, 'Private sessions added', pk.sessions || ' sessions · ' || pk.name, '/student/private-sessions');
  end if;
  return new;
end $$;
drop trigger if exists payments_fulfil on public.payments;
create trigger payments_fulfil after insert or update of status on public.payments
  for each row execute function public.fulfil_payment();

-- ---------------------------------------------------------------------
-- 7. Private sessions use a credit when the office turns this on
-- ---------------------------------------------------------------------
create or replace function public.book_private_slot(p_slot bigint, p_note text default null) returns void
  language plpgsql security definer set search_path = public as
$$
declare sl public.private_slots; g bigint; need boolean := coalesce((public.billing('privateNeedsCredit'))::text::boolean, false);
begin
  if public.my_role() <> 'student' then raise exception 'Only students can book a session.'; end if;
  if not public.placement_done() then raise exception 'Please take the placement test first.'; end if;
  if need then
    select id into g from public.credit_grants where student_id = auth.uid() and used < total and expires_at > now()
     order by expires_at limit 1 for update;
    if g is null then raise exception 'You have no private-session credits left. Buy a package from Plans & Packages.'; end if;
  elsif not exists (select 1 from public.enrollments where student_id = auth.uid() and status = 'active')
        and public.credits_left() = 0 then
    raise exception 'Private sessions are for students with an active course or a session package.';
  else
    select id into g from public.credit_grants where student_id = auth.uid() and used < total and expires_at > now()
     order by expires_at limit 1 for update;
  end if;
  update public.private_slots set status = 'booked', booked_by = auth.uid(), booked_at = now(), student_note = nullif(btrim(p_note), ''), credit_grant_id = g
   where id = p_slot and status = 'open' and starts_at > now() + interval '2 hours'
   returning * into sl;
  if sl.id is null then raise exception 'This time is no longer available. Please choose another.'; end if;
  if g is not null then update public.credit_grants set used = used + 1 where id = g; end if;
  insert into public.notifications (user_id, title, body, link)
  values (sl.instructor_id, 'New private session booked',
          (select full_name from public.profiles where id = auth.uid()) || ' · ' || to_char(sl.starts_at at time zone 'Asia/Kuala_Lumpur', 'DD Mon HH24:MI'),
          '/instructor/private-sessions');
end $$;
grant execute on function public.book_private_slot(bigint, text) to authenticated;

create or replace function public.cancel_private_booking(p_slot bigint) returns void
  language plpgsql security definer set search_path = public as
$$
declare sl public.private_slots;
begin
  select * into sl from public.private_slots where id = p_slot;
  if sl.id is null or sl.status <> 'booked' then raise exception 'Booking not found.'; end if;
  if sl.booked_by = auth.uid() then
    if sl.starts_at < now() + interval '24 hours' then raise exception 'Bookings can be cancelled up to 24 hours before the session. Please contact your instructor.'; end if;
    update public.private_slots set status = 'open', booked_by = null, booked_at = null, student_note = null, credit_grant_id = null where id = p_slot;
    insert into public.notifications (user_id, title, body, link)
    values (sl.instructor_id, 'Private session cancelled by the student', to_char(sl.starts_at at time zone 'Asia/Kuala_Lumpur', 'DD Mon HH24:MI'), '/instructor/private-sessions');
  elsif sl.instructor_id = auth.uid() or public.is_academic() then
    update public.private_slots set status = 'cancelled', credit_grant_id = null where id = p_slot;
    insert into public.notifications (user_id, title, body, link)
    values (sl.booked_by, 'Your private session was cancelled', to_char(sl.starts_at at time zone 'Asia/Kuala_Lumpur', 'DD Mon HH24:MI') ||
            case when sl.credit_grant_id is not null then ' · your credit was returned' else '' end, '/student/private-sessions');
  else
    raise exception 'Not allowed.';
  end if;
  -- the credit goes back in both cases
  if sl.credit_grant_id is not null then update public.credit_grants set used = greatest(used - 1, 0) where id = sl.credit_grant_id; end if;
end $$;
grant execute on function public.cancel_private_booking(bigint) to authenticated;

-- ---------------------------------------------------------------------
-- 8. Refunds
-- ---------------------------------------------------------------------
create table if not exists public.refund_requests (
  id bigint generated always as identity primary key,
  payment_id bigint not null references public.payments (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  amount numeric(10, 2) not null check (amount > 0),
  reason text not null check (char_length(reason) between 3 and 2000),
  status text not null default 'requested' check (status in ('requested', 'approved', 'rejected', 'processed')),
  revoke_access boolean not null default true,
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  response text,
  refund_reference text,
  created_at timestamptz not null default now()
);
alter table public.refund_requests enable row level security;
drop policy if exists "refunds: read" on public.refund_requests;
create policy "refunds: read" on public.refund_requests for select to authenticated using (student_id = auth.uid() or public.is_finance());
drop policy if exists "refunds: finance" on public.refund_requests;
create policy "refunds: finance" on public.refund_requests for update to authenticated using (public.is_finance());

create or replace function public.request_refund(p_payment bigint, p_reason text) returns bigint
  language plpgsql security definer set search_path = public as
$$
declare p public.payments; days int := coalesce((public.billing('refundDays'))::text::int, 14); rid bigint;
begin
  select * into p from public.payments where id = p_payment;
  if p.id is null or p.student_id <> auth.uid() then raise exception 'Payment not found.'; end if;
  if p.status <> 'paid' or p.amount - p.refunded_amount <= 0 then raise exception 'Only paid payments can be refunded.'; end if;
  if p.paid_at < now() - make_interval(days => days) then
    raise exception 'Refunds can be requested within % days of payment. Please contact the office.', days;
  end if;
  if exists (select 1 from public.refund_requests where payment_id = p.id and status in ('requested', 'approved')) then
    raise exception 'You already asked for a refund of this payment.';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then raise exception 'Please write the reason.'; end if;
  insert into public.refund_requests (payment_id, student_id, amount, reason) values (p.id, auth.uid(), p.amount - p.refunded_amount, btrim(p_reason))
  returning id into rid;
  insert into public.notifications (user_id, title, body, link)
  select id, 'Refund request', coalesce(p.description, p.invoice_no) || ' · ' || (p.amount - p.refunded_amount) || ' ' || p.currency, '/admin/refunds'
    from public.profiles where role::text in ('admin', 'finance') and is_active;
  return rid;
end $$;
grant execute on function public.request_refund(bigint, text) to authenticated;

-- finance decides: approve / reject, then mark processed once the money is sent back
create or replace function public.guard_refund() returns trigger
  language plpgsql security definer set search_path = public as
$$
declare p public.payments;
begin
  new.payment_id := old.payment_id; new.student_id := old.student_id; new.created_at := old.created_at; new.reason := old.reason;
  if old.status in ('rejected', 'processed') and new.status <> old.status then raise exception 'This refund is already closed.'; end if;
  select * into p from public.payments where id = new.payment_id;
  if new.amount > p.amount - p.refunded_amount then raise exception 'The refund is more than what is left of the payment.'; end if;
  if new.status <> old.status then
    new.decided_by := auth.uid(); new.decided_at := now();
    insert into public.notifications (user_id, title, body, link)
    values (new.student_id,
            case new.status when 'approved' then 'Refund approved' when 'rejected' then 'Refund not approved' when 'processed' then 'Refund sent' else 'Refund updated' end,
            coalesce(p.description, p.invoice_no) || ' · ' || new.amount || ' ' || p.currency || coalesce(' — ' || new.response, ''), '/student/finances');
  end if;
  if new.status = 'processed' and old.status <> 'processed' then
    update public.payments set refunded_amount = refunded_amount + new.amount,
           status = case when refunded_amount + new.amount >= amount then 'refunded' else status end
     where id = p.id;
    if new.revoke_access then
      if p.kind = 'course' and p.enrollment_id is not null then
        update public.enrollments set status = 'cancelled', note = coalesce(note || ' · ', '') || 'refunded' where id = p.enrollment_id;
        update public.agent_earnings set status = 'cancelled' where enrollment_id = p.enrollment_id and status in ('pending', 'approved') and payout_id is null;
      elsif p.kind = 'plan' then
        update public.subscriptions set status = 'cancelled', cancelled_at = now() where last_payment_id = p.id and status = 'active';
        perform public.expire_subscriptions();
        update public.credit_grants set total = greatest(used, 1), used = greatest(used, 1) where payment_id = p.id and used < total;
      elsif p.kind = 'package' then
        update public.credit_grants set total = greatest(used, 1), used = greatest(used, 1) where payment_id = p.id and used < total;
      end if;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists refunds_guard on public.refund_requests;
create trigger refunds_guard before update on public.refund_requests for each row execute function public.guard_refund();

-- ---------------------------------------------------------------------
-- 9. Custom invoices from the office (a "custom" payment with lines)
-- ---------------------------------------------------------------------
create or replace function public.create_invoice(p_student uuid, p_lines jsonb, p_due date default null, p_note text default null) returns bigint
  language plpgsql security definer set search_path = public as
$$
declare sub numeric := 0; l jsonb; rate numeric; id_ bigint; descr text;
begin
  if not public.is_finance() then raise exception 'Not allowed.'; end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then raise exception 'Add at least one line.'; end if;
  for l in select * from jsonb_array_elements(p_lines) loop
    if coalesce(l ->> 'description', '') = '' or (l ->> 'qty')::numeric <= 0 or (l ->> 'unit')::numeric < 0 then raise exception 'Every line needs a description, a quantity and a price.'; end if;
    sub := sub + round((l ->> 'qty')::numeric * (l ->> 'unit')::numeric, 2);
  end loop;
  rate := coalesce((public.billing('taxRate'))::text::numeric, 0);
  descr := (p_lines -> 0 ->> 'description') || case when jsonb_array_length(p_lines) > 1 then ' + ' || (jsonb_array_length(p_lines) - 1) || ' more' else '' end;
  insert into public.payments (student_id, kind, description, lines, subtotal, discount, tax, amount, currency, method, status, due_at, note, created_by)
  values (p_student, 'custom', descr, p_lines, sub, 0, round(sub * rate / 100, 2), round(sub * (1 + rate / 100), 2), 'USD', null, 'pending',
          p_due::timestamptz, nullif(btrim(p_note), ''), auth.uid())
  returning id into id_;
  insert into public.notifications (user_id, title, body, link) values (p_student, 'New invoice', descr, '/student/finances');
  return id_;
end $$;
grant execute on function public.create_invoice(uuid, jsonb, date, text) to authenticated;

-- ---------------------------------------------------------------------
-- 10. Agent commission is worked out on what the student actually paid (after discount, before tax)
-- ---------------------------------------------------------------------
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
  select p.amount - p.tax into price from public.payments p where p.enrollment_id = new.id and p.status = 'paid' order by p.id desc limit 1;
  if price is null then select c.price into price from public.courses c where c.id = new.course_id; end if;
  amt := case when r.kind = 'percent' then round(coalesce(price, 0) * r.value / 100, 2) else r.value end;
  if amt > 0 then
    insert into public.agent_earnings (agent_id, enrollment_id, rule_id, amount, currency) values (new.agent_id, new.id, r.id, amt, 'USD');
  end if;
  return new;
end $$;
