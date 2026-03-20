#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const SNAPSHOTS_DIR = path.join(__dirname, 'snapshots');

function sanitizeTrigger(trigger) {
  const value = String(trigger || 'auto');
  return value.replace(/[^a-z0-9\-_]/gi, '-').toLowerCase().slice(0, 40) || 'auto';
}

function urlToKey(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    const key = `${parsed.hostname}${parsed.pathname}`
      .replace(/[^a-zA-Z0-9_\-/]/g, '_')
      .replace(/\/+?/g, '__')
      .replace(/^__|__$/g, '')
      .slice(0, 120);
    return key || 'root';
  } catch (_) {
    return 'unknown';
  }
}

function parseArgs(argv) {
  const result = {
    session: '',
    dryRun: false
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--session' && argv[i + 1]) {
      result.session = argv[++i];
      continue;
    }
    if (arg === '--dry-run') {
      result.dryRun = true;
    }
  }

  return result;
}

function safeReadJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return fallback;
  }
}

function readChanges(filePath) {
  if (!fs.existsSync(filePath)) return [];

  return fs
    .readFileSync(filePath, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch (_) {
        return null;
      }
    })
    .filter(Boolean);
}

function writeNdjson(filePath, items) {
  const body = items.map((item) => JSON.stringify(item)).join('\n');
  fs.writeFileSync(filePath, body ? `${body}\n` : '', 'utf8');
}

function extractSectionBlocks(latestHtml) {
  const blocks = new Map();
  const re = /<section class="snap" data-index="(\d+)"[\s\S]*?<\/section>\n?/g;
  let match;

  while ((match = re.exec(latestHtml)) !== null) {
    const index = Number(match[1]);
    blocks.set(index, match[0]);
  }

  return blocks;
}

function ensureLatestSkeleton(filePath, title) {
  if (fs.existsSync(filePath)) return;

  const doc = `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>${title || 'Combined snapshots'}</title>\n<style>\nbody{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;padding:12px;background:#0b1020;color:#d6e1ff;}\n.snap{margin-bottom:12px;border:1px solid #334155;border-radius:6px;background:#111827;}\n.head{padding:8px 10px;border-bottom:1px solid #334155;color:#93c5fd;}\npre{margin:0;padding:10px;white-space:pre-wrap;word-break:break-word;}\n</style>\n</head>\n<body>\n<main>\n</main>\n</body>\n</html>\n`;

  fs.writeFileSync(filePath, doc, 'utf8');
}

function appendSectionsToLatest(filePath, sectionBlocks) {
  if (!sectionBlocks.length) return;

  const tail = '</main>\n</body>\n</html>';
  const current = fs.readFileSync(filePath, 'utf8');
  const existing = new Set();
  const existingMatches = current.match(/data-index="(\d+)"/g) || [];
  existingMatches.forEach((s) => existing.add(Number(String(s).replace(/\D/g, ''))));

  const toAdd = sectionBlocks.filter((entry) => !existing.has(entry.index)).map((entry) => entry.block);
  if (!toAdd.length) return;

  if (current.includes(tail)) {
    fs.writeFileSync(filePath, current.replace(tail, `${toAdd.join('')}${tail}`), 'utf8');
    return;
  }

  fs.appendFileSync(filePath, `\n${toAdd.join('')}`, 'utf8');
}

function fullFilenameFor(change) {
  return `${String(change.index).padStart(4, '0')}_${sanitizeTrigger(change.trigger)}_${change.timestamp}.html`;
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  const out = [];
  items.forEach((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(item);
  });
  return out;
}

