'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { decks } = require('./slides.json');

const files = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/slides.json': ['slides.json', 'application/json; charset=utf-8'],
  ...Object.fromEntries(decks.flatMap(deck => deck.sections.map(section => {
    const file = `materials/bootlin/sections/${deck.id}/${section.start}-${section.end}.pdf`;
    return [`/${file}`, [file, 'application/pdf']];
  })))
};
function createServer() {
  return http.createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }); return res.end(); }
    const file = files[new URL(req.url, 'http://localhost').pathname];
    if (!file) { res.writeHead(404); return res.end('Not found'); }
    const filename = path.join(__dirname, file[0]);
    fs.stat(filename, (err, stat) => {
      if (err || !stat.isFile()) { res.writeHead(404); return res.end('File not found'); }
      res.writeHead(200, { 'Content-Type': file[1], 'Content-Length': stat.size, 'X-Content-Type-Options': 'nosniff' });
      if (req.method === 'HEAD') return res.end();
      const stream = fs.createReadStream(filename);
      stream.on('error', () => res.destroy());
      stream.pipe(res);
    });
  });
}
if (require.main === module) createServer().listen(3000, '127.0.0.1', () => console.log('Open http://localhost:3000'));
module.exports = { createServer };
