(async () => {
  const $ = (id) => document.getElementById(id);

  const settings = await CCA.getSettings();

  // Style selector
  const sel = $('preferredStyle');
  for (const s of CCA.STYLES) {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.label;
    sel.appendChild(opt);
  }
  sel.value = settings.preferredStyle || '';
  $('autoRedirect').checked = Boolean(settings.autoRedirect);

  sel.addEventListener('change', () => save({ preferredStyle: sel.value }));
  $('autoRedirect').addEventListener('change', (e) => save({ autoRedirect: e.target.checked }));
  $('openOptions').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  async function save(patch) {
    await CCA.saveSettings(patch);
    flash('נשמר');
  }

  function flash(text) {
    const el = $('status');
    el.textContent = text;
    setTimeout(() => { if (el.textContent === text) el.textContent = ''; }, 1500);
  }

  // Ask the content script of the active tab what it sees.
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let state = null;
  if (tab && tab.id != null) {
    try {
      state = await chrome.tabs.sendMessage(tab.id, { type: 'getState' });
    } catch (_) {
      state = null; // not a YouTube tab, or the script has not loaded yet
    }
  }

  if (state && state.episode) {
    $('episode').hidden = false;
    $('episodeTitle').textContent = state.episode.title || 'פרק ללא שם';
    $('demoNote').hidden = !state.episode.demo;
    const chips = $('versions');
    for (const v of state.episode.versions) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip' + (v.style === settings.preferredStyle ? ' preferred' : '');
      b.textContent = v.label;
      b.addEventListener('click', async () => {
        try {
          await chrome.tabs.sendMessage(tab.id, { type: 'openVersion', url: v.url });
        } catch (_) {
          chrome.tabs.create({ url: v.url });
        }
        window.close();
      });
      chips.appendChild(b);
    }
  } else {
    $('noEpisode').hidden = false;
    if (state && state.videoId) {
      $('noEpisodeText').textContent = state.error
        ? 'לא ניתן היה לבדוק מול הפלטפורמה: ' + state.error
        : 'הסרטון הזה אינו פרק של הפודקאסט.';
    } else {
      $('noEpisodeText').textContent = 'פתחו סרטון ביוטיוב כדי לראות אם יש לו גרסה מותאמת.';
    }
  }
})();
