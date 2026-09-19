const { chromium } = require('playwright');
const path = require('path').resolve(__dirname, '..');
(async () => {
  const ctx = await chromium.launchPersistentContext('', {
    headless: true, channel: 'chromium',
    args: [`--disable-extensions-except=${path}`, `--load-extension=${path}`],
  });
  const fakeYt = `<!doctype html><html><head><title>fake yt</title></head><body>
    <div id="masthead">YouTube</div><video id="v" src="" controls></video><div id="content">watch page</div></body></html>`;
  await ctx.route('https://www.youtube.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: fakeYt }));

  let sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker');
  const extId = new URL(sw.url()).host;
  console.log('extension id', extId);

  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto('https://www.youtube.com/watch?v=abc123XYZ_0');
  await page.waitForSelector('#cca-host', { state: 'attached', timeout: 10000 });
  const info = await page.evaluate(() => {
    const sr = document.getElementById('cca-host').shadowRoot;
    return { title: sr.querySelector('.title').textContent, buttons: [...sr.querySelectorAll('.ver')].map(b => b.textContent), note: !!sr.querySelector('.note') };
  });
  console.log('banner:', JSON.stringify(info));

  // clicking a version opens a new tab with the demo url and pauses the video
  await page.evaluate(() => document.getElementById('v').play().catch(() => {}));
  const [newPage] = await Promise.all([
    ctx.waitForEvent('page'),
    page.evaluate(() => document.getElementById('cca-host').shadowRoot.querySelector('.ver').click()),
  ]);
  console.log('opened:', newPage.url());
  console.log('video paused:', await page.evaluate(() => document.getElementById('v').paused));

  // close button dismisses; re-navigating (SPA style) to another id shows it again
  await page.evaluate(() => document.getElementById('cca-host').shadowRoot.querySelector('.close').click());
  console.log('after close present:', await page.$('#cca-host') !== null);
  await page.evaluate(() => { history.pushState({}, '', '/watch?v=second_id00'); document.dispatchEvent(new Event('yt-navigate-finish')); });
  await page.waitForSelector('#cca-host', { state: 'attached', timeout: 5000 });
  console.log('second video banner shown: true');
  await page.evaluate(() => { history.pushState({}, '', '/feed/subscriptions'); document.dispatchEvent(new Event('yt-navigate-finish')); });
  await page.waitForTimeout(300);
  console.log('non-watch page banner present:', await page.$('#cca-host') !== null);

  // preferred style moves to the front and is highlighted
  await page.evaluate(() => { history.pushState({}, '', '/watch?v=third_id000'); document.dispatchEvent(new Event('yt-navigate-finish')); });
  await page.waitForSelector('#cca-host', { state: 'attached' });
  const opt = await ctx.newPage();
  await opt.goto(`chrome-extension://${extId}/options.html`);
  await opt.selectOption('#preferredStyle', 'dati_leumi');
  await page.waitForTimeout(300);
  const first = await page.evaluate(() => { const b = document.getElementById('cca-host').shadowRoot.querySelector('.ver'); return b.textContent + '|' + b.className; });
  console.log('first button after preference:', first);

  // popup renders
  const pop = await ctx.newPage();
  pop.on('pageerror', (e) => errors.push('popup pageerror: ' + e.message));
  await pop.goto(`chrome-extension://${extId}/popup.html`);
  await pop.waitForTimeout(300);
  console.log('popup style value:', await pop.inputValue('#preferredStyle'));
  
  
  
  console.log('errors:', errors);
  await ctx.close();
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
