'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function SuccessPage() {
  const [status, setStatus] = useState<'checking' | 'active' | 'pending'>('checking');

  useEffect(() => {
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    async function check() {
      tries += 1;
      try {
        const res = await fetch('/api/me/subscription', { cache: 'no-store' });
        const json = await res.json();
        if (json.active) { setStatus('active'); return; }
      } catch { /* retry */ }
      if (tries < 20) timer = setTimeout(check, 3000);
      else setStatus('pending');
    }
    check();
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="card" style={{ maxWidth: 520 }}>
      <h1>תודה!</h1>
      {status === 'checking' && <p>התשלום התקבל. מפעילים את המנוי, זה לוקח כמה שניות...</p>}
      {status === 'active' && (
        <>
          <p className="ok">המנוי פעיל. אפשר להתחיל לצפות.</p>
          <div className="row">
            <Link href="/account" className="btn">לבחירת סגנון הצפייה</Link>
            <Link href="/episodes" className="btn primary">לפרקים</Link>
          </div>
        </>
      )}
      {status === 'pending' && (
        <p className="note">התשלום עדיין לא אושר אצלנו. בדרך כלל זה מתעדכן תוך דקות. אם המנוי לא נפתח, כתבו לנו.</p>
      )}
    </div>
  );
}
