// stripe-webhook — Stripe tells us a Checkout payment succeeded; we mark the payment as paid.
// Secrets needed: STRIPE_WEBHOOK_SECRET (whsec_...).
// IMPORTANT: deploy this function with "Verify JWT" turned OFF (Stripe does not send a Supabase token).
import { createClient } from 'npm:@supabase/supabase-js@2';

const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');

async function verify(body: string, header: string, secret: string): Promise<boolean> {
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=') as [string, string]));
  const t = parts['t'];
  const sigs = header.split(',').filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
  if (!t || !sigs.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false; // older than 5 minutes
  const k = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expected = hex(await crypto.subtle.sign('HMAC', k, enc.encode(`${t}.${body}`)));
  return sigs.includes(expected);
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!secret) return new Response('not configured', { status: 500 });
  const body = await req.text();
  if (!(await verify(body, req.headers.get('stripe-signature') ?? '', secret))) return new Response('bad signature', { status: 400 });

  const event = JSON.parse(body);
  const s = event.data?.object;
  const paidEvent = event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded';
  if (!paidEvent || s?.payment_status !== 'paid') return new Response('ignored', { status: 200 });

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const id = Number(s.metadata?.payment_id ?? s.client_reference_id);
  const { data: pay } = await db.from('payments').select('id, student_id, status, amount, stripe_session_id').eq('id', id).single();
  if (!pay) return new Response('payment not found', { status: 200 });
  if (pay.status === 'paid') return new Response('already paid', { status: 200 });
  // the session must be the one we created for this payment, and the amount must match
  if (pay.stripe_session_id !== s.id || Math.round(Number(pay.amount) * 100) !== s.amount_total) {
    console.error('mismatch', { id, session: s.id, amount: s.amount_total });
    return new Response('mismatch', { status: 200 });
  }

  await db.from('payments').update({
    status: 'paid',
    paid_at: new Date().toISOString(),
    method: 'card',
    reference: String(s.payment_intent ?? s.id),
  }).eq('id', pay.id).eq('status', 'pending');

  await db.from('notifications').insert({
    user_id: pay.student_id,
    title: 'Payment confirmed',
    body: 'We received your online payment. Our team will confirm your enrollment shortly.',
    link: '/student/finances',
  });
  return new Response('ok', { status: 200 });
});
