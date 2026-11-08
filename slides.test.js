'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { createServer } = require('./server');
const { decks } = require('./slides.json');

test('the four pinned PDFs have complete contiguous chapter ranges', () => {
  assert.deepEqual(decks.map(deck => deck.id), ['embedded-linux', 'linux-kernel', 'yocto', 'debugging']);
  for (const deck of decks) {
    const pdf = fs.readFileSync(path.join(__dirname, 'materials', 'bootlin', `${deck.id}-slides.pdf`));
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    assert.equal(createHash('sha256').update(pdf).digest('hex'), deck.sha256);
    let page = 1;
    for (const section of deck.sections) {
      assert.ok(section.title.trim());
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
  assert.equal((await fetch(`${base}/materials/bootlin/sections/embedded-linux/1-999.pdf`)).status, 404);
  assert.equal((await fetch(`${base}/materials/bootlin/embedded-linux-slides.pdf`)).status, 404);
  assert.equal((await fetch(`${base}/README.md`)).status, 404);
  assert.equal((await fetch(`${base}/slides.json`, { method: 'POST' })).status, 405);
});
