'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { decks } = require('./slides.json');

function progressApp(entries = {}) {
  const data = new Map(Object.entries(entries));
  const context = vm.createContext({
    document: { getElementById: () => ({}) },
    window: { addEventListener() {} },
    localStorage: {
      getItem: key => data.get(key) ?? null,
      setItem: (key, value) => data.set(key, value)
    },
    navigator: { locks: { request: async (_key, callback) => callback() } },
    fetch: () => new Promise(() => {})
  });
  vm.runInContext(fs.readFileSync(require.resolve('./app.js'), 'utf8'), context);
  vm.runInContext(`decks = ${JSON.stringify(decks)}`, context);
  return { data, run: expression => vm.runInContext(expression, context) };
}
const legacyKey = 'ldd-slide-progress-v1';
const currentKey = 'ldd-reading-progress-v2';
const plain = value => JSON.parse(JSON.stringify(value));

test('old progress credits full split/merged/unchanged ranges, never partially read chunks', () => {
  const old = JSON.stringify({
    'embedded-linux:1': true, 'embedded-linux:3': true, 'embedded-linux:9': true,
    'embedded-linux:18': true, 'embedded-linux:41': true,
    'embedded-linux:48': true, 'embedded-linux:86': true,
    'embedded-linux:218': true, 'embedded-linux:257': true,
    'linux-kernel:49': true, 'yocto:90': 'not a completion mark', 'unknown:1': true
  });
  const { data, run } = progressApp({ [legacyKey]: old, unrelated: 'keep' });
  assert.deepEqual(plain(run('readProgress()')), {
    'embedded-linux:1-47': true,
    'embedded-linux:48-85': true,
    'embedded-linux:86-124': true,
    'embedded-linux:125-142': true,
    'embedded-linux:143-166': true,
    'embedded-linux:257-294': true,
    'embedded-linux:295-321': true,
    'embedded-linux:322-343': true,
    'linux-kernel:49-91': true
  });
  assert.equal(data.get(legacyKey), old);
  assert.equal(data.has(currentKey), false, 'reading/migration does not write browser data');
  assert.equal(data.get('unrelated'), 'keep');
  const missing = JSON.parse(old);
  delete missing['embedded-linux:3'];
  data.set(legacyKey, JSON.stringify(missing));
  assert.equal(run("readProgress()['embedded-linux:1-47']"), undefined, 'a shared start page is not enough');
});

test('first save persists imported marks, manual uncompletion persists, reset retains legacy backup', async () => {
  const old = JSON.stringify({ 'embedded-linux:86': true });
  const { data, run } = progressApp({ [legacyKey]: old, unrelated: 'keep' });
  await run("updateProgress('embedded-linux:48-85', true)");
  assert.deepEqual(JSON.parse(data.get(currentKey)), {
    'embedded-linux:86-124': true, 'embedded-linux:125-142': true,
    'embedded-linux:143-166': true, 'embedded-linux:48-85': true
  });
  await run("updateProgress('embedded-linux:125-142', false)");
  assert.equal(run("readProgress()['embedded-linux:125-142']"), undefined);
  await run('updateProgress(null)');
  assert.equal(data.get(currentKey), '{}');
  assert.deepEqual(plain(run('readProgress()')), {}, 'reset must not import old marks again');
  assert.equal(data.get(legacyKey), old);
  assert.equal(data.get('unrelated'), 'keep');
});

test('invalid progress is reported without overwriting either version', async () => {
  for (const raw of ['broken JSON', 'null', '[]', 'true']) {
    const { data, run } = progressApp({ [legacyKey]: raw });
    assert.throws(() => run('readProgress()'));
    await assert.rejects(run("updateProgress('embedded-linux:48-85', true)"));
    assert.equal(data.get(legacyKey), raw);
    assert.equal(data.has(currentKey), false);
  }
  const { data, run } = progressApp({ [legacyKey]: '{bad', [currentKey]: '{}' });
  assert.deepEqual(plain(run('readProgress()')), {}, 'a valid current record does not depend on the backup');
  data.set(currentKey, '[]');
  await assert.rejects(run("updateProgress('embedded-linux:48-85', true)"));
  assert.equal(data.get(currentKey), '[]');
});
