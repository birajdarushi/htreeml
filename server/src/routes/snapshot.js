const { saveSnapshot } = require('../services/snapshot-storage');

const MAX_BODY_BYTES = 5 * 1024 * 1024;

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function handleSnapshotPost(req, res) {
  let body = '';
  let responded = false;
  req.setEncoding('utf8');

  const timeout = setTimeout(() => {
    if (responded) return;
    responded = true;
    req.destroy();
    sendJson(res, 408, { error: 'Request timeout' });
  }, 10000);

  req.on('data', (chunk) => {
    if (responded) return;
    body += chunk;
    if (body.length > MAX_BODY_BYTES) {
      responded = true;
      clearTimeout(timeout);
      req.destroy();
      sendJson(res, 413, { error: 'Payload too large' });
    }
  });

  req.on('end', () => {
    if (responded) return;
    responded = true;
    clearTimeout(timeout);

    try {
      const payload = JSON.parse(body || '{}');
      if (!payload.url || payload.html === undefined) {
        sendJson(res, 400, {
          error: 'Missing required fields: url, html',
          detail: {
            sessionId: !!payload.sessionId,
            url: !!payload.url,
            html: payload.html !== undefined
          }
        });
        return;
      }

      const result = saveSnapshot(payload, req);
      sendJson(res, 200, { ok: true, ...result });
    } catch (err) {
      sendJson(res, 400, { error: `Invalid JSON: ${err.message}` });
    }
  });

  req.on('error', (err) => {
    if (responded) return;
    responded = true;
    clearTimeout(timeout);
    sendJson(res, 400, { error: `Request error: ${err.message}` });
  });
}

module.exports = {
  handleSnapshotPost,
  sendJson
};