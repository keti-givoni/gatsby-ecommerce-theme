import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { getUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getLatestSubscription, isActive } from '@/lib/subscription';
import { STYLES, isStyleId } from '@/lib/styles';
import CancelButton from './CancelButton';

export const dynamic = 'force-dynamic';

async function savePreferences(formData: FormData) {
  'use server';
  const user = await getUser();
  if (!user) return;
  const style = String(formData.get('preferred_style') ?? '');
  const admin = createAdminClient();
  await admin.from('profiles').update({ preferred_style: isStyleId(style) ? style : null }).eq('id', user.id);
  revalidatePath('/account');
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'ממתין לתשלום',
  active: 'פעיל',
  past_due: 'תשלום נכשל, בתקופת חסד',
  canceled: 'בוטל',
};

export default async function AccountPage() {
  const user = await getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: profile } = await admin.from('profiles').select('preferred_style').eq('id', user.id).maybeSingle();
  const sub = await getLatestSubscription(user.id);
  const active = isActive(sub);

  return (
    <>
      <h1>החשבון שלי</h1>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>המנוי</h2>
        {!sub && <p>אין מנוי. <Link href="/subscribe" className="btn primary">להצטרף למנוי חודשי</Link></p>}
        {sub && (
          <>
            <p>
              מצב: <strong>{STATUS_LABEL[sub.status] ?? sub.status}</strong>
              {sub.current_period_end && (
                <span className="muted"> · {sub.status === 'canceled' ? 'פעיל עד' : 'חיוב הבא'}: {new Date(sub.current_period_end).toLocaleDateString('he-IL')}</span>
              )}
            </p>
            {active && sub.status !== 'canceled' && <CancelButton />}
            {!active && <Link href="/subscribe" className="btn primary">להצטרף מחדש</Link>}
          </>
        )}
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>סגנון הצפייה שלי</h2>
        <form action={savePreferences}>
          <label className="field">
            <span>הגרסה שתיפתח כברירת מחדל</span>
            <select name="preferred_style" defaultValue={profile?.preferred_style ?? ''}>
              <option value="">לבחור בכל פרק</option>
              {STYLES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
          <button className="btn" type="submit">שמירה</button>
        </form>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>תוסף כרום</h2>
        <p className="small">התוסף מזהה את הפרקים ביוטיוב ומציע את הגרסה המותאמת. בהגדרות התוסף מזינים את הכתובת: <code>{process.env.NEXT_PUBLIC_SITE_URL}</code></p>
      </div>
    </>
  );
}
