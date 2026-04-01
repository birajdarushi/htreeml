// Extracts the logic to strip non-essential nodes from captured HTML

function buildAiFriendlyHtml(rawHtml) {
  let html = String(rawHtml || '');

  // Remove heavy/non-locator tags that bloat context for downstream AI parsing.
  html = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<iframe\b[^>]*\/>/gi, '')
    .replace(/<link\b[^>]*>/gi, '')
    .replace(/<meta\b[^>]*>/gi, '');

  // Remove common third-party/support widgets and capture overlays.
  html = html
    .replace(/<[^>]*id="chatbot-widget-script"[^>]*>[\s\S]*?<\/[^>]+>/gi, '')
    .replace(/<[^>]*id="chatclient-bubble-button"[^>]*>[\s\S]*?<\/[^>]+>/gi, '')
    .replace(/<[^>]*id="recharts_measurement_span"[^>]*>[\s\S]*?<\/[^>]+>/gi, '')
    .replace(/<[^>]*id="mobile-close-button"[^>]*>[\s\S]*?<\/[^>]+>/gi, '')
    .replace(/<div[^>]*>Saved\s+(dom-mutation|network-idle|user-click|manual|navigation)[\s\S]*?<\/div>/gi, '');

  html = html
    .replace(/\s{2,}/g, ' ')
    .replace(/>\s+</g, '><')
    .trim();

  return html;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = {
  buildAiFriendlyHtml,
  escapeHtml
};