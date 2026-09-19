// Service worker: looks up episodes on the platform API on behalf of the
// content script (so the request carries the extension's host permission
// instead of youtube.com's origin) and caches the answers.

importScripts('common.js');

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map(); // videoId -> { ts, result }

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.type !== 'lookupEpisode') return false;
  lookupEpisode(msg.videoId)
    .then(sendResponse)
    .catch((err) => sendResponse({ episode: null, error: String(err && err.message || err) }));
  return true; // keep the channel open for the async reply
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.apiBase) cache.clear();
});

async function lookupEpisode(videoId) {
  if (!videoId) return { episode: null };

  const hit = cache.get(videoId);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.result;

  const settings = await CCA.getSettings();
  const apiBase = CCA.normalizeBase(settings.apiBase);

  let result;
  if (!apiBase) {
    result = { episode: demoEpisode(videoId), demoMode: true };
  } else {
    result = await fetchEpisode(apiBase, videoId);
  }

  cache.set(videoId, { ts: Date.now(), result });
  return result;
}

async function fetchEpisode(apiBase, videoId) {
  const url = apiBase + CCA.API_PATH + encodeURIComponent(videoId);
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (res.status === 404) return { episode: null };
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const episode = CCA.normalizeEpisode(await res.json());
  return { episode };
}

// Demo mode: until a platform URL is configured, every YouTube video is
// treated as an episode so the banner and popup can be seen working.
function demoEpisode(videoId) {
  return CCA.normalizeEpisode({
    title: 'פרק לדוגמה (מצב דמו)',
    demo: true,
    versions: CCA.STYLES.map((s) => ({
      style: s.id,
      label: s.label,
      url: 'https://example.com/watch/' + encodeURIComponent(videoId) + '?style=' + s.id,
    })),
  });
}
