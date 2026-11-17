import { supabase } from './supabase';

/** Opens Stripe Checkout for one pending payment. Returns an error message, or redirects. */
export async function payOnline(paymentId: number): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke('stripe-checkout', { body: { payment_id: paymentId } });
  if (error) {
    let msg = error.message;
    try { const j = await (error as { context?: Response }).context?.json(); if (j?.error) msg = j.error; } catch { /* keep message */ }
    return msg;
  }
  if (!data?.url) return data?.error ?? 'Could not open the payment page.';
  window.location.href = data.url;
  return null;
}
