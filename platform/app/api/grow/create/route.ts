import { NextResponse, type NextRequest } from 'next/server';
import { getUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getLatestSubscription, isActive } from '@/lib/subscription';
import { configFromEnv, createPaymentProcess } from '@/lib/grow';
import { env, siteUrl } from '@/lib/env';

export const dynamic = 'force-dynamic';

// Starts a Grow recurring payment for the signed-in user and returns the
// hosted payment page URL to redirect to.
export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user || !user.email) return NextResponse.json({ error: 'לא מחובר' }, { status: 401 });

  const existing = await getLatestSubscription(user.id);
  if (isActive(existing)) return NextResponse.json({ error: 'כבר יש מנוי פעיל' }, { status: 409 });

  let body: { fullName?: string; phone?: string } = {};
  try { body = await request.json(); } catch { /* empty body */ }
  const fullName = String(body.fullName ?? '').trim();
  const phone = String(body.phone ?? '').replace(/[^\d+]/g, '');
  if (fullName.length < 2) return NextResponse.json({ error: 'נא למלא שם מלא' }, { status: 400 });

  let cfg;
  try { cfg = configFromEnv(); } catch (e) {
    return NextResponse.json({ error: 'הסליקה לא מוגדרת: ' + (e as Error).message }, { status: 500 });
  }
  const sum = Number(env('PLAN_PRICE_ILS'));
  const paymentNum = Number(process.env.GROW_PAYMENT_NUM ?? '120');
  const description = process.env.PLAN_DESCRIPTION ?? 'מנוי חודשי';

  const admin = createAdminClient();
  await admin.from('profiles').update({ full_name: fullName, phone }).eq('id', user.id);

  const { data: sub, error } = await admin
    .from('subscriptions')
    .insert({ user_id: user.id, status: 'pending', provider: 'grow', plan_sum: sum })
    .select('id')
    .single();
  if (error || !sub) return NextResponse.json({ error: 'שגיאת מסד נתונים' }, { status: 500 });

  const base = siteUrl();
  try {
    const result = await createPaymentProcess(cfg, {
      sum,
      description,
      paymentNum,
      fullName,
      email: user.email,
      phone: phone || undefined,
      successUrl: `${base}/subscribe/success`,
      cancelUrl: `${base}/subscribe/cancel`,
      notifyUrl: `${base}/api/grow/notify`,
      customFields: [sub.id, user.id],
    });
    await admin
      .from('subscriptions')
      .update({ grow_process_id: result.processId, grow_process_token: result.processToken })
      .eq('id', sub.id);
    await admin.from('payment_events').insert({ subscription_id: sub.id, kind: 'process_created', payload: result });
    return NextResponse.json({ url: result.url });
  } catch (e) {
    const message = (e as Error).message;
    await admin.from('payment_events').insert({ subscription_id: sub.id, kind: 'process_failed', payload: { message } });
    return NextResponse.json({ error: 'יצירת התשלום נכשלה: ' + message }, { status: 502 });
  }
}
