'use strict';

// Extract chapter boundaries while keeping the original PDF pages intact.
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const decks = [
  { id: 'embedded-linux', title: 'Embedded Linux system development', pages: 552, sha256: '7603ee5367055e071fd6ae23285dcc638447864f6f282435201b86d7e130d587' },
  { id: 'linux-kernel', title: 'Linux kernel driver development', pages: 446, sha256: 'd1341fbebe4246bf121d6c3f4b660cc26ace68c1767d7b3eea768949b5dc9a0b' },
  { id: 'yocto', title: 'Yocto Project and OpenEmbedded', pages: 335, sha256: 'd052abfdecf8bbc4c0d8c3be64d27fefab8fb274ed26d036d6e50805e5b711d2' },
  { id: 'debugging', title: 'Linux debugging, tracing, profiling and performance', pages: 346, sha256: '21ec3897920edf0f1538e75299e85804279c540454833f3c749f9932164ac6af' }
];

for (const deck of decks) {
  const file = path.join(root, 'materials', 'bootlin', deck.id + '-slides.pdf');
  const hash = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  if (hash !== deck.sha256) throw new Error(`${file}: PDF differs from the pinned snapshot; review its version and section boundaries first`);
  const text = execFileSync('pdftotext', ['-layout', file, '-'], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  const pages = text.split('\f');
  if (!pages.at(-1).trim()) pages.pop();
  if (pages.length !== deck.pages) throw new Error(`${deck.id}: expected ${deck.pages} pages, got ${pages.length}`);
  const sections = [];
  pages.forEach((page, index) => {
    if (!page.includes('Copyright 2004-2026, Bootlin') || !page.includes('Creative Commons BY-SA 3.0')) return;
    const firstLine = page.split(/\r?\n/).find(line => line.trim());
    const title = index === 0 ? 'Course introduction and information' : firstLine.split(/Embedded Linux and kernel engineering/i)[0].trim();
    if (!title) throw new Error(`${deck.id}: missing section title on page ${index + 1}`);
    sections.push({ title, start: index + 1 });
  });
  if (sections.length < 3 || sections[0].start !== 1) throw new Error(`${deck.id}: section extraction failed`);
  deck.sections = sections.map((section, i) => ({ ...section, end: (sections[i + 1]?.start || deck.pages + 1) - 1 }));
}
fs.writeFileSync(path.join(root, 'slides.json'), JSON.stringify({ decks }, null, 2) + '\n');
console.log(decks.map(d => `${d.title}: ${d.pages} pages, ${d.sections.length} sections`).join('\n'));
