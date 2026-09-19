import { revalidatePath } from 'next/cache';
import { notFound } from 'next/navigation';
import { getUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { adminEmails } from '@/lib/env';
import { STYLES, isStyleId } from '@/lib/styles';
import type { Episode, EpisodeVersion } from '@/lib/episodes';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const user = await getUser();
  if (!user?.email || !adminEmails().includes(user.email.toLowerCase())) notFound();
  return user;
}

function slugify(s: string): string {
  return s.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'episode';
}

function youtubeIdFrom(input: string): string | null {
  const s = input.trim();
  if (/^[\w-]{6,32}$/.test(s)) return s;
  try {
    const u = new URL(s);
    if (u.hostname === 'youtu.be') return u.pathname.slice(1) || null;
    return u.searchParams.get('v');
  } catch {
    return null;
  }
}

async function addEpisode(formData: FormData) {
  'use server';
  await requireAdmin();
  const admin = createAdminClient();
  const title = String(formData.get('title') ?? '').trim();
  if (!title) return;
  const slug = String(formData.get('slug') ?? '').trim() || slugify(title);
  await admin.from('episodes').insert({
    title,
    slug,
    description: String(formData.get('description') ?? '').trim() || null,
    youtube_id: youtubeIdFrom(String(formData.get('youtube') ?? '')),
    published_at: String(formData.get('published_at') ?? '') || null,
  });
  revalidatePath('/admin');
}

async function addVersion(formData: FormData) {
  'use server';
  await requireAdmin();
  const admin = createAdminClient();
  const episodeId = String(formData.get('episode_id') ?? '');
  const style = String(formData.get('style') ?? '');
  const videoUrl = String(formData.get('video_url') ?? '').trim();
  if (!episodeId || !isStyleId(style) || !videoUrl) return;
  await admin.from('episode_versions').upsert(
    { episode_id: episodeId, style, video_url: videoUrl, label: String(formData.get('label') ?? '').trim() || null },
    { onConflict: 'episode_id,style' },
  );
  revalidatePath('/admin');
}

async function deleteVersion(formData: FormData) {
  'use server';
  await requireAdmin();
  const admin = createAdminClient();
  await admin.from('episode_versions').delete().eq('id', String(formData.get('id') ?? ''));
  revalidatePath('/admin');
}

export default async function AdminPage() {
  await requireAdmin();
  const admin = createAdminClient();
  const { data: eps } = await admin.from('episodes').select('*').order('created_at', { ascending: false });
  const { data: vs } = await admin.from('episode_versions').select('*');
  const { count: activeCount } = await admin.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active');
  const episodes = (eps ?? []) as Episode[];
  const versions = (vs ?? []) as EpisodeVersion[];

  return (
    <>
      <h1>ניהול</h1>
      <p className="muted">מנויים פעילים: {activeCount ?? 0}</p>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>פרק חדש</h2>
        <form action={addEpisode}>
          <label className="field"><span>כותרת</span><input name="title" required /></label>
          <label className="field"><span>קישור או מזהה של הסרטון ביוטיוב</span><input name="youtube" dir="ltr" /></label>
          <label className="field"><span>תאריך פרסום</span><input name="published_at" type="date" /></label>
          <label className="field"><span>תיאור</span><textarea name="description" rows={3} /></label>
          <label className="field"><span>slug (אופציונלי, נוצר אוטומטית)</span><input name="slug" dir="ltr" /></label>
          <button className="btn primary" type="submit">הוספת פרק</button>
        </form>
      </div>

      {episodes.map((ep) => {
        const epVersions = versions.filter((v) => v.episode_id === ep.id);
        return (
          <div className="card" key={ep.id}>
            <h2 style={{ marginTop: 0 }}>{ep.title}</h2>
            <div className="muted small">
              /watch/{ep.slug} · יוטיוב: <code>{ep.youtube_id ?? 'לא הוגדר'}</code>
            </div>
            <table>
              <thead><tr><th>סגנון</th><th>קישור וידאו</th><th></th></tr></thead>
              <tbody>
                {epVersions.map((v) => (
                  <tr key={v.id}>
                    <td>{v.label || STYLES.find((s) => s.id === v.style)?.label || v.style}</td>
                    <td><code>{v.video_url}</code></td>
                    <td>
                      <form action={deleteVersion}>
                        <input type="hidden" name="id" value={v.id} />
                        <button className="btn" type="submit">מחיקה</button>
                      </form>
                    </td>
                  </tr>
                ))}
                {!epVersions.length && <tr><td colSpan={3} className="muted">אין גרסאות עדיין</td></tr>}
              </tbody>
            </table>
            <form action={addVersion} className="row" style={{ marginTop: 10 }}>
              <input type="hidden" name="episode_id" value={ep.id} />
              <select name="style" style={{ width: 'auto' }}>
                {STYLES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              <input name="video_url" dir="ltr" placeholder="https://vimeo.com/... או קישור HLS/MP4" required style={{ flex: 1, minWidth: 220 }} />
              <button className="btn primary" type="submit">הוספה / עדכון</button>
            </form>
          </div>
        );
      })}
    </>
  );
}
