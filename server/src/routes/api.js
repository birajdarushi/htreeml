const fs = require('fs');
const path = require('path');
const { getTree, getSnapshotCount, getSnapshotsDir } = require('../services/snapshot-storage');
const { sendJson } = require('./snapshot');

function handleApiTree(req, res) {
  const tree = getTree();
  const sessions = Object.entries(tree).map(([sessionId, branches]) => ({
    sessionId,
    branches: Object.values(branches).map((branch) => ({
      urlKey: branch.urlKey,
      url: branch.url,
      pathname: branch.pathname,
      title: branch.title,
      urls: branch.urls || [branch.url],
      mergedBySignature: !!branch.mergedBySignature,
      snapshotCount: branch.snapshots.length,
      lastSnapshot: branch.snapshots[branch.snapshots.length - 1]
    }))
  }));
  sendJson(res, 200, sessions);
}

function handleApiSnapshots(req, res, parsedUrl) {
  const { session, branch } = parsedUrl.query;
  const tree = getTree();
  if (!session || !branch || !tree[session] || !tree[session][branch]) {
    sendJson(res, 404, {});
    return;
  }
  sendJson(res, 200, tree[session][branch]);
}

function handleApiFile(req, res, parsedUrl) {
  const { session, branch, file } = parsedUrl.query;
  const snapshotsDir = getSnapshotsDir();
  const resolved = path.resolve(snapshotsDir, String(session || ''), String(branch || ''), String(file || ''));

  if (!resolved.startsWith(path.resolve(snapshotsDir)) || !fs.existsSync(resolved)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  fs.createReadStream(resolved).pipe(res);
}

function handlePing(req, res) {
  sendJson(res, 200, { ok: true, snapshots: getSnapshotCount() });
}

module.exports = {
  handleApiTree,
  handleApiSnapshots,
  handleApiFile,
  handlePing
};