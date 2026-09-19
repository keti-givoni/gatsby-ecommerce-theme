import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUser } from '@/lib/supabase/server';
import { hasActiveSubscription } from '@/lib/subscription';
import { styleLabel } from '@/lib/styles';
import type { Episode, EpisodeVersion } from '@/lib/episodes';
import Player from '@/components/Player';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ style?: string }> };

export default async function WatchPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { style: requested } = await searchParams;

  const admin = createAdminClient();
  const { data: ep } = await admin
    .from('episodes')
    .select('id, slug, title, description, youtube_id, published_at, is_published')
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle();
  if (!ep) notFound();
  const episode = ep as Episode;

  const { data: vs } = await admin
    .from('episode_versions')
    .select('id, episode_id, style, label, video_url')
    .eq('episode_id', episode.id)
    .order('style');
  const versions = (vs ?? []) as EpisodeVersion[];

  const user = await getUser();
  const subscribed = user ? await hasActiveSubscription(user.id) : false;

  let preferred = requested;
  if (!preferred && user) {
    const { data: profile } = await admin.from('profiles').select('preferred_style').eq('id', user.id).maybeSingle();
    preferred = profile?.preferred_style ?? undefined;
  }
  const current = versions.find((v) => v.style === preferred) ?? versions[0] ?? null;

  return (
    <>
      <h1>{episode.title}</h1>
      {episode.published_at && <div className="muted small">{episode.published_at}</div>}

      <div className="chips">
        {versions.map((v) => (
          <Link
            key={v.id}
            href={`/watch/${episode.slug}?style=${v.style}`}
            className={'chip' + (current && v.id === current.id ? ' active' : '')}
          >
            {v.label || styleLabel(v.style)}
          </Link>
        ))}
      </div>

      {!current && <p className="muted">לפרק הזה עדיין אין גרסאות מותאמות.</p>}

      {current && subscribed && <Player url={current.video_url} />}

      {current && !subscribed && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>הגרסה הזו זמינה למנויים</h2>
          <p>
            הגרסה בסגנון <strong>{current.label || styleLabel(current.style)}</strong> של הפרק הזה פתוחה למנויי הפלטפורמה.
          </p>
          <div className="row">
            {user ? (
              <Link href="/subscribe" className="btn primary">להצטרף למנוי חודשי</Link>
            ) : (
              <>
                <Link href={`/login?next=${encodeURIComponent(`/watch/${episode.slug}?style=${current.style}`)}`} className="btn primary">כניסה</Link>
                <Link href="/subscribe" className="btn">להצטרף למנוי</Link>
              </>
            )}
            {episode.youtube_id && (
              <a className="btn" href={`https://www.youtube.com/watch?v=${episode.youtube_id}`} target="_blank" rel="noreferrer">
                לגרסה המקורית ביוטיוב
              </a>
            )}
          </div>
        </div>
      )}

      {episode.description && <p>{episode.description}</p>}
    </>
  );
}
