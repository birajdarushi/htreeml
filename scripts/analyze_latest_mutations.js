#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { compareTrees } = require('./mutation_compare');

/**
 * DOM Mutation Analyzer for latest.html files.
 * compareTrees matches the browser snippet (full text diffs, inlined attrs).
 */

class LatestDOMMutationAnalyzer {
  constructor(sessionDir, options = {}) {
    this.sessionDir = sessionDir;
    this.writeJson = options.writeJson === true;
  }

  yieldAsync() {
    return new Promise(resolve => setTimeout(resolve, 50));
  }

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

      const mutations = [];

      for (let i = 1; i < snapshots.length; i++) {
        await this.yieldAsync();

        const prevSnap = snapshots[i - 1];
        const currSnap = snapshots[i];

        const preElements = prevSnap.querySelectorAll('pre');
        if (preElements.length === 0) continue;

        const prevHTML = preElements[0].textContent;
        const currHTML = currSnap.querySelectorAll('pre')[0]?.textContent;

        if (!prevHTML || !currHTML) continue;

        const prevDOM = new JSDOM(prevHTML);
        const currDOM = new JSDOM(currHTML);

        const index = currSnap.getAttribute('data-index');
        const trigger = currSnap.getAttribute('data-trigger');

        const changes = compareTrees(
          prevDOM.window.document.body,
          currDOM.window.document.body,
          'BODY'
        );

        mutations.push({
          mutation_id: index != null ? String(index) : String(i),
          trigger: trigger != null ? trigger : '',
          total_changes: changes.length,
          changes
        });

        if (!this.writeJson) {
          console.groupCollapsed(
            `%cMutation #${index} (${trigger}) - ${changes.length} changes`,
            'color: #8b5cf6; font-weight: bold;'
          );
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
      }

      if (this.writeJson) {
        const outDir = path.join(this.sessionDir, directory, 'mutations');
        fs.mkdirSync(outDir, { recursive: true });
        const payload = {
          directory,
          analyzed_at: new Date().toISOString(),
          total_snapshots: snapshots.length,
          total_mutations: mutations.length,
          mutations
        };
        const outPath = path.join(outDir, 'mutation_analysis.json');
        fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf-8');
        console.log(`%c  Wrote ${outPath}`, 'color: #10b981; font-weight: bold;');
      }

      console.log(`%c  ✅ Complete!\n`, 'color: #10b981; font-weight: bold;');
    } catch (err) {
      console.error(`%c  ❌ Error: ${err.message}\n`, 'color: #ef4444;');
    }
  }

  findLatestHtmlFiles() {
    const dirs = fs
      .readdirSync(this.sessionDir)
      .filter(
        f =>
          f.startsWith('platform-') && fs.statSync(path.join(this.sessionDir, f)).isDirectory()
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

  async analyze() {
    console.log(
      `\n%c🔍 Analyzing Latest HTML Files for DOM Mutations\n`,
      'color: #3b82f6; font-weight: bold; font-size: 14px;'
    );

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

function parseCli(argv) {
  const args = argv.slice(2);
  const writeJson = args.includes('--write-json');
  const positional = args.filter(a => !a.startsWith('--'));
  const sessionDir =
    positional[0] ||
    '/Users/rushiraj/htreeml/server/snapshots/session_1774124147428_ecdhyl';
  return { sessionDir, writeJson };
}

if (require.main === module) {
  const { sessionDir, writeJson } = parseCli(process.argv);

  if (!fs.existsSync(sessionDir)) {
    console.error(`Error: Directory not found: ${sessionDir}`);
    process.exit(1);
  }

  const analyzer = new LatestDOMMutationAnalyzer(sessionDir, { writeJson });
  analyzer.analyze().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = LatestDOMMutationAnalyzer;
