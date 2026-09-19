import { createAdminClient } from '@/lib/supabase/admin';

export type SubscriptionRow = {
  id: string;
  user_id: string;
  status: 'pending' | 'active' | 'past_due' | 'canceled';
  plan_sum: number | null;
  grow_process_id: string | null;
  grow_process_token: string | null;
  grow_transaction_id: string | null;
  grow_recurring_id: string | null;
  started_at: string | null;
  current_period_end: string | null;
  canceled_at: string | null;
  created_at: string;
};

const GRACE_DAYS = 3;

export function isActive(sub: SubscriptionRow | null | undefined): boolean {
  if (!sub) return false;
  if (sub.status !== 'active' && sub.status !== 'past_due') return false;
  if (!sub.current_period_end) return true;
  const end = new Date(sub.current_period_end).getTime() + GRACE_DAYS * 86400000;
  return end > Date.now();
}

/** Latest subscription for the user (any status). Uses the service role. */
export async function getLatestSubscription(userId: string): Promise<SubscriptionRow | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as SubscriptionRow | null) ?? null;
}

export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['active', 'past_due'])
    .order('created_at', { ascending: false })
    .limit(5);
  return ((data ?? []) as SubscriptionRow[]).some(isActive);
}

export function addOneMonth(from: Date): Date {
  const d = new Date(from);
  d.setMonth(d.getMonth() + 1);
  return d;
}
