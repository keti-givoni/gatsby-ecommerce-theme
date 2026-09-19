(async () => {
  const $ = (id) => document.getElementById(id);
  const settings = await CCA.getSettings();

  const sel = $('preferredStyle');
  for (const s of CCA.STYLES) {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.label;
    sel.appendChild(opt);
  }
  sel.value = settings.preferredStyle || '';
  $('autoRedirect').checked = Boolean(settings.autoRedirect);
  $('apiBase').value = settings.apiBase || '';

  sel.addEventListener('change', () => CCA.saveSettings({ preferredStyle: sel.value }).then(() => status('נשמר')));
  $('autoRedirect').addEventListener('change', (e) =>
    CCA.saveSettings({ autoRedirect: e.target.checked }).then(() => status('נשמר')));

  $('save').addEventListener('click', async () => {
    const apiBase = CCA.normalizeBase($('apiBase').value);
    if (apiBase) {
      let origin;
      try {
        const u = new URL(apiBase);
        if (u.protocol !== 'https:') throw new Error('not https');
        origin = u.origin;
      } catch (_) {
        status('הכתובת חייבת להתחיל ב-https://', true);
        return;
      }
      // Ask Chrome for permission to call the platform from the extension.
      // Without it the platform must answer with permissive CORS headers.
      let granted = false;
      try {
        granted = await chrome.permissions.request({ origins: [origin + '/*'] });
      } catch (_) { granted = false; }
      if (!granted) status('נשמר בלי הרשאת גישה. ודאו שה-API מחזיר כותרות CORS.', true);
    }
    await CCA.saveSettings({ apiBase });
    if (!apiBase) status('נשמר. התוסף במצב דמו.');
    else if ($('status').textContent === '') status('נשמר');
  });

  $('test').addEventListener('click', async () => {
    const apiBase = CCA.normalizeBase($('apiBase').value);
    if (!apiBase) { status('אין כתובת לבדוק. התוסף במצב דמו.'); return; }
    status('בודק...');
    try {
      const res = await fetch(apiBase + CCA.API_PATH + '__ping__', { headers: { Accept: 'application/json' } });
      if (res.status === 404 || res.ok) status('החיבור תקין (HTTP ' + res.status + ')');
      else status('הפלטפורמה ענתה עם שגיאה: HTTP ' + res.status, true);
    } catch (err) {
      status('לא ניתן להתחבר: ' + (err && err.message || err), true);
    }
  });

  function status(text, isError) {
    const el = $('status');
    el.textContent = text;
    el.classList.toggle('error', Boolean(isError));
    if (!isError) setTimeout(() => { if (el.textContent === text) el.textContent = ''; }, 2500);
  }
})();
