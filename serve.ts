// Dusthaven — serve.ts
// A tiny static file server for local play-testing: serves game/ at
// http://localhost:8080 (or $PORT). Node standard library only.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, normalize, resolve } from 'node:path';

const PORT = Number(process.env.PORT || 8080);
const ROOT = resolve(new URL('.', import.meta.url).pathname, 'game');

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

const server = createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const file = normalize(join(ROOT, rel));
  if (!file.startsWith(ROOT) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found\n');
    return;
  }
  const ext = file.slice(file.lastIndexOf('.'));
  res.writeHead(200, { 'content-type': TYPES[ext] || 'application/octet-stream' });
  createReadStream(file).pipe(res);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('Dusthaven serving game/ at http://localhost:' + PORT);
});
