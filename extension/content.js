// DOM Tree Capture - Content Script
// Runs on every page, watches for DOM changes and network idle

(function () {
  if (window.__domTreeCaptureInitialized) return;
  window.__domTreeCaptureInitialized = true;

  const SERVER_URL = 'http://localhost:7700';
  const NETWORK_IDLE_DELAY = 1200; // ms after last network request
  const MUTATION_DEBOUNCE = 800;   // ms after last DOM mutation

  let networkIdleTimer = null;
  let mutationTimer = null;
  let pendingRequests = 0;
  let lastSnapshotHash = null;
  let lastStructuralHash = null;
  let sessionId = null;
  let snapshotIndex = 0;

  // ── Session ID (persists per tab across navigations) ──────────────────────
  chrome.storage.session.get(['domCaptureSessionId'], (res) => {
    sessionId = res.domCaptureSessionId;
    if (!sessionId) {
      sessionId = `session_${Date.now()}`;
      chrome.storage.session.set({ domCaptureSessionId: sessionId });
    }
  });

  // ── Simple hash to avoid saving identical snapshots ───────────────────────
  function quickHash(str) {
    let h = 0;
    for (let i = 0; i < Math.min(str.length, 5000); i++) {
      h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    }
    return h;
  }

  // ── Structural hash: counts elements by tag, ignoring text content ────────
  // Returns a hash that changes only when DOM elements are added/removed,
  // not when visible text is updated (e.g. feed scroll, live counters).
  function structuralQuickHash() {
    const counts = {};
    document.querySelectorAll('*').forEach(el => {
      const key = el.tagName.toLowerCase();
      counts[key] = (counts[key] || 0) + 1;
    });
    const sig = Object.keys(counts).sort().map(k => `${k}:${counts[k]}`).join(',');
    return quickHash(sig);
  }

  // ── Capture the live DOM ──────────────────────────────────────────────────
  function captureSnapshot(trigger = 'auto') {
    const html = document.documentElement.outerHTML;
    const hash = quickHash(html);
    const structHash = structuralQuickHash();

    if (trigger === 'auto') {
      // Skip completely identical snapshots
      if (hash === lastSnapshotHash) return;
      // Skip text-only changes (element structure unchanged) — reduces noise
      // e.g. feed scrolls, live counters, timestamp updates
      if (structHash === lastStructuralHash) return;
    }

    lastSnapshotHash = hash;
    lastStructuralHash = structHash;

    const payload = {
      sessionId,
      url: location.href,
      pathname: location.pathname,
      title: document.title,
      trigger,
      snapshotIndex: snapshotIndex++,
      timestamp: Date.now(),
      html
    };

    fetch(`${SERVER_URL}/snapshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(() => {
      // Server not running — silently ignore, show badge via bg
      chrome.runtime.sendMessage({ type: 'SERVER_UNREACHABLE' });
    });

    // Flash visual feedback
    flashIndicator(trigger);
  }

  // ── Visual feedback indicator ─────────────────────────────────────────────
  function flashIndicator(trigger) {
    const el = document.createElement('div');
    el.style.cssText = `
      position: fixed; bottom: 20px; right: 20px; z-index: 2147483647;
      background: ${trigger === 'manual' ? '#6366f1' : '#10b981'};
      color: white; font-family: monospace; font-size: 12px;
      padding: 6px 12px; border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      transition: opacity 0.4s ease;
      pointer-events: none;
    `;
    el.textContent = trigger === 'manual' ? '📸 Manual snapshot saved' : '🌿 Auto snapshot saved';
    document.body.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; }, 1200);
    setTimeout(() => el.remove(), 1700);
  }

  // ── Network idle detection via XHR/fetch patching ────────────────────────
  function resetNetworkIdleTimer() {
    clearTimeout(networkIdleTimer);
    networkIdleTimer = setTimeout(() => {
      if (pendingRequests === 0) captureSnapshot('network-idle');
    }, NETWORK_IDLE_DELAY);
  }

  // Patch XMLHttpRequest
  const OrigXHR = window.XMLHttpRequest;
  function PatchedXHR() {
    const xhr = new OrigXHR();
    const origOpen = xhr.open.bind(xhr);
    xhr.open = function (...args) {
      pendingRequests++;
      xhr.addEventListener('loadend', () => {
        pendingRequests = Math.max(0, pendingRequests - 1);
        resetNetworkIdleTimer();
      });
      return origOpen(...args);
    };
    return xhr;
  }
  PatchedXHR.prototype = OrigXHR.prototype;
  Object.defineProperty(PatchedXHR, 'DONE', { value: OrigXHR.DONE });
  window.XMLHttpRequest = PatchedXHR;

  // Patch fetch
  const origFetch = window.fetch.bind(window);
  window.fetch = function (...args) {
    // Don't intercept our own server calls
    if (args[0] && args[0].toString().includes(':7700')) return origFetch(...args);
    pendingRequests++;
    return origFetch(...args).finally(() => {
      pendingRequests = Math.max(0, pendingRequests - 1);
      resetNetworkIdleTimer();
    });
  };

  // ── DOM Mutation observer (for SPA DOM changes) ───────────────────────────
  const observer = new MutationObserver(() => {
    clearTimeout(mutationTimer);
    mutationTimer = setTimeout(() => {
      if (pendingRequests === 0) captureSnapshot('dom-mutation');
    }, MUTATION_DEBOUNCE);
  });

  observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true,
    attributes: false,
    characterData: false
  });

  // ── Listen for manual trigger from background (keyboard shortcut) ─────────
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'MANUAL_SNAPSHOT') captureSnapshot('manual');
  });

  // ── Initial page load snapshot ────────────────────────────────────────────
  if (document.readyState === 'complete') {
    setTimeout(() => captureSnapshot('page-load'), 500);
  } else {
    window.addEventListener('load', () => {
      setTimeout(() => captureSnapshot('page-load'), 500);
    });
  }

})();
