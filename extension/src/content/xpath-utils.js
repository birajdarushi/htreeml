export function getRelativeXpath(element) {
  if (!element || element.nodeType !== 1) return '';
  if (element.hasAttribute('id')) return `//*[@id="${element.id}"]`;
  if (element.tagName === 'BODY') return '//BODY';
  if (element.tagName === 'HTML') return '/HTML';

  let ix = 1;
  let siblings = element.parentNode ? element.parentNode.children : [];
  for (let i = 0; i < siblings.length; i++) {
    let sibling = siblings[i];
    if (sibling === element) {
      const parentPath = getRelativeXpath(element.parentNode);
      return parentPath + '/' + element.tagName + '[' + ix + ']';
    }
    if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
      ix++;
    }
  }
  return '';
}

export function getFullXpath(element) {
  if (!element || element.nodeType !== 1) return '';
  if (element.tagName === 'HTML') return '/HTML[1]';
  if (element.tagName === 'BODY') return '/HTML[1]/BODY[1]';

  let ix = 1;
  let siblings = element.parentNode ? element.parentNode.children : [];
  for (let i = 0; i < siblings.length; i++) {
    let sibling = siblings[i];
    if (sibling === element) {
      return getFullXpath(element.parentNode) + '/' + element.tagName + '[' + ix + ']';
    }
    if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
      ix++;
    }
  }
  return '';
}

export function getElementName(element) {
  if (!element || element.nodeType !== 1) return '';
  let text = (element.getAttribute('aria-label') || element.title || element.getAttribute('name') || element.getAttribute('alt') || '').trim();
  if (!text && element.textContent) {
      text = element.textContent.trim().replace(/\s+/g, ' ').substring(0, 50);
  }
  if (!text && (element.tagName.toLowerCase() === 'svg' || element.querySelector('svg') || (typeof element.className === 'string' && element.className.includes('icon')))) {
      text = 'icon';
  }
  return text;
}
