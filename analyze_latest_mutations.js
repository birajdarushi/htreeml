#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

/**
 * DOM Mutation Analyzer for latest.html files
 * Uses the provided analyzeDomMutations() and compareTrees() functions
 */

class LatestDOMMutationAnalyzer {
  constructor(sessionDir) {
    this.sessionDir = sessionDir;
  }

  /**
   * Compare attributes between two nodes
   */
  compareAttributes(node1, node2, path) {
    const changes = [];
    const attrs1 = node1.attributes || [];
    const attrs2 = node2.attributes || [];
    const a1Map = {};
    const a2Map = {};

    for (let a of attrs1) a1Map[a.name] = a.value;
    for (let a of attrs2) a2Map[a.name] = a.value;

    for (let key in a1Map) {
      // Skip noisy dynamic IDs
      if (key === 'id' && a1Map[key].includes('recharts')) continue;

      if (!(key in a2Map)) {
        changes.push(`[-] Attribute removed: '${key}' at [${path}]`);
      } else if (a1Map[key] !== a2Map[key]) {
        changes.push(
          `[*] Attribute changed: '${key}' at [${path}] ('${a1Map[key]}' -> '${a2Map[key]}')`
        );
      }
    }
    for (let key in a2Map) {
      if (!(key in a1Map)) {
        changes.push(`[+] Attribute added: '${key}'="${a2Map[key]}" at [${path}]`);
      }
    }

    return changes;
  }

  /**
   * Recursively compare DOM trees with pruning for heavy nodes
   */
  compareTrees(node1, node2, path) {
    let changes = [];

    // PRUNING: Skip extremely heavy or irrelevant nodes
    const ignoreTags = ['SVG', 'SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME'];
    if (ignoreTags.includes(node1.nodeName.toUpperCase())) {
      return changes;
    }

    // Compare Attributes
    changes.push(...this.compareAttributes(node1, node2, path));

    // Filter out whitespace-only text nodes
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
        changes.push(`[+] Node added: <${child2.nodeName}> at [${path}]`);
      } else if (!child2) {
        changes.push(`[-] Node removed: <${child1.nodeName}> at [${path}]`);
      } else if (
        child1.nodeType !== child2.nodeType ||
        child1.nodeName !== child2.nodeName
      ) {
        changes.push(
          `[*] Node replaced: <${child1.nodeName}> to <${child2.nodeName}> at [${path}]`
        );
      } else if (child1.nodeType === 3) {
        // Text node
        if (child1.textContent.trim() !== child2.textContent.trim()) {
          const txt1 = child1.textContent.trim().substring(0, 50);
          const txt2 = child2.textContent.trim().substring(0, 50);
          changes.push(
            `[*] Text changed at [${path}]: '${txt1}...' -> '${txt2}...'`
          );
        }
      } else {
        // Recurse down element children
        const childPath = `${path} > ${child1.nodeName.toLowerCase()}:nth-child(${
          i + 1
        })`;
        changes.push(...this.compareTrees(child1, child2, childPath));
      }
    }

    return changes;
  }

  /**
   * Analyze DOM mutations from latest.html (async version with console-only output)
   */
  async analyzeDomMutations(latestHtml, directory) {
    try {
      const dom = new JSDOM(latestHtml);
      const document = dom.window.document;
      const snapshots = document.querySelectorAll('.snap');

      console.log(`%c  Analyzing ${directory}...`, 'color: #3b82f6; font-weight: bold;');
      console.log(`%c  Found ${snapshots.length} snapshots`, 'color: #10b981;');

      if (snapshots.length < 2) {
        console.log(`%c  ⚠️  Need at least 2 snapshots to compare\n`, 'color: #fbbf24;');
        return;
      }

      for (let i = 1; i < snapshots.length; i++) {
        // Yield to prevent freezing and allow memory cleanup
        await new Promise(resolve => setImmediate(resolve));

        const prevSnap = snapshots[i - 1];
        const currSnap = snapshots[i];

        // Extract the raw HTML strings
        const preElements = prevSnap.querySelectorAll('pre');
        if (preElements.length === 0) continue;

        const prevHTML = preElements[0].textContent;
        const currHTML = currSnap.querySelectorAll('pre')[0]?.textContent;

        if (!prevHTML || !currHTML) continue;

        // Parse into DOM documents
        const prevDOM = new JSDOM(prevHTML);
        const currDOM = new JSDOM(currHTML);

        const index = currSnap.getAttribute('data-index');
        const trigger = currSnap.getAttribute('data-trigger');

        // Compare the <body> recursively
        const changes = this.compareTrees(
          prevDOM.window.document.body,
          currDOM.window.document.body,
          'BODY'
        );

        // Output to console with grouping
        console.groupCollapsed(`%cMutation #${index} (${trigger}) - ${changes.length} changes`, 'color: #8b5cf6; font-weight: bold;');
        if (changes.length === 0) {
          console.log('%cNo changes detected.', 'color: #9ca3af;');
        } else {
          changes.slice(0, 50).forEach(change => console.log(change));
          if (changes.length > 50) {
            console.log(`%c... and ${changes.length - 50} more changes`, 'color: #9ca3af;');
          }
        }
        console.groupEnd();
      }

      console.log(`%c  ✅ Complete!\n`, 'color: #10b981; font-weight: bold;');
    } catch (err) {
      console.error(`%c  ❌ Error: ${err.message}\n`, 'color: #ef4444;');
    }
  }

  /**
   * Find all latest.html files in subdirectories
   */
  findLatestHtmlFiles() {
    const dirs = fs.readdirSync(this.sessionDir)
      .filter(f => 
        f.startsWith('platform-') && 
        fs.statSync(path.join(this.sessionDir, f)).isDirectory()
      );

    const latestFiles = [];

    dirs.forEach(dir => {
      const latestPath = path.join(this.sessionDir, dir, 'latest.html');
      if (fs.existsSync(latestPath)) {
        latestFiles.push({
          directory: dir,
          path: latestPath
        });
      }
    });

    return latestFiles;
  }

  /**
   * Main analysis function (async, console-only)
   */
  async analyze() {
    console.log(`\n%c🔍 Analyzing Latest HTML Files for DOM Mutations\n`, 'color: #3b82f6; font-weight: bold; font-size: 14px;');

    const latestFiles = this.findLatestHtmlFiles();
    console.log(`Found ${latestFiles.length} latest.html files\n`);

    for (let idx = 0; idx < latestFiles.length; idx++) {
      const file = latestFiles[idx];
      try {
        const html = fs.readFileSync(file.path, 'utf-8');
        await this.analyzeDomMutations(html, file.directory);
      } catch (err) {
        console.error(`%c  ❌ Error reading file: ${err.message}\n`, 'color: #ef4444;');
      }
    }

    console.log(`\n%c✨ All analyses complete!\n`, 'color: #10b981; font-weight: bold; font-size: 14px;');
  }
}

// Main execution
if (require.main === module) {
  const sessionDir =
    process.argv[2] ||
    '/Users/rushiraj/htreeml/server/snapshots/session_1773989880829_0kdqkf';

  if (!fs.existsSync(sessionDir)) {
    console.error(`Error: Directory not found: ${sessionDir}`);
    process.exit(1);
  }

  const analyzer = new LatestDOMMutationAnalyzer(sessionDir);
  analyzer.analyze().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = LatestDOMMutationAnalyzer;
