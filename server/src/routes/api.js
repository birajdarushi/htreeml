const fs = require('fs');
const path = require('path');
const { getTree, getSnapshotCount, getSnapshotsDir } = require('../services/snapshot-storage');
const { sendJson } = require('./snapshot');

/**
 * Check whether a single path segment is safe for use in filesystem paths.
 * @param {string} segment - The path segment to validate (a single path component).
 * @returns {boolean} `true` if the segment does not contain `..` or path separators (`/` or `\`), `false` otherwise.
 */
function isValidSegment(segment) {
  return !(/\.\.|[/\\]/.test(segment));
}

/**
 * Send a JSON array describing snapshot sessions and their branches.
 *
 * The response body is an array where each element represents a session:
 * {
 *   sessionId: string,
 *   branches: Array<{
 *     urlKey: string,
 *     url: string,
 *     pathname: string,
 *     title: string,
 *     urls: string[],
 *     mergedBySignature: boolean,
 *     snapshotCount: number,
 *     lastSnapshot: any
 *   }>
 * }
 *
 * @param {import('http').IncomingMessage} req - The incoming HTTP request.
 * @param {import('http').ServerResponse} res - The HTTP response used to send JSON.
 */
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

/**
 * Serve an HTML snapshot file for a given session, branch, and file.
 *
 * Validates that `parsedUrl.query` contains safe `session`, `branch`, and `file`
 * segments; responds with HTTP 400 for invalid segments. Resolves the target
 * file inside the configured snapshots directory and responds with HTTP 404
 * if the file does not exist or is outside the snapshots directory. If valid,
 * streams the file to the response with Content-Type `text/html; charset=utf-8`.
 *
 * @param {import('http').IncomingMessage} req - Incoming HTTP request.
 * @param {import('http').ServerResponse} res - HTTP response to write to.
 * @param {{ query: { session?: string, branch?: string, file?: string } }} parsedUrl - Parsed URL object whose `query` provides `session`, `branch`, and `file`.
 */
function handleApiFile(req, res, parsedUrl) {
  const { session, branch, file } = parsedUrl.query;
  const snapshotsDir = getSnapshotsDir();

  // Validate segments: deny '..' and path separators to prevent traversal
  if (
    !isValidSegment(String(session || '')) ||
    !isValidSegment(String(branch || '')) ||
    !isValidSegment(String(file || ''))
  ) {
    res.writeHead(400);
    res.end('Bad request');
    return;
  }

  const resolved = path.resolve(snapshotsDir, String(session || ''), String(branch || ''), String(file || ''));
  const base = path.resolve(snapshotsDir) + path.sep;
  if (!resolved.startsWith(base) || !fs.existsSync(resolved)) {
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