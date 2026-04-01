#!/usr/bin/env node
/**
 * Test script for dropdown extraction in the indexer.
 * Creates mock snapshot data with API-populated dropdowns and runs the indexer logic.
 */

const path = require('path');
const fs = require('fs');
const { JSDOM } = require('jsdom');

// Import functions from indexer (simulated - we'll test the logic directly)
const SNAPSHOTS_DIR = path.join(__dirname, '../snapshots');
const TEST_OUTPUT = path.join(__dirname, '../test-output');

// ═══════════════════════════════════════════════════════════════════════════════
// MOCK DATA: Simulates a dropdown populated via API
// ═══════════════════════════════════════════════════════════════════════════════

const MOCK_HTML_WITH_DROPDOWNS = `
<!DOCTYPE html>
<html>
<head><title>Consumer Registration Form</title></head>
<body>
  <form id="consumer-form">
    <h1>Create New Consumer</h1>
    
    <!-- Native Select: Consumer Type (populated via API) -->
    <label for="consumer-type">Consumer Type</label>
    <select id="consumer-type" name="consumerType" data-testid="consumer-type-select">
      <option value="">Select type...</option>
      <option value="individual">Individual</option>
      <option value="business">Business</option>
      <option value="enterprise">Enterprise</option>
      <option value="government">Government Agency</option>
      <option value="nonprofit">Non-Profit Organization</option>
    </select>
    
    <!-- Native Select: Country (typically populated via API) -->
    <label for="country">Country</label>
    <select id="country" name="country" aria-label="Select country">
      <option value="">Choose country...</option>
      <option value="US">United States</option>
      <option value="CA">Canada</option>
      <option value="UK">United Kingdom</option>
      <option value="DE">Germany</option>
      <option value="FR">France</option>
      <option value="AU">Australia</option>
      <option value="JP">Japan</option>
      <option value="IN">India</option>
    </select>
    
    <!-- Custom Dropdown: Role Selector (Radix UI style) -->
    <div class="role-selector">
      <button 
        type="button"
        role="combobox" 
        aria-haspopup="listbox"
        aria-expanded="false"
        aria-controls="role-listbox"
        id="role-trigger"
        data-testid="role-selector"
      >
        Select role...
      </button>
      <!-- Listbox is hidden by default, shown when clicked -->
      <ul id="role-listbox" role="listbox" hidden aria-label="Select user role">
        <li role="option" data-value="admin">Administrator</li>
        <li role="option" data-value="manager">Manager</li>
        <li role="option" data-value="editor">Editor</li>
        <li role="option" data-value="viewer">Viewer</li>
        <li role="option" data-value="guest">Guest</li>
      </ul>
    </div>
    
    <!-- Custom Dropdown: Category (open state snapshot) -->
    <div class="category-selector">
      <button 
        type="button"
        role="combobox" 
        aria-haspopup="listbox"
        aria-expanded="true"
        aria-controls="category-listbox"
        id="category-trigger"
      >
        Select category...
      </button>
      <!-- This listbox is NOT hidden - simulating snapshot while dropdown is open -->
      <ul id="category-listbox" role="listbox" aria-label="Product category">
        <li role="option" data-value="electronics">Electronics</li>
        <li role="option" data-value="clothing">Clothing</li>
        <li role="option" data-value="food">Food & Grocery</li>
        <li role="option" data-value="home">Home & Garden</li>
        <li role="option" data-value="sports">Sports & Outdoors</li>
        <li role="option" data-value="books">Books & Media</li>
        <li role="option" data-value="toys">Toys & Games</li>
      </ul>
    </div>
    
    <button type="submit">Create Consumer</button>
  </form>
</body>
</html>
`;

