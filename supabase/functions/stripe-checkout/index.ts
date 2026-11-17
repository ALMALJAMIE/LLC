// stripe-checkout — creates a Stripe Checkout page for one pending payment of the signed-in student.
// Secrets needed (Supabase → Edge Functions → Secrets): STRIPE_SECRET_KEY, optional SITE_URL.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const key = Deno.env.get('STRIPE_SECRET_KEY');
    if (!key) return json({ error: 'Online payment is not set up yet.' }, 500);
    const site = (Deno.env.get('SITE_URL') ?? 'https://almaljamie.github.io/LLC').replace(/\/$/, '');
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // who is calling
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    const { data: { user } } = await db.auth.getUser(token);
    if (!user) return json({ error: 'Please sign in again.' }, 401);

    const { payment_id } = await req.json();
    const { data: pay } = await db.from('payments')
      .select('id, student_id, status, enrollment:enrollments(id, course:courses(title, code, price, currency))')
      .eq('id', payment_id).single();
    if (!pay || pay.student_id !== user.id) return json({ error: 'Payment not found.' }, 404);
    if (pay.status !== 'pending') return json({ error: 'This payment is already ' + pay.status + '.' }, 400);
    const course = (pay.enrollment as any)?.course;
    const price = Number(course?.price ?? 0);
    if (!course || price <= 0) return json({ error: 'This course has no fee.' }, 400);
    const currency = String(course.currency ?? 'MYR').toLowerCase();

    // the amount always comes from the course price, never from the browser
    await db.from('payments').update({ amount: price, currency: currency.toUpperCase(), method: 'card' }).eq('id', pay.id);

    const form = new URLSearchParams({
      mode: 'payment',
      success_url: `${site}/student/finances?paid=${pay.id}`,
      cancel_url: `${site}/student/finances?cancelled=${pay.id}`,
      client_reference_id: String(pay.id),
      customer_email: user.email ?? '',
      'metadata[payment_id]': String(pay.id),
      'payment_intent_data[metadata][payment_id]': String(pay.id),
      'line_items[0][quantity]': '1',
      'line_items[0][price_data][currency]': currency,
      'line_items[0][price_data][unit_amount]': String(Math.round(price * 100)),
      'line_items[0][price_data][product_data][name]': `${course.title}${course.code ? ` (${course.code})` : ''}`,
      expires_at: String(Math.floor(Date.now() / 1000) + 60 * 60), // 1 hour
    });
    const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    });
    const s = await r.json();
    if (!r.ok) return json({ error: s?.error?.message ?? 'Stripe error' }, 502);

    await db.from('payments').update({ stripe_session_id: s.id }).eq('id', pay.id);
    return json({ url: s.url });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
