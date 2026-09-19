import Link from 'next/link';
import { STYLES } from '@/lib/styles';

export default function HomePage() {
  return (
    <>
      <h1>אותו פודקאסט. לבוש שמתאים לך.</h1>
      <p className="lead">
        כל פרק זמין בכמה גרסאות, עם לבוש של המנחה והאורחים שמותאם לסגנון הצפייה שלך.
        בוחרים סגנון פעם אחת, וכל הפרקים נפתחים בגרסה שלכם.
      </p>
      <div className="chips">
        {STYLES.map((s) => <span key={s.id} className="chip">{s.label}</span>)}
      </div>
      <div className="row" style={{ marginTop: 16 }}>
        <Link href="/subscribe" className="btn primary">להצטרף למנוי חודשי</Link>
        <Link href="/episodes" className="btn">לרשימת הפרקים</Link>
      </div>
      <h2>איך זה עובד</h2>
      <ol>
        <li>נרשמים עם כתובת אימייל ומצטרפים למנוי חודשי.</li>
        <li>בוחרים את סגנון הצפייה בחשבון.</li>
        <li>צופים כאן באתר, או מתקינים את תוסף הכרום שמציע את הגרסה המותאמת ישירות מיוטיוב.</li>
      </ol>
    </>
  );
}
