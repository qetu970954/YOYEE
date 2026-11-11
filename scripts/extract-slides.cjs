'use strict';

// Extract source chapters and apply reviewed reading boundaries without changing PDF pages.
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const plans = require('./reading-plan.json');

const root = path.join(__dirname, '..');
const decks = [
  { id: 'embedded-linux', title: 'Embedded Linux system development', pages: 552, sha256: '7603ee5367055e071fd6ae23285dcc638447864f6f282435201b86d7e130d587' },
  { id: 'linux-kernel', title: 'Linux kernel driver development', pages: 446, sha256: 'd1341fbebe4246bf121d6c3f4b660cc26ace68c1767d7b3eea768949b5dc9a0b' },
  { id: 'yocto', title: 'Yocto Project and OpenEmbedded', pages: 335, sha256: 'd052abfdecf8bbc4c0d8c3be64d27fefab8fb274ed26d036d6e50805e5b711d2' },
  { id: 'debugging', title: 'Linux debugging, tracing, profiling and performance', pages: 346, sha256: '21ec3897920edf0f1538e75299e85804279c540454833f3c749f9932164ac6af' }
];

function wordCount(text) {
  return text.split(/\r?\n/).filter(line =>
    !line.includes('- Kernel, drivers and embedded Linux -') &&
    !/^\s*embedded Linux and kernel engineering\s*$/i.test(line)
  ).join(' ').split(/\s+/).filter(word => /[\p{L}\p{N}]/u.test(word)).length;
}
function heading(page) { return page.split(/\r?\n/).find(line => line.trim())?.trim() || ''; }
function buildSections(pages, plan) {
  if (!Array.isArray(plan) || !plan.length || plan[0].start !== 1) throw new Error('Reading plan must begin on slide 1');
  return plan.map((chunk, i) => {
    const { title, start, reviewMinutes, review, anchor, exception } = chunk;
    const end = (plan[i + 1]?.start ?? pages.length + 1) - 1;
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start || end > pages.length) throw new Error(`Invalid chunk range: ${start}-${end}`);
    if (!title?.trim() || !anchor?.trim() || !review?.trim() || !Number.isFinite(reviewMinutes) || reviewMinutes < 0) throw new Error(`Missing content review: slide ${start}`);
    if (!pages[start - 1].replace(/\s+/g, ' ').includes(anchor)) throw new Error(`Review anchor differs on slide ${start}: ${anchor}`);
    const first = heading(pages[start - 1]);
    const numbered = first.match(/\(?([0-9]+)\/[0-9]+\)?\s*$/);
    if (start > 1 && ((numbered && Number(numbered[1]) > 1) || first === heading(pages[start - 2]))) throw new Error(`Chunk starts inside a continuing example: slide ${start}`);
    const readingMinutes = Math.max(1, Math.round(wordCount(pages.slice(start - 1, end).join('\n')) / 180 + reviewMinutes));
    if ((readingMinutes < 20 || readingMinutes > 30) && !exception?.trim()) throw new Error(`Explain timing exception: ${title}, ${readingMinutes} minutes`);
    return { title, start, end, readingMinutes, ...(exception ? { timingNote: exception } : {}) };
  });
}
function main() {
  for (const deck of decks) {
    const file = path.join(root, 'materials', 'bootlin', deck.id + '-slides.pdf');
    const hash = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    if (hash !== deck.sha256) throw new Error(`${file}: PDF differs from the pinned snapshot; review its version and section boundaries first`);
    const text = execFileSync('pdftotext', ['-layout', file, '-'], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
    const pages = text.split('\f');
    if (!pages.at(-1).trim()) pages.pop();
    if (pages.length !== deck.pages) throw new Error(`${deck.id}: expected ${deck.pages} pages, got ${pages.length}`);
    const chapters = [];
    pages.forEach((page, index) => {
      if (!page.includes('Copyright 2004-2026, Bootlin') || !page.includes('Creative Commons BY-SA 3.0')) return;
      const firstLine = heading(page);
      const title = index === 0 ? 'Course introduction and information' : firstLine.split(/Embedded Linux and kernel engineering/i)[0].trim();
      if (!title) throw new Error(`${deck.id}: missing chapter title on page ${index + 1}`);
      chapters.push({ title, start: index + 1 });
    });
    if (chapters.length < 3 || chapters[0].start !== 1) throw new Error(`${deck.id}: chapter extraction failed`);
    deck.chapters = chapters.map((chapter, i) => ({ ...chapter, end: (chapters[i + 1]?.start || deck.pages + 1) - 1 }));
    deck.sections = buildSections(pages, plans[deck.id]);
  }
  const output = JSON.stringify({ decks }, null, 2) + '\n';
  if (process.argv.includes('--check')) {
    if (fs.readFileSync(path.join(root, 'slides.json'), 'utf8') !== output) throw new Error('slides.json is out of date; regenerate the index and section PDFs');
  } else fs.writeFileSync(path.join(root, 'slides.json'), output);
  console.log(decks.map(d => `${d.title}: ${d.pages} slides, ${d.sections.length} reading chunks`).join('\n'));
}
if (require.main === module) main();
module.exports = { buildSections, wordCount };
