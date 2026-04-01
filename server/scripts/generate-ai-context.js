#!/usr/bin/env node
/**
 * AI Context Pack Generator
 * 
 * Bundles all necessary files into a single context package for AI agents
 * to generate best-in-class POMs with full page understanding.
 */

const fs = require('fs');
const path = require('path');

const SERVER_DIR = path.join(__dirname, '..');
const OUTPUT_DIR = path.join(SERVER_DIR, 'index-output');
const BASE_PAGE_PATH = path.join(SERVER_DIR, 'scripts', 'base_page.py');

// ─────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

function listSessions() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    console.error('❌ Output directory not found:', OUTPUT_DIR);
    console.log('   Run `npm run index` first to generate indexes.');
    process.exit(1);
  }
  
  const sessions = fs.readdirSync(OUTPUT_DIR).filter(name => {
    const fullPath = path.join(OUTPUT_DIR, name);
    return fs.statSync(fullPath).isDirectory();
  });
  
  return sessions;
}

function listPages(sessionId) {
  const sessionDir = path.join(OUTPUT_DIR, sessionId);
  if (!fs.existsSync(sessionDir)) {
    return [];
  }
  
  return fs.readdirSync(sessionDir).filter(name => {
    const fullPath = path.join(sessionDir, name);
    return fs.statSync(fullPath).isDirectory();
  });
}

function readMarkdownIndex(sessionId, urlKey) {
  const indexPath = path.join(OUTPUT_DIR, sessionId, urlKey, 'index.md');
  if (!fs.existsSync(indexPath)) {
    return null;
  }
  return fs.readFileSync(indexPath, 'utf8');
}

function readPomSkeleton(sessionId, urlKey) {
  const pomFiles = fs.readdirSync(path.join(OUTPUT_DIR, sessionId, urlKey))
    .filter(f => f.startsWith('pom_') && f.endsWith('.py'));
  
  if (pomFiles.length === 0) return null;
  
  const pomPath = path.join(OUTPUT_DIR, sessionId, urlKey, pomFiles[0]);
  return fs.readFileSync(pomPath, 'utf8');
}

function readBasePage() {
  if (!fs.existsSync(BASE_PAGE_PATH)) {
    return null;
  }
  return fs.readFileSync(BASE_PAGE_PATH, 'utf8');
}

