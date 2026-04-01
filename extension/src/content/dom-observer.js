import { getFullXpath, getRelativeXpath, getElementName } from './xpath-utils.js';

export function describeMutationTarget(node) {
  if (!node || node.nodeType !== 1) return 'unknown';
  const el = node;
  const tag = (el.tagName || 'node').toLowerCase();
  const id = el.id ? `#${el.id}` : '';
  const cls = typeof el.className === 'string' && el.className.trim()
    ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}`
    : '';
  return `${tag}${id}${cls}`;
}

export function collectOpenOverlayContext() {
  const openMenus = [];

  // 1. Standard listbox role
  document.querySelectorAll('[role="listbox"]').forEach((lb) => {
    const rect = lb.getBoundingClientRect();
    if (rect.width < 2 && rect.height < 2) return;
    if (lb.getAttribute('hidden') !== null) return;
    const opts = Array.from(
      lb.querySelectorAll('[role="option"], [data-radix-collection-item]')
    ).slice(0, 400);
    if (!opts.length) return;
    openMenus.push({
      kind: 'listbox',
      xpath: getFullXpath(lb),
      triggerId: lb.getAttribute('aria-labelledby') || '',
      itemCount: opts.length,
      items: opts.map((el) => ({
        text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 500),
        value: el.getAttribute('data-value') || el.getAttribute('value') || '',
        disabled: el.getAttribute('aria-disabled') === 'true' || el.hasAttribute('data-disabled'),
        selected: el.getAttribute('aria-selected') === 'true' || el.getAttribute('data-state') === 'checked'
      }))
    });
  });

  // 2. Standard menu role
  document.querySelectorAll('[role="menu"]').forEach((menu) => {
    const rect = menu.getBoundingClientRect();
    if (rect.width < 2 && rect.height < 2) return;
    const items = Array.from(
      menu.querySelectorAll('[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]')
    ).slice(0, 400);
    if (!items.length) return;
    openMenus.push({
      kind: 'menu',
      xpath: getFullXpath(menu),
      itemCount: items.length,
      items: items.map((el) => ({
        text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 500),
        value: el.getAttribute('data-value') || '',
        disabled: el.getAttribute('aria-disabled') === 'true'
      }))
    });
  });

  // 3. Radix UI / HeadlessUI portals (dropdown content rendered in portals)
  document.querySelectorAll('[data-radix-popper-content-wrapper], [data-headlessui-state], [data-state="open"]').forEach((portal) => {
    const rect = portal.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) return;
    
    // Find options inside the portal
    const opts = Array.from(
      portal.querySelectorAll('[role="option"], [role="menuitem"], [data-radix-collection-item], [cmdk-item]')
    ).slice(0, 400);
    
    if (opts.length > 0) {
      openMenus.push({
        kind: 'radix-portal',
        xpath: getFullXpath(portal),
        itemCount: opts.length,
        items: opts.map((el) => ({
          text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 500),
          value: el.getAttribute('data-value') || el.getAttribute('value') || '',
          disabled: el.getAttribute('aria-disabled') === 'true' || el.hasAttribute('data-disabled'),
          selected: el.getAttribute('aria-selected') === 'true' || el.getAttribute('data-state') === 'checked'
        }))
      });
    }
  });

  // 4. Country/phone code dropdowns (react-phone-input, intl-tel-input)
  document.querySelectorAll('.country-list:not([style*="display: none"]), .iti__country-list').forEach((list) => {
    const items = Array.from(list.querySelectorAll('li, .country')).slice(0, 250);
    if (items.length > 0) {
      openMenus.push({
        kind: 'country-selector',
        xpath: getFullXpath(list),
        itemCount: items.length,
        items: items.map((el) => ({
          text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 100),
          value: el.getAttribute('data-country-code') || el.getAttribute('data-dial-code') || ''
        }))
      });
    }
  });

  // 5. Native select elements (capture ALL selects, not just focused)
  document.querySelectorAll('select').forEach((sel) => {
    if (sel.options.length === 0) return;
    openMenus.push({
      kind: 'native-select',
      id: sel.id || '',
      name: sel.name || '',
      xpath: getFullXpath(sel),
      options: Array.from(sel.options).map((o) => ({
        text: o.text,
        value: o.value,
        selected: o.selected
      }))
    });
  });

  // 6. Generic visible dropdown content (catch-all for custom implementations)
  document.querySelectorAll('[class*="dropdown"][class*="open"], [class*="dropdown"][class*="show"], [class*="menu"][class*="visible"]').forEach((dd) => {
    const rect = dd.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) return;
    
    const items = Array.from(dd.querySelectorAll('li, [class*="item"], [class*="option"]'))
      .filter(el => el.textContent?.trim())
      .slice(0, 100);
    
    if (items.length > 0) {
      openMenus.push({
        kind: 'generic-dropdown',
        xpath: getFullXpath(dd),
        itemCount: items.length,
        items: items.map((el) => ({
          text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200)
        }))
      });
    }
  });

  return { openMenus, capturedAt: Date.now() };
}

export function buildInteractionContext(trigger, lastClickElement) {
  if (trigger !== 'user-click' && trigger !== 'dom-mutation') return null;
  let clickTarget = null;
  let targetElement = lastClickElement;
  
  if (targetElement && targetElement.nodeType !== 1 && targetElement.parentElement) {
      targetElement = targetElement.parentElement;
  }

  if (targetElement && targetElement.nodeType === 1) {
    clickTarget = describeMutationTarget(targetElement);
  }

  let clickData = null;
  if (trigger === 'user-click' && targetElement && targetElement.nodeType === 1) {
      clickData = {
          target: clickTarget,
          fullXpath: getFullXpath(targetElement),
          relativeXpath: getRelativeXpath(targetElement),
          name: getElementName(targetElement)
      };
  }

  return {
    clickTarget,
    clickData,
    openOverlays: collectOpenOverlayContext()
  };
}