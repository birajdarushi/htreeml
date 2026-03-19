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
const SNAPSHOTS_ROOT = path.resolve(SNAPSHOTS_DIR);

// ── Ensure dirs exist ─────────────────────────────────────────────────────
if (!fs.existsSync(SNAPSHOTS_DIR)) fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });

// ── In-memory tree (rebuilt on restart from disk) ─────────────────────────
// tree[sessionId][urlKey] = [ { index, trigger, timestamp, file, title } ]
let tree = {};
let snapshotCount = 0;

// Last structural fingerprint per branch (session/urlKey) — used at save time
// to detect whether new DOM elements appeared vs text-only changes.
const branchLastFingerprints = {};

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

// ── Structural fingerprint ────────────────────────────────────────────────
// Extracts an ordered list of "tag[#id][.classes]" tokens from HTML,
// ignoring text content. Two snapshots that differ only in text will produce
// the same fingerprint; adding/removing DOM elements changes it.
function structuralFingerprint(html) {
  const SKIP = new Set([
    'script', 'style', 'meta', 'link', 'noscript', 'br', 'hr',
    'input', 'img', 'svg', 'path', 'use', 'g', 'circle', 'rect',
    'line', 'polyline', 'polygon', 'ellipse', 'defs', 'symbol',
  ]);
  const tags = [];
  const tagRe = /<([a-zA-Z][a-zA-Z0-9-]*)([^>]*?)>/g;
  let m;
  while ((m = tagRe.exec(html)) !== null) {
    const tag = m[1].toLowerCase();
    if (SKIP.has(tag) || tag.startsWith('!')) continue;
    const attrs = m[2] || '';
    const idM   = attrs.match(/\bid=["']([^"']*?)["']/);
    const clsM  = attrs.match(/\bclass=["']([^"']*?)["']/);
    const id    = idM  ? `#${idM[1]}` : '';
    const cls   = clsM ? `.${clsM[1].trim().split(/\s+/).sort().join('.')}` : '';
    tags.push(`${tag}${id}${cls}`);
  }
  return tags;
}

// ── Diff two structural fingerprints ─────────────────────────────────────
// Returns { added, removed } — arrays of { tag, count } sorted by count desc.
function diffStructure(fp1, fp2) {
  const countMap = arr => arr.reduce((m, t) => { m[t] = (m[t] || 0) + 1; return m; }, {});
  const c1 = countMap(fp1);
  const c2 = countMap(fp2);
  const allTags = new Set([...Object.keys(c1), ...Object.keys(c2)]);
  const added = [], removed = [];
  allTags.forEach(tag => {
    const n1 = c1[tag] || 0, n2 = c2[tag] || 0;
    if (n2 > n1) added.push({ tag, count: n2 - n1 });
    else if (n1 > n2) removed.push({ tag, count: n1 - n2 });
  });
  return {
    added:   added.sort((a, b) => b.count - a.count),
    removed: removed.sort((a, b) => b.count - a.count),
  };
}

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

function isSafePathSegment(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,120}$/.test(value);
}

function isSafeSnapshotFilename(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9._-]{1,255}$/.test(value);
}

function resolveSnapshotPath(...segments) {
  const target = path.resolve(SNAPSHOTS_ROOT, ...segments.map(v => String(v || '')));
  const rootWithSep = `${SNAPSHOTS_ROOT}${path.sep}`;
  if (target === SNAPSHOTS_ROOT || target.startsWith(rootWithSep)) return target;
  return null;
}

