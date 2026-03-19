// DOM Tree Capture - Local Server
// Run once: node server.js
// Receives snapshots from extension, saves to disk, serves viewer UI

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 7700;
const SNAPSHOTS_DIR = path.join(__dirname, 'snapshots');
const PUBLIC_DIR = path.join(__dirname, 'public');

// ── Ensure dirs exist ─────────────────────────────────────────────────────
if (!fs.existsSync(SNAPSHOTS_DIR)) fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });

// ── In-memory tree (rebuilt on restart from disk) ─────────────────────────
// tree[sessionId][urlKey] = [ { index, trigger, timestamp, file, title } ]
let tree = {};
let snapshotCount = 0;

function loadTreeFromDisk() {
  if (!fs.existsSync(SNAPSHOTS_DIR)) return;
  const sessions = fs.readdirSync(SNAPSHOTS_DIR);
  for (const session of sessions) {
    const sessionPath = path.join(SNAPSHOTS_DIR, session);
    if (!fs.statSync(sessionPath).isDirectory()) continue;
    tree[session] = {};
    const branches = fs.readdirSync(sessionPath);
    for (const branch of branches) {
      const branchPath = path.join(sessionPath, branch);
      if (!fs.statSync(branchPath).isDirectory()) continue;
      const metaFile = path.join(branchPath, 'meta.json');
      if (!fs.existsSync(metaFile)) continue;
      try {
        const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
        tree[session][branch] = meta;
        snapshotCount += meta.snapshots ? meta.snapshots.length : 0;
      } catch (_) {}
    }
  }
  console.log(`📂 Loaded ${snapshotCount} existing snapshots from disk`);
}

loadTreeFromDisk();

// ── URL → safe folder name ────────────────────────────────────────────────
function urlToKey(rawUrl) {
  try {
    const u = new URL(rawUrl);
    const base = (u.hostname + u.pathname)
      .replace(/[^a-zA-Z0-9_\-\/]/g, '_')
      .replace(/\/+/g, '__')
      .replace(/^__/, '')
      .replace(/__$/, '')
      .substring(0, 80);
    return base || 'root';
  } catch (_) {
    return 'unknown';
  }
}

// ── Save a snapshot ───────────────────────────────────────────────────────
function saveSnapshot(payload) {
  const { sessionId, url: rawUrl, pathname, title, trigger, snapshotIndex, timestamp, html } = payload;

  const urlKey = urlToKey(rawUrl);
  const sessionDir = path.join(SNAPSHOTS_DIR, sessionId);
  const branchDir = path.join(sessionDir, urlKey);

  if (!fs.existsSync(branchDir)) fs.mkdirSync(branchDir, { recursive: true });

  // Save HTML file
  const filename = `${String(snapshotIndex).padStart(4, '0')}_${trigger}_${timestamp}.html`;
  const filepath = path.join(branchDir, filename);
  fs.writeFileSync(filepath, html, 'utf8');

  // Update branch meta
  if (!tree[sessionId]) tree[sessionId] = {};
  if (!tree[sessionId][urlKey]) {
    tree[sessionId][urlKey] = {
      urlKey,
      url: rawUrl,
      pathname,
      title,
      snapshots: []
    };
  }

  tree[sessionId][urlKey].snapshots.push({
    index: snapshotIndex,
    trigger,
    timestamp,
    filename,
    title
  });

  // Persist meta
  const metaPath = path.join(branchDir, 'meta.json');
  fs.writeFileSync(metaPath, JSON.stringify(tree[sessionId][urlKey], null, 2));

  snapshotCount++;
  const timeStr = new Date(timestamp).toLocaleTimeString();
  console.log(`🌿 [${timeStr}] ${trigger.padEnd(14)} → ${urlKey.substring(0, 50)}`);

  return { urlKey, snapshotCount };
}

// ── HTTP Server ───────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  // CORS for extension
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204); res.end(); return;
  }

  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  // ── Health check
  if (req.method === 'GET' && pathname === '/ping') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, snapshots: snapshotCount }));
    return;
  }

  // ── Receive snapshot from extension
  if (req.method === 'POST' && pathname === '/snapshot') {
    let body = '';
    req.on('data', d => { body += d; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const result = saveSnapshot(payload);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, ...result }));
      } catch (e) {
        res.writeHead(400); res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // ── Tree API for viewer
  if (req.method === 'GET' && pathname === '/api/tree') {
    const sessions = Object.entries(tree).map(([sid, branches]) => ({
      sessionId: sid,
      branches: Object.values(branches).map(b => ({
        urlKey: b.urlKey,
        url: b.url,
        pathname: b.pathname,
        title: b.title,
        snapshotCount: b.snapshots.length,
        lastSnapshot: b.snapshots[b.snapshots.length - 1]
      }))
    }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(sessions));
    return;
  }

  // ── Branch snapshots list
  if (req.method === 'GET' && pathname === '/api/snapshots') {
    const { session, branch } = parsed.query;
    if (!session || !branch || !tree[session] || !tree[session][branch]) {
      res.writeHead(404); res.end('{}'); return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(tree[session][branch]));
    return;
  }

  // ── Serve HTML snapshot file
  if (req.method === 'GET' && pathname === '/api/file') {
    const { session, branch, file } = parsed.query;
    const filePath = path.join(SNAPSHOTS_DIR, session, branch, file);
    if (!fs.existsSync(filePath) || !filePath.startsWith(SNAPSHOTS_DIR)) {
      res.writeHead(404); res.end('Not found'); return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  // ── Serve viewer UI (static files from public/)
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' };
    res.writeHead(200, { 'Content-Type': types[ext] || 'text/plain' });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  // Default: serve index.html (SPA)
  const indexPath = path.join(PUBLIC_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    fs.createReadStream(indexPath).pipe(res);
  } else {
    res.writeHead(404); res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log('');
  console.log('🌿 DOM Tree Capture Server');
  console.log(`   Running at  → http://localhost:${PORT}`);
  console.log(`   Snapshots   → ${SNAPSHOTS_DIR}`);
  console.log(`   Viewer      → http://localhost:${PORT}`);
  console.log('');
  console.log('   Install the Chrome extension from ./extension/');
  console.log('   Then browse your app — snapshots appear automatically.');
  console.log('   Ctrl+Shift+S in browser for manual capture.');
  console.log('');
});
