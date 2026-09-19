import { NextResponse } from 'next/server';
import { getUser } from '@/lib/supabase/server';
import { getLatestSubscription, isActive } from '@/lib/subscription';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ active: false, status: null }, { status: 401 });
  const sub = await getLatestSubscription(user.id);
  return NextResponse.json({
    active: isActive(sub),
    status: sub?.status ?? null,
    currentPeriodEnd: sub?.current_period_end ?? null,
  });
}
