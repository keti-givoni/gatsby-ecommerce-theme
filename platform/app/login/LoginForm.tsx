'use client';
import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginForm() {
  const params = useSearchParams();
  const next = params.get('next') || '/account';
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const redirect = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <div className="card" style={{ maxWidth: 440 }}>
      <h1>כניסה</h1>
      {sent ? (
        <p className="ok">שלחנו קישור כניסה לכתובת {email}. פתחו את המייל ולחצו על הקישור.</p>
      ) : (
        <form onSubmit={submit}>
          <p className="muted">מזינים אימייל ומקבלים קישור כניסה. אין צורך בסיסמה.</p>
          <label className="field">
            <span>אימייל</span>
            <input type="email" dir="ltr" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="btn primary" type="submit" disabled={busy}>{busy ? 'שולח...' : 'שליחת קישור כניסה'}</button>
        </form>
      )}
    </div>
  );
}
