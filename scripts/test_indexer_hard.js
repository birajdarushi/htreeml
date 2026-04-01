const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SNAPSHOTS_ROOT = path.join(__dirname, '..', 'server', 'snapshots');
const INDEX_OUTPUT_ROOT = path.join(__dirname, '..', 'server', 'index-output');

// Helper to create directory
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Helper to write JSON
function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Helper to write HTML
function writeHtml(file, content) {
  fs.writeFileSync(file, content);
}

function setupTestData() {
  console.log('--- Setting up "Hard" Test Data ---');

  // Clean up previous test data if any
  if (fs.existsSync(SNAPSHOTS_ROOT)) {
    // We don't want to delete user data, so let's use a specific test session prefix
  }

  const TEST_SESSIONS = {
    'session_standard': 'example_com__home',
    'session_unicode': 'unicode_test__🚀__你好',
    'session_corrupt': 'corrupt_page',
    'session_trail_A': 'trail__page1',
    'session_trail_B': 'trail__page2', // Will be in same session
    'session_massive': 'performance_test'
  };

  // 1. Standard Session
  const s1 = 'session_standard_123';
  const b1 = 'example_com__home';
  const d1 = path.join(SNAPSHOTS_ROOT, s1, b1);
  ensureDir(d1);
  const m1 = {
    urlKey: b1,
    url: 'https://example.com/',
    title: 'Standard Home',
    snapshots: [
      {
        index: 0,
        trigger: 'page-load',
        timestamp: Date.now() - 10000,
        filename: 'latest.html',
        fullFilename: '0000_page-load.html'
      }
    ]
  };
  writeJson(path.join(d1, 'meta.json'), m1);
  writeHtml(path.join(d1, '0000_page-load.html'), '<html><body><button id="btn1">Click Me</button></body></html>');
  writeHtml(path.join(d1, 'latest.ai.html'), '<html><body><button id="btn1">Click Me</button></body></html>');
  writeHtml(path.join(d1, 'latest.html'), '<html><body><button id="btn1">Click Me</button></body></html>');

  // 2. Unicode & Long Titles
  const s2 = 'session_unicode_456';
  const b2 = 'unicode_test__rocket__nihao';
  const d2 = path.join(SNAPSHOTS_ROOT, s2, b2);
  ensureDir(d2);
  const m2 = {
    urlKey: b2,
    url: 'https://unicode.test/🚀/你好',
    title: 'Unicode Page 🚀 你好 ' + 'A'.repeat(200),
    snapshots: [
      {
        index: 0,
        trigger: 'page-load',
        timestamp: Date.now() - 5000,
        filename: 'latest.html'
      }
    ]
  };
  writeJson(path.join(d2, 'meta.json'), m2);
  writeHtml(path.join(d2, 'latest.ai.html'), '<html><body><button>🚀 Submit 你好</button></body></html>');
  writeHtml(path.join(d2, 'latest.html'), '<html><body><button>🚀 Submit 你好</button></body></html>');

  // 3. Corrupt / Edge Cases
  const s3 = 'session_corrupt_789';
  const b3 = 'corrupt_page';
  const d3 = path.join(SNAPSHOTS_ROOT, s3, b3);
  ensureDir(d3);
  // Missing meta.json entirely in one branch
  ensureDir(path.join(SNAPSHOTS_ROOT, s3, 'missing_meta'));
  
  // Broken meta.json
  fs.writeFileSync(path.join(d3, 'meta.json'), '{ "broken": true, '); // Invalid JSON

  // 4. Trail Reconstruction
  const s4 = 'session_trail_999';
  const b4a = 'trail__page1';
  const b4b = 'trail__page2';
  const d4a = path.join(SNAPSHOTS_ROOT, s4, b4a);
  const d4b = path.join(SNAPSHOTS_ROOT, s4, b4b);
  ensureDir(d4a);
  ensureDir(d4b);
  
  const ts_start = Date.now() - 20000;
  
  const m4a = {
    urlKey: b4a,
    url: 'https://trail.com/p1',
    title: 'Page 1',
    snapshots: [
      { index: 0, trigger: 'page-load', timestamp: ts_start, filename: 'latest.html' },
      { 
        index: 1, 
        trigger: 'user-click', 
        timestamp: ts_start + 5000, 
        filename: 'latest.html',
        interactionContext: {
          clickData: { name: 'Go to Page 2', fullXpath: '/html/body/a' }
        }
      }
    ]
  };
  const m4b = {
    urlKey: b4b,
    url: 'https://trail.com/p2',
    title: 'Page 2',
    snapshots: [
      { index: 0, trigger: 'navigation', timestamp: ts_start + 6000, filename: 'latest.html' }
    ]
  };
  writeJson(path.join(d4a, 'meta.json'), m4a);
  writeHtml(path.join(d4a, 'latest.ai.html'), '<html><body><a href="/p2">Go to Page 2</a></body></html>');
  writeHtml(path.join(d4a, 'latest.html'), '<html><body><a href="/p2">Go to Page 2</a></body></html>');
  
  writeJson(path.join(d4b, 'meta.json'), m4b);
  writeHtml(path.join(d4b, 'latest.ai.html'), '<html><body><h1>Welcome to Page 2</h1></body></html>');
  writeHtml(path.join(d4b, 'latest.html'), '<html><body><h1>Welcome to Page 2</h1></body></html>');

  // 5. Massive Element Set
  const s5 = 'session_massive_000';
  const b5 = 'performance_test';
  const d5 = path.join(SNAPSHOTS_ROOT, s5, b5);
  ensureDir(d5);
  
  let manyButtons = '';
  for(let i=0; i<500; i++) {
    manyButtons += `<button id="btn_${i}" data-testid="test-${i}">Button ${i} ${'X'.repeat(i % 20)}</button>\n`;
  }
  
  const m5 = {
    urlKey: b5,
    url: 'https://massive.test/',
    title: 'Massive Page',
    snapshots: [
      { index: 0, trigger: 'page-load', timestamp: Date.now(), filename: 'latest.html' }
    ]
  };
  writeJson(path.join(d5, 'meta.json'), m5);
  writeHtml(path.join(d5, 'latest.ai.html'), `<html><body>${manyButtons}</body></html>`);
  writeHtml(path.join(d5, 'latest.html'), `<html><body>${manyButtons}</body></html>`);

  console.log('--- Test Data Ready ---');
}

