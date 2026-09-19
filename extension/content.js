// Content script: runs on youtube.com, detects episode pages and shows a
// small floating card offering the adapted versions of the episode.

(() => {
  const HOST_ID = 'cca-host';
  const dismissed = new Set(); // video ids the user closed the card for
  let state = { videoId: null, episode: null, demoMode: false, error: null };
  let settings = { ...CCA.DEFAULTS };
  let inflight = 0;

  init();

  async function init() {
    settings = await CCA.getSettings();
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync') return;
      for (const k of Object.keys(changes)) settings[k] = changes[k].newValue;
      if (changes.apiBase) {
        state.videoId = null; // force a fresh lookup with the new backend
      }
      handleNavigation();
    });

    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg && msg.type === 'getState') {
        sendResponse({ ...state, settings });
        return false;
      }
      if (msg && msg.type === 'openVersion') {
        openVersion(msg.url, false);
        sendResponse({ ok: true });
        return false;
      }
      return false;
    });

    // YouTube is a single-page app: navigation does not reload the page.
    document.addEventListener('yt-navigate-finish', handleNavigation);
    window.addEventListener('popstate', handleNavigation);
    handleNavigation();
  }

  async function handleNavigation() {
    const videoId = CCA.getVideoId(location.href);
    if (videoId === state.videoId) {
      render();
      return;
    }
    state = { videoId, episode: null, demoMode: false, error: null };
    removeCard();
    if (!videoId) return;

    const seq = ++inflight;
    let result;
    try {
      result = await chrome.runtime.sendMessage({ type: 'lookupEpisode', videoId });
    } catch (err) {
      result = { episode: null, error: String(err) };
    }
    if (seq !== inflight || videoId !== state.videoId) return; // stale reply

    state.episode = result && result.episode ? result.episode : null;
    state.demoMode = Boolean(result && result.demoMode);
    state.error = result && result.error ? result.error : null;

    if (state.episode && settings.autoRedirect && settings.preferredStyle) {
      const v = state.episode.versions.find((x) => x.style === settings.preferredStyle);
      if (v && !state.episode.demo) {
        openVersion(v.url, true);
        return;
      }
    }
    render();
  }

  function openVersion(url, sameTab) {
    const video = document.querySelector('video');
    if (video && !video.paused) {
      try { video.pause(); } catch (_) { /* ignore */ }
    }
    if (sameTab) location.assign(url);
    else window.open(url, '_blank', 'noopener');
  }

  function removeCard() {
    const el = document.getElementById(HOST_ID);
    if (el) el.remove();
  }

  function render() {
    removeCard();
    if (!state.episode || !state.videoId || dismissed.has(state.videoId)) return;

    const host = document.createElement('div');
    host.id = HOST_ID;
    const shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = CSS;
    shadow.appendChild(style);

    const card = document.createElement('div');
    card.className = 'card';
    card.dir = 'rtl';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-label', 'גרסה מותאמת לפרק');

    const head = document.createElement('div');
    head.className = 'head';
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = state.episode.demo ? 'מצב דמו: כך תיראה ההצעה' : 'יש לפרק הזה גרסה עם לבוש מותאם';
    const close = document.createElement('button');
    close.className = 'close';
    close.type = 'button';
    close.title = 'סגירה';
    close.setAttribute('aria-label', 'סגירה');
    close.textContent = '×';
    close.addEventListener('click', () => {
      dismissed.add(state.videoId);
      removeCard();
    });
    head.append(title, close);
    card.appendChild(head);

    if (state.episode.title) {
      const sub = document.createElement('div');
      sub.className = 'sub';
      sub.textContent = state.episode.title;
      card.appendChild(sub);
    }

    const hint = document.createElement('div');
    hint.className = 'hint';
    hint.textContent = 'בחרו סגנון צפייה:';
    card.appendChild(hint);

    const list = document.createElement('div');
    list.className = 'versions';
    const preferred = settings.preferredStyle;
    const ordered = [...state.episode.versions].sort((a, b) =>
      (b.style === preferred) - (a.style === preferred));
    for (const v of ordered) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ver' + (v.style === preferred ? ' preferred' : '');
      btn.textContent = v.label;
      btn.addEventListener('click', () => openVersion(v.url, false));
      list.appendChild(btn);
    }
    card.appendChild(list);

    if (state.episode.demo) {
      const note = document.createElement('div');
      note.className = 'note';
      note.textContent = 'לא הוגדרה כתובת פלטפורמה. הקישורים כאן הם קישורי דוגמה. הגדרות התוסף ← כתובת הפלטפורמה.';
      card.appendChild(note);
    }

    shadow.appendChild(card);
    document.documentElement.appendChild(host);
  }

  const CSS = `
    :host { all: initial; }
    .card {
      position: fixed; top: 72px; right: 16px; z-index: 2147483646;
      width: 300px; max-width: calc(100vw - 32px);
      box-sizing: border-box; padding: 14px 16px;
      background: #fffdf8; color: #1f1a17;
      border: 1px solid #e6dccb; border-radius: 12px;
      box-shadow: 0 8px 28px rgba(0,0,0,.18);
      font: 14px/1.45 -apple-system, "Segoe UI", Roboto, Arial, "Noto Sans Hebrew", sans-serif;
      text-align: right;
    }
    .head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
    .title { font-weight: 700; font-size: 15px; }
    .close {
      flex: 0 0 auto; border: 0; background: transparent; cursor: pointer;
      font-size: 20px; line-height: 1; color: #7a6f65; padding: 0 2px; margin-top: -2px;
    }
    .close:hover { color: #1f1a17; }
    .sub { margin-top: 4px; color: #5c534b; font-size: 13px; }
    .hint { margin-top: 10px; font-size: 13px; color: #5c534b; }
    .versions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
    .ver {
      cursor: pointer; border: 1px solid #c9b99f; background: #fff; color: #1f1a17;
      border-radius: 999px; padding: 6px 12px; font: inherit; font-size: 13px;
    }
    .ver:hover { background: #f4ecdf; }
    .ver.preferred { background: #7b3f00; border-color: #7b3f00; color: #fff; }
    .ver.preferred:hover { background: #63320a; }
    .note { margin-top: 10px; font-size: 12px; color: #8a5a00; background: #fff4dc; border-radius: 8px; padding: 6px 8px; }
    @media (prefers-color-scheme: dark) {
      .card { background: #201c19; color: #f3ede4; border-color: #3b342e; }
      .sub, .hint { color: #b8ada0; }
      .ver { background: #2b2521; color: #f3ede4; border-color: #5a4d40; }
      .ver:hover { background: #3a312a; }
      .note { background: #3a2b12; color: #f0c97a; }
    }
  `;
})();
