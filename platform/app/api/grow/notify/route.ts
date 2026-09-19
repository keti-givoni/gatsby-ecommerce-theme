import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { approveTransaction, configFromEnv, isSuccessfulCharge, parseCallback } from '@/lib/grow';
import { addOneMonth, type SubscriptionRow } from '@/lib/subscription';

export const dynamic = 'force-dynamic';

// Grow server-to-server callback (notifyUrl). Called on the first charge and,
// for recurring orders, on every renewal. Form-encoded POST.
export async function POST(request: NextRequest) {
  const contentType = request.headers.get('content-type') ?? '';
  let params: URLSearchParams;
  if (contentType.includes('application/json')) {
    const json = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    params = new URLSearchParams(Object.entries(json).map(([k, v]) => [k, String(v)]));
  } else {
    params = new URLSearchParams(await request.text());
  }
  const cb = parseCallback(params);
  const admin = createAdminClient();

  // Locate the subscription: by our own id echoed in cField1, then by Grow ids.
  let sub: SubscriptionRow | null = null;
  if (cb.cField1) {
    const { data } = await admin.from('subscriptions').select('*').eq('id', cb.cField1).maybeSingle();
    sub = (data as SubscriptionRow | null) ?? null;
  }
  if (!sub && cb.processId) {
    const { data } = await admin.from('subscriptions').select('*').eq('grow_process_id', cb.processId).maybeSingle();
    sub = (data as SubscriptionRow | null) ?? null;
  }
  if (!sub && cb.recurringId) {
    const { data } = await admin.from('subscriptions').select('*').eq('grow_recurring_id', cb.recurringId)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    sub = (data as SubscriptionRow | null) ?? null;
  }

  await admin.from('payment_events').insert({
    subscription_id: sub?.id ?? null,
    kind: sub ? 'callback' : 'callback_unmatched',
    payload: cb.raw,
  });

  if (!sub) return NextResponse.json({ ok: false, error: 'unknown subscription' }, { status: 404 });

  // Anti-forgery: the callback must carry the processToken we received when
  // creating the process (first charge), or reference a recurring id we
  // already stored (renewals).
  const tokenMatches = !!sub.grow_process_token && cb.processToken === sub.grow_process_token;
  const recurringMatches = !!sub.grow_recurring_id && cb.recurringId === sub.grow_recurring_id;
  if (!tokenMatches && !recurringMatches) {
    await admin.from('payment_events').insert({ subscription_id: sub.id, kind: 'callback_rejected', payload: { reason: 'token mismatch' } });
    return NextResponse.json({ ok: false, error: 'token mismatch' }, { status: 403 });
  }

  // Idempotency: ignore a transaction we already applied.
  if (cb.transactionId && sub.grow_transaction_id === cb.transactionId && sub.status === 'active') {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const now = new Date();
  if (isSuccessfulCharge(cb)) {
    const periodStart = sub.current_period_end && new Date(sub.current_period_end) > now
      ? new Date(sub.current_period_end)
      : now;
    await admin.from('subscriptions').update({
      status: 'active',
      started_at: sub.started_at ?? now.toISOString(),
      current_period_end: addOneMonth(periodStart).toISOString(),
      grow_transaction_id: cb.transactionId || sub.grow_transaction_id,
      grow_recurring_id: cb.recurringId || sub.grow_recurring_id,
      plan_sum: cb.sum ?? sub.plan_sum,
    }).eq('id', sub.id);
  } else {
    // A failed charge on an active subscription keeps access during the grace period.
    await admin.from('subscriptions').update({
      status: sub.status === 'active' ? 'past_due' : sub.status,
      grow_recurring_id: cb.recurringId || sub.grow_recurring_id,
    }).eq('id', sub.id);
  }

  // Acknowledge to Grow. Their side processes the charge regardless.
  if (cb.transactionId) {
    try {
      const ok = await approveTransaction(configFromEnv(), cb.transactionId);
      await admin.from('payment_events').insert({ subscription_id: sub.id, kind: 'approve', payload: { ok } });
    } catch (e) {
      await admin.from('payment_events').insert({ subscription_id: sub.id, kind: 'approve_failed', payload: { message: (e as Error).message } });
    }
  }

  return NextResponse.json({ ok: true });
}
