'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createServer } = require('./server');
const { decks } = require('./slides.json');
const { labs } = require('./labs.json');
const browserPath = [process.env.BROWSER_PATH, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/microsoft-edge', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(file => file && fs.existsSync(file));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const storageKey = 'ldd-reading-progress-v2';
const saved = `JSON.parse(localStorage.getItem('${storageKey}') || '{}')`;

async function connect(url) {
  const ws = new WebSocket(url);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  const pending = new Map(); let nextId = 0;
  ws.onmessage = event => { const msg = JSON.parse(event.data); if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); } };
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, msg => msg.error || msg.result?.exceptionDetails ? reject(new Error(JSON.stringify(msg.error || msg.result.exceptionDetails))) : resolve(msg.result));
    ws.send(JSON.stringify({ id, method, params }));
  });
  const run = async expression => (await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value;
  return { ws, call, run };
}

test('reading chunks, progress carry-over, navigation, labs, fullscreen, persistence and reset', { skip: !browserPath, timeout: 60000 }, async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ldd-slides-'));
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const browser = spawn(browserPath, ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=0', `--user-data-dir=${dir}`, url], { stdio: 'ignore' });
  t.after(async () => { browser.kill(); await new Promise(resolve => server.close(resolve)); try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} });
  let port;
  for (let i = 0; i < 100; i++) {
    try { port = Number(fs.readFileSync(path.join(dir, 'DevToolsActivePort'), 'utf8').split('\n')[0]); break; } catch { await sleep(100); }
  }
  assert.ok(port, 'browser debugging port');
  let tabs;
  for (let i = 0; i < 50; i++) {
    try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (tabs.some(tab => tab.type === 'page')) break; } catch {}
    await sleep(100);
  }
  const { ws, call, run } = await connect(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
  t.after(() => ws.close());
  const wait = async expression => { for (let i = 0; i < 100; i++) { if (await run(expression)) return; await sleep(50); } assert.fail(`Timed out: ${expression}`); };
  const enter = async () => {
    await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
    await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  };
  const checkFullscreen = async (click = false) => {
    const progress = await run(`localStorage.getItem('${storageKey}')`);
    assert.equal(await run("(() => { const button = document.querySelector('[data-fullscreen]'); const viewer = document.querySelector('.slide-viewer').getBoundingClientRect(); const rect = button.getBoundingClientRect(); return button.parentElement.matches('.pdf-viewer') && rect.left >= viewer.left && rect.top >= viewer.top && rect.right <= viewer.right && rect.bottom <= viewer.bottom; })()"), true);
    await run("window.fullscreenViewer = document.querySelector('.slide-viewer'); document.querySelector('[data-fullscreen]').focus()");
    if (click) {
      const point = await run("(() => { const rect = document.querySelector('[data-fullscreen]').getBoundingClientRect(); return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }; })()");
      await call('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
      await call('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
    } else await enter();
    await wait('document.fullscreenElement === window.fullscreenViewer');
    await wait('fullscreenViewer.getBoundingClientRect().height >= innerHeight - 1 && fullscreenViewer.getBoundingClientRect().width >= innerWidth - 1');
    await run('document.exitFullscreen()');
    await wait('!document.fullscreenElement');
    assert.equal(await run("document.querySelector('.slide-viewer') === window.fullscreenViewer"), true);
    assert.equal(await run(`localStorage.getItem('${storageKey}')`), progress);
  };
  await wait("document.querySelectorAll('.course-card').length === 4");
  assert.equal(await run('document.title'), 'YOYEE | Your Own Yocto & Embedded Education');
  assert.equal(await run("document.querySelector('.brand').getAttribute('aria-label')"), 'YOYEE home');
  assert.equal(await run("document.querySelector('.brand').textContent.trim()"), '▦YOYEE');
  assert.equal(await run("Array.from(document.querySelectorAll('.page-heading .subtitle b'), e => e.textContent).join('')"), 'YOYEE');
  assert.ok(await run("parseInt(getComputedStyle(document.querySelector('.page-heading .subtitle b')).fontWeight) > parseInt(getComputedStyle(document.querySelector('.page-heading .subtitle')).fontWeight)"));
  assert.equal(await run("document.querySelector('h1').textContent"), 'Welcome to YOYEE.');
  assert.doesNotMatch(await run('document.body.textContent'), /workspace/i);
  assert.equal(await run("document.querySelector('.page-heading .subtitle').textContent"), 'Your Own Yocto & Embedded Education.');
  assert.equal(await run("document.querySelectorAll('.page-heading .subtitle')[1].textContent"), 'Embedded Linux · Kernel Drivers · Yocto · Debugging');
  assert.equal(await run("document.querySelector('#nav-courses, footer')"), null);
  assert.match(await run("document.querySelector('.source-credit').textContent"), /Slides © Bootlin/);
  assert.match(await run("document.querySelector('.hero p').textContent"), /Est\. \d+ min reading/);
  assert.deepEqual(await run("Array.from(document.querySelectorAll('.course-card h2'), e => e.textContent)"), decks.map(deck => deck.title));
  assert.deepEqual(await run("Array.from(document.querySelectorAll('.course-nav a'), e => e.dataset.course)"), decks.map(deck => deck.id));
  for (const deck of decks) {
    await run(`document.querySelector('[data-course="${deck.id}"]').click()`);
    await wait(`document.querySelector('.course-nav .active')?.dataset.course === '${deck.id}'`);
    assert.equal(await run("document.querySelectorAll('.section-row').length"), deck.sections.length);
    assert.deepEqual(await run("Array.from(document.querySelectorAll('.section-link strong'), e => e.textContent)"), deck.sections.map(section => section.title));
    assert.ok(await run("Array.from(document.querySelectorAll('.section-link small')).every(e => /Slides \\d+–\\d+ · Est\\. \\d+ min reading/.test(e.textContent))"));
  }
  // A completed old chapter becomes three completed parts without touching its saved data.
  const legacy = JSON.stringify({ 'embedded-linux:86': true });
  await run(`localStorage.setItem('ldd-slide-progress-v1', ${JSON.stringify(legacy)}); location.hash = '#course/embedded-linux'`);
  await call('Page.reload');
  await wait(`!!document.querySelector('input[data-start="125"]')`);
  assert.equal(await run(`document.querySelector('input[data-start="125"]').checked`), true);
  assert.equal(await run(`document.querySelector('input[data-start="143"]').checked`), true);
  assert.match(await run("document.querySelector('.subtitle').textContent"), /3 of 19/);
  await run(`document.querySelector('input[data-start="48"]').click()`);
  await wait(`${saved}['embedded-linux:48-85'] === true && ${saved}['embedded-linux:125-142'] === true`);
  assert.equal(await run("localStorage.getItem('ldd-slide-progress-v1')"), legacy);
  await run(`localStorage.setItem('${storageKey}', '{}')`);
  await call('Page.reload');
  await wait(`!!document.querySelector('input[data-start="48"]')`);
  await run(`localStorage.setItem('unrelated', 'keep'); document.querySelector('input[data-start="48"]').click()`);
  await wait(`${saved}['embedded-linux:48-85'] === true`);
  assert.match(await run("document.querySelector('.subtitle').textContent"), /1 of 19/);
  await call('Page.reload');
  await wait(`!!document.querySelector('input[data-start="48"]')`);
  assert.equal(await run(`document.querySelector('input[data-start="48"]').checked`), true);
  await run("window.other = document.createElement('iframe'); other.hidden = true; other.src = location.href; document.body.append(other)");
  await wait(`!!other.contentDocument?.querySelector('input[data-start="125"]')`);
  await run(`document.querySelector('input[data-start="86"]').click(); other.contentDocument.querySelector('input[data-start="125"]').click()`);
  await wait(`(() => { const p = ${saved}; return p['embedded-linux:48-85'] && p['embedded-linux:86-124'] && p['embedded-linux:125-142']; })()`);
  await wait(`other.contentDocument.querySelector('input[data-start="86"]').checked && document.querySelector('input[data-start="125"]').checked`);
  const { targetId } = await call('Target.createTarget', { url: `${url}/#course/embedded-linux` });
  let secondTab;
  for (let i = 0; i < 50; i++) {
    secondTab = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(tab => tab.id === targetId);
    if (secondTab) break;
    await sleep(50);
  }
  assert.ok(secondTab, 'second browser tab');
  const { ws: ws2, run: run2 } = await connect(secondTab.webSocketDebuggerUrl);
  t.after(() => ws2.close());
  for (let i = 0; i < 100 && !(await run2(`!!document.querySelector('input[data-start="218"]')`)); i++) await sleep(50);
  assert.equal(await run2(`!!document.querySelector('input[data-start="218"]')`), true);
  await Promise.all([run(`document.querySelector('input[data-start="167"]').click()`), run2(`document.querySelector('input[data-start="218"]').click()`)]);
  await wait(`${saved}['embedded-linux:167-217'] && ${saved}['embedded-linux:218-256']`);
  await call('Target.closeTarget', { targetId });
  await run("location.hash = '#slide/embedded-linux/48'");
  await wait("!!document.querySelector('.slide-viewer')");
  assert.equal(await run("document.querySelector('.slide-viewer').getAttribute('src')"), '/materials/bootlin/sections/embedded-linux/48-85.pdf');
  assert.equal(await run("document.querySelector('.course-nav .active')?.dataset.course"), 'embedded-linux');
  assert.equal(await run("document.querySelector('.slide-content .subtitle')"), null);
  assert.match(await run("document.querySelector('.viewer-hint').textContent"), /Slides 48–85 · Est\. 24 min reading/);
  assert.equal(await run(`document.querySelector('input[data-start="48"]').checked`), true);
  assert.equal(await run("Array.from(document.querySelectorAll('a')).some(a => a.textContent.includes('Open PDF'))"), false);
  await run(`window.currentViewer = document.querySelector('.slide-viewer'); window.sawProgressEvent = false; window.addEventListener('storage', e => { if (e.key === '${storageKey}') window.sawProgressEvent = true; }); other.contentDocument.querySelector('input[data-start="257"]').click()`);
  await wait(`${saved}['embedded-linux:257-294'] === true && window.sawProgressEvent`);
  assert.equal(await run("document.querySelector('.slide-viewer') === window.currentViewer"), true);
  await call('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  assert.equal(await run("document.querySelector('.slide-viewer').getBoundingClientRect().width >= document.querySelector('.main').getBoundingClientRect().width - 50"), true);
  assert.equal(await run("document.querySelector('.slide-viewer').getBoundingClientRect().height > innerHeight * 0.55"), true);
  assert.equal(await run('document.documentElement.scrollHeight <= innerHeight'), true);
  assert.equal(await run("document.querySelector('.section-navigation').getBoundingClientRect().bottom <= innerHeight"), true);
  await run("window.originalFullscreen = document.querySelector('.slide-viewer').requestFullscreen; document.querySelector('.slide-viewer').requestFullscreen = async () => { throw new Error('blocked'); }; document.querySelector('[data-fullscreen]').click()");
  await wait("document.getElementById('fullscreen-status').textContent.includes('Could not enter')");
  await run("document.querySelector('.slide-viewer').requestFullscreen = window.originalFullscreen");
  await checkFullscreen();
  assert.equal(await run("document.getElementById('fullscreen-status').textContent"), '');
  await run(`Storage.prototype.originalSetItem = Storage.prototype.setItem; Storage.prototype.setItem = () => { throw new Error('blocked'); }; document.querySelector('input[data-start="48"]').click()`);
  await wait("document.getElementById('save-status').textContent.includes('Could not save')");
  assert.equal(await run(`document.querySelector('input[data-start="48"]').checked`), true);
  await run(`Storage.prototype.setItem = Storage.prototype.originalSetItem; document.querySelector('input[data-start="48"]').click()`);
  await wait(`!${saved}['embedded-linux:48-85'] && !document.querySelector('input[data-start="48"]').disabled`);
  assert.equal(await run("document.getElementById('save-status').textContent"), '');
  await run(`document.querySelector('input[data-start="48"]').click()`);
  await wait(`${saved}['embedded-linux:48-85'] === true && !document.querySelector('input[data-start="48"]').disabled`);
  await run(`Object.defineProperty(navigator, 'locks', { value: undefined, configurable: true }); document.querySelector('input[data-start="48"]').click()`);
  await wait("document.getElementById('save-status').textContent.includes('Web Locks')");
  assert.equal(await run(`document.querySelector('input[data-start="48"]').checked`), true);
  await run('delete navigator.locks');
  for (const [width, height] of [[390, 844], [320, 568]]) {
    await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    assert.equal(await run('document.documentElement.scrollWidth <= innerWidth'), true);
    assert.equal(await run('document.documentElement.scrollHeight <= innerHeight'), true);
    assert.equal(await run("document.querySelector('.section-navigation').getBoundingClientRect().bottom <= innerHeight"), true);
  }
  await run("location.hash = '#slide/embedded-linux/388'");
  await wait("document.querySelector('h1')?.textContent === 'Cross-compiling user-space libraries and applications'");
  assert.deepEqual(await run("(() => { const title = document.querySelector('h1'); const original = title.textContent; const failures = []; for (const deck of decks) for (const section of deck.sections) { title.textContent = section.title; if (document.documentElement.scrollHeight > innerHeight || document.querySelector('.slide-viewer').getBoundingClientRect().height <= 80) failures.push(section.title); } title.textContent = original; return failures; })()"), []);
  await run("document.getElementById('save-status').textContent = 'Could not save progress. Check browser storage permissions and saved data.'");
  assert.equal(await run('document.documentElement.scrollHeight <= innerHeight'), true);
  await call('Emulation.setDeviceMetricsOverride', { width: 320, height: 500, deviceScaleFactor: 1, mobile: false });
  assert.equal(await run('document.documentElement.scrollHeight > innerHeight'), true);
  await run('window.scrollTo(0, document.documentElement.scrollHeight)');
  assert.equal(await run("document.querySelector('.section-navigation').getBoundingClientRect().bottom <= innerHeight"), true);
  // Old chapter links now open the reading chunk containing their original slide.
  await run("location.hash = '#slide/embedded-linux/18'");
  await wait("document.querySelector('.slide-viewer')?.getAttribute('src') === '/materials/bootlin/sections/embedded-linux/1-47.pdf'");
  await run("updateProgress('embedded-linux:48-85', false)");
  assert.equal(await run(`document.querySelector('input[data-start="1"]').checked`), false);
  await run("Storage.prototype.originalSetItem = Storage.prototype.setItem; Storage.prototype.setItem = () => { throw new Error('blocked'); }; document.querySelector('[data-next-section]').click()");
  await wait("document.getElementById('save-status').textContent.includes('Could not save')");
  assert.equal(await run('location.hash'), '#slide/embedded-linux/18');
  assert.equal(await run(`${saved}['embedded-linux:1-47'] === true`), false);
  await call('Page.bringToFront');
  await run("Storage.prototype.setItem = Storage.prototype.originalSetItem; document.querySelector('[data-next-section]').focus()");
  await enter();
  await wait(`location.hash === '#slide/embedded-linux/48' && !!document.querySelector('input[data-start="48"]')`);
  assert.equal(await run(`${saved}['embedded-linux:1-47']`), true);
  assert.equal(await run(`document.querySelector('input[data-start="48"]').checked`), false);
  await run("document.querySelector('.section-navigation a').click()");
  await wait(`location.hash === '#slide/embedded-linux/1' && !!document.querySelector('input[data-start="1"]')`);
  assert.equal(await run(`document.querySelector('input[data-start="1"]').checked`), true);
  await call('Page.reload');
  await wait(`!!document.querySelector('input[data-start="1"]')`);
  assert.equal(await run(`document.querySelector('input[data-start="1"]').checked`), true);
  await run(`navigator.locks.request('${storageKey}', () => new Promise(resolve => { window.releaseTestLock = resolve; })); 'queued'`);
  await wait("typeof window.releaseTestLock === 'function'");
  await run("document.querySelector('[data-next-section]').click(); location.hash = '#home'");
  await wait("document.querySelector('h1')?.textContent === 'Welcome to YOYEE.'");
  await run('window.releaseTestLock()');
  await run(`navigator.locks.request('${storageKey}', () => true)`);
  assert.equal(await run('location.hash'), '#home');
  const progressBeforeLabs = await run(`localStorage.getItem('${storageKey}')`);
  await run("document.getElementById('nav-labs').click()");
  await wait("document.querySelector('h1')?.textContent === 'Practical labs'");
  assert.equal(await run("document.querySelectorAll('.course-card').length"), 4);
  assert.match(await run('document.body.textContent'), /not BeagleBone Black/);
  for (const lab of labs) {
    await run(`document.querySelector('a[href="#lab/${lab.id}"]').click()`);
    await wait(`document.querySelector('.slide-viewer')?.getAttribute('src') === '/materials/bootlin/${lab.file}'`);
    assert.equal(await run("!!document.querySelector('#nav-labs.active')"), true);
    assert.equal(await run("document.querySelector('.course-nav .active')"), null);
    assert.match(await run("document.querySelector('.subtitle').textContent"), new RegExp(lab.board));
    assert.equal(await run("document.querySelector('input[data-deck]')"), null);
    assert.equal(await run("document.querySelector('.subtitle a').href"), lab.source);
    if (lab.notice) assert.match(await run('document.body.textContent'), /not BeagleBone Black/);
    await run(`document.querySelector('a[href="#labs"]').click()`);
    await wait("document.querySelector('h1')?.textContent === 'Practical labs'");
  }
  await run("location.hash = '#lab/debugging'");
  await wait("!!document.querySelector('.slide-viewer')");
  await call('Page.reload');
  await wait("document.querySelector('.slide-viewer')?.getAttribute('src') === '/materials/bootlin/debugging-beagleplay-labs.pdf'");
  await call('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await checkFullscreen(true);
  for (const [width, height] of [[390, 844], [320, 568]]) {
    await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    assert.equal(await run('document.documentElement.scrollWidth <= innerWidth'), true);
    assert.equal(await run('document.documentElement.scrollHeight <= innerHeight'), true);
    assert.equal(await run("document.querySelector('.slide-viewer').getBoundingClientRect().height > 80"), true);
    assert.equal(await run("document.querySelector('[data-fullscreen]').getBoundingClientRect().bottom <= document.querySelector('.slide-viewer').getBoundingClientRect().bottom"), true);
    assert.equal(await run("document.querySelector('[data-fullscreen]').getBoundingClientRect().top >= document.querySelector('.slide-viewer').getBoundingClientRect().top"), true);
  }
  assert.equal(await run(`localStorage.getItem('${storageKey}')`), progressBeforeLabs);
  await run("Object.defineProperty(document, 'fullscreenEnabled', { value: false, configurable: true }); location.hash = '#lab/yocto'");
  await wait("document.querySelector('[data-fullscreen]')?.disabled");
  assert.match(await run("document.getElementById('fullscreen-status').textContent"), /not supported/);
  await run("delete document.fullscreenEnabled; location.hash = '#lab/missing'");
  await wait("document.getElementById('app').textContent.includes('Section not found')");
  assert.equal(await run("document.querySelector('.layout').classList.contains('slide-layout')"), false);
  await run("window.other = document.createElement('iframe'); other.hidden = true; other.src = '#course/embedded-linux'; document.body.append(other)");
  await wait(`!!other.contentDocument?.querySelector('input[data-start="125"]')`);
  await run("location.hash = '#settings'");
  await wait("!!document.getElementById('reset-confirm')");
  assert.doesNotMatch(await run('document.body.textContent'), /workspace/i);
  assert.equal(await run("document.getElementById('app').classList.contains('slide-content')"), false);
  assert.equal(await run("document.querySelector('.layout').classList.contains('slide-layout')"), false);
  assert.equal(await run("document.querySelector('#reset-form button').disabled"), true);
  await run("document.getElementById('reset-confirm').value = 'RESET'; document.getElementById('reset-confirm').dispatchEvent(new Event('input')); document.getElementById('reset-form').requestSubmit()");
  await wait(`localStorage.getItem('${storageKey}') === '{}'`);
  assert.equal(await run("localStorage.getItem('unrelated')"), 'keep');
  assert.equal(await run("localStorage.getItem('ldd-slide-progress-v1')"), legacy);
  await wait(`!other.contentDocument.querySelector('input[data-start="86"]').checked && !other.contentDocument.querySelector('input[data-start="125"]').checked`);
  await run(`other.contentDocument.querySelector('input[data-start="125"]').click()`);
  await wait(`${saved}['embedded-linux:125-142'] === true`);
  assert.deepEqual(await run(saved), { 'embedded-linux:125-142': true });
});