function run() {
  const args = parseArgs(process.argv);
  if (!args.session) {
    console.error('Usage: node rebucket-session.js --session <session_id> [--dry-run]');
    process.exit(1);
  }

  const sessionPath = path.join(SNAPSHOTS_DIR, args.session);
  if (!fs.existsSync(sessionPath)) {
    console.error(`Session not found: ${sessionPath}`);
    process.exit(1);
  }

  const branchNames = fs.readdirSync(sessionPath).filter((name) => {
    const p = path.join(sessionPath, name);
    return fs.existsSync(p) && fs.statSync(p).isDirectory();
  });

  let movedEvents = 0;
  let touchedBranches = 0;

  branchNames.forEach((sourceBranch) => {
    const sourceDir = path.join(sessionPath, sourceBranch);
    const changesPath = path.join(sourceDir, 'changes.ndjson');
    const metaPath = path.join(sourceDir, 'meta.json');
    const latestPath = path.join(sourceDir, 'latest.html');

    if (!fs.existsSync(changesPath)) return;

    const changes = readChanges(changesPath);
    if (!changes.length) return;

    const sourceMeta = safeReadJson(metaPath, {
      urlKey: sourceBranch,
      snapshots: [],
      urls: []
    });
    const snapshotByIndex = new Map(
      (Array.isArray(sourceMeta.snapshots) ? sourceMeta.snapshots : []).map((s) => [Number(s.index), s])
    );

    const sectionBlocks = fs.existsSync(latestPath)
      ? extractSectionBlocks(fs.readFileSync(latestPath, 'utf8'))
      : new Map();

    const byTarget = new Map();
    changes.forEach((change) => {
      const targetKey = urlToKey(change.url || '');
      if (targetKey === sourceBranch) return;
      if (!byTarget.has(targetKey)) byTarget.set(targetKey, []);
      byTarget.get(targetKey).push(change);
    });

    if (byTarget.size === 0) return;

    byTarget.forEach((items, targetKey) => {
      touchedBranches += 1;
      movedEvents += items.length;

      const targetDir = path.join(sessionPath, targetKey);
      const targetMetaPath = path.join(targetDir, 'meta.json');
      const targetChangesPath = path.join(targetDir, 'changes.ndjson');
      const targetLatestPath = path.join(targetDir, 'latest.html');

      const targetMeta = safeReadJson(targetMetaPath, {
        urlKey: targetKey,
        url: items[0]?.url || '',
        primaryUrl: items[0]?.url || '',
        urls: [],
        pathname: (() => {
          try {
            return new URL(items[0]?.url || 'about:blank').pathname;
          } catch (_) {
            return '/';
          }
        })(),
        title: '',
        domSignature: null,
        mergedBySignature: false,
        latestFile: 'latest.html',
        lastFullSnapshotAt: 0,
        snapshots: []
      });

      const targetChanges = readChanges(targetChangesPath);
      const mergedChanges = uniqueBy(
        targetChanges.concat(items),
        (it) => `${it.index}|${it.timestamp}|${it.url}`
      ).sort((a, b) => Number(a.index) - Number(b.index));

      const movedSnapshots = items
        .map((change) => snapshotByIndex.get(Number(change.index)))
        .filter(Boolean);
      const mergedSnapshots = uniqueBy(
        (Array.isArray(targetMeta.snapshots) ? targetMeta.snapshots : []).concat(movedSnapshots),
        (it) => `${it.index}|${it.timestamp || ''}`
      ).sort((a, b) => Number(a.index) - Number(b.index));

      const mergedUrls = Array.from(new Set((targetMeta.urls || []).concat(items.map((c) => String(c.url || '')).filter(Boolean))));

      if (!args.dryRun) {
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
        writeNdjson(targetChangesPath, mergedChanges);

        targetMeta.snapshots = mergedSnapshots;
        targetMeta.urls = mergedUrls;
        targetMeta.url = targetMeta.url || items[0]?.url || '';
        targetMeta.primaryUrl = targetMeta.primaryUrl || targetMeta.url;
        targetMeta.urlKey = targetKey;
        targetMeta.pathname = (() => {
          try {
            return new URL(targetMeta.url || items[0]?.url || 'about:blank').pathname;
          } catch (_) {
            return '/';
          }
        })();
        targetMeta.latestFile = 'latest.html';

        fs.writeFileSync(targetMetaPath, JSON.stringify(targetMeta, null, 2), 'utf8');

        const selectedBlocks = items
          .map((change) => ({ index: Number(change.index), block: sectionBlocks.get(Number(change.index)) }))
          .filter((entry) => !!entry.block);

        ensureLatestSkeleton(targetLatestPath, targetKey);
        appendSectionsToLatest(targetLatestPath, selectedBlocks);

        items.forEach((change) => {
          if (!change.fullSaved) return;
          const fileName = fullFilenameFor(change);
          const srcFile = path.join(sourceDir, fileName);
          const dstFile = path.join(targetDir, fileName);
          if (fs.existsSync(srcFile) && !fs.existsSync(dstFile)) {
            fs.copyFileSync(srcFile, dstFile);
          }
        });
      }

      console.log(`${args.dryRun ? '[dry-run] ' : ''}${sourceBranch} -> ${targetKey} : ${items.length} events`);
    });
  });

  console.log(`Done. ${args.dryRun ? 'Would move' : 'Moved'} ${movedEvents} events across ${touchedBranches} target-branch updates.`);
}

run();
