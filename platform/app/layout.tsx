import type { Metadata } from 'next';
import './globals.css';
import SiteHeader from '@/components/SiteHeader';

export const metadata: Metadata = {
  title: 'הפודקאסט עם לבוש מותאם',
  description: 'צפייה בפרקי הפודקאסט בגרסה עם לבוש שמתאים לסגנון הצפייה שלך',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body>
        <SiteHeader />
        <main>{children}</main>
      </body>
    </html>
  );
}
