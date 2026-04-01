/**
 * Index API Routes
 * 
 * Serves generated index files (index.md, POM .py) from server/index-output/
 */

const fs = require('fs');
const path = require('path');

const INDEX_OUTPUT_DIR = path.join(__dirname, '..', '..', 'index-output');

/**
 * Determine whether a URL path segment is safe for use in filesystem or route paths.
 *
 * @param {string} segment - The path segment to validate.
 * @returns {boolean} `true` if the segment contains no `..` and no path separators (`/` or `\`), `false` otherwise.
 */
function isValidSegment(segment) {
  return !(/\.\.|[/\\]/.test(segment));
}

/**
 * Send a JSON HTTP response with the given status code and payload.
 * @param {import('http').ServerResponse} res - The HTTP response object.
 * @param {number} status - HTTP status code to set on the response.
 * @param {*} data - The value to serialize to JSON for the response body.
 */
function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function sendText(res, status, content, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': contentType });
  res.end(content);
}

/**
 * GET /api/index
 * Returns a list of all indexed sessions and urlKeys
 */
function handleApiIndexList(req, res) {
  if (!fs.existsSync(INDEX_OUTPUT_DIR)) {
    sendJson(res, 200, { sessions: [], message: 'No indexes generated yet. Run: npm run index' });
    return;
  }

  const result = { sessions: [] };

  try {
    const sessions = fs.readdirSync(INDEX_OUTPUT_DIR);
    
    for (const sessionId of sessions) {
      const sessionPath = path.join(INDEX_OUTPUT_DIR, sessionId);
      if (!fs.statSync(sessionPath).isDirectory()) continue;

      const sessionEntry = {
        sessionId,
        pages: []
      };

      const urlKeys = fs.readdirSync(sessionPath);
      for (const urlKey of urlKeys) {
        const urlKeyPath = path.join(sessionPath, urlKey);
        if (!fs.statSync(urlKeyPath).isDirectory()) continue;

        const indexMdExists = fs.existsSync(path.join(urlKeyPath, 'index.md'));
        const pomFile = `pom_${urlKey}.py`;
        const pomExists = fs.existsSync(path.join(urlKeyPath, pomFile));

        sessionEntry.pages.push({
          urlKey,
          hasIndex: indexMdExists,
          hasPom: pomExists,
          pomFile: pomExists ? pomFile : null,
          paths: {
            index: `/api/index/${sessionId}/${urlKey}`,
            indexMd: `/api/index/${sessionId}/${urlKey}/index.md`,
            pom: pomExists ? `/api/index/${sessionId}/${urlKey}/${pomFile}` : null
          }
        });
      }

      if (sessionEntry.pages.length > 0) {
        result.sessions.push(sessionEntry);
      }
    }

    sendJson(res, 200, result);
  } catch (err) {
    sendJson(res, 500, { error: `Failed to list indexes: ${err.message}` });
  }
}

/**
 * Serve metadata for an index page identified by `sessionId` and `urlKey`.
 *
 * Validates `sessionId` and `urlKey` for unsafe path segments. If validation fails,
 * responds with HTTP 400. If the corresponding index directory does not exist,
 * responds with HTTP 404 and a hint to run the index generation. Otherwise responds
 * with HTTP 200 and a JSON object containing `sessionId`, `urlKey`, and `files`
 * metadata for `index.md` and the `pom_<urlKey>.py` file (existence flags and
 * public API paths; `pom.path` is `null` when missing).
 *
 * @param {string} sessionId - Session directory name; must not contain `..`, `/`, or `\`.
 * @param {string} urlKey - Page directory name within the session; must not contain `..`, `/`, or `\`.
 */
function handleApiIndexMeta(req, res, sessionId, urlKey) {
  // Validate segments to prevent path traversal
  if (!isValidSegment(sessionId) || !isValidSegment(urlKey)) {
    sendJson(res, 400, { error: 'Invalid path segment' });
    return;
  }

  const indexDir = path.join(INDEX_OUTPUT_DIR, sessionId, urlKey);
  
  if (!fs.existsSync(indexDir)) {
    sendJson(res, 404, { 
      error: 'Index not found',
      hint: 'Run: npm run index'
    });
    return;
  }

  const indexMdPath = path.join(indexDir, 'index.md');
  const pomFile = `pom_${urlKey}.py`;
  const pomPath = path.join(indexDir, pomFile);

  const result = {
    sessionId,
    urlKey,
    files: {
      indexMd: {
        exists: fs.existsSync(indexMdPath),
        path: `/api/index/${sessionId}/${urlKey}/index.md`
      },
      pom: {
        exists: fs.existsSync(pomPath),
        filename: pomFile,
        path: fs.existsSync(pomPath) ? `/api/index/${sessionId}/${urlKey}/${pomFile}` : null
      }
    }
  };

  sendJson(res, 200, result);
}