function runIndexer() {
  console.log('\n--- Running Indexer ---');
  try {
    const output = execSync('npm run index:force', { encoding: 'utf8' });
    console.log(output);
  } catch (err) {
    console.error('Indexer FAILED:');
    console.error(err.stdout);
    console.error(err.stderr);
  }
}

function verifyOutputs() {
  console.log('\n--- Verifying Outputs ---');
  
  const sessions = fs.readdirSync(INDEX_OUTPUT_ROOT);
  console.log(`Found ${sessions.length} sessions in index-output`);

  sessions.forEach(s => {
    const sPath = path.join(INDEX_OUTPUT_ROOT, s);
    const branches = fs.readdirSync(sPath);
    branches.forEach(b => {
      const bPath = path.join(sPath, b);
      const files = fs.readdirSync(bPath);
      console.log(`  [${s}] [${b}] -> Files: ${files.join(', ')}`);
      
      if (files.includes('index.md')) {
        const content = fs.readFileSync(path.join(bPath, 'index.md'), 'utf8');
        if (content.length < 100) console.warn(`    ⚠ index.md looks too small (${content.length} bytes)`);
      }
      
      if (files.some(f => f.startsWith('pom_'))) {
        const pomFile = files.find(f => f.startsWith('pom_'));
        const content = fs.readFileSync(path.join(bPath, pomFile), 'utf8');
        if (content.length < 100) console.warn(`    ⚠ ${pomFile} looks too small (${content.length} bytes)`);
      }
    });
  });
}

function testApi() {
  console.log('\n--- Testing API Routes (Mocking req/res) ---');
  const { handleIndexRoute } = require('../server/src/routes/index-api');
  
  const mockRes = {
    writeHead: (status, headers) => { console.log(`    API Status: ${status}, Headers: ${JSON.stringify(headers)}`); },
    end: (content) => { 
        console.log(`    API Body Length: ${content.length}`);
        try {
            const json = JSON.parse(content);
            if (json.sessions) console.log(`    API Sessions Found: ${json.sessions.length}`);
            if (json.urlKeys) console.log(`    API URL Keys Found: ${json.urlKeys.length}`);
        } catch(e) {}
    }
  };

  console.log('  Testing GET /api/index');
  handleIndexRoute({ method: 'GET' }, mockRes, '/api/index');
}

setupTestData();
runIndexer();
verifyOutputs();
testApi();
