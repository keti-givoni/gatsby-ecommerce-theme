import { NextResponse, type NextRequest } from 'next/server';
import { episodeForExtension } from '@/lib/episodes';

// Public endpoint used by the Chrome extension. Returns only style names and
// platform links, never the video URLs, so it is safe to expose with CORS.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Accept',
  'Cache-Control': 'public, max-age=300',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ videoId: string }> }) {
  const { videoId } = await ctx.params;
  if (!/^[\w-]{6,32}$/.test(videoId)) {
    return NextResponse.json({ error: 'bad video id' }, { status: 404, headers: CORS });
  }
  const episode = await episodeForExtension(videoId);
  if (!episode) return NextResponse.json({ error: 'not an episode' }, { status: 404, headers: CORS });
  return NextResponse.json(episode, { headers: CORS });
}
