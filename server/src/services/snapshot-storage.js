const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mutationCompare = require('../../../scripts/mutation_compare');
const { buildAiFriendlyHtml, escapeHtml } = require('./html-cleaner');

const SNAPSHOTS_DIR = path.join(__dirname, '..', '..', 'snapshots');
const LATEST_FILE = 'latest.html';
const AI_LATEST_FILE = 'latest.ai.html';
const SINGLE_FILE_MODE = false;
const LEGACY_FULL_FILE_RE = /^\d{4}_.+\.html$/;
const CRITICAL_FULL_TRIGGERS = new Set(['page-load', 'navigation', 'manual']);
const DOM_FULL_INTERVAL_MS = 20000;
const NON_DOM_FULL_INTERVAL_MS = 10000;

if (!fs.existsSync(SNAPSHOTS_DIR)) fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });

let tree = {};
let snapshotCount = 0;
const inferredSessionsByClient = new Map();

function stableHash(input) {
  return crypto.createHash('sha1').update(String(input)).digest('hex').slice(0, 12);
}

function sanitizeTrigger(trigger) {
  const value = String(trigger || 'auto');
  return value.replace(/[^a-z0-9\-_]/gi, '-').toLowerCase().slice(0, 40) || 'auto';
}

function urlToKey(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    const key = `${parsed.hostname}${parsed.pathname}`
      .replace(/[^a-zA-Z0-9_\-/]/g, '_')
      .replace(/\/+/g, '__')
      .replace(/^__|__$/g, '')
      .slice(0, 120);
    return key || 'root';
  } catch (_) {
    return 'unknown';
  }
}

function computeDomSignature(html) {
  const structural = String(html || '')
    .replace(/<!--([\s\S]*?)-->/g, '')
    .replace(/\s(data-react\S*|data-v-\S*|data-testid|aria-describedby|aria-controls)="[^"]*"/g, '')
    .replace(/\s(id|for|name)="[^"]{8,}"/g, '')
    .replace(/>[^<]{1,80}</g, '></g')
    .replace(/\s+/g, ' ')
    .slice(0, 30000);
  return `sig_${stableHash(structural)}`;
}

function ensureSessionId(payload, req) {
  if (payload.sessionId && typeof payload.sessionId === 'string') {
    return payload.sessionId;
  }

  const headerClientId = req.headers['x-dom-client-id'];
  const clientKey =
    payload.clientId ||
    (Array.isArray(headerClientId) ? headerClientId[0] : headerClientId) ||
    `${req.socket.remoteAddress || 'ip'}:${req.headers['user-agent'] || 'ua'}`;

  if (!inferredSessionsByClient.has(clientKey)) {
    inferredSessionsByClient.set(clientKey, `session_inferred_${Date.now()}_${stableHash(clientKey)}`);
  }

  return inferredSessionsByClient.get(clientKey);
}

function toBranchMeta(rawMeta, branchKey) {
  const snapshots = Array.isArray(rawMeta?.snapshots) ? rawMeta.snapshots : [];
  const primaryUrl = rawMeta?.url || rawMeta?.primaryUrl || '';
  const urls = Array.isArray(rawMeta?.urls) ? rawMeta.urls : primaryUrl ? [primaryUrl] : [];

  return {
    urlKey: rawMeta?.urlKey || branchKey,
    url: primaryUrl,
    primaryUrl,
    urls,
    pathname: rawMeta?.pathname || '/',
    title: rawMeta?.title || '',
    domSignature: rawMeta?.domSignature || null,
    mergedBySignature: !!rawMeta?.mergedBySignature,
    latestFile: rawMeta?.latestFile || LATEST_FILE,
    lastFullSnapshotAt: Number(rawMeta?.lastFullSnapshotAt) || 0,
    snapshots
  };
}

function loadTreeFromDisk() {
  if (!fs.existsSync(SNAPSHOTS_DIR)) return;

  snapshotCount = 0;
  tree = {};

  const sessions = fs.readdirSync(SNAPSHOTS_DIR);
  for (const sessionId of sessions) {
    const sessionPath = path.join(SNAPSHOTS_DIR, sessionId);
    if (!fs.statSync(sessionPath).isDirectory()) continue;

    tree[sessionId] = {};
    const branches = fs.readdirSync(sessionPath);
    for (const branchKey of branches) {
      const branchPath = path.join(sessionPath, branchKey);
      if (!fs.statSync(branchPath).isDirectory()) continue;

      const metaPath = path.join(branchPath, 'meta.json');
      if (!fs.existsSync(metaPath)) continue;

      try {
        const parsed = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        const meta = toBranchMeta(parsed, branchKey);
        tree[sessionId][branchKey] = meta;
        snapshotCount += meta.snapshots.length;
      } catch (_) {
        // ignore invalid metadata files
      }
    }
  }

  console.log(`Loaded ${snapshotCount} snapshots from disk`);
}

function findMergedBranchKey(sessionId, urlKey, domSignature) {
  return urlKey;
}

