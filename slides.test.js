'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { createServer } = require('./server');
const { decks } = require('./slides.json');
const { labs } = require('./labs.json');
const { spawnSync } = require('node:child_process');
const { buildSections, wordCount } = require('./scripts/extract-slides.cjs');

test('the four pinned PDFs have complete contiguous reading chunks and source chapters', () => {
  assert.deepEqual(decks.map(deck => deck.id), ['embedded-linux', 'linux-kernel', 'yocto', 'debugging']);
  for (const deck of decks) {
    const pdf = fs.readFileSync(path.join(__dirname, 'materials', 'bootlin', `${deck.id}-slides.pdf`));
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    assert.equal(createHash('sha256').update(pdf).digest('hex'), deck.sha256);
    let chapterPage = 1;
    for (const chapter of deck.chapters) {
      assert.equal(chapter.start, chapterPage);
      assert.ok(chapter.end >= chapter.start);
      chapterPage = chapter.end + 1;
    }
    assert.equal(chapterPage, deck.pages + 1);
    assert.deepEqual(fs.readdirSync(path.join(__dirname, 'materials', 'bootlin', 'sections', deck.id)).filter(name => /^\d+-\d+\.pdf$/.test(name)).sort(), deck.sections.map(section => `${section.start}-${section.end}.pdf`).sort());
    let page = 1;
    for (const section of deck.sections) {
      assert.ok(section.title.trim());
      assert.ok(Number.isInteger(section.readingMinutes) && section.readingMinutes > 0);
      if (section.readingMinutes < 20 || section.readingMinutes > 30) assert.ok(section.timingNote?.trim(), 'timing exceptions must have a reason');
      assert.equal(section.start, page);
      assert.ok(section.end >= section.start && section.end <= deck.pages);
      const split = fs.readFileSync(path.join(__dirname, 'materials', 'bootlin', 'sections', deck.id, `${section.start}-${section.end}.pdf`));
      assert.equal(split.subarray(0, 5).toString(), '%PDF-');
      assert.equal((split.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length, section.end - section.start + 1);
      page = section.end + 1;
    }
    assert.equal(page, deck.pages + 1);
  }
});

test('reading estimates use content and reviewed interpretation time; unsafe boundaries are rejected', () => {
  assert.equal(wordCount('Read this diagram\n- Kernel, drivers and embedded Linux - footer\nEmbedded Linux and kernel engineering\n‣'), 3);
  const pages = ['First topic\n' + 'word '.repeat(180), 'Example 1/2\ncode', 'Example 2/2\nexplanation', 'Next topic\nsummary'];
  const first = { start: 1, title: 'First topic', anchor: 'First topic', reviewMinutes: 20, review: 'Keep the entire example together' };
  const next = { start: 4, title: 'Next topic', anchor: 'Next topic', reviewMinutes: 21, review: 'Read the diagram and summary' };
  const chunks = buildSections(pages, [first, next]);
  assert.deepEqual(chunks.map(chunk => [chunk.start, chunk.end]), [[1, 3], [4, 4]]);
  assert.equal(chunks[0].readingMinutes, 21);
  assert.equal(buildSections(pages, [{ ...first, reviewMinutes: 26 }])[0].readingMinutes, 27);
  assert.throws(() => buildSections(pages, [{ ...first, start: 2 }]), /begin on slide 1/);
  assert.throws(() => buildSections(pages, [first, { ...next, start: 3, anchor: 'Example 2/2' }]), /continuing example/);
  assert.throws(() => buildSections(pages, [first, { ...next, start: 8 }]), /Invalid chunk range/);
  assert.throws(() => buildSections(pages, [{ ...first, anchor: 'Wrong source text' }]), /anchor differs/);
  assert.throws(() => buildSections(pages, [{ ...first, reviewMinutes: 0 }]), /timing exception/);
  assert.throws(() => buildSections(pages, [{ ...first, reviewMinutes: -1 }]), /Missing content review/);
});

test('the generated index is reproducible from the pinned PDFs and reading plan', { skip: !!spawnSync('pdftotext', ['-v']).error }, () => {
  const result = spawnSync(process.execPath, ['scripts/extract-slides.cjs', '--check'], { cwd: __dirname, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});

test('each course has an original pinned lab manual with its board variant identified', () => {
  assert.deepEqual(labs.map(lab => lab.id), decks.map(deck => deck.id));
  assert.deepEqual(labs.map(lab => lab.pages), [71, 55, 28, 34]);
  for (const lab of labs) {
    assert.equal(lab.board, lab.id === 'debugging' ? 'BeaglePlay' : 'BeagleBone Black');
    assert.equal(new URL(lab.source).origin, 'https://bootlin.com');
    assert.equal(lab.source.split('/').at(-1), lab.file);
    const pdf = fs.readFileSync(path.join(__dirname, 'materials', 'bootlin', lab.file));
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    assert.equal(createHash('sha256').update(pdf).digest('hex'), lab.sha256);
  }
  assert.match(labs.find(lab => lab.id === 'debugging').notice, /not BeagleBone Black/);
});

test('server serves the index and each PDF without exposing arbitrary files', async t => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const index = await fetch(`${base}/slides.json`);
  assert.equal(index.status, 200);
  assert.equal((await index.json()).decks.length, 4);
  for (const deck of decks) {
    for (const section of deck.sections) {
      const name = `${section.start}-${section.end}.pdf`;
      const url = `${base}/materials/bootlin/sections/${deck.id}/${name}`;
      const response = await fetch(url, { method: 'HEAD' });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('content-type'), 'application/pdf');
      assert.equal(Number(response.headers.get('content-length')), fs.statSync(path.join(__dirname, 'materials', 'bootlin', 'sections', deck.id, name)).size);
    }
    const section = deck.sections[0];
    const url = `${base}/materials/bootlin/sections/${deck.id}/${section.start}-${section.end}.pdf`;
    const downloaded = await fetch(url);
    assert.equal(downloaded.status, 200);
    const expected = fs.readFileSync(path.join(__dirname, 'materials', 'bootlin', 'sections', deck.id, `${section.start}-${section.end}.pdf`));
    assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), expected);
  }
  const manuals = await fetch(`${base}/labs.json`);
  assert.equal(manuals.status, 200);
  assert.deepEqual((await manuals.json()).labs, labs);
  for (const lab of labs) {
    const url = `${base}/materials/bootlin/${lab.file}`;
    const expected = fs.readFileSync(path.join(__dirname, 'materials', 'bootlin', lab.file));
    const head = await fetch(url, { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(head.headers.get('content-type'), 'application/pdf');
    assert.equal(Number(head.headers.get('content-length')), expected.length);
    const response = await fetch(url);
    assert.equal(response.status, 200);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), expected);
  }
  assert.equal((await fetch(`${base}/materials/bootlin/debugging-bbb-labs.pdf`)).status, 404);
  assert.equal((await fetch(`${base}/materials/bootlin/sections/embedded-linux/1-999.pdf`)).status, 404);
  assert.equal((await fetch(`${base}/materials/bootlin/embedded-linux-slides.pdf`)).status, 404);
  assert.equal((await fetch(`${base}/README.md`)).status, 404);
  assert.equal((await fetch(`${base}/slides.json`, { method: 'POST' })).status, 405);
});
