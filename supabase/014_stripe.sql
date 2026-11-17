-- 014 — Online payments with Stripe (card / FPX)
-- Run once in Supabase → SQL Editor.
-- The Stripe secret keys are NOT stored here: they live in Edge Function secrets.

alter table public.payments add column if not exists stripe_session_id text unique;

-- method values used by the app: 'bank_transfer', 'cash', 'card' (Stripe)
comment on column public.payments.stripe_session_id is 'Stripe Checkout Session id (cs_...) for online payments';
