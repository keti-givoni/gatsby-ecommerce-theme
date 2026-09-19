import Link from 'next/link';

export default function CancelPage() {
  return (
    <div className="card" style={{ maxWidth: 480 }}>
      <h1>התשלום בוטל</h1>
      <p>לא חויבת. אפשר לנסות שוב בכל זמן.</p>
      <Link href="/subscribe" className="btn primary">חזרה למנוי</Link>
    </div>
  );
}
