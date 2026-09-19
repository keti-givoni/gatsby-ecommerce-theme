function embedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const id = u.searchParams.get('v');
      return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0` : url;
    }
    if (host === 'youtu.be') return `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}?rel=0`;
    if (host === 'vimeo.com') return `https://player.vimeo.com/video/${u.pathname.split('/').filter(Boolean).pop()}`;
    if (host.endsWith('youtube-nocookie.com') || host === 'player.vimeo.com' || host.includes('iframe.mediadelivery.net') || host.includes('player.mux.com')) return url;
    return null;
  } catch {
    return null;
  }
}

export default function Player({ url }: { url: string }) {
  const embed = embedUrl(url);
  return (
    <div className="player">
      {embed ? (
        <iframe src={embed} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen title="נגן" />
      ) : (
        <video src={url} controls playsInline />
      )}
    </div>
  );
}