function sanitizeForFilename(str) {
  return str
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .toLowerCase();
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT PACK GENERATION
// ─────────────────────────────────────────────────────────────────────────────

function generateContextPack(sessionId, urlKey, outputPath) {
  console.log(`\n📦 Generating AI Context Pack for:`);
  console.log(`   Session: ${sessionId}`);
  console.log(`   Page: ${urlKey}\n`);
  
  // Gather components
  const basePage = readBasePage();
  const indexMd = readMarkdownIndex(sessionId, urlKey);
  const pomSkeleton = readPomSkeleton(sessionId, urlKey);
  
  if (!basePage) {
    console.error('❌ BasePage not found at:', BASE_PAGE_PATH);
    process.exit(1);
  }
  
  if (!indexMd) {
    console.error('❌ index.md not found for this page');
    process.exit(1);
  }
  
  // Build context pack
  let context = '';
  
  // Header
  context += `# AI AGENT CONTEXT PACK\n`;
  context += `# Generated: ${new Date().toISOString()}\n`;
  context += `# Page: ${urlKey}\n`;
  context += `# Session: ${sessionId}\n\n`;
  
  // Section 1: BasePage API
  context += `╔══════════════════════════════════════════════════════════════════════════╗\n`;
  context += `║ SECTION 1: BASEPAGE API CONTRACT                                        ║\n`;
  context += `║ INSTRUCTIONS: Use ONLY these methods in your generated POM              ║\n`;
  context += `╚══════════════════════════════════════════════════════════════════════════╝\n\n`;
  
  context += `File: base_page.py\n`;
  context += `─────────────────────────────────────────────────────────────────────────────\n\n`;
  context += basePage;
  context += `\n\n`;
  
  // Section 2: Page Documentation
  context += `╔══════════════════════════════════════════════════════════════════════════╗\n`;
  context += `║ SECTION 2: PAGE DOCUMENTATION                                           ║\n`;
  context += `║ INSTRUCTIONS: This is what the page looks like - implement all elements ║\n`;
  context += `╚══════════════════════════════════════════════════════════════════════════╝\n\n`;
  
  context += `File: index.md\n`;
  context += `─────────────────────────────────────────────────────────────────────────────\n\n`;
  context += indexMd;
  context += `\n\n`;
  
  // Section 3: Auto-generated Skeleton (if available)
  if (pomSkeleton) {
    context += `╔══════════════════════════════════════════════════════════════════════════╗\n`;
    context += `║ SECTION 3: AUTO-GENERATED SKELETON (REFERENCE)                          ║\n`;
    context += `║ INSTRUCTIONS: Use this as starting point, enhance with business logic   ║\n`;
    context += `╚══════════════════════════════════════════════════════════════════════════╝\n\n`;
    
    context += `File: pom_${sanitizeForFilename(urlKey)}.py\n`;
    context += `─────────────────────────────────────────────────────────────────────────────\n\n`;
    context += pomSkeleton;
    context += `\n\n`;
  }
  
  // Section 4: Generation Instructions
  context += `╔══════════════════════════════════════════════════════════════════════════╗\n`;
  context += `║ SECTION 4: AI AGENT INSTRUCTIONS                                        ║\n`;
  context += `╚══════════════════════════════════════════════════════════════════════════╝\n\n`;
  
  context += `## YOUR TASK\n\n`;
  context += `Generate a production-ready Playwright Page Object Model class.\n\n`;
  
  context += `## REQUIREMENTS\n\n`;
  context += `1. **Inheritance**: Your class MUST inherit from BasePage\n`;
  context += `   \`\`\`python\n`;
  context += `   class YourPageName(BasePage):\n`;
  context += `       def __init__(self, page: Page, base_url: Optional[str] = None):\n`;
  context += `           super().__init__(page, base_url)\n`;
  context += `   \`\`\`\n\n`;
  
  context += `2. **Method Usage**: Use ONLY methods defined in BasePage API:\n`;
  context += `   - self.click(locator, **kwargs)\n`;
  context += `   - self.fill(locator, value, **kwargs)\n`;
  context += `   - self.get_text(locator)\n`;
  context += `   - self.is_visible(locator, timeout=5000)\n`;
  context += `   - self.wait_for_element(locator, state="visible", timeout=30000)\n`;
  context += `   - self.get_attribute(locator, attribute)\n`;
  context += `   - self.select_option(locator, value, **kwargs)\n`;
  context += `   - self.check(locator, **kwargs)\n`;
  context += `   - self.uncheck(locator, **kwargs)\n`;
  context += `   - self.hover(locator, **kwargs)\n`;
  context += `   - self.focus(locator, **kwargs)\n`;
  context += `   - self.clear(locator, **kwargs)\n`;
  context += `   - self.navigate(url)\n`;
  context += `   - self.get_current_url()\n`;
  context += `   - self.get_page_title()\n`;
  context += `   - self.screenshot(path, **kwargs)\n\n`;
  
  context += `3. **Element Constants**: Define ALL element locators as class constants\n`;
  context += `   - Use naming convention: EL_<ELEMENT_NAME>\n`;
  context += `   - Prefer XPath for stability (from index.md)\n`;
  context += `   - Include data-testid when available\n\n`;
  
  context += `4. **Business Methods**: Create meaningful methods for user actions\n`;
  context += `   - Example: \`create_consumer(consumer_data)\` instead of just click/fill\n`;
  context += `   - Combine multiple steps into single method\n`;
  context += `   - Add validation/assertions\n\n`;
  
  context += `5. **Type Hints**: Always use Python type hints\n`;
  context += `   - Parameters: str, int, bool, Optional[str], Dict, List\n`;
  context += `   - Return types: -> None, -> str, -> bool\n\n`;
  
  context += `6. **Docstrings**: Every method must have a docstring\n`;
  context += `   \`\`\`python\n`;
  context += `   def my_method(self, param: str) -> bool:\n`;
  context += `       """Description of what method does.\n`;
  context += `       \n`;
  context += `       Args:\n`;
  context += `           param: Description of parameter\n`;
  context += `       \n`;
  context += `       Returns:\n`;
  context += `           Description of return value\n`;
  context += `       """\n`;
  context += `   \`\`\`\n\n`;
  
  context += `7. **Dropdown Handling**: Use information from "Dropdowns & Select Fields"\n`;
  context += `   - For native <select>: use self.select_option()\n`;
  context += `   - For custom dropdowns: click trigger, wait for options, click option\n`;
  context += `   - Reference the captured options from index.md\n\n`;
  
  context += `8. **Assertions**: Add validation methods\n`;
  context += `   - is_page_loaded() - check key elements visible\n`;
  context += `   - verify_success_message() - validate expected outcomes\n`;
  context += `   - assert_error_present() - negative test cases\n\n`;
  
  context += `## ELEMENT MAPPING\n\n`;
  context += `From the index.md, implement these elements:\n\n`;
  
  // Extract element summary from index.md
  const elementMatches = indexMd.match(/### \d+\. "([^"]+)".*?\| \*\*tag\*\* \| `([^`]+)` \|.*?\| \*\*xpath\*\* \| `([^`]+)` \|/gs);
  if (elementMatches) {
    context += `| Element Label | Tag | XPath |\n`;
    context += `|---------------|-----|-------|\n`;
    elementMatches.forEach(match => {
      const [, label, tag, xpath] = match.match(/### \d+\. "([^"]+)".*?\| \*\*tag\*\* \| `([^`]+)` \|.*?\| \*\*xpath\*\* \| `([^`]+)` \|(?:.*?\| \*\*css_selector\*\* \| `([^`]+)` \|)?/s) || [];
      if (label && tag && xpath) {
        const shortXpath = xpath.length > 60 ? xpath.slice(0, 57) + '...' : xpath;
        context += `| ${label} | ${tag} | \`${shortXpath}\` |\n`;
      }
    });
    context += `\n`;
  }
  
  // Dropdown summary
  const dropdownSection = indexMd.match(/## Dropdowns & Select Fields.*?(?=## |\Z)/s);
  if (dropdownSection && !dropdownSection[0].includes('No dropdowns')) {
    context += `## DROPDOWNS TO IMPLEMENT\n\n`;
    const dropdownMatches = dropdownSection[0].match(/### \d+\. "([^"]+)".*?\| \*\*type\*\* \| `([^`]+)` \|.*?\| \*\*option_count\*\* \| (\d+) \|(.*?)(?=###|$)/gs);
    if (dropdownMatches) {
      dropdownMatches.forEach(match => {
        const [, label, type, count] = match.match(/### \d+\. "([^"]+)".*?\| \*\*type\*\* \| `([^`]+)` \|.*?\| \*\*option_count\*\* \| (\d+) \|/) || [];
        if (label) {
          context += `- **${label}** (${type}, ${count} options)\n`;
        }
      });
    }
    context += `\n`;
  }
  
  // Write output
  fs.writeFileSync(outputPath, context, 'utf8');
  console.log(`✅ Context pack generated: ${outputPath}`);
  console.log(`   Size: ${(context.length / 1024).toFixed(1)} KB\n`);
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI INTERFACE
// ─────────────────────────────────────────────────────────────────────────────

function showHelp() {
  console.log(`
AI Context Pack Generator
=========================

Usage:
  node scripts/generate-ai-context.js [options]

Options:
  --session <id>     Session ID (required)
  --page <urlKey>    Page URL key (required)
  --output <path>    Output file path (default: ai-context-pack.md)
  --list             List all available sessions and pages
  --help             Show this help message

Examples:
  # List all sessions
  node scripts/generate-ai-context.js --list

  # Generate context pack for specific page
  node scripts/generate-ai-context.js \\
    --session session_1774987490873_sq30cl \\
    --page platform-new_bynry_com__cx__dashboard \\
    --output dashboard-pom-context.md

  # Use with AI agent
  node scripts/generate-ai-context.js \\
    --session session_1774987490873_sq30cl \\
    --page platform-new_bynry_com__cx__consumer-management__create__manual && \\
    cat ai-context-pack.md | your-ai-tool

`.trim());
}

function listAllPages() {
  const sessions = listSessions();
  
  console.log('\n📁 Available Sessions and Pages:\n');
  
  sessions.forEach(sessionId => {
    console.log(`Session: ${sessionId}`);
    const pages = listPages(sessionId);
    pages.forEach(page => {
      console.log(`  └─ ${page}`);
    });
    console.log('');
  });
  
  const totalPages = sessions.reduce((sum, sessionId) => sum + listPages(sessionId).length, 0);
  console.log(`Total: ${sessions.length} sessions, ${totalPages} pages\n`);
}

// Main execution
function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.length === 0) {
    showHelp();
    process.exit(0);
  }
  
  if (args.includes('--list')) {
    listAllPages();
    process.exit(0);
  }
  
  const sessionIdx = args.indexOf('--session');
  const pageIdx = args.indexOf('--page');
  const outputIdx = args.indexOf('--output');
  
  if (sessionIdx === -1 || pageIdx === -1) {
    console.error('❌ Error: --session and --page are required');
    showHelp();
    process.exit(1);
  }
  
  const sessionId = args[sessionIdx + 1];
  const urlKey = args[pageIdx + 1];
  const outputPath = outputIdx !== -1 ? args[outputIdx + 1] : 'ai-context-pack.md';
  
  generateContextPack(sessionId, urlKey, outputPath);
}

main();
