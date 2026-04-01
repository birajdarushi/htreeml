const http = require('http');
const path = require('path');
const fs = require('fs');
const url = require('url');

const { loadTreeFromDisk, getSnapshotsDir } = require('./services/snapshot-storage');
const { handleSnapshotPost } = require('./routes/snapshot');
const { handleApiTree, handleApiSnapshots, handleApiFile, handlePing } = require('./routes/api');
const { handleIndexRoute } = require('./routes/index-api');

const PORT = 7700;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// Initialize state
loadTreeFromDisk();

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Dom-Client-Id');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // Routes
  if (req.method === 'GET' && pathname === '/ping') {
    return handlePing(req, res);
  }

  if (req.method === 'POST' && pathname === '/snapshot') {
    return handleSnapshotPost(req, res);
  }

  if (req.method === 'GET' && pathname === '/api/tree') {
    return handleApiTree(req, res);
  }

  if (req.method === 'GET' && pathname === '/api/snapshots') {
    return handleApiSnapshots(req, res, parsedUrl);
  }

  if (req.method === 'GET' && pathname === '/api/file') {
    return handleApiFile(req, res, parsedUrl);
  }

  // Index API routes
  if (req.method === 'GET' && pathname.startsWith('/api/index')) {
    return handleIndexRoute(req, res, pathname);
  }

  // Static File Serving — strip leading slash and enforce path stays under PUBLIC_DIR
  const safeName = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const publicBase = path.resolve(PUBLIC_DIR) + path.sep;
  const staticPath = path.resolve(PUBLIC_DIR, safeName);
  if (staticPath.startsWith(publicBase) && fs.existsSync(staticPath) && fs.statSync(staticPath).isFile()) {
    const ext = path.extname(staticPath);
    const types = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css'
    };
    res.writeHead(200, { 'Content-Type': types[ext] || 'text/plain' });
    fs.createReadStream(staticPath).pipe(res);
    return;
  }

  const indexPath = path.join(PUBLIC_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    fs.createReadStream(indexPath).pipe(res);
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log('');
  console.log('DOM Tree Capture Server (Modularized)');
  console.log(`Running   : http://localhost:${PORT}`);
  console.log(`Snapshots : ${getSnapshotsDir()}`);
  console.log('');
});
