// serve.ts — tiny static server for Porto Verde (Node 22 stdlib only).
// Serves game/ at http://localhost:8080 so the game can be played in a browser.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const ROOT = join(new URL('.', import.meta.url).pathname, 'game');
const PORT = 8080;
const TYPES: Record<string, string> = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
};

createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url?.split('?')[0] || '/');
  const path = normalize(join(ROOT, urlPath === '/' ? 'index.html' : urlPath));
  if (!path.startsWith(ROOT) || !existsSync(path) || !statSync(path).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' });
  createReadStream(path).pipe(res);
}).listen(PORT, () => console.log('Porto Verde at http://localhost:' + PORT));