// Mock snapshot metadata with interaction context (captured open overlays)
const MOCK_BRANCH = {
  urlKey: 'example_com__consumer__create',
  url: 'https://example.com/consumer/create',
  title: 'Consumer Registration Form',
  pathname: '/consumer/create',
  sessionId: 'test_session_001',
  branchPath: '/mock/path',
  snapshots: [
    {
      index: 0,
      timestamp: Date.now() - 30000,
      trigger: 'page-load',
      interactionContext: {}
    },
    {
      index: 1,
      timestamp: Date.now() - 15000,
      trigger: 'user-click',
      interactionContext: {
        openOverlays: {
          openMenus: [
            {
              kind: 'listbox',
              triggerId: 'role-trigger',
              itemCount: 5,
              items: [
                { text: 'Administrator', value: 'admin', disabled: false },
                { text: 'Manager', value: 'manager', disabled: false },
                { text: 'Editor', value: 'editor', disabled: false },
                { text: 'Viewer', value: 'viewer', disabled: false },
                { text: 'Guest', value: 'guest', disabled: true }
              ]
            }
          ],
          capturedAt: Date.now() - 15000
        }
      }
    },
    {
      index: 2,
      timestamp: Date.now(),
      trigger: 'dom-mutation',
      interactionContext: {
        openOverlays: {
          openMenus: [
            {
              kind: 'listbox',
              triggerId: 'country',
              itemCount: 8,
              items: [
                { text: 'United States', value: 'US' },
                { text: 'Canada', value: 'CA' },
                { text: 'United Kingdom', value: 'UK' },
                { text: 'Germany', value: 'DE' },
                { text: 'France', value: 'FR' },
                { text: 'Australia', value: 'AU' },
                { text: 'Japan', value: 'JP' },
                { text: 'India', value: 'IN' }
              ]
            }
          ]
        }
      }
    }
  ]
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS (copied from indexer.js for testing)
// ═══════════════════════════════════════════════════════════════════════════════

function getElementLabel(element) {
  return element.getAttribute('aria-label') ||
         element.getAttribute('title') ||
         element.getAttribute('placeholder') ||
         element.textContent?.trim()?.slice(0, 50) ||
         element.getAttribute('name') ||
         element.getAttribute('id') ||
         `[${element.tagName.toLowerCase()}]`;
}

function generateAbsoluteXPath(element) {
  if (!element || element.nodeType !== 1) return '';
  
  const parts = [];
  let current = element;
  
  while (current && current.nodeType === 1) {
    let index = 1;
    let sibling = current.previousElementSibling;
    
    while (sibling) {
      if (sibling.tagName === current.tagName) index++;
      sibling = sibling.previousElementSibling;
    }
    
    const tagName = current.tagName.toLowerCase();
    parts.unshift(`${tagName}[${index}]`);
    current = current.parentElement;
  }
  
  return '/' + parts.join('/');
}

function generateRelativeXPath(element, document) {
  if (!element) return '';
  
  const tag = element.tagName.toLowerCase();
  const id = element.getAttribute('id');
  const name = element.getAttribute('name');
  const ariaLabel = element.getAttribute('aria-label');
  const text = element.textContent?.trim()?.slice(0, 30);
  
  if (id) return `//${tag}[@id='${id}']`;
  if (name) return `//${tag}[@name='${name}']`;
  if (ariaLabel) return `//${tag}[@aria-label='${ariaLabel}']`;
  if (text) return `//${tag}[normalize-space()='${text}']`;
  
  return generateAbsoluteXPath(element);
}

function generateCssSelector(element, document) {
  if (!element) return '';
  
  const id = element.getAttribute('id');
  const dataTestid = element.getAttribute('data-testid');
  const name = element.getAttribute('name');
  const tag = element.tagName.toLowerCase();
  
  if (id) return `#${id}`;
  if (dataTestid) return `[data-testid="${dataTestid}"]`;
  if (name) return `${tag}[name="${name}"]`;
  
  return tag;
}

function extractListboxOptions(listbox) {
  const options = [];
  const items = listbox.querySelectorAll('[role="option"], li');
  
  items.forEach(item => {
    options.push({
      text: item.textContent?.trim() || '',
      value: item.getAttribute('data-value') || item.getAttribute('value') || '',
      disabled: item.hasAttribute('aria-disabled') || item.hasAttribute('disabled'),
      selected: item.getAttribute('aria-selected') === 'true'
    });
  });
  
  return options;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DROPDOWN EXTRACTION (from indexer.js)
// ═══════════════════════════════════════════════════════════════════════════════

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
      options: [],
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
    const options = extractListboxOptions(listbox);
    if (options.length > 0) {
      const listboxId = listbox.getAttribute('id');
      const trigger = listboxId ? document.querySelector(`[aria-controls="${listboxId}"]`) : null;
      
      dropdowns.push({
        type: 'open-listbox',
        label: trigger ? getElementLabel(trigger) : listbox.getAttribute('aria-label') || 'Open Dropdown',
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
                label: `${menu.kind} - ${menu.triggerId || 'overlay'} (captured at snapshot #${snap.index})`,
                capturedAt: snap.timestamp,
                trigger: snap.trigger,
                triggerId: menu.triggerId,
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

// ═══════════════════════════════════════════════════════════════════════════════
// TEST EXECUTION
// ═══════════════════════════════════════════════════════════════════════════════

function runTest() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('  DROPDOWN EXTRACTION TEST');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
  
  // Parse mock HTML
  const dom = new JSDOM(MOCK_HTML_WITH_DROPDOWNS);
  const document = dom.window.document;
  
  console.log('📄 Parsed mock HTML with dropdowns\n');
  
  // Extract dropdowns
  const dropdowns = extractDropdownsAndSelects(document, MOCK_BRANCH);
  
  console.log(`📊 Found ${dropdowns.length} dropdowns/selects:\n`);
  
  dropdowns.forEach((dd, idx) => {
    console.log(`  ${idx + 1}. [${dd.type}] "${dd.label}"`);
    console.log(`     ID: ${dd.id || 'N/A'}`);
    console.log(`     Options: ${dd.optionCount}`);
    if (dd.xpath) console.log(`     XPath: ${dd.xpath}`);
    if (dd.cssSelector) console.log(`     CSS: ${dd.cssSelector}`);
    if (dd.capturedWhileOpen) console.log(`     ✅ Captured while open!`);
    
    if (dd.options && dd.options.length > 0) {
      console.log(`     Values:`);
      dd.options.slice(0, 5).forEach(opt => {
        const status = opt.disabled ? ' (disabled)' : opt.selected ? ' (selected)' : '';
        console.log(`       - "${opt.text}" → ${opt.value}${status}`);
      });
      if (dd.options.length > 5) {
        console.log(`       ... and ${dd.options.length - 5} more`);
      }
    }
    console.log('');
  });
  
  // Generate markdown section
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('  GENERATED MARKDOWN OUTPUT');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
  
  let md = `## Dropdowns & Select Fields (${dropdowns.length})\n\n`;
  
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
        md += `\n`;
      } else {
        md += `_Options not captured. Click the dropdown during capture to record values._\n\n`;
      }
    });
  }
  
  console.log(md);
  
  // Summary
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('  TEST SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
  
  const nativeSelects = dropdowns.filter(d => d.type === 'native-select');
  const customDropdowns = dropdowns.filter(d => d.type === 'custom-dropdown');
  const openListboxes = dropdowns.filter(d => d.type === 'open-listbox');
  const capturedOverlays = dropdowns.filter(d => d.type === 'captured-overlay');
  
  console.log(`  Native <select> elements: ${nativeSelects.length}`);
  console.log(`  Custom dropdowns (combobox): ${customDropdowns.length}`);
  console.log(`  Open listboxes (captured in DOM): ${openListboxes.length}`);
  console.log(`  Captured overlays (from interaction context): ${capturedOverlays.length}`);
  console.log('');
  
  const totalOptions = dropdowns.reduce((sum, d) => sum + d.optionCount, 0);
  console.log(`  Total options captured: ${totalOptions}`);
  console.log('');
  
  // Validate results
  let passed = true;
  
  if (nativeSelects.length !== 2) {
    console.log('  ❌ FAIL: Expected 2 native selects');
    passed = false;
  } else {
    console.log('  ✅ PASS: Found 2 native selects');
  }
  
  if (customDropdowns.length !== 2) {
    console.log('  ❌ FAIL: Expected 2 custom dropdowns');
    passed = false;
  } else {
    console.log('  ✅ PASS: Found 2 custom dropdowns');
  }
  
  if (openListboxes.length !== 1) {
    console.log('  ❌ FAIL: Expected 1 open listbox');
    passed = false;
  } else {
    console.log('  ✅ PASS: Found 1 open listbox (category selector was open)');
  }
  
  if (capturedOverlays.length >= 1) {
    console.log('  ✅ PASS: Found captured overlays from interaction context');
  } else {
    console.log('  ❌ FAIL: Expected captured overlays from interaction context');
    passed = false;
  }
  
  // Check consumer-type has correct options
  const consumerType = nativeSelects.find(d => d.id === 'consumer-type');
  if (consumerType && consumerType.optionCount === 6) {
    console.log('  ✅ PASS: Consumer type dropdown has 6 options');
  } else {
    console.log('  ❌ FAIL: Consumer type dropdown missing or wrong option count');
    passed = false;
  }
  
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  if (passed) {
    console.log('  🎉 ALL TESTS PASSED');
  } else {
    console.log('  ⚠️  SOME TESTS FAILED');
  }
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
  
  return passed;
}

// Run the test
const success = runTest();
process.exit(success ? 0 : 1);
