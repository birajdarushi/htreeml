#!/usr/bin/env node
/**
 * DOM Snapshot Indexer
 * 
 * Reads captured snapshot data from server/snapshots/ and produces:
 *   - Output A: Navigation Index (.md) - Human-readable page documentation
 *   - Output B: POM Python Skeleton (.py) - Playwright page object model
 * 
 * Usage:
 *   node server/scripts/indexer.js [--force]
 * 
 * Output:
 *   server/index-output/{sessionId}/{urlKey}/
 *     ├── index.md
 *     └── pom_{urlKey}.py
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

const SNAPSHOTS_DIR = path.join(__dirname, '..', 'snapshots');
const OUTPUT_DIR = path.join(__dirname, '..', 'index-output');
const FORCE_FLAG = process.argv.includes('--force');

// Interactive element selectors
const INTERACTIVE_SELECTORS = [
  'button',
  'a[href]',
  'input',
  'select',
  'textarea',
  '[role="button"]',
  '[role="link"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="switch"]',
  '[role="combobox"]',
  '[role="listbox"]',
  '[role="option"]',
  '[onclick]',
  '[data-testid]',
  '[data-cy]',
  '[data-qa]'
];

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

function log(message) {
  console.log(`[INDEXER] ${message}`);
}

function warn(message) {
  console.warn(`[INDEXER] ⚠ ${message}`);
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function urlKeyToClassName(urlKey) {
  // Convert urlKey to PascalCase class name
  // e.g., app_example_com__dashboard__orders -> AppExampleComDashboardOrdersPage
  return urlKey
    .split(/[_]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('') + 'Page';
}

function urlKeyToHumanName(urlKey, title) {
  if (title && title !== 'Untitled' && title.trim()) {
    return title.trim();
  }
  // Convert urlKey to human-readable name
  return urlKey
    .replace(/__/g, ' / ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapePythonString(str) {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

// ─────────────────────────────────────────────────────────────────────────────
// LOCATOR GENERATION
// ─────────────────────────────────────────────────────────────────────────────

function getElementLabel(element) {
  // Priority: aria-label > visible text > placeholder > title > alt > name
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel?.trim()) return ariaLabel.trim();

  const text = element.textContent?.trim().replace(/\s+/g, ' ');
  if (text && text.length <= 100) return text;

  const placeholder = element.getAttribute('placeholder');
  if (placeholder?.trim()) return placeholder.trim();

  const title = element.getAttribute('title');
  if (title?.trim()) return title.trim();

  const alt = element.getAttribute('alt');
  if (alt?.trim()) return alt.trim();

  const name = element.getAttribute('name');
  if (name?.trim()) return `[name: ${name.trim()}]`;

  const id = element.getAttribute('id');
  if (id?.trim()) return `[id: ${id.trim()}]`;

  return `[${element.tagName.toLowerCase()}]`;
}

function generateCssSelector(element, document) {
  // Priority: ID > data-testid > unique class > combined selectors
  const id = element.getAttribute('id');
  if (id && !id.match(/^[0-9]/) && !id.includes(':')) {
    // Validate uniqueness
    try {
      if (document.querySelectorAll(`#${CSS.escape(id)}`).length === 1) {
        return `#${id}`;
      }
    } catch (e) {
      // Invalid selector, skip
    }
  }

  // Check data-testid, data-cy, data-qa
  for (const attr of ['data-testid', 'data-cy', 'data-qa']) {
    const value = element.getAttribute(attr);
    if (value) {
      const selector = `[${attr}="${value}"]`;
      try {
        if (document.querySelectorAll(selector).length === 1) {
          return selector;
        }
      } catch (e) {
        // Invalid selector
      }
    }
  }

  // Try name attribute for inputs
  const name = element.getAttribute('name');
  if (name) {
    const tag = element.tagName.toLowerCase();
    const selector = `${tag}[name="${name}"]`;
    try {
      if (document.querySelectorAll(selector).length === 1) {
        return selector;
      }
    } catch (e) {
      // Invalid selector
    }
  }

  // Try unique class combination
  const classes = Array.from(element.classList || [])
    .filter(c => !c.match(/^[0-9]/) && !c.includes(':') && c.length < 50);
  
  if (classes.length > 0) {
    const tag = element.tagName.toLowerCase();
    for (let i = 1; i <= Math.min(classes.length, 3); i++) {
      const classCombo = classes.slice(0, i).map(c => `.${c}`).join('');
      const selector = `${tag}${classCombo}`;
      try {
        if (document.querySelectorAll(selector).length === 1) {
          return selector;
        }
      } catch (e) {
        // Invalid selector
      }
    }
  }

  // Fall back to positional selector (less stable)
  return generatePositionalCssSelector(element);
}

function generatePositionalCssSelector(element) {
  const parts = [];
  let current = element;
  
  while (current && current.tagName && current.tagName !== 'HTML') {
    const tag = current.tagName.toLowerCase();
    const parent = current.parentElement;
    
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        el => el.tagName === current.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        parts.unshift(`${tag}:nth-of-type(${index})`);
      } else {
        parts.unshift(tag);
      }
    } else {
      parts.unshift(tag);
    }
    
    current = parent;
  }
  
  return parts.join(' > ');
}

function generateAbsoluteXPath(element) {
  const parts = [];
  let current = element;
  
  while (current && current.nodeType === 1) {
    const tag = current.tagName;
    if (tag === 'HTML') {
      parts.unshift('/html[1]');
      break;
    }
    
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        el => el.tagName === tag
      );
      const index = siblings.indexOf(current) + 1;
      parts.unshift(`/${tag.toLowerCase()}[${index}]`);
    } else {
      parts.unshift(`/${tag.toLowerCase()}[1]`);
    }
    
    current = parent;
  }
  
  return parts.join('');
}

function generateRelativeXPath(element, document) {
  const tag = element.tagName.toLowerCase();
  
  // Try ID-based XPath
  const id = element.getAttribute('id');
  if (id && !id.includes('"')) {
    return `//*[@id="${id}"]`;
  }
  
  // Try data-testid based XPath
  for (const attr of ['data-testid', 'data-cy', 'data-qa']) {
    const value = element.getAttribute(attr);
    if (value && !value.includes('"')) {
      return `//*[@${attr}="${value}"]`;
    }
  }
  
  // Try text-based XPath for buttons, links, labels
  const text = element.textContent?.trim().replace(/\s+/g, ' ');
  if (text && text.length <= 50 && !text.includes('"') && !text.includes("'")) {
    const xpathText = `//${tag}[normalize-space()='${text}']`;
    try {
      const result = document.evaluate(
        xpathText, document, null, 
        7, // XPathResult.ORDERED_NODE_SNAPSHOT_TYPE
        null
      );
      if (result.snapshotLength === 1) {
        return xpathText;
      }
    } catch (e) {
      // XPath evaluation failed
    }
    
    // Try contains for partial match
    if (text.length > 10) {
      const shortText = text.slice(0, 30);
      const xpathContains = `//${tag}[contains(normalize-space(),'${shortText}')]`;
      try {
        const result = document.evaluate(
          xpathContains, document, null, 7, null
        );
        if (result.snapshotLength === 1) {
          return xpathContains;
        }
      } catch (e) {
        // Skip
      }
    }
  }
  
  // Try aria-label based XPath
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel && !ariaLabel.includes('"')) {
    return `//${tag}[@aria-label="${ariaLabel}"]`;
  }
  
  // Try name attribute for form elements
  const name = element.getAttribute('name');
  if (name && !name.includes('"')) {
    return `//${tag}[@name="${name}"]`;
  }
  
  // Try placeholder for inputs
  const placeholder = element.getAttribute('placeholder');
  if (placeholder && !placeholder.includes('"')) {
    return `//${tag}[@placeholder="${placeholder}"]`;
  }
  
  // Try role + text combination
  const role = element.getAttribute('role');
  if (role && text && text.length <= 30 && !text.includes('"')) {
    return `//*[@role="${role}"][normalize-space()='${text}']`;
  }
  
  // Mark as unstable if no good strategy found
  return null;
}

function extractElementInfo(element, document, index) {
  const tag = element.tagName.toLowerCase();
  const label = getElementLabel(element);
  const role = element.getAttribute('role') || '';
  const id = element.getAttribute('id') || '';
  const name = element.getAttribute('name') || '';
  const dataTestid = element.getAttribute('data-testid') || 
                     element.getAttribute('data-cy') || 
                     element.getAttribute('data-qa') || '';
  
  const cssSelector = generateCssSelector(element, document);
  const xpathAbsolute = generateAbsoluteXPath(element);
  const xpathRelative = generateRelativeXPath(element, document);
  
  return {
    index,
    label,
    tag,
    role,
    id,
    name,
    dataTestid,
    cssSelector,
    xpathAbsolute,
    xpathRelative: xpathRelative || `⚠ UNSTABLE — no id/text/aria, positional only: ${xpathAbsolute}`,
    isStable: !!xpathRelative
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SNAPSHOT PARSING
// ─────────────────────────────────────────────────────────────────────────────

function parseHtmlFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  
  try {
    const html = fs.readFileSync(filePath, 'utf8');
    const dom = new JSDOM(html);
    return dom.window.document;
  } catch (err) {
    warn(`Failed to parse HTML: ${filePath} - ${err.message}`);
    return null;
  }
}

function extractInteractiveElements(document) {
  if (!document || !document.body) return [];
  
  const selector = INTERACTIVE_SELECTORS.join(', ');
  const elements = Array.from(document.querySelectorAll(selector));
  
  // Deduplicate and filter out hidden/empty elements
  const seen = new Set();
  const results = [];
  
  elements.forEach((el, idx) => {
    // Skip hidden elements
    const style = el.getAttribute('style') || '';
    if (style.includes('display: none') || style.includes('display:none')) return;
    if (el.getAttribute('hidden') !== null) return;
    if (el.getAttribute('aria-hidden') === 'true') return;
    
    // Skip elements with no content or purpose
    const hasContent = el.textContent?.trim() || 
                       el.getAttribute('aria-label') ||
                       el.getAttribute('placeholder') ||
                       el.getAttribute('title') ||
                       el.getAttribute('name') ||
                       el.getAttribute('id');
    
    if (!hasContent && el.tagName !== 'INPUT' && el.tagName !== 'BUTTON') return;
    
    // Create a unique key to dedupe
    const key = `${el.tagName}:${el.getAttribute('id') || ''}:${el.textContent?.slice(0, 50) || ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    
    results.push(extractElementInfo(el, document, idx));
  });
  
  return results;
}

function extractClickedElement(document, interactionContext) {
  if (!interactionContext?.clickData) return null;
  
  const { clickData } = interactionContext;
  const result = {
    label: clickData.name || clickData.target || 'Unknown element',
    xpath: clickData.fullXpath || '',
    relativeXpath: clickData.relativeXpath || ''
  };
  
  // Try to get more info from the actual element if xpath is available
  if (clickData.fullXpath && document) {
    try {
      const el = document.evaluate(
        clickData.fullXpath, document, null,
        9, // XPathResult.FIRST_ORDERED_NODE_TYPE
        null
      ).singleNodeValue;
      
      if (el) {
        result.tag = el.tagName?.toLowerCase() || '';
        result.id = el.getAttribute?.('id') || '';
        result.role = el.getAttribute?.('role') || '';
        result.ariaLabel = el.getAttribute?.('aria-label') || '';
        if (!result.label || result.label === 'Unknown element') {
          result.label = getElementLabel(el);
        }
      }
    } catch (e) {
      // XPath evaluation failed
    }
  }
  
  return result;
}

function loadApiEvents(branchDir) {
  const apiEventsFile = path.join(branchDir, 'api-events.ndjson');
  if (!fs.existsSync(apiEventsFile)) return [];
  
  try {
    const content = fs.readFileSync(apiEventsFile, 'utf8');
    return content
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        try {
          return JSON.parse(line);
        } catch (e) {
          return null;
        }
      })
      .filter(Boolean);
  } catch (err) {
    warn(`Failed to read API events: ${err.message}`);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DROPDOWN & SELECT EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────

function extractDropdownsAndSelects(document, branch) {
  const dropdowns = [];
  
  if (!document) return dropdowns;
  
  // 1. Extract native <select> elements with their options
  const selectElements = document.querySelectorAll('select');
  selectElements.forEach((select, idx) => {
    const options = Array.from(select.querySelectorAll('option')).map(opt => ({
      value: opt.value || '',
      text: opt.textContent?.trim() || '',
      selected: opt.selected
    }));
    
    if (options.length > 0) {
      dropdowns.push({
        type: 'native-select',
        label: select.getAttribute('aria-label') || 
               select.getAttribute('name') || 
               select.getAttribute('id') || 
               `Select ${idx + 1}`,
        id: select.getAttribute('id') || '',
        name: select.getAttribute('name') || '',
        xpath: generateAbsoluteXPath(select),
        cssSelector: generateCssSelector(select, document),
        options,
        optionCount: options.length
      });
    }
  });
  
  // 2. Extract custom dropdown triggers (combobox, listbox triggers)
  const comboboxTriggers = document.querySelectorAll('[role="combobox"], [aria-haspopup="listbox"], [aria-haspopup="menu"]');
  comboboxTriggers.forEach((trigger, idx) => {
    const label = getElementLabel(trigger);
    const dropdown = {
      type: 'custom-dropdown',
      label,
      id: trigger.getAttribute('id') || '',
      ariaExpanded: trigger.getAttribute('aria-expanded'),
      ariaControls: trigger.getAttribute('aria-controls') || '',
      xpath: generateAbsoluteXPath(trigger),
      xpathRelative: generateRelativeXPath(trigger, document) || generateAbsoluteXPath(trigger),
      cssSelector: generateCssSelector(trigger, document),
      options: [], // Will be populated from open overlays or listbox
      optionCount: 0
    };
    
    // Try to find associated listbox by aria-controls
    if (dropdown.ariaControls) {
      const listbox = document.getElementById(dropdown.ariaControls);
      if (listbox) {
        const options = extractListboxOptions(listbox);
        dropdown.options = options;
        dropdown.optionCount = options.length;
      }
    }
    
    dropdowns.push(dropdown);
  });
  
  // 3. Extract visible listboxes/menus (open dropdowns captured in snapshot)
  const openListboxes = document.querySelectorAll('[role="listbox"]:not([hidden]), [role="menu"]:not([hidden])');
  openListboxes.forEach((listbox) => {
    const rect = listbox.getBoundingClientRect?.() || { width: 100, height: 100 };
    if (rect.width < 2 && rect.height < 2) return;
    
    const options = extractListboxOptions(listbox);
    if (options.length > 0) {
      // Find the trigger for this listbox
      const listboxId = listbox.getAttribute('id');
      const trigger = listboxId ? document.querySelector(`[aria-controls="${listboxId}"]`) : null;
      
      dropdowns.push({
        type: 'open-listbox',
        label: trigger ? getElementLabel(trigger) : 'Open Dropdown',
        role: listbox.getAttribute('role'),
        xpath: generateAbsoluteXPath(listbox),
        options,
        optionCount: options.length,
        capturedWhileOpen: true
      });
    }
  });
  
  // 4. Extract from interaction context (openOverlays in metadata)
  if (branch?.snapshots) {
    branch.snapshots.forEach(snap => {
      if (snap.interactionContext?.openOverlays?.openMenus) {
        snap.interactionContext.openOverlays.openMenus.forEach(menu => {
          if (menu.items && menu.items.length > 0) {
            const existingIdx = dropdowns.findIndex(d => 
              d.type === 'captured-overlay' && d.kind === menu.kind
            );
            
            if (existingIdx === -1) {
              dropdowns.push({
                type: 'captured-overlay',
                kind: menu.kind,
                label: `${menu.kind} (captured at snapshot #${snap.index})`,
                capturedAt: snap.timestamp,
                trigger: snap.trigger,
                options: menu.items.map(item => ({
                  text: item.text || '',
                  value: item.value || '',
                  disabled: item.disabled || false
                })),
                optionCount: menu.itemCount || menu.items.length
              });
            }
          }
        });
      }
    });
  }
  
  return dropdowns;
}

function extractListboxOptions(listbox) {
  const options = [];
  const optionEls = listbox.querySelectorAll('[role="option"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [data-radix-collection-item]');
  
  optionEls.forEach(opt => {
    const text = opt.textContent?.trim().replace(/\s+/g, ' ').slice(0, 200) || '';
    if (text) {
      options.push({
        text,
        value: opt.getAttribute('data-value') || opt.getAttribute('value') || '',
        disabled: opt.getAttribute('aria-disabled') === 'true' || opt.hasAttribute('data-disabled'),
        selected: opt.getAttribute('aria-selected') === 'true' || opt.hasAttribute('data-state') && opt.getAttribute('data-state') === 'checked'
      });
    }
  });
  
  return options;
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 1: PARSE SNAPSHOT TREE
// ─────────────────────────────────────────────────────────────────────────────

function loadSnapshotTree() {
  const tree = {};
  
  if (!fs.existsSync(SNAPSHOTS_DIR)) {
    warn(`Snapshots directory not found: ${SNAPSHOTS_DIR}`);
    return tree;
  }
  
  const sessions = fs.readdirSync(SNAPSHOTS_DIR);
  
  for (const sessionId of sessions) {
    const sessionPath = path.join(SNAPSHOTS_DIR, sessionId);
    if (!fs.statSync(sessionPath).isDirectory()) continue;
    
    tree[sessionId] = {};
    const branches = fs.readdirSync(sessionPath);
    
    for (const urlKey of branches) {
      const branchPath = path.join(sessionPath, urlKey);
      if (!fs.statSync(branchPath).isDirectory()) continue;
      
      const metaPath = path.join(branchPath, 'meta.json');
      if (!fs.existsSync(metaPath)) continue;
      
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        tree[sessionId][urlKey] = {
          ...meta,
          branchPath,
          sessionId,
          urlKey
        };
      } catch (err) {
        warn(`Failed to parse meta.json: ${metaPath}`);
      }
    }
  }
  
  return tree;
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2: TRAIL RECONSTRUCTION
// ─────────────────────────────────────────────────────────────────────────────

function buildSessionTimeline(sessionBranches) {
  // Sort branches by their first snapshot timestamp
  const timeline = Object.entries(sessionBranches)
    .map(([urlKey, branch]) => {
      const firstSnapshot = branch.snapshots?.[0];
      return {
        urlKey,
        branch,
        firstTimestamp: firstSnapshot?.timestamp || 0,
        firstTrigger: firstSnapshot?.trigger || 'unknown'
      };
    })
    .filter(item => item.firstTimestamp > 0)
    .sort((a, b) => a.firstTimestamp - b.firstTimestamp);
  
  return timeline;
}

function findNavigationSource(timeline, currentIndex, sessionBranches) {
  if (currentIndex === 0) {
    return { isEntryPoint: true };
  }
  
  const currentItem = timeline[currentIndex];
  const currentFirstTs = currentItem.firstTimestamp;
  
  // Look at all previous branches to find the click that led here
  for (let i = currentIndex - 1; i >= 0; i--) {
    const prevItem = timeline[i];
    const prevBranch = prevItem.branch;
    
    if (!prevBranch.snapshots) continue;
    
    // Find user-click snapshots that occurred before current page's first snapshot
    const clickSnapshots = prevBranch.snapshots
      .filter(snap => 
        snap.trigger === 'user-click' && 
        snap.timestamp < currentFirstTs
      )
      .sort((a, b) => b.timestamp - a.timestamp); // Most recent first
    
    if (clickSnapshots.length > 0) {
      const clickSnapshot = clickSnapshots[0];
      
      // Try to load the HTML to extract clicked element info
      let clickedElement = null;
      if (clickSnapshot.interactionContext) {
        // Parse the snapshot HTML to get element details
        const snapshotFile = clickSnapshot.fullFilename || clickSnapshot.filename;
        const htmlPath = path.join(prevBranch.branchPath, snapshotFile);
        const document = parseHtmlFile(htmlPath);
        clickedElement = extractClickedElement(document, clickSnapshot.interactionContext);
      }
      
      return {
        isEntryPoint: false,
        sourcePage: prevItem.urlKey,
        sourcePageTitle: prevBranch.title || prevItem.urlKey,
        trigger: clickSnapshot.trigger,
        timestamp: clickSnapshot.timestamp,
        clickedElement
      };
    }
    
    // Check for navigation triggers
    const navSnapshots = prevBranch.snapshots
      .filter(snap => 
        snap.trigger === 'navigation' && 
        snap.timestamp < currentFirstTs
      )
      .sort((a, b) => b.timestamp - a.timestamp);
    
    if (navSnapshots.length > 0) {
      return {
        isEntryPoint: false,
        sourcePage: prevItem.urlKey,
        sourcePageTitle: prevBranch.title || prevItem.urlKey,
        trigger: 'navigation',
        timestamp: navSnapshots[0].timestamp,
        clickedElement: null
      };
    }
  }
  
  // If we can't find source, check if this was a direct page-load
  if (currentItem.firstTrigger === 'page-load') {
    return { isEntryPoint: true, trigger: 'page-load' };
  }
  
  return { isEntryPoint: true, trigger: currentItem.firstTrigger };
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 3: ELEMENT EXTRACTION WITH APPEARANCE TRACKING
// ─────────────────────────────────────────────────────────────────────────────

function extractElementsWithAppearance(branch) {
  const { branchPath, snapshots } = branch;
  
  if (!snapshots || snapshots.length === 0) {
    return [];
  }
  
  // Find page-load snapshot
  const pageLoadSnapshot = snapshots.find(s => s.trigger === 'page-load');
  
  // Parse latest.ai.html for current elements
  const latestAiPath = path.join(branchPath, 'latest.ai.html');
  const latestDocument = parseHtmlFile(latestAiPath);
  
  if (!latestDocument) {
    // Fall back to latest.html
    const latestPath = path.join(branchPath, 'latest.html');
    const doc = parseHtmlFile(latestPath);
    if (!doc) return [];
  }
  
  // Extract all interactive elements from latest
  const latestElements = extractInteractiveElements(latestDocument);
  
  // If we have a page-load snapshot, check what appeared later
  if (pageLoadSnapshot) {
    const pageLoadFile = pageLoadSnapshot.fullFilename || pageLoadSnapshot.filename;
    const pageLoadPath = path.join(branchPath, pageLoadFile);
    const pageLoadDocument = parseHtmlFile(pageLoadPath);
    
    if (pageLoadDocument) {
      const pageLoadElements = extractInteractiveElements(pageLoadDocument);
      const pageLoadSignatures = new Set(
        pageLoadElements.map(el => `${el.tag}:${el.id}:${el.label.slice(0, 30)}`)
      );
      
      // Mark elements that appeared after page-load
      latestElements.forEach(el => {
        const sig = `${el.tag}:${el.id}:${el.label.slice(0, 30)}`;
        if (!pageLoadSignatures.has(sig)) {
          // Find which snapshot this element first appeared in
          for (const snap of snapshots) {
            if (snap === pageLoadSnapshot) continue;
            
            const snapFile = snap.fullFilename || snap.filename;
            const snapPath = path.join(branchPath, snapFile);
            const snapDoc = parseHtmlFile(snapPath);
            
            if (snapDoc) {
              const snapElements = extractInteractiveElements(snapDoc);
              const found = snapElements.some(
                se => `${se.tag}:${se.id}:${se.label.slice(0, 30)}` === sig
              );
              
              if (found) {
                el.appearedAfter = snap.trigger;
                el.appearedInSnapshot = snap.index;
                break;
              }
            }
          }
        }
      });
    }
  }
  
  return latestElements;
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 4: OUTPUT GENERATION
// ─────────────────────────────────────────────────────────────────────────────

function generateIndexMd(branch, navSource, elements, apiEvents, timeline, dropdowns = []) {
  const { urlKey, url, title, pathname, sessionId, snapshots } = branch;
  const firstSnapshot = snapshots?.[0];
  const humanName = urlKeyToHumanName(urlKey, title);

  let md = `# ${humanName}\n\n`;
  
  // PAGE IDENTITY
  md += `## Page Identity\n\n`;
  md += `| Field | Value |\n`;
  md += `|-------|-------|\n`;
  md += `| **Page Name** | ${humanName} |\n`;
  md += `| **Full URL** | ${url || 'N/A'} |\n`;
  md += `| **Pathname** | ${pathname || '/'} |\n`;
  md += `| **URL Key** | \`${urlKey}\` |\n`;
  md += `| **Session ID** | \`${sessionId}\` |\n`;
  md += `| **First Seen** | ${firstSnapshot ? new Date(firstSnapshot.timestamp).toISOString() : 'N/A'} |\n`;
  md += `| **Total Snapshots** | ${snapshots?.length || 0} |\n\n`;
  
  // NAVIGATION TRAIL
  md += `## Navigation Trail\n\n`;
  if (navSource.isEntryPoint) {
    md += `\`\`\`\n`;
    md += `[ENTRY POINT] ${urlKey} (${navSource.trigger || 'direct-load'})\n`;
    md += `  └─ User navigated directly to this page or it was the first page in session\n`;
    md += `\`\`\`\n\n`;
  } else {
    md += `\`\`\`\n`;
    md += `[START] ${navSource.sourcePage}\n`;
    if (navSource.clickedElement) {
      const el = navSource.clickedElement;
      md += `  └─ Clicked: "${el.label}"`;
      if (el.tag) md += ` (${el.tag})`;
      if (el.role) md += ` [role="${el.role}"]`;
      md += `\n`;
      md += `      → opened: ${urlKey}\n`;
    } else {
      md += `  └─ ${navSource.trigger} → opened: ${urlKey}\n`;
    }
    md += `\`\`\`\n\n`;
  }
  
  // DROPDOWNS & SELECT FIELDS (NEW SECTION)
  md += `## Dropdowns & Select Fields (${dropdowns.length})\n\n`;
  
  if (dropdowns.length === 0) {
    md += `_No dropdowns or select fields found on this page._\n\n`;
  } else {
    dropdowns.forEach((dd, idx) => {
      md += `### ${idx + 1}. "${dd.label}"\n\n`;
      md += `| Property | Value |\n`;
      md += `|----------|-------|\n`;
      md += `| **type** | \`${dd.type}\` |\n`;
      if (dd.id) md += `| **id** | \`${dd.id}\` |\n`;
      if (dd.name) md += `| **name** | \`${dd.name}\` |\n`;
      if (dd.xpath) md += `| **xpath** | \`${dd.xpath}\` |\n`;
      if (dd.xpathRelative) md += `| **xpath_relative** | \`${dd.xpathRelative}\` |\n`;
      if (dd.cssSelector) md += `| **css_selector** | \`${dd.cssSelector}\` |\n`;
      md += `| **option_count** | ${dd.optionCount} |\n`;
      if (dd.capturedWhileOpen) md += `| **captured_open** | ✅ Yes |\n`;
      md += `\n`;
      
      // List options if available
      if (dd.options && dd.options.length > 0) {
        md += `**Available Options:**\n\n`;
        md += `| # | Text | Value | Status |\n`;
        md += `|---|------|-------|--------|\n`;
        dd.options.slice(0, 50).forEach((opt, optIdx) => {
          const status = opt.selected ? '✅ Selected' : (opt.disabled ? '⛔ Disabled' : '');
          const text = (opt.text || '').slice(0, 60);
          const value = (opt.value || '').slice(0, 30);
          md += `| ${optIdx + 1} | ${text} | \`${value}\` | ${status} |\n`;
        });
        if (dd.options.length > 50) {
          md += `| ... | _${dd.options.length - 50} more options_ | | |\n`;
        }
        md += `\n`;
      } else {
        md += `_Options not captured. Click the dropdown during capture to record values._\n\n`;
      }
    });
  }
  
  // ELEMENTS ON THIS PAGE
  md += `## Interactive Elements (${elements.length})\n\n`;

  if (elements.length === 0) {
    md += `_No interactive elements found on this page._\n\n`;
  } else {
    elements.forEach((el, idx) => {
      md += `### ${idx + 1}. "${el.label}"\n\n`;
      md += `| Locator Strategy | Value |\n`;
      md += `|-----------------|-------|\n`;
      md += `| **tag** | \`${el.tag}\` |\n`;
      if (el.role) md += `| **role** | \`${el.role}\` |\n`;
      if (el.id) md += `| **id** | \`${el.id}\` |\n`;
      if (el.name) md += `| **name** | \`${el.name}\` |\n`;
      if (el.dataTestid) md += `| **data-testid** | \`${el.dataTestid}\` |\n`;
      md += `| **css_selector** | \`${el.cssSelector}\` |\n`;
      md += `| **xpath** | \`${el.xpathAbsolute}\` |\n`;
      md += `| **xpath_relative** | \`${el.xpathRelative}\` |\n`;
      if (el.appearedAfter) {
        md += `| **appeared_after** | ${el.appearedAfter} (snapshot #${el.appearedInSnapshot}) |\n`;
      }
      md += `\n`;
    });
  }

  // API CALLS
  md += `## API Calls Observed (${apiEvents.length})\n\n`;
  
  if (apiEvents.length === 0) {
    md += `_No API calls captured for this page._\n\n`;
  } else {
    md += `| Method | Endpoint | Status | Triggered By |\n`;
    md += `|--------|----------|--------|-------------|\n`;
    
    // Group by unique method+url, show first occurrence
    const seen = new Set();
    apiEvents.forEach(event => {
      const key = `${event.method}:${event.url}`;
      if (seen.has(key)) return;
      seen.add(key);
      
      // Try to correlate with snapshot
      const triggeredBy = snapshots?.find(s => 
        Math.abs(s.timestamp - event.timestamp) < 2000
      )?.trigger || 'auto';
      
      // Truncate long URLs
      const shortUrl = event.url.length > 60 
        ? event.url.slice(0, 57) + '...' 
        : event.url;
      
      md += `| ${event.method} | \`${shortUrl}\` | ${event.status} | ${triggeredBy} |\n`;
    });
    md += `\n`;
  }
  
  // SNAPSHOT TIMELINE
  md += `## Snapshot Timeline\n\n`;
  md += `| # | Trigger | Timestamp | Has API Calls |\n`;
  md += `|---|---------|-----------|---------------|\n`;
  
  (snapshots || []).forEach(snap => {
    const time = new Date(snap.timestamp).toLocaleTimeString();
    const hasApi = snap.apiCallCount > 0 ? `Yes (${snap.apiCallCount})` : 'No';
    md += `| ${snap.index} | ${snap.trigger} | ${time} | ${hasApi} |\n`;
  });
  md += `\n`;
  
  return md;
}

function generatePomPython(branch, navSource, elements) {
  const { urlKey, url, title, pathname } = branch;
  const className = urlKeyToClassName(urlKey);
  const humanName = urlKeyToHumanName(urlKey, title);
  
  // Build docstring
  let reachedBy = 'Direct navigation or entry point';
  if (!navSource.isEntryPoint && navSource.clickedElement) {
    reachedBy = `After clicking '${navSource.clickedElement.label}' on ${navSource.sourcePageTitle || navSource.sourcePage}`;
  } else if (!navSource.isEntryPoint) {
    reachedBy = `Via ${navSource.trigger} from ${navSource.sourcePageTitle || navSource.sourcePage}`;
  }
  
  let py = `"""
Page Object Model for: ${humanName}
Auto-generated by DOM Snapshot Indexer
"""

from base_page import BasePage


class ${className}(BasePage):
    """
    URL      : ${url || 'N/A'}
    Pathname : ${pathname || '/'}
    Reached  : ${reachedBy}
    """

    # ══════════════════════════════════════════════════════════════════════════
    # LOCATORS
    # ══════════════════════════════════════════════════════════════════════════
`;

  // Generate locator constants
  const locatorDefs = [];
  const actionMethods = [];
  const stableElements = elements.filter(el => el.isStable);
  
  stableElements.forEach((el, idx) => {
    // Generate a constant name from the element label
    const constName = generateConstantName(el);
    
    // Prefer relative XPath, fall back to CSS
    let locator = el.xpathRelative;
    let locatorComment = '';
    
    if (!el.isStable || el.xpathRelative.includes('UNSTABLE')) {
      locator = el.cssSelector;
      locatorComment = '  # CSS fallback - no stable XPath available';
    }
    
    locatorDefs.push({
      name: constName,
      value: locator,
      comment: locatorComment,
      element: el
    });
  });
  
  // Write locator constants
  if (locatorDefs.length === 0) {
    py += `    # No stable interactive elements found on this page\n`;
    py += `    pass\n`;
  } else {
    locatorDefs.forEach(loc => {
      py += `    ${loc.name} = "${escapePythonString(loc.value)}"${loc.comment}\n`;
    });
  }
  
  py += `
    # ══════════════════════════════════════════════════════════════════════════
    # ACTIONS
    # ══════════════════════════════════════════════════════════════════════════

    def navigate_to(self):
        """Navigate directly to this page."""
        self.navigate("${url || 'about:blank'}")
`;

  // Generate action methods for key elements
  locatorDefs.forEach(loc => {
    const el = loc.element;
    const methodName = generateMethodName(el);
    
    if (el.tag === 'button' || el.role === 'button' || el.tag === 'a') {
      py += `
    def click_${methodName}(self):
        """Click the '${el.label.slice(0, 40)}' ${el.tag}."""
        self.click(self.${loc.name})
`;
    } else if (el.tag === 'input' && el.role !== 'checkbox' && el.role !== 'radio') {
      py += `
    def fill_${methodName}(self, value: str):
        """Fill the '${el.label.slice(0, 40)}' input field."""
        self.fill(self.${loc.name}, value)
`;
    } else if (el.tag === 'select' || el.role === 'combobox' || el.role === 'listbox') {
      py += `
    def select_${methodName}(self, value: str):
        """Select an option from the '${el.label.slice(0, 40)}' dropdown."""
        self.select_option(self.${loc.name}, value)
`;
    } else if (el.tag === 'input' && (el.role === 'checkbox' || el.role === 'radio')) {
      py += `
    def toggle_${methodName}(self):
        """Toggle the '${el.label.slice(0, 40)}' ${el.role || el.tag}."""
        self.click(self.${loc.name})
`;
    }
  });
  
  // Add visibility helpers
  py += `
    # ══════════════════════════════════════════════════════════════════════════
    # ASSERTIONS / VISIBILITY
    # ══════════════════════════════════════════════════════════════════════════

    def is_page_loaded(self) -> bool:
        """Check if the page has loaded by verifying key elements are visible."""
`;
  
  if (locatorDefs.length > 0) {
    py += `        return self.is_visible(self.${locatorDefs[0].name})\n`;
  } else {
    py += `        return True  # No key elements to check\n`;
  }
  
  return py;
}

function generateConstantName(element) {
  const { tag, label, role, id, name } = element;
  
  // Determine prefix based on element type
  let prefix = 'EL';
  if (tag === 'button' || role === 'button') prefix = 'BTN';
  else if (tag === 'a' || role === 'link') prefix = 'LNK';
  else if (tag === 'input') prefix = 'TXT';
  else if (tag === 'select' || role === 'combobox') prefix = 'SEL';
  else if (tag === 'textarea') prefix = 'TXA';
  else if (role === 'tab') prefix = 'TAB';
  else if (role === 'menuitem') prefix = 'MNU';
  else if (role === 'checkbox') prefix = 'CHK';
  else if (role === 'radio') prefix = 'RAD';
  
  // Generate suffix from label, id, or name
  let suffix = '';
  if (id) {
    suffix = id;
  } else if (name) {
    suffix = name;
  } else if (label && !label.startsWith('[')) {
    suffix = label.slice(0, 30);
  } else {
    suffix = `${tag}_${element.index}`;
  }
  
  // Convert to SCREAMING_SNAKE_CASE
  suffix = suffix
    .replace(/[^a-zA-Z0-9\s_-]/g, '')
    .replace(/[\s-]+/g, '_')
    .toUpperCase()
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  
  return `${prefix}_${suffix || 'UNKNOWN'}`;
}

function generateMethodName(element) {
  const { label, id, name, tag } = element;
  
  let base = '';
  if (id) {
    base = id;
  } else if (name) {
    base = name;
  } else if (label && !label.startsWith('[')) {
    base = label.slice(0, 25);
  } else {
    base = `${tag}_${element.index}`;
  }
  
  // Convert to snake_case
  return base
    .replace(/[^a-zA-Z0-9\s_-]/g, '')
    .replace(/[\s-]+/g, '_')
    .toLowerCase()
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXECUTION
// ─────────────────────────────────────────────────────────────────────────────

function processSession(sessionId, sessionBranches) {
  log(`Processing session: ${sessionId}`);
  
  const timeline = buildSessionTimeline(sessionBranches);
  
  timeline.forEach((item, idx) => {
    const { urlKey, branch } = item;
    const outputDir = path.join(OUTPUT_DIR, sessionId, urlKey);
    
    // Check if already processed (unless --force)
    if (fs.existsSync(outputDir) && !FORCE_FLAG) {
      log(`  ${urlKey} → SKIPPED (already exists, use --force to regenerate)`);
      return;
    }
    
    // Phase 2: Find navigation source
    const navSource = findNavigationSource(timeline, idx, sessionBranches);
    
    // Phase 3: Extract elements
    const elements = extractElementsWithAppearance(branch);
    
    // Load API events
    const apiEvents = loadApiEvents(branch.branchPath);
    
    // Phase 3b: Extract dropdowns and select fields
    const latestAiPath = path.join(branch.branchPath, 'latest.ai.html');
    const latestPath = path.join(branch.branchPath, 'latest.html');
    const document = parseHtmlFile(latestAiPath) || parseHtmlFile(latestPath);
    const dropdowns = extractDropdownsAndSelects(document, branch);
    
    // Phase 4: Generate outputs
    ensureDir(outputDir);
    
    const indexMd = generateIndexMd(branch, navSource, elements, apiEvents, timeline, dropdowns);
    fs.writeFileSync(path.join(outputDir, 'index.md'), indexMd, 'utf8');
    
    const pomPy = generatePomPython(branch, navSource, elements);
    fs.writeFileSync(path.join(outputDir, `pom_${urlKey}.py`), pomPy, 'utf8');
    
    log(`  session=${sessionId.slice(0, 12)}  urlKey=${urlKey.slice(0, 48)} → DONE`);
  });
}

function main() {
  log('DOM Snapshot Indexer starting...');
  log(`Snapshots directory: ${SNAPSHOTS_DIR}`);
  log(`Output directory: ${OUTPUT_DIR}`);
  log(`Force mode: ${FORCE_FLAG ? 'ON' : 'OFF'}`);
  log('');
  
  // Phase 1: Load snapshot tree
  const tree = loadSnapshotTree();
  const sessionCount = Object.keys(tree).length;
  
  if (sessionCount === 0) {
    log('No snapshots found. Capture some pages first!');
    process.exit(0);
  }
  
  log(`Found ${sessionCount} session(s)`);
  log('');
  
  // Ensure output directory exists
  ensureDir(OUTPUT_DIR);
  
  // Process each session
  let totalUrlKeys = 0;
  for (const [sessionId, sessionBranches] of Object.entries(tree)) {
    processSession(sessionId, sessionBranches);
    totalUrlKeys += Object.keys(sessionBranches).length;
  }
  
  log('');
  log(`✓ Indexing complete! Processed ${totalUrlKeys} page(s) across ${sessionCount} session(s)`);
  log(`  Output: ${OUTPUT_DIR}`);
}

main();
