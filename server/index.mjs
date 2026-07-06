/**
 * NUC food-diary server (zero dependencies — Node built-ins only).
 *
 * Serves two things over one origin:
 *   1. GET /api/food-diary  -> live JSON parsed from the Obsidian vault
 *   2. the built SPA (dist/spa) as static files, with history-mode fallback
 *
 * Front it with `tailscale serve` for HTTPS on your tailnet so phone + laptop
 * can reach it privately. Access control is the tailnet itself.
 *
 * Env vars:
 *   VAULT_DIR  (required)  absolute path to the "Food Diary" folder
 *   PORT       (default 8080)
 *   SPA_DIR    (default ../dist/spa relative to this file)
 *   CACHE_MS   (default 2000) how long to reuse a parse result
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, normalize, extname, dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFoodDiary } from './foodDiaryParser.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT ?? 8080);
const VAULT_DIR = process.env.VAULT_DIR;
const SPA_DIR = resolve(process.env.SPA_DIR ?? join(HERE, '..', 'dist', 'spa'));
const CACHE_MS = Number(process.env.CACHE_MS ?? 2000);

if (!VAULT_DIR) {
  console.error('VAULT_DIR is required (absolute path to the "Food Diary" folder).');
  process.exit(1);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

// Small cache so rapid polls don't re-read the vault each time.
let cache = { at: 0, body: null };

function foodDiaryJson() {
  const now = Date.now();
  if (cache.body && now - cache.at < CACHE_MS) return cache.body;
  const { days, prices, warnings } = parseFoodDiary(VAULT_DIR);
  const body = JSON.stringify({ days, prices, warnings });
  cache = { at: now, body };
  return body;
}

async function serveStatic(req, res) {
  // Map URL path to a file inside SPA_DIR; fall back to index.html (history mode).
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  let filePath = normalize(join(SPA_DIR, urlPath));

  // Path-traversal guard: resolved path must stay within SPA_DIR.
  if (filePath !== SPA_DIR && !filePath.startsWith(SPA_DIR + sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  try {
    const info = await stat(filePath);
    if (info.isDirectory()) filePath = join(filePath, 'index.html');
  } catch {
    filePath = join(SPA_DIR, 'index.html'); // SPA route -> index.html
  }

  try {
    const data = await readFile(filePath);
    const type = MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
    res.writeHead(200, { 'content-type': type }).end(data);
  } catch {
    res.writeHead(404).end('Not found');
  }
}

const server = createServer(async (req, res) => {
  try {
    const path = (req.url || '/').split('?')[0];
    if (path === '/api/food-diary') {
      if (req.method !== 'GET') {
        res.writeHead(405, { allow: 'GET' }).end('Method not allowed');
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' }).end(foodDiaryJson());
      return;
    }
    await serveStatic(req, res);
  } catch (err) {
    console.error(err);
    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' }).end(
      JSON.stringify({ error: String(err && err.message ? err.message : err) }),
    );
  }
});

server.listen(PORT, () => {
  console.log(`Food diary server on http://0.0.0.0:${PORT}`);
  console.log(`  vault : ${VAULT_DIR}`);
  console.log(`  spa   : ${SPA_DIR}`);
});
