'use client';
import { useState, type FormEvent } from 'react';

export default function SubscribeForm({ defaultName, defaultPhone, email }: { defaultName: string; defaultPhone: string; email: string }) {
  const [fullName, setFullName] = useState(defaultName);
  const [phone, setPhone] = useState(defaultPhone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/grow/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, phone }),
      });
      const json = await res.json();
      if (!res.ok || !json.url) throw new Error(json.error || 'שגיאה ביצירת התשלום');
      window.location.href = json.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <label className="field"><span>אימייל</span><input value={email} readOnly dir="ltr" /></label>
      <label className="field"><span>שם מלא</span><input required value={fullName} onChange={(e) => setFullName(e.target.value)} /></label>
      <label className="field"><span>טלפון</span><input required dir="ltr" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
      {error && <p className="error">{error}</p>}
      <button className="btn primary" type="submit" disabled={busy}>{busy ? 'מעביר לתשלום...' : 'מעבר לתשלום מאובטח'}</button>
    </form>
  );
}
