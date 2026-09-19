import { NextResponse } from 'next/server';
import { getUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getLatestSubscription, isActive } from '@/lib/subscription';
import { configFromEnv, updateRecurringPayment } from '@/lib/grow';

export const dynamic = 'force-dynamic';

// Cancels the recurring order at Grow and marks the subscription canceled.
// Access stays open until current_period_end (see is_active_subscriber).
export async function POST() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'לא מחובר' }, { status: 401 });
  const sub = await getLatestSubscription(user.id);
  if (!sub || !isActive(sub)) return NextResponse.json({ error: 'אין מנוי פעיל' }, { status: 404 });

  const admin = createAdminClient();
  let growOk = false;
  let growError: string | null = null;
  if (sub.grow_recurring_id) {
    try {
      growOk = await updateRecurringPayment(configFromEnv(), sub.grow_recurring_id, 'cancel');
    } catch (e) {
      growError = (e as Error).message;
    }
  } else {
    growError = 'no recurring id stored';
  }

  await admin.from('subscriptions').update({ status: 'canceled', canceled_at: new Date().toISOString() }).eq('id', sub.id);
  await admin.from('payment_events').insert({
    subscription_id: sub.id,
    kind: growOk ? 'cancel' : 'cancel_needs_manual',
    payload: { growOk, growError },
  });

  // Even if Grow's API refused, the local state is canceled so the user is
  // not shown as subscribed beyond the paid period; the event log flags it
  // for manual cancellation in the Grow dashboard.
  return NextResponse.json({ ok: true, growOk });
}