function persistBranchMeta(sessionId, branchKey) {
  const branchDir = path.join(SNAPSHOTS_DIR, sessionId, branchKey);
  if (!fs.existsSync(branchDir)) fs.mkdirSync(branchDir, { recursive: true });
  const metaPath = path.join(branchDir, 'meta.json');
  fs.writeFileSync(metaPath, JSON.stringify(tree[sessionId][branchKey], null, 2));
}

function appendApiEvents(sessionId, branchKey, snapshotIndex, timestamp, apiCalls) {
  if (!Array.isArray(apiCalls) || apiCalls.length === 0) return null;

  const branchDir = path.join(SNAPSHOTS_DIR, sessionId, branchKey);
  if (!fs.existsSync(branchDir)) fs.mkdirSync(branchDir, { recursive: true });

  const fileName = 'api-events.ndjson';
  const filePath = path.join(branchDir, fileName);

  const lines = apiCalls
    .filter((item) => item && typeof item === 'object')
    .map((item) => JSON.stringify({
      snapshotIndex,
      snapshotTimestamp: timestamp,
      type: item.type || 'fetch',
      method: String(item.method || 'GET').toUpperCase(),
      url: String(item.url || ''),
      status: Number(item.status) || 0,
      durationMs: Number(item.durationMs) || 0,
      error: item.error ? String(item.error) : undefined,
      timestamp: Number(item.timestamp) || Date.now()
    }));

  if (lines.length === 0) return null;
  fs.appendFileSync(filePath, lines.join('\n') + '\n', 'utf8');
  return fileName;
}

