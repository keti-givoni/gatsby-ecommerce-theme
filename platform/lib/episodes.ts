import { createAdminClient } from '@/lib/supabase/admin';
import { siteUrl } from '@/lib/env';
import { styleLabel } from '@/lib/styles';

export type Episode = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  youtube_id: string | null;
  published_at: string | null;
  is_published: boolean;
};

export type EpisodeVersion = {
  id: string;
  episode_id: string;
  style: string;
  label: string | null;
  video_url: string;
};

export function watchUrl(slug: string, style: string): string {
  return `${siteUrl()}/watch/${encodeURIComponent(slug)}?style=${encodeURIComponent(style)}`;
}

/** Public shape returned to the Chrome extension: styles and platform links only. */
export async function episodeForExtension(youtubeId: string) {
  const admin = createAdminClient();
  const { data: episode } = await admin
    .from('episodes')
    .select('id, slug, title, is_published')
    .eq('youtube_id', youtubeId)
    .eq('is_published', true)
    .maybeSingle();
  if (!episode) return null;
  const { data: versions } = await admin
    .from('episode_versions')
    .select('style, label')
    .eq('episode_id', episode.id)
    .order('style');
  const list = (versions ?? []) as Pick<EpisodeVersion, 'style' | 'label'>[];
  if (!list.length) return null;
  return {
    title: episode.title as string,
    versions: list.map((v) => ({
      style: v.style,
      label: v.label || styleLabel(v.style),
      url: watchUrl(episode.slug as string, v.style),
    })),
  };
}