/**
 * Serve an index file for a given session and urlKey.
 *
 * Validates `sessionId`, `urlKey`, and `filename` for path-safety, restricts served files to
 * `index.md` or `pom_{urlKey}.py`, enforces that the resolved file path stays inside the
 * configured INDEX_OUTPUT_DIR, and streams the file content with an appropriate Content-Type.
 *
 * Possible HTTP responses:
 * - 200: file content (Content-Type: Markdown for `.md`, Python for `.py`, plain text otherwise)
 * - 400: invalid path segments or filename
 * - 403: file not allowed or access denied (path outside INDEX_OUTPUT_DIR)
 * - 404: file not found
 * - 500: failed to read file
 *
 * @param {import('http').IncomingMessage} req - The incoming HTTP request.
 * @param {import('http').ServerResponse} res - The HTTP response object used to send the result.
 * @param {string} sessionId - The session directory name under INDEX_OUTPUT_DIR; must be a safe path segment.
 * @param {string} urlKey - The urlKey directory name under the session; must be a safe path segment.
 * @param {string} filename - Requested filename (allowed: `index.md` or `pom_{urlKey}.py`).
 */
function handleApiIndexFile(req, res, sessionId, urlKey, filename) {
  // Security: prevent path traversal in all segments
  if (!isValidSegment(sessionId) || !isValidSegment(urlKey) ||
      filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    sendJson(res, 400, { error: 'Invalid filename' });
    return;
  }

  // Only allow specific files
  const allowedFiles = ['index.md', `pom_${urlKey}.py`];
  if (!allowedFiles.includes(filename)) {
    sendJson(res, 403, { 
      error: 'File not allowed',
      allowed: allowedFiles
    });
    return;
  }

  const filePath = path.join(INDEX_OUTPUT_DIR, sessionId, urlKey, filename);
  
  // Security: ensure we're still within INDEX_OUTPUT_DIR
  const resolvedPath = path.resolve(filePath);
  const base = path.resolve(INDEX_OUTPUT_DIR) + path.sep;
  if (!resolvedPath.startsWith(base)) {
    sendJson(res, 403, { error: 'Access denied' });
    return;
  }

  if (!fs.existsSync(filePath)) {
    sendJson(res, 404, { error: 'File not found' });
    return;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const contentType = filename.endsWith('.md') 
      ? 'text/markdown; charset=utf-8'
      : filename.endsWith('.py')
        ? 'text/x-python; charset=utf-8'
        : 'text/plain; charset=utf-8';
    
    sendText(res, 200, content, contentType);
  } catch (err) {
    sendJson(res, 500, { error: `Failed to read file: ${err.message}` });
  }
}

/**
 * Route handler for /api/index paths; dispatches to list, session listing, metadata, or file handlers based on the pathname.
 *
 * Supported routes:
 * - /api/index — lists all sessions
 * - /api/index/:sessionId — lists urlKeys for the session (returns 400 for invalid sessionId, 404 if session not found)
 * - /api/index/:sessionId/:urlKey — returns metadata for the urlKey
 * - /api/index/:sessionId/:urlKey/:filename — serves the requested file if allowed
 *
 * @param {import('http').IncomingMessage} req - The incoming HTTP request.
 * @param {import('http').ServerResponse} res - The HTTP response used to send results.
 * @param {string} pathname - The request pathname to route; expected forms are listed above.
 */
function handleIndexRoute(req, res, pathname) {
  // Parse the path: /api/index[/:sessionId[/:urlKey[/:filename]]]
  const match = pathname.match(/^\/api\/index(?:\/([^/]+))?(?:\/([^/]+))?(?:\/([^/]+))?$/);
  
  if (!match) {
    sendJson(res, 400, { error: 'Invalid index route' });
    return;
  }

  const [, sessionId, urlKey, filename] = match;

  // /api/index - list all
  if (!sessionId) {
    return handleApiIndexList(req, res);
  }

  // /api/index/:sessionId/:urlKey/:filename - get file content
  if (sessionId && urlKey && filename) {
    return handleApiIndexFile(req, res, sessionId, urlKey, filename);
  }

  // /api/index/:sessionId/:urlKey - get metadata
  if (sessionId && urlKey) {
    return handleApiIndexMeta(req, res, sessionId, urlKey);
  }

  // /api/index/:sessionId - list urlKeys for session
  if (!isValidSegment(sessionId)) {
    sendJson(res, 400, { error: 'Invalid path segment' });
    return;
  }

  const sessionPath = path.join(INDEX_OUTPUT_DIR, sessionId);
  if (!fs.existsSync(sessionPath)) {
    sendJson(res, 404, { error: 'Session not found' });
    return;
  }

  try {
    const urlKeys = fs.readdirSync(sessionPath)
      .filter(f => fs.statSync(path.join(sessionPath, f)).isDirectory());
    
    sendJson(res, 200, {
      sessionId,
      urlKeys,
      paths: urlKeys.map(uk => ({
        urlKey: uk,
        path: `/api/index/${sessionId}/${uk}`
      }))
    });
  } catch (err) {
    sendJson(res, 500, { error: `Failed to list session: ${err.message}` });
  }
}

module.exports = {
  handleIndexRoute
};
