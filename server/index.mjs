/**
 * NUC server (zero dependencies — Node built-ins only).
 *
 * Serves the whole app + its data over one origin:
 *   1. GET  /api/food-diary       -> live JSON parsed from the Obsidian vault
 *   2. GET  /api/expenses         -> shared expenses/payments list
 *      POST /api/expenses         -> add one (server assigns id + createdAt)
 *      PUT  /api/expenses/:id     -> update one
 *      DELETE /api/expenses/:id   -> delete one
 *   3. the built SPA (dist/spa) as static files, with history-mode fallback
 *
 * Front it with `tailscale serve` for HTTPS on your tailnet so phone + laptop
 * (and anyone you share the node with) can reach it. Access control is the
 * tailnet itself — there is no login.
 *
 * Env vars:
 *   VAULT_DIR      (required)  absolute path to the "Food Diary" folder
 *   EXPENSES_FILE  (default ../data/expenses.json) writable JSON store
 *   PORT           (default 8080)
 *   SPA_DIR        (default ../dist/spa relative to this file)
 *   CACHE_MS       (default 2000) how long to reuse a food-diary parse result
 */
import { createServer } from 'node:http';
import { readFile, writeFile, rename, mkdir, stat } from 'node:fs/promises';
import { join, normalize, extname, dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { parseFoodDiary } from './foodDiaryParser.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT ?? 8080);
const VAULT_DIR = process.env.VAULT_DIR;
const SPA_DIR = resolve(process.env.SPA_DIR ?? join(HERE, '..', 'dist', 'spa'));
const CACHE_MS = Number(process.env.CACHE_MS ?? 2000);
const EXPENSES_FILE = resolve(process.env.EXPENSES_FILE ?? join(HERE, '..', 'data', 'expenses.json'));

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

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(body === undefined ? '' : JSON.stringify(body));
}

// ---- Food diary (read-only, from the vault) --------------------------------

let cache = { at: 0, body: null };

function foodDiaryJson() {
  const now = Date.now();
  if (cache.body && now - cache.at < CACHE_MS) return cache.body;
  const { days, prices, warnings } = parseFoodDiary(VAULT_DIR);
  const body = JSON.stringify({ days, prices, warnings });
  cache = { at: now, body };
  return body;
}

// ---- Expenses (read-write, JSON file) --------------------------------------

// Serialize all reads-modify-writes so concurrent requests can't clobber.
let opChain = Promise.resolve();
function withLock(fn) {
  const run = opChain.then(fn);
  opChain = run.then(
    () => {},
    () => {},
  );
  return run;
}

async function readExpenses() {
  try {
    const arr = JSON.parse(await readFile(EXPENSES_FILE, 'utf8'));
    return Array.isArray(arr) ? arr : [];
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

async function writeExpenses(list) {
  await mkdir(dirname(EXPENSES_FILE), { recursive: true });
  const tmp = `${EXPENSES_FILE}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(list, null, 2));
  await rename(tmp, EXPENSES_FILE); // atomic replace
}

function sanitizeExpense(body) {
  return {
    type: body.type === 'payment' ? 'payment' : 'expense',
    description: String(body.description ?? ''),
    amount: Number(body.amount) || 0,
    paidBy: body.paidBy === 'Martina' ? 'Martina' : 'Brett',
    date: String(body.date ?? new Date().toISOString().slice(0, 10)),
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) req.destroy(); // 1 MB guard
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

async function handleExpenses(req, res, id) {
  if (!id && req.method === 'GET') {
    const list = await readExpenses();
    list.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    sendJson(res, 200, list);
    return;
  }
  if (!id && req.method === 'POST') {
    const body = await readBody(req);
    const item = { id: randomUUID(), ...sanitizeExpense(body), createdAt: Date.now() };
    await withLock(async () => {
      const list = await readExpenses();
      list.push(item);
      await writeExpenses(list);
    });
    sendJson(res, 201, item);
    return;
  }
  if (id && req.method === 'PUT') {
    const body = await readBody(req);
    const updated = await withLock(async () => {
      const list = await readExpenses();
      const idx = list.findIndex((e) => e.id === id);
      if (idx === -1) return null;
      list[idx] = { ...list[idx], ...sanitizeExpense(body), id, createdAt: list[idx].createdAt };
      await writeExpenses(list);
      return list[idx];
    });
    if (!updated) sendJson(res, 404, { error: 'not found' });
    else sendJson(res, 200, updated);
    return;
  }
  if (id && req.method === 'DELETE') {
    await withLock(async () => {
      const list = await readExpenses();
      await writeExpenses(list.filter((e) => e.id !== id));
    });
    sendJson(res, 204);
    return;
  }
  res.writeHead(405, { allow: 'GET, POST, PUT, DELETE' }).end('Method not allowed');
}

// ---- Static SPA ------------------------------------------------------------

async function serveStatic(req, res) {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  let filePath = normalize(join(SPA_DIR, urlPath));

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

// ---- Router ----------------------------------------------------------------

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

    const expensesMatch = path.match(/^\/api\/expenses(?:\/([^/]+))?$/);
    if (expensesMatch) {
      await handleExpenses(req, res, expensesMatch[1] ? decodeURIComponent(expensesMatch[1]) : null);
      return;
    }

    await serveStatic(req, res);
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: String(err && err.message ? err.message : err) });
  }
});

server.listen(PORT, () => {
  console.log(`NUC server on http://0.0.0.0:${PORT}`);
  console.log(`  vault    : ${VAULT_DIR}`);
  console.log(`  expenses : ${EXPENSES_FILE}`);
  console.log(`  spa      : ${SPA_DIR}`);
});
