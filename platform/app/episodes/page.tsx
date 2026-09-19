import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { Episode } from '@/lib/episodes';

export const dynamic = 'force-dynamic';

export default async function EpisodesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('episodes')
    .select('id, slug, title, description, youtube_id, published_at, is_published')
    .order('published_at', { ascending: false, nullsFirst: false });
  const episodes = (data ?? []) as Episode[];
  return (
    <>
      <h1>פרקים</h1>
      {!episodes.length && <p className="muted">עדיין אין פרקים.</p>}
      <div className="grid">
        {episodes.map((ep) => (
          <Link key={ep.id} href={`/watch/${ep.slug}`} className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
            <strong>{ep.title}</strong>
            {ep.published_at && <div className="muted small">{ep.published_at}</div>}
            {ep.description && <p className="small">{ep.description}</p>}
          </Link>
        ))}
      </div>
    </>
  );
}