function ensureCombinedLatestSkeleton(filePath, pageTitle) {
  if (fs.existsSync(filePath)) return;

  const skeleton = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(pageTitle)} - Combined Snapshot Timeline</title>
  <style>
    body { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; margin: 16px; background: #0b1020; color: #dbe4ff; }
    h1 { font-size: 18px; margin: 0 0 12px 0; }
    .meta { color: #9fb0d8; font-size: 12px; margin-bottom: 16px; }
    .snap { border: 1px solid #27314f; border-radius: 8px; margin: 12px 0; overflow: hidden; background: #111a33; }
    .head { padding: 10px 12px; background: #1a2444; font-size: 12px; color: #c7d6ff; }
    pre { margin: 0; padding: 12px; white-space: pre-wrap; word-break: break-word; max-height: 520px; overflow: auto; color: #e9efff; background: #0d1430; }
  </style>
</head>
<body>
  <h1>Combined Snapshot Timeline</h1>
  <div class="meta">This single file accumulates every captured DOM state for this branch.</div>
  <main id="timeline"></main>
</body>
</html>`;

  fs.writeFileSync(filePath, skeleton, 'utf8');
}

function appendSnapshotToCombinedLatest(filePath, snapMeta, html) {
  ensureCombinedLatestSkeleton(filePath, snapMeta.url || snapMeta.title || 'Snapshot');

  const tail = '</main>\n</body>\n</html>';
  const current = fs.readFileSync(filePath, 'utf8');
  const header = `#${snapMeta.index} · ${snapMeta.trigger} · ${new Date(snapMeta.timestamp).toISOString()} · ${snapMeta.url}`;
  const block = `  <section class="snap" data-index="${snapMeta.index}" data-trigger="${escapeHtml(snapMeta.trigger)}" data-ts="${snapMeta.timestamp}">
    <div class="head">${escapeHtml(header)}</div>
    <pre>${escapeHtml(html)}</pre>
  </section>\n`;

  if (current.includes(tail)) {
    fs.writeFileSync(filePath, current.replace(tail, `${block}${tail}`), 'utf8');
    return;
  }

  fs.appendFileSync(filePath, `\n${block}`, 'utf8');
}

function shouldPersistFullSnapshot(branch, trigger, timestamp) {
  if (SINGLE_FILE_MODE) return false;
  if (CRITICAL_FULL_TRIGGERS.has(trigger)) return true;

  const lastFull = Number(branch.lastFullSnapshotAt) || 0;
  const interval = trigger === 'dom-mutation' ? DOM_FULL_INTERVAL_MS : NON_DOM_FULL_INTERVAL_MS;
  return timestamp - lastFull >= interval;
}

function pruneLegacyHtmlFiles(branchDir) {
  if (!SINGLE_FILE_MODE || !fs.existsSync(branchDir)) return;

  const files = fs.readdirSync(branchDir);
  for (const name of files) {
    if (LEGACY_FULL_FILE_RE.test(name)) {
      try {
        fs.unlinkSync(path.join(branchDir, name));
      } catch (_) {
        // ignore best-effort cleanup errors
      }
    }
  }
}

function saveSnapshot(payload, req) {
  const sessionId = ensureSessionId(payload, req);
  const rawUrl = String(payload.url || 'about:blank');
  const pathname = payload.pathname || (() => {
    try {
      return new URL(rawUrl).pathname;
    } catch (_) {
      return '/';
    }
  })();

  const title = String(payload.title || 'Untitled');
  const trigger = sanitizeTrigger(payload.trigger);
  const timestamp = Number(payload.timestamp) || Date.now();
  const html = String(payload.html || '');
  const apiCalls = Array.isArray(payload.apiCalls) ? payload.apiCalls.slice(-50) : [];
  const mutationSummary = payload.mutationSummary && typeof payload.mutationSummary === 'object'
    ? payload.mutationSummary
    : null;
  const interactionContext =
    payload.interactionContext && typeof payload.interactionContext === 'object'
      ? payload.interactionContext
      : null;
  const domSignature = payload.domSignature || computeDomSignature(html);
  const urlKey = urlToKey(rawUrl);

  if (!tree[sessionId]) tree[sessionId] = {};
  const branchKey = findMergedBranchKey(sessionId, urlKey, domSignature);
  const mergedBySignature = branchKey !== urlKey;

  if (!tree[sessionId][branchKey]) {
    tree[sessionId][branchKey] = {
      urlKey: branchKey,
      url: rawUrl,
      primaryUrl: rawUrl,
      urls: [rawUrl],
      pathname,
      title,
      domSignature,
      mergedBySignature,
      latestFile: LATEST_FILE,
      lastFullSnapshotAt: 0,
      snapshots: []
    };
  }

  const branch = tree[sessionId][branchKey];
  if (!branch.urls.includes(rawUrl)) branch.urls.push(rawUrl);
  if (!branch.domSignature) branch.domSignature = domSignature;

  const inferredIndex = branch.snapshots.length;
  const snapshotIndex = Number.isFinite(payload.snapshotIndex) ? Number(payload.snapshotIndex) : inferredIndex;
  const fullFilename = `${String(snapshotIndex).padStart(4, '0')}_${trigger}_${timestamp}.html`;
  const fullSaved = shouldPersistFullSnapshot(branch, trigger, timestamp);
  const filename = fullSaved ? fullFilename : LATEST_FILE;
  const aiFriendlyHtml = buildAiFriendlyHtml(html);

  const branchDir = path.join(SNAPSHOTS_DIR, sessionId, branchKey);
  if (!fs.existsSync(branchDir)) fs.mkdirSync(branchDir, { recursive: true });

  const latestPath = path.join(branchDir, LATEST_FILE);
  const prevHtml = mutationCompare.getLastSnapshotHtmlFromLatest(latestPath);

  // Keep latest.html as one accumulated file containing every captured DOM state.
  appendSnapshotToCombinedLatest(latestPath, {
    index: snapshotIndex,
    trigger,
    timestamp,
    url: rawUrl,
    title
  }, aiFriendlyHtml);
  fs.writeFileSync(path.join(branchDir, AI_LATEST_FILE), aiFriendlyHtml, 'utf8');
  pruneLegacyHtmlFiles(branchDir);
  if (fullSaved) {
    fs.writeFileSync(path.join(branchDir, fullFilename), html, 'utf8');
    branch.lastFullSnapshotAt = timestamp;
  }

  if (prevHtml) {
    try {
      const changes = mutationCompare.compareBodiesFromHtml(prevHtml, html);
      mutationCompare.appendMutationEntry(
        branchDir,
        branchKey,
        {
          mutation_id: snapshotIndex,
          trigger,
          changes,
          interaction_context: interactionContext || undefined
        },
        branch.snapshots.length + 1
      );
    } catch (err) {
      console.warn(`[mutation] append failed: ${err.message}`);
    }
  }

  const apiEventsFile = appendApiEvents(sessionId, branchKey, snapshotIndex, timestamp, apiCalls);

  branch.snapshots.push({
    index: snapshotIndex,
    trigger,
    timestamp,
    filename,
    fullFilename: fullSaved ? fullFilename : null,
    fullSaved,
    aiLatestFile: AI_LATEST_FILE,
    title,
    url: rawUrl,
    apiCallCount: apiCalls.length,
    apiEventsFile,
    domSignature,
    mutationSummary,
    interactionContext
  });

  branch.pathname = pathname;
  branch.title = title;
  branch.url = branch.url || rawUrl;
  branch.latestFile = LATEST_FILE;

  persistBranchMeta(sessionId, branchKey);

  snapshotCount++;
  const timeStr = new Date(timestamp).toLocaleTimeString();
  console.log(`[${timeStr}] ${trigger.padEnd(13)} -> ${branchKey.slice(0, 64)} (${sessionId.slice(0, 18)})`);

  return { sessionId, urlKey: branchKey, snapshotCount, mergedBySignature };
}

function getTree() {
  return tree;
}

function getSnapshotCount() {
  return snapshotCount;
}

function getSnapshotsDir() {
  return SNAPSHOTS_DIR;
}

module.exports = {
  loadTreeFromDisk,
  saveSnapshot,
  getTree,
  getSnapshotCount,
  getSnapshotsDir
};