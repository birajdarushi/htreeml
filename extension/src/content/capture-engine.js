// Logic for getting HTML, hashing, and creating signatures

export function removeNodes(root, selectors) {
  selectors.forEach((selector) => {
    root.querySelectorAll(selector).forEach((el) => el.remove());
  });
}

export function getHtmlForCapture(ignoreChatClientWidget) {
  const clone = document.documentElement.cloneNode(true);

  // Remove non-structural tags entirely to reduce payload size
  removeNodes(clone, ['script', 'style', 'link[rel="stylesheet"]', 'noscript']);

  // Truncate heavy SVGs
  clone.querySelectorAll('svg').forEach(svg => {
    svg.innerHTML = '<!-- SVG paths removed for size -->';
  });

  // Truncate large Base64 images
  clone.querySelectorAll('img[src^="data:image/"]').forEach(img => {
    img.setAttribute('src', 'data:image/svg+xml,...[TRUNCATED]');
  });

  // Remove temporary extension overlay from captured snapshots.
  removeNodes(clone, ['[data-dom-tree-capture-overlay="1"]']);

  if (ignoreChatClientWidget) {
    removeNodes(clone, [
      'script[src*="chatclient.ai"]',
      'iframe[src*="chatclient.ai"]',
      '#chatclient-bubble-button',
      '#mobile-close-button',
      '#chatbot-widget-script',
      '[id*="chatclient"]',
      '[src*="chatclient.ai/chatbot-widget"]',
      '[src*="chatclient.ai/api/embed"]'
    ]);
  }

  return clone.outerHTML;
}

export function quickHash(str) {
  if (!str) return 0;

  const len = str.length;
  const chunk = Math.min(4000, len);
  const midStart = Math.max(0, Math.floor((len - chunk) / 2));
  const tailStart = Math.max(0, len - chunk);
  const sampled =
    str.slice(0, chunk) + '|' +
    str.slice(midStart, midStart + chunk) + '|' +
    str.slice(tailStart);

  let h = 0;
  for (let i = 0; i < sampled.length; i++) {
    h = (Math.imul(31, h) + sampled.charCodeAt(i)) | 0;
  }
  return `${h}:${len}`;
}

export function createDomSignature(html) {
  const structural = html
    .replace(/<!--([\s\S]*?)-->/g, '')
    .replace(/\s(data-react\S*|data-v-\S*|data-testid|aria-describedby|aria-controls)="[^"]*"/g, '')
    .replace(/\s(id|for|name)="[^"]{8,}"/g, '')
    .replace(/>[^<]{1,80}</g, '></g')
    .replace(/\s+/g, ' ')
    .slice(0, 20000);

  return `sig_${quickHash(structural)}`;
}
