/**
 * Shared DOM diff used by analyze_latest_mutations.js and server snapshot pipeline.
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

function compareTrees(node1, node2, pathStr) {
  const changes = [];

  const ignoreTags = ['SVG', 'SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME'];
  if (ignoreTags.includes(node1.nodeName.toUpperCase())) {
    return changes;
  }

  const attrs1 = node1.attributes || [];
  const attrs2 = node2.attributes || [];
  const a1Map = {};
  const a2Map = {};

  for (const a of attrs1) a1Map[a.name] = a.value;
  for (const a of attrs2) a2Map[a.name] = a.value;

  for (const key in a1Map) {
    if (key === 'id' && a1Map[key].includes('recharts')) continue;

    if (!(key in a2Map)) {
      changes.push(`[-] Attribute removed: '${key}' at [${pathStr}]`);
    } else if (a1Map[key] !== a2Map[key]) {
      changes.push(
        `[*] Attribute changed: '${key}' at [${pathStr}] ('${a1Map[key]}' -> '${a2Map[key]}')`
      );
    }
  }
  for (const key in a2Map) {
    if (!(key in a1Map)) {
      changes.push(`[+] Attribute added: '${key}'="${a2Map[key]}" at [${pathStr}]`);
    }
  }

  const c1 = Array.from(node1.childNodes).filter(
    n => n.nodeType === 1 || (n.nodeType === 3 && n.textContent.trim() !== '')
  );
  const c2 = Array.from(node2.childNodes).filter(
    n => n.nodeType === 1 || (n.nodeType === 3 && n.textContent.trim() !== '')
  );

  const maxLen = Math.max(c1.length, c2.length);
  for (let i = 0; i < maxLen; i++) {
    const child1 = c1[i];
    const child2 = c2[i];

    if (!child1) {
      changes.push(`[+] Node added: <${child2.nodeName}> at [${pathStr}]`);
    } else if (!child2) {
      changes.push(`[-] Node removed: <${child1.nodeName}> at [${pathStr}]`);
    } else if (child1.nodeType !== child2.nodeType || child1.nodeName !== child2.nodeName) {
      changes.push(
        `[*] Node replaced: <${child1.nodeName}> to <${child2.nodeName}> at [${pathStr}]`
      );
    } else if (child1.nodeType === 3) {
      if (child1.textContent.trim() !== child2.textContent.trim()) {
        changes.push(
          `[*] Text changed at [${pathStr}]: '${child1.textContent.trim()}' -> '${child2.textContent.trim()}'`
        );
      }
    } else {
      const childPath = `${pathStr} > ${child1.nodeName.toLowerCase()}:nth-child(${i + 1})`;
      changes.push(...compareTrees(child1, child2, childPath));
    }
  }

  return changes;
}

function compareBodiesFromHtml(prevHtml, currHtml) {
  const prevDOM = new JSDOM(prevHtml);
  const currDOM = new JSDOM(currHtml);
  return compareTrees(
    prevDOM.window.document.body,
    currDOM.window.document.body,
    'BODY'
  );
}

/**
 * Read combined latest.html and return the last captured page HTML inside the last .snap pre.
 */
function getLastSnapshotHtmlFromLatest(latestPath) {
  if (!fs.existsSync(latestPath)) return null;
  const raw = fs.readFileSync(latestPath, 'utf8');
  const dom = new JSDOM(raw);
  const pres = dom.window.document.querySelectorAll('.snap pre');
  if (!pres.length) return null;
  return pres[pres.length - 1].textContent;
}

/**
 * Append one mutation record to mutations/mutation_analysis.json (creates or merges file).
 */
function appendMutationEntry(branchDir, branchKey, { mutation_id, trigger, changes, interaction_context }, totalSnapshots) {
  const mutDir = path.join(branchDir, 'mutations');
  fs.mkdirSync(mutDir, { recursive: true });
  const filePath = path.join(mutDir, 'mutation_analysis.json');

  let payload = {
    directory: branchKey,
    analyzed_at: new Date().toISOString(),
    total_snapshots: totalSnapshots,
    total_mutations: 0,
    mutations: []
  };

  if (fs.existsSync(filePath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (existing && Array.isArray(existing.mutations)) {
        payload = {
          directory: branchKey,
          analyzed_at: existing.analyzed_at,
          total_snapshots: totalSnapshots,
          total_mutations: existing.mutations.length,
          mutations: existing.mutations.slice()
        };
      }
    } catch (_) {
      // overwrite with fresh below
    }
  }

  const entry = {
    mutation_id: String(mutation_id),
    trigger: String(trigger || ''),
    total_changes: changes.length,
    changes
  };
  if (interaction_context && typeof interaction_context === 'object') {
    entry.interaction_context = interaction_context;
  }

  payload.mutations.push(entry);
  payload.total_mutations = payload.mutations.length;
  payload.total_snapshots = totalSnapshots;
  payload.analyzed_at = new Date().toISOString();

  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
}

module.exports = {
  compareTrees,
  compareBodiesFromHtml,
  getLastSnapshotHtmlFromLatest,
  appendMutationEntry
};
