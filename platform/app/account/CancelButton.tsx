'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CancelButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function cancel() {
    if (!confirm('לבטל את המנוי? הצפייה תישאר פתוחה עד סוף התקופה ששולמה.')) return;
    setBusy(true);
    const res = await fetch('/api/grow/cancel', { method: 'POST' });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) { setMsg('המנוי בוטל.'); router.refresh(); }
    else setMsg(json.error || 'הביטול נכשל. כתבו לנו ונטפל בזה.');
  }

  return (
    <div>
      <button className="btn" onClick={cancel} disabled={busy}>{busy ? 'מבטל...' : 'ביטול המנוי'}</button>
      {msg && <p className="small">{msg}</p>}
    </div>
  );
}
