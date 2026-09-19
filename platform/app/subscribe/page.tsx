import Link from 'next/link';
import { getUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getLatestSubscription, isActive } from '@/lib/subscription';
import SubscribeForm from './SubscribeForm';

export const dynamic = 'force-dynamic';

export default async function SubscribePage() {
  const user = await getUser();
  if (!user) return null; // proxy redirects to /login
  const sub = await getLatestSubscription(user.id);
  if (isActive(sub)) {
    return (
      <div className="card">
        <h1>המנוי שלך פעיל</h1>
        <p>אפשר לצפות בכל הפרקים. <Link href="/episodes">לרשימת הפרקים</Link></p>
      </div>
    );
  }
  const admin = createAdminClient();
  const { data: profile } = await admin.from('profiles').select('full_name, phone').eq('id', user.id).maybeSingle();
  const price = process.env.PLAN_PRICE_ILS ?? '';
  return (
    <div className="card" style={{ maxWidth: 480 }}>
      <h1>מנוי חודשי</h1>
      <p className="lead">{price ? `${price} ₪ לחודש.` : ''} מתחדש אוטומטית, אפשר לבטל בכל רגע מהחשבון.</p>
      <SubscribeForm defaultName={profile?.full_name ?? ''} defaultPhone={profile?.phone ?? ''} email={user.email ?? ''} />
      <p className="muted small">התשלום מתבצע בדף מאובטח של Grow. פרטי הכרטיס לא נשמרים אצלנו.</p>
    </div>
  );
}