// ── Save a snapshot ───────────────────────────────────────────────────────
function saveSnapshot(payload) {
  const { sessionId, url: rawUrl, pathname, title, trigger, snapshotIndex, timestamp, html } = payload;
  if (!isSafePathSegment(sessionId)) {
    throw new Error('Invalid sessionId');
  }

  const urlKey = urlToKey(rawUrl);
  const sessionDir = resolveSnapshotPath(sessionId);
  const branchDir = resolveSnapshotPath(sessionId, urlKey);
  if (!sessionDir || !branchDir) throw new Error('Invalid snapshot path');

  if (!fs.existsSync(branchDir)) fs.mkdirSync(branchDir, { recursive: true });

  // Save HTML file
  const filename = `${String(snapshotIndex).padStart(4, '0')}_${trigger}_${timestamp}.html`;
  const filepath = path.join(branchDir, filename);
  fs.writeFileSync(filepath, html, 'utf8');

  // ── Structural-change detection ──────────────────────────────────────────
  // Compare the new snapshot's structural fingerprint to the previous one
  // on this branch so the viewer can flag text-only vs structural changes.
  const branchKey = `${sessionId}/${urlKey}`;
  const fp = structuralFingerprint(html);
  const prevFp = branchLastFingerprints[branchKey] || [];
  const structDiff = diffStructure(prevFp, fp);
  const structuralChange = prevFp.length === 0 ||
    structDiff.added.length > 0 ||
    structDiff.removed.length > 0;
  branchLastFingerprints[branchKey] = fp;

  const changeLabel = structuralChange
    ? `+${structDiff.added.length}/-${structDiff.removed.length} elem`
    : 'text-only';

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
    title,
    structuralChange,
  });

  // Persist meta
  const metaPath = path.join(branchDir, 'meta.json');
  fs.writeFileSync(metaPath, JSON.stringify(tree[sessionId][urlKey], null, 2));

  snapshotCount++;
  const timeStr = new Date(timestamp).toLocaleTimeString();
  console.log(`🌿 [${timeStr}] ${trigger.padEnd(14)} → ${urlKey.substring(0, 50)} (${changeLabel})`);

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

  // ── Structural diff between two snapshots on the same branch
  // GET /api/diff?session=&branch=&from=filename1&to=filename2
  if (req.method === 'GET' && pathname === '/api/diff') {
    const { session, branch, from: fromFile, to: toFile } = parsed.query;
    if (!session || !branch || !fromFile || !toFile) {
      res.writeHead(400); res.end(JSON.stringify({ error: 'Missing params' })); return;
    }
    if (!isSafePathSegment(session) || !isSafePathSegment(branch) ||
        !isSafeSnapshotFilename(fromFile) || !isSafeSnapshotFilename(toFile)) {
      res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid path' })); return;
    }
    const fromPath = resolveSnapshotPath(session, branch, fromFile);
    const toPath   = resolveSnapshotPath(session, branch, toFile);
    if (!fromPath || !toPath) {
      res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid path' })); return;
    }
    if (!fs.existsSync(fromPath) || !fs.existsSync(toPath)) {
      res.writeHead(404); res.end(JSON.stringify({ error: 'File not found' })); return;
    }
    const html1 = fs.readFileSync(fromPath, 'utf8');
    const html2 = fs.readFileSync(toPath, 'utf8');
    const fp1 = structuralFingerprint(html1);
    const fp2 = structuralFingerprint(html2);
    const diff = diffStructure(fp1, fp2);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ...diff,
      isTextOnly: diff.added.length === 0 && diff.removed.length === 0,
      totalFrom: fp1.length,
      totalTo:   fp2.length,
    }));
    return;
  }

  // ── Component deduplication: find HTML structures shared across all branches
  // GET /api/components?session=
  if (req.method === 'GET' && pathname === '/api/components') {
    const { session } = parsed.query;
    if (!session || !tree[session]) {
      res.writeHead(404); res.end(JSON.stringify({ components: [] })); return;
    }
    const branches = Object.values(tree[session]);
    if (branches.length < 2) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ components: [], note: 'Need ≥2 pages to detect shared components' }));
      return;
    }
    // Build fingerprint set for the first snapshot of every branch
    const branchFps = [];
    for (const branch of branches) {
      if (!branch.snapshots.length) continue;
      const firstSnap = branch.snapshots[0];
      const filePath = path.join(SNAPSHOTS_DIR, session, branch.urlKey, firstSnap.filename);
      if (!fs.existsSync(filePath)) continue;
      try {
        const html = fs.readFileSync(filePath, 'utf8');
        const fp = structuralFingerprint(html);
        branchFps.push({ urlKey: branch.urlKey, tags: new Set(fp) });
      } catch (_) {}
    }
    if (branchFps.length < 2) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ components: [] }));
      return;
    }
    // Intersection: elements present in EVERY branch
    const commonTags = [...branchFps[0].tags].filter(tag =>
      branchFps.every(b => b.tags.has(tag))
    );
    // Keep only meaningful elements — bare anonymous tags (div, span, p, …)
    // without an id/class carry no component identity and are excluded.
    const BARE = new Set(['html', 'head', 'body', 'div', 'span', 'p', 'a',
                          'ul', 'ol', 'li', 'table', 'tbody', 'tr', 'td', 'th']);
    const COMPONENT_TAGS = new Set(['nav', 'header', 'footer', 'aside',
                                    'section', 'article', 'form', 'dialog']);
    const meaningful = commonTags.filter(tag => {
      const base = (tag.match(/^([a-z][a-z0-9-]*)/) || [])[1] || '';
      if (COMPONENT_TAGS.has(base)) return true;             // semantic block
      if (BARE.has(base) && !tag.includes('#') && !tag.includes('.')) return false;
      return tag.includes('#') || tag.includes('.');         // has id/class
    });
    const components = meaningful.map(tag => ({
      tag,
      presentIn:   branchFps.filter(b => b.tags.has(tag)).map(b => b.urlKey),
      occurrences: branchFps.filter(b => b.tags.has(tag)).length,
    })).sort((a, b) => b.occurrences - a.occurrences);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ components, totalBranches: branchFps.length }));
    return;
  }

  // ── Serve HTML snapshot file
  if (req.method === 'GET' && pathname === '/api/file') {
    const { session, branch, file } = parsed.query;
    if (!isSafePathSegment(session) || !isSafePathSegment(branch) || !isSafeSnapshotFilename(file)) {
      res.writeHead(400); res.end('Invalid path'); return;
    }
    const filePath = resolveSnapshotPath(session, branch, file);
    if (!filePath || !fs.existsSync(filePath)) {
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
