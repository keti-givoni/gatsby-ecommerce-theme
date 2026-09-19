import Link from 'next/link';
import { getUser } from '@/lib/supabase/server';
import { adminEmails } from '@/lib/env';

export default async function SiteHeader() {
  const user = await getUser();
  const isAdmin = !!user?.email && adminEmails().includes(user.email.toLowerCase());
  return (
    <header className="site">
      <div className="inner">
        <Link href="/" className="brand">הפודקאסט עם לבוש מותאם</Link>
        <nav>
          <Link href="/episodes">פרקים</Link>
          {user ? (
            <>
              <Link href="/account">החשבון שלי</Link>
              {isAdmin && <Link href="/admin">ניהול</Link>}
              <Link href="/auth/signout" prefetch={false}>יציאה</Link>
            </>
          ) : (
            <Link href="/login">כניסה</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
