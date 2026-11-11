'use strict';

const app = document.getElementById('app');
const storageKey = 'ldd-reading-progress-v2';
const legacyStorageKey = 'ldd-slide-progress-v1';
let decks = [];
let labs = [];
let completed = {};
let storageError = false;
function parseProgress(raw) {
  const saved = JSON.parse(raw ?? '{}');
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) throw new Error('Invalid saved progress');
  return saved;
}
// shortcut: v2 stores this plan's ranges; remap saved ranges before another rebalance.
function readProgress() {
  const current = localStorage.getItem(storageKey);
  if (current !== null) return parseProgress(current);
  const legacy = parseProgress(localStorage.getItem(legacyStorageKey));
  return Object.fromEntries(decks.flatMap(deck => deck.sections.filter(section =>
    deck.chapters.filter(chapter => chapter.start <= section.end && chapter.end >= section.start)
      .every(chapter => legacy[`${deck.id}:${chapter.start}`] === true)
  ).map(section => [sectionKey(deck, section), true])));
}
async function updateProgress(key, checked) {
  if (!navigator.locks) throw new Error('Progress requires a browser with Web Locks support.');
  await navigator.locks.request(storageKey, () => {
    if (key === null) {
      // Keep an empty v2 record so reset does not re-import the untouched legacy backup.
      localStorage.setItem(storageKey, '{}');
      completed = {};
    } else {
      const current = readProgress();
      if (checked) current[key] = true; else delete current[key];
      localStorage.setItem(storageKey, JSON.stringify(current));
      completed = current;
    }
    storageError = false;
  });
}
function progressError(error) {
  return !navigator.locks ? error.message : 'Could not save progress. Check browser storage permissions and saved data.';
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
function sectionKey(deck, section) { return `${deck.id}:${section.start}-${section.end}`; }
function completeCount(deck) { return deck.sections.filter(section => completed[sectionKey(deck, section)] === true).length; }
function sectionUrl(deck, section) { return `#slide/${deck.id}/${section.start}`; }
function pdfUrl(deck, section) { return `/materials/bootlin/sections/${deck.id}/${section.start}-${section.end}.pdf`; }
function courseCards() {
  return decks.map((deck, i) => {
    const count = completeCount(deck);
    return `<a class="course-card" href="#course/${deck.id}"><div class="course-number">${String(i + 1).padStart(2, '0')}</div><div class="course-copy"><h2>${escapeHTML(deck.title)}</h2><p>${deck.sections.length} sections · ${deck.pages} slides</p><div class="progress-bar"><span style="width:${count / deck.sections.length * 100}%"></span></div><small>${count} of ${deck.sections.length} sections complete</small></div><span class="course-arrow" aria-hidden="true">→</span></a>`;
  }).join('');
}
function courseList(home) {
  const total = decks.reduce((sum, deck) => sum + deck.sections.length, 0);
  const done = decks.reduce((sum, deck) => sum + completeCount(deck), 0);
  const nextDeck = decks.find(deck => completeCount(deck) < deck.sections.length) || decks[0];
  const next = nextDeck.sections.find(section => completed[sectionKey(nextDeck, section)] !== true) || nextDeck.sections[0];
  return `<div class="page-heading">${home ? '' : '<div class="eyebrow">YOUR COURSE</div>'}<h1>${home ? 'Welcome to YOYEE.' : 'Learning path'}</h1>${home ? '<p class="subtitle"><b>Y</b>our <b>O</b>wn <b>Y</b>octo &amp; <b>E</b>mbedded <b>E</b>ducation.</p><p class="subtitle">Embedded Linux · Kernel Drivers · Yocto · Debugging</p>' : ''}<p class="subtitle">Study the four Bootlin courses in order. Your progress stays in this browser.</p></div>${home ? `<section class="hero"><div><div class="eyebrow">YOUR NEXT SECTION</div><h2>${escapeHTML(next.title)}</h2><p>${escapeHTML(nextDeck.title)} · Est. ${next.readingMinutes} min reading</p><a class="button" href="${sectionUrl(nextDeck, next)}">Continue learning →</a></div><div class="hero-progress"><strong>${done} / ${total}</strong><span>sections completed</span></div></section>` : ''}<div class="section-heading"><h2>${home ? 'Your courses' : 'Courses'}</h2><p>${done} of ${total} sections complete</p></div><div class="course-list">${courseCards()}</div><p class="source-credit">Slides © Bootlin, available under <a href="https://creativecommons.org/licenses/by-sa/3.0/">CC BY-SA 3.0</a>. The original PDFs retain their individual credits and notices.</p>`;
}
function coursePage(deck) {
  return `<p><a class="text-link" href="#courses">← All courses</a></p><div class="page-heading"><div class="eyebrow">COURSE ${decks.indexOf(deck) + 1} OF ${decks.length}</div><h1>${escapeHTML(deck.title)}</h1><p class="subtitle">${completeCount(deck)} of ${deck.sections.length} sections complete · ${deck.pages} slides</p></div><div class="section-list">${deck.sections.map((section, i) => `<div class="section-row"><a class="section-link" href="${sectionUrl(deck, section)}"><span class="row-number">${String(i + 1).padStart(2, '0')}</span><span><strong>${escapeHTML(section.title)}</strong><small>Slides ${section.start}–${section.end} · Est. ${section.readingMinutes} min reading</small></span></a><label class="completion-toggle"><input type="checkbox" data-deck="${deck.id}" data-start="${section.start}" data-key="${sectionKey(deck, section)}" ${completed[sectionKey(deck, section)] === true ? 'checked' : ''} aria-label="Mark ${escapeHTML(section.title)} complete"> Complete</label></div>`).join('')}</div><p class="source-credit">Sections target about 25 minutes of reading and end at complete topics. Estimates include interpreting diagrams and code, not performing labs. Shorter wrap-ups and standalone topics are intentional. Completion is self-reported.</p>`;
}
function pdfViewer(url, title, hint) {
  return `<div class="pdf-viewer"><iframe class="slide-viewer" src="${url}" title="${escapeHTML(title)}"></iframe><button type="button" class="button secondary viewer-fullscreen" data-fullscreen title="View PDF full screen (Esc to exit)">Full screen</button></div><p class="viewer-hint">${escapeHTML(hint)} Esc exits full screen.</p><p id="fullscreen-status" class="warning" role="status"></p>`;
}
function labsPage() {
  return `<div class="page-heading"><h1>Practical labs</h1><p class="subtitle">Original Bootlin lab manuals, available offline.</p></div><p class="warning">These exercises have not been verified here. Before hardware work, verify board identity, voltage compatibility, storage targets and recovery.</p><div class="course-list">${labs.map((lab, i) => `<a class="course-card" href="#lab/${lab.id}"><div class="course-number">${String(i + 1).padStart(2, '0')}</div><div class="course-copy"><h2>${escapeHTML(decks.find(deck => deck.id === lab.id).title)}</h2><p>${escapeHTML(lab.board)} · ${lab.pages} pages</p>${lab.notice ? `<small>${escapeHTML(lab.notice)}</small>` : ''}</div><span class="course-arrow" aria-hidden="true">→</span></a>`).join('')}</div><p class="source-credit">Lab manuals © Bootlin, available under <a href="https://creativecommons.org/licenses/by-sa/3.0/">CC BY-SA 3.0</a>. The original PDFs retain their individual credits and notices. Reading a manual does not change slide progress.</p>`;
}
function labPage(deck, lab) {
  return `<p><a class="text-link" href="#labs">← All labs</a></p><div class="page-heading"><div class="eyebrow">PRACTICAL LABS</div><h1>${escapeHTML(deck.title)}</h1><p class="subtitle">${escapeHTML(lab.board)} · ${lab.pages} pages · <a class="text-link" href="${lab.source}">Bootlin source</a> · CC BY-SA 3.0</p>${lab.notice ? `<p class="warning">${escapeHTML(lab.notice)}</p>` : ''}</div>${pdfViewer(`/materials/bootlin/${lab.file}`, `${deck.title}: ${lab.board} lab manual`, 'Complete lab manual. No completion marks are recorded.')}`;
}
function slidePage(deck, section) {
  const index = deck.sections.indexOf(section);
  const previous = deck.sections[index - 1];
  const next = deck.sections[index + 1];
  return `<p><a class="text-link" href="#course/${deck.id}">← ${escapeHTML(deck.title)}</a></p><div class="page-heading"><div class="eyebrow">SECTION ${index + 1} OF ${deck.sections.length}</div><div class="slide-heading-line"><h1>${escapeHTML(section.title)}</h1><label class="completion-toggle"><input type="checkbox" data-deck="${deck.id}" data-start="${section.start}" data-key="${sectionKey(deck, section)}" ${completed[sectionKey(deck, section)] === true ? 'checked' : ''}> Mark section complete</label></div></div>${pdfViewer(pdfUrl(deck, section), `${deck.title}: ${section.title} slides`, `Slides ${section.start}–${section.end} · Est. ${section.readingMinutes} min reading. PDF pages start at 1.`)}<div class="section-navigation">${previous ? `<a class="button secondary" href="${sectionUrl(deck, previous)}">← Previous section</a>` : '<span></span>'}${next ? `<button type="button" class="button" data-next-section="${sectionUrl(deck, next)}">Next section →</button>` : `<a class="button" href="#courses">All courses →</a>`}</div>`;
}
function settingsPage() {
  return `<div class="page-heading"><h1>Settings</h1><p class="subtitle">Manage section progress stored in this browser.</p></div><section class="panel"><h2>Reset slide progress</h2><p>This clears active completion marks for all four courses in this browser. Original legacy progress is retained as a backup, but will not be reapplied after a reset. The PDFs are not changed.</p><form id="reset-form"><label for="reset-confirm">Type RESET to confirm</label><input id="reset-confirm" autocomplete="off" spellcheck="false"><button class="button danger" type="submit" disabled>Reset progress</button><p id="reset-status" role="status"></p></form></section>`;
}
function refreshProgressView() {
  if (!decks.length) return;
  const [page, id] = (location.hash.slice(1) || 'home').split('/');
  if (page === 'home' || page === 'courses') { render(); return; }
  app.querySelectorAll('input[data-deck]').forEach(input => {
    if (!input.disabled) input.checked = completed[input.dataset.key] === true;
  });
  const deck = page === 'course' && decks.find(item => item.id === id);
  if (deck) app.querySelector('.subtitle').textContent = `${completeCount(deck)} of ${deck.sections.length} sections complete · ${deck.pages} slides`;
}
function render() {
  if (!decks.length) return;
  const [page = 'home', id, start] = (location.hash.slice(1) || 'home').split('/');
  const deck = decks.find(item => item.id === id);
  const section = deck?.sections.find(item => /^\d+$/.test(start || '') && Number(start) >= item.start && Number(start) <= item.end);
  const lab = labs.find(item => item.id === id);
  const viewingPdf = (page === 'slide' && !!section) || (page === 'lab' && !!deck && !!lab);
  app.classList.toggle('slide-content', viewingPdf);
  document.querySelector('.layout').classList.toggle('slide-layout', viewingPdf);
  document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
  const nav = (page === 'course' || page === 'slide') && deck
    ? document.querySelector(`.course-nav [data-course="${deck.id}"]`)
    : document.getElementById('nav-' + (page === 'lab' ? 'labs' : page));
  if (nav) nav.classList.add('active');
  if (page === 'home' || page === 'courses') app.innerHTML = courseList(page === 'home');
  else if (page === 'course' && deck) app.innerHTML = coursePage(deck);
  else if (page === 'slide' && section) app.innerHTML = slidePage(deck, section);
  else if (page === 'labs') app.innerHTML = labsPage();
  else if (page === 'lab' && deck && lab) app.innerHTML = labPage(deck, lab);
  else if (page === 'settings') app.innerHTML = settingsPage();
  else app.innerHTML = '<div class="panel">Section not found. <a class="text-link" href="#courses">Go to the learning path →</a></div>';
  if (storageError) app.insertAdjacentHTML('afterbegin', '<p class="warning" role="alert">Browser storage is unavailable. Progress may not be saved.</p>');
  app.querySelectorAll('input[data-deck]').forEach(input => input.addEventListener('change', async () => {
    const key = input.dataset.key;
    const checked = input.checked;
    input.disabled = true;
    try {
      await updateProgress(key, checked);
      const message = document.getElementById('save-status');
      if (message) message.textContent = '';
    } catch (error) {
      const message = document.getElementById('save-status');
      if (message) message.textContent = progressError(error);
    } finally {
      input.disabled = false;
      refreshProgressView();
    }
  }));
  if (app.querySelector('input[data-deck]')) app.insertAdjacentHTML('beforeend', '<p id="save-status" class="warning" role="status"></p>');
  const fullscreenButton = app.querySelector('[data-fullscreen]');
  if (fullscreenButton) {
    const viewer = app.querySelector('.slide-viewer');
    const status = document.getElementById('fullscreen-status');
    fullscreenButton.disabled = !document.fullscreenEnabled || !viewer.requestFullscreen;
    if (fullscreenButton.disabled) status.textContent = 'Full screen is not supported in this browser.';
    fullscreenButton.addEventListener('click', async () => {
      status.textContent = '';
      try { await viewer.requestFullscreen(); }
      catch { status.textContent = 'Could not enter full screen. Try again or check browser permissions.'; }
    });
  }
  const nextButton = app.querySelector('[data-next-section]');
  if (nextButton) nextButton.addEventListener('click', async () => {
    const origin = location.hash;
    nextButton.disabled = true;
    try {
      await updateProgress(sectionKey(deck, section), true);
      if (nextButton.isConnected && location.hash === origin) location.hash = nextButton.dataset.nextSection;
    } catch (error) {
      if (nextButton.isConnected && location.hash === origin) document.getElementById('save-status').textContent = progressError(error);
    } finally { nextButton.disabled = false; }
  });
  if (page === 'settings') {
    const form = document.getElementById('reset-form');
    const input = document.getElementById('reset-confirm');
    const button = form.querySelector('button');
    input.addEventListener('input', () => { button.disabled = input.value !== 'RESET'; });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (input.value !== 'RESET' || button.disabled) return;
      button.disabled = true; input.disabled = true;
      try {
        await updateProgress(null);
        input.value = '';
        form.querySelector('#reset-status').textContent = 'Slide progress has been reset.';
        refreshProgressView();
      } catch (error) { form.querySelector('#reset-status').textContent = progressError(error); }
      finally { input.disabled = false; button.disabled = input.value !== 'RESET'; }
    });
  }
}
window.addEventListener('storage', event => {
  if (event.key !== storageKey && event.key !== legacyStorageKey && event.key !== null) return;
  try { completed = readProgress(); storageError = false; refreshProgressView(); }
  catch { storageError = true; }
});
window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
Promise.all(['/slides.json', '/labs.json'].map(url => fetch(url).then(response => {
  if (!response.ok) throw new Error('Could not load course materials');
  return response.json();
}))).then(([slides, manuals]) => {
  decks = slides.decks; labs = manuals.labs;
  try { completed = readProgress(); } catch { storageError = true; }
  render();
}).catch(() => { app.innerHTML = '<div class="panel" role="alert">Could not load the course materials. Start the site with npm start and try again.</div>'; });
