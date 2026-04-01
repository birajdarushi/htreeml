#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Analyze only the latest.html file from each directory in the session
 */

class LatestHTMLAnalyzer {
  constructor(sessionDir) {
    this.sessionDir = sessionDir;
    this.analysis = [];
  }

  /**
   * Simple DOM parser for extracting statistics
   */
  static extractDOMStats(html) {
    const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const bodyContent = body ? body[1] : html;

    // Count tags
    const tags = {};
    const tagRegex = /<([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/gi;
    let match;
    while ((match = tagRegex.exec(bodyContent)) !== null) {
      const tag = match[1].toLowerCase();
      tags[tag] = (tags[tag] || 0) + 1;
    }

    // Extract text content
    let textContent = bodyContent
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .trim();

    const wordCount = textContent.split(/\s+/).filter(w => w).length;

    // Look for specific UI patterns
    const hasModal = /data-vaul-drawer|modal|dialog/i.test(html);
    const hasForm = /<form|<input|<textarea|<select/i.test(html);
    const hasTable = /<table|<tr|<td|<th/i.test(html);
    const hasButton = /<button/i.test(html);
    const hasInput = /<input/i.test(html);

    return {
      fileSize: html.length,
      bodySize: bodyContent.length,
      tagCount: Object.keys(tags).length,
      totalElements: Object.values(tags).reduce((sum, count) => sum + count, 0),
      tags: tags,
      textLength: textContent.length,
      wordCount: wordCount,
      features: {
        hasModal,
        hasForm,
        hasTable,
        hasButton,
        hasInput
      }
    };
  }

  /**
   * Get all latest.html files from subdirectories
   */
  findLatestHtmlFiles() {
    const dirs = fs.readdirSync(this.sessionDir)
      .filter(f => f.startsWith('platform-') && fs.statSync(path.join(this.sessionDir, f)).isDirectory());

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
   * Analyze all latest.html files
   */
  analyze() {
    console.log(`\n📊 Analyzing Latest HTML Files\n`);

    const latestFiles = this.findLatestHtmlFiles();
    console.log(`Found ${latestFiles.length} latest.html files\n`);

    latestFiles.forEach((file, idx) => {
      try {
        const html = fs.readFileSync(file.path, 'utf-8');
        const stats = LatestHTMLAnalyzer.extractDOMStats(html);

        this.analysis.push({
          directory: file.directory,
          path: file.path,
          stats: stats
        });

        console.log(`${idx + 1}. ${file.directory}`);
        console.log(`   ├─ File Size: ${(stats.fileSize / 1024).toFixed(2)} KB`);
        console.log(`   ├─ Total Elements: ${stats.totalElements}`);
        console.log(`   ├─ Unique Tags: ${stats.tagCount}`);
        console.log(`   ├─ Text Words: ${stats.wordCount}`);
        console.log(`   └─ Features: ${Object.entries(stats.features)
          .filter(([, v]) => v)
          .map(([k]) => k.replace('has', ''))
          .join(', ')}\n`);

      } catch (err) {
        console.error(`❌ Error analyzing ${file.directory}: ${err.message}\n`);
      }
    });

    // Generate reports
    this.generateReports();
  }

  /**
   * Generate summary reports
   */
  generateReports() {
    const outputDir = path.join(this.sessionDir, 'latest-html-analysis');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Master JSON report
    const masterReport = {
      generated_at: new Date().toISOString(),
      total_directories: this.analysis.length,
      analysis: this.analysis.map(a => ({
        directory: a.directory,
        stats: a.stats
      }))
    };

    fs.writeFileSync(
      path.join(outputDir, 'latest-analysis-report.json'),
      JSON.stringify(masterReport, null, 2)
    );

    // CSV summary
    let csv = 'Directory,File Size (KB),Total Elements,Unique Tags,Word Count,Has Modal,Has Form,Has Table,Has Button,Has Input\n';
    this.analysis.forEach(a => {
      csv += `"${a.directory}",${(a.stats.fileSize / 1024).toFixed(2)},${a.stats.totalElements},${a.stats.tagCount},${a.stats.wordCount},${a.stats.features.hasModal},${a.stats.features.hasForm},${a.stats.features.hasTable},${a.stats.features.hasButton},${a.stats.features.hasInput}\n`;
    });

    fs.writeFileSync(
      path.join(outputDir, 'latest-analysis-summary.csv'),
      csv
    );

    // Markdown report
    let md = `# Latest HTML Analysis Report\n\n`;
    md += `**Generated:** ${new Date().toLocaleString()}\n`;
    md += `**Total Flows Analyzed:** ${this.analysis.length}\n\n`;

    md += `## Summary Statistics\n\n`;
    const avgFileSize = this.analysis.reduce((sum, a) => sum + a.stats.fileSize, 0) / this.analysis.length;
    const avgElements = this.analysis.reduce((sum, a) => sum + a.stats.totalElements, 0) / this.analysis.length;
    const avgWords = this.analysis.reduce((sum, a) => sum + a.stats.wordCount, 0) / this.analysis.length;

    md += `- **Average File Size:** ${(avgFileSize / 1024).toFixed(2)} KB\n`;
    md += `- **Average Total Elements:** ${Math.round(avgElements)}\n`;
    md += `- **Average Word Count:** ${Math.round(avgWords)}\n\n`;

    md += `## Detailed Analysis\n\n`;
    this.analysis.forEach((a, idx) => {
      md += `### ${idx + 1}. ${a.directory}\n`;
      md += `- **File Size:** ${(a.stats.fileSize / 1024).toFixed(2)} KB\n`;
      md += `- **Total Elements:** ${a.stats.totalElements}\n`;
      md += `- **Unique Tags:** ${a.stats.tagCount}\n`;
      md += `- **Text Content:** ${a.stats.wordCount} words\n`;
      md += `- **UI Features:**\n`;
      md += `  - Modal/Drawer: ${a.stats.features.hasModal ? '✅' : '❌'}\n`;
      md += `  - Forms: ${a.stats.features.hasForm ? '✅' : '❌'}\n`;
      md += `  - Tables: ${a.stats.features.hasTable ? '✅' : '❌'}\n`;
      md += `  - Buttons: ${a.stats.features.hasButton ? '✅' : '❌'}\n`;
      md += `  - Input Fields: ${a.stats.features.hasInput ? '✅' : '❌'}\n`;
      md += `- **Top Elements:**\n`;

      const sorted = Object.entries(a.stats.tags)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      sorted.forEach(([tag, count]) => {
        md += `  - \`${tag}\`: ${count}\n`;
      });
      md += `\n`;
    });

    fs.writeFileSync(
      path.join(outputDir, 'latest-analysis-report.md'),
      md
    );

    console.log(`\n✨ Analysis complete!\n`);
    console.log(`📁 Reports generated in: ${outputDir}\n`);
    console.log(`📋 Files created:`);
    console.log(`   - latest-analysis-report.json`);
    console.log(`   - latest-analysis-report.md`);
    console.log(`   - latest-analysis-summary.csv\n`);
  }
}

// Main execution
if (require.main === module) {
  const sessionDir = process.argv[2] || '/Users/rushiraj/htreeml/server/snapshots/session_1773989880829_0kdqkf';

  if (!fs.existsSync(sessionDir)) {
    console.error(`Error: Directory not found: ${sessionDir}`);
    process.exit(1);
  }

  const analyzer = new LatestHTMLAnalyzer(sessionDir);
  analyzer.analyze();
}

module.exports = LatestHTMLAnalyzer;
