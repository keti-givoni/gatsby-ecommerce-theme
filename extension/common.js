// Shared constants and helpers. Loaded by the content script, the popup,
// the options page and (via importScripts) the background service worker.

const CCA = {
  // Viewing styles the platform can offer. The API may return a subset per
  // episode; labels here are only used as a fallback when the API omits them.
  STYLES: [
    { id: 'hasidic', label: 'חסידי' },
    { id: 'litvak', label: 'ליטאי' },
    { id: 'dati_leumi', label: 'דתי לאומי' },
    { id: 'masorti', label: 'מסורתי' },
  ],

  DEFAULTS: {
    apiBase: '',          // e.g. https://app.example.com  (empty = demo mode)
    preferredStyle: '',   // one of STYLES[].id, or '' for "ask me every time"
    autoRedirect: false,  // jump straight to the adapted version when one exists
  },

  API_PATH: '/api/episodes/by-youtube/',

  getSettings() {
    return chrome.storage.sync.get(CCA.DEFAULTS);
  },

  saveSettings(patch) {
    return chrome.storage.sync.set(patch);
  },

  styleLabel(id) {
    const s = CCA.STYLES.find((x) => x.id === id);
    return s ? s.label : id;
  },

  // Extracts the YouTube video id from a watch URL (desktop or mobile).
  getVideoId(href) {
    try {
      const u = new URL(href);
      if (u.pathname === '/watch') return u.searchParams.get('v');
      const shorts = u.pathname.match(/^\/shorts\/([\w-]{6,})/);
      if (shorts) return shorts[1];
      const live = u.pathname.match(/^\/live\/([\w-]{6,})/);
      if (live) return live[1];
      return null;
    } catch (_) {
      return null;
    }
  },

  normalizeBase(apiBase) {
    return String(apiBase || '').trim().replace(/\/+$/, '');
  },

  // Validates and normalizes an episode object returned by the API.
  normalizeEpisode(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const versions = Array.isArray(raw.versions) ? raw.versions : [];
    const clean = versions
      .filter((v) => v && typeof v.url === 'string' && typeof v.style === 'string')
      .map((v) => ({
        style: v.style,
        label: typeof v.label === 'string' && v.label ? v.label : CCA.styleLabel(v.style),
        url: v.url,
      }));
    if (!clean.length) return null;
    return {
      title: typeof raw.title === 'string' ? raw.title : '',
      versions: clean,
      demo: Boolean(raw.demo),
    };
  },
};

if (typeof globalThis !== 'undefined') globalThis.CCA = CCA;
