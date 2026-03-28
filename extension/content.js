// DOM Tree Capture - Content Script
// Captures page state across user interactions for POM authoring.

(function () {
  if (window.__domTreeCaptureInitialized) return;
  window.__domTreeCaptureInitialized = true;

  const SERVER_URL = 'http://localhost:7700';
  const SESSION_KEY = 'domCaptureSessionId';
  const CLIENT_KEY = 'domCaptureClientId';
  const MAX_API_EVENTS = 120;
  const MAX_API_EVENTS_PER_SNAPSHOT = 30;
  const NETWORK_IDLE_DELAY = 1200;
  const MUTATION_DEBOUNCE = 800;
  const CLICK_CAPTURE_DELAY = 650;

  let networkIdleTimer = null;
  let mutationTimer = null;
  let clickTimer = null;
  let pendingRequests = 0;
  let lastSnapshotKey = null;
  let lastSnapshotAt = 0;
  let lastApiEventAt = 0;
  let sessionId = null;
  let clientId = null;
  let snapshotIndex = 0;
  let captureEnabled = true;
  let ignoreChatClientWidget = true;
  let focusUrls = [];
  let ignoreUrls = [];
  let captureInitialized = false;
  let sessionInitialized = false;
  let recentApiCalls = [];
  let pendingMutationSummary = null;
  /** @type {Element|null} */
  let lastClickElement = null;

  console.log('DOM Tree Capture initialized');

  function quickHash(str) {
    if (!str) return 0;

    // Sample start/middle/end so changes deep in large React DOMs are also detected.
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

  function getSessionStorageArea() {
    if (chrome?.storage?.session && typeof chrome.storage.session.get === 'function') {
      return chrome.storage.session;
    }
    return null;
  }

  function readSessionId(callback) {
    const sessionArea = getSessionStorageArea();
    if (sessionArea) {
      sessionArea.get([SESSION_KEY], (res) => callback(res?.[SESSION_KEY] || null));
      return;
    }

    try {
      callback(window.sessionStorage.getItem(SESSION_KEY));
    } catch (_) {
      callback(null);
    }
  }

  function writeSessionId(id) {
    const sessionArea = getSessionStorageArea();
    if (sessionArea) {
      sessionArea.set({ [SESSION_KEY]: id });
      return;
    }

    try {
      window.sessionStorage.setItem(SESSION_KEY, id);
    } catch (_) {
      // ignore
    }
  }

  function getOrCreateClientId() {
    try {
      const existing = window.localStorage.getItem(CLIENT_KEY);
      if (existing) return existing;
      const created = `client_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      window.localStorage.setItem(CLIENT_KEY, created);
      return created;
    } catch (_) {
      return `client_fallback_${Math.random().toString(36).slice(2, 10)}`;
    }
  }

  function createDomSignature(html) {
    const structural = html
      .replace(/<!--([\s\S]*?)-->/g, '')
      .replace(/\s(data-react\S*|data-v-\S*|data-testid|aria-describedby|aria-controls)="[^"]*"/g, '')
      .replace(/\s(id|for|name)="[^"]{8,}"/g, '')
      .replace(/>[^<]{1,80}</g, '></g')
      .replace(/\s+/g, ' ')
      .slice(0, 20000);

    return `sig_${quickHash(structural)}`;
  }

  function normalizeRuleList(list) {
    if (!Array.isArray(list)) return [];
    return list.map((item) => String(item).trim().toLowerCase()).filter(Boolean);
  }

  function wildcardToRegex(pattern) {
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    return new RegExp(escaped, 'i');
  }

  function matchHostPathWildcard(urlValue, rule) {
    const parsedUrl = (() => {
      try {
        return new URL(String(urlValue || '').toLowerCase());
      } catch (_) {
        return null;
      }
    })();

    if (!parsedUrl) return false;

    const normalizedRule = String(rule || '').toLowerCase();
    const noSchemeRule = normalizedRule.replace(/^https?:\/\//, '');
    const slashIndex = noSchemeRule.indexOf('/');
    const hostPattern = slashIndex >= 0 ? noSchemeRule.slice(0, slashIndex) : noSchemeRule;
    const pathPattern = slashIndex >= 0 ? noSchemeRule.slice(slashIndex) : '/*';

    const host = parsedUrl.hostname;
    const pathAndQuery = `${parsedUrl.pathname}${parsedUrl.search}`;

    let hostMatch = false;
    if (hostPattern.startsWith('*.')) {
      const bare = hostPattern.slice(2);
      hostMatch = host === bare || host.endsWith(`.${bare}`);
    } else if (hostPattern.includes('*')) {
      hostMatch = wildcardToRegex(hostPattern).test(host);
    } else {
      hostMatch = host === hostPattern;
    }

    if (!hostMatch) return false;
    return wildcardToRegex(pathPattern).test(pathAndQuery);
  }

  function matchRule(urlValue, rule) {
    if (!rule) return false;

    const urlLower = String(urlValue || '').toLowerCase();
    const parsed = (() => {
      try {
        return new URL(urlLower);
      } catch (_) {
        return null;
      }
    })();

    const hostname = parsed ? parsed.hostname : '';

    if (rule.includes('*')) {
      if (!rule.includes('://')) {
        const wildcardHostPathMatch = matchHostPathWildcard(urlValue, rule);
        if (wildcardHostPathMatch) return true;
      }
      return wildcardToRegex(rule).test(urlLower);
    }

    if (rule.includes('://') || rule.includes('/') || rule.includes('?')) {
      return urlLower.includes(rule);
    }

    if (!hostname) return false;
    return hostname === rule || hostname.endsWith('.' + rule);
  }

  function shouldCaptureUrl(urlValue) {
    if (!captureEnabled) return false;

    const lowered = String(urlValue || '').toLowerCase();
    if (
      lowered.includes('://localhost:7700') ||
      lowered.includes('://127.0.0.1:7700')
    ) {
      return false;
    }

    if (ignoreUrls.some((rule) => matchRule(urlValue, rule))) {
      return false;
    }

    if (focusUrls.length > 0) {
      return focusUrls.some((rule) => matchRule(urlValue, rule));
    }

    return true;
  }

  function initializeCaptureFilter() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['captureEnabled', 'focusUrls', 'ignoreUrls', 'captureDomain', 'ignoreChatClientWidget'], (res) => {
        const legacyDomain = String(res.captureDomain || '').trim().toLowerCase();
        captureEnabled = res.captureEnabled !== false;
        ignoreChatClientWidget = res.ignoreChatClientWidget !== false;
        focusUrls = normalizeRuleList(res.focusUrls);
        ignoreUrls = normalizeRuleList(res.ignoreUrls);

        if (focusUrls.length === 0 && legacyDomain) {
          focusUrls = [legacyDomain];
        }

        captureInitialized = true;
        resolve();
      });
    });
  }

  function pushApiCall(event) {
    recentApiCalls.push(event);
    lastApiEventAt = Date.now();
    if (recentApiCalls.length > MAX_API_EVENTS) {
      recentApiCalls = recentApiCalls.slice(recentApiCalls.length - MAX_API_EVENTS);
    }
  }

  function toAbsoluteUrl(value) {
    try {
      return new URL(String(value || ''), location.href).href;
    } catch (_) {
      return String(value || '');
    }
  }

  function isCollectorRequest(apiUrl) {
    return String(apiUrl || '').includes(':7700');
  }

  function initializeSession() {
    return new Promise((resolve) => {
      readSessionId((existingId) => {
        sessionId = existingId;
        if (!sessionId) {
          sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          writeSessionId(sessionId);
        }

        clientId = getOrCreateClientId();
        sessionInitialized = true;
        resolve();
      });
    });
  }

  function flashIndicator(trigger) {
    const el = document.createElement('div');
    el.setAttribute('data-dom-tree-capture-overlay', '1');
    el.style.cssText = [
      'position:fixed',
      'bottom:20px',
      'right:20px',
      'z-index:2147483647',
      `background:${trigger === 'manual' ? '#6366f1' : '#10b981'}`,
      'color:white',
      'font-family:monospace',
      'font-size:12px',
      'padding:6px 12px',
      'border-radius:6px',
      'box-shadow:0 4px 12px rgba(0,0,0,0.3)',
      'transition:opacity 0.35s ease',
      'pointer-events:none'
    ].join(';');

    el.textContent = `Saved ${trigger}`;
    document.body.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
    }, 1000);
    setTimeout(() => {
      el.remove();
    }, 1500);
  }

  function describeMutationTarget(node) {
    if (!node || node.nodeType !== 1) return 'unknown';
    const el = node;
    const tag = (el.tagName || 'node').toLowerCase();
    const id = el.id ? `#${el.id}` : '';
    const cls = typeof el.className === 'string' && el.className.trim()
      ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}`
      : '';
    return `${tag}${id}${cls}`;
  }

  /**
   * Capture open listbox / menu / native select options for viewer + mutation JSON.
   */
  function collectOpenOverlayContext() {
    const openMenus = [];

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
        itemCount: opts.length,
        items: opts.map((el) => ({
          text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 500),
          value: el.getAttribute('data-value') || el.getAttribute('value') || '',
          disabled:
            el.getAttribute('aria-disabled') === 'true' || el.hasAttribute('data-disabled')
        }))
      });
    });

    document.querySelectorAll('[role="menu"]').forEach((menu) => {
      const rect = menu.getBoundingClientRect();
      if (rect.width < 2 && rect.height < 2) return;
      const items = Array.from(
        menu.querySelectorAll(
          '[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]'
        )
      ).slice(0, 400);
      if (!items.length) return;
      openMenus.push({
        kind: 'menu',
        itemCount: items.length,
        items: items.map((el) => ({
          text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 500)
        }))
      });
    });

    const active = document.activeElement;
    if (active && active.tagName === 'SELECT') {
      const sel = active;
      openMenus.push({
        kind: 'select',
        id: sel.id || '',
        name: sel.name || '',
        options: Array.from(sel.options).map((o) => ({
          text: o.text,
          value: o.value,
          selected: o.selected
        }))
      });
    }

    return { openMenus, capturedAt: Date.now() };
  }

  function buildInteractionContext(trigger) {
    if (trigger !== 'user-click' && trigger !== 'dom-mutation') return null;
    let clickTarget = null;
    if (lastClickElement && lastClickElement.nodeType === 1) {
      clickTarget = describeMutationTarget(lastClickElement);
    } else if (lastClickElement && lastClickElement.parentElement) {
      clickTarget = describeMutationTarget(lastClickElement.parentElement);
    }
    return {
      clickTarget,
      openOverlays: collectOpenOverlayContext()
    };
  }

  function removeNodes(root, selectors) {
    selectors.forEach((selector) => {
      root.querySelectorAll(selector).forEach((el) => el.remove());
    });
  }

  function getHtmlForCapture() {
    const clone = document.documentElement.cloneNode(true);

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

  function captureSnapshot(trigger) {
    if (!sessionInitialized || !captureInitialized) return;
    if (!shouldCaptureUrl(location.href)) return;

    const html = getHtmlForCapture();
    const hash = quickHash(html);
    const snapshotKey = `${location.href}::${hash}`;
    const now = Date.now();
    const hasFreshApiActivity = lastApiEventAt > lastSnapshotAt;
    if (snapshotKey === lastSnapshotKey && trigger !== 'manual' && trigger !== 'navigation' && !hasFreshApiActivity) return;
    if (now - lastSnapshotAt < 350 && trigger !== 'manual') return;

    lastSnapshotKey = snapshotKey;
    lastSnapshotAt = now;

    const payload = {
      sessionId,
      clientId,
      url: location.href,
      pathname: location.pathname,
      title: document.title,
      trigger,
      snapshotIndex: snapshotIndex++,
      timestamp: now,
      domSignature: createDomSignature(html),
      apiCalls: recentApiCalls.slice(-MAX_API_EVENTS_PER_SNAPSHOT),
      mutationSummary: trigger === 'dom-mutation' ? pendingMutationSummary : null,
      interactionContext: buildInteractionContext(trigger),
      html
    };

    if (trigger === 'dom-mutation') {
      pendingMutationSummary = null;
    }

    fetch(`${SERVER_URL}/snapshot`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Dom-Client-Id': clientId
      },
      body: JSON.stringify(payload)
    })
      .then((res) => {
        if (res.ok) {
          chrome.runtime.sendMessage({ type: 'SERVER_OK' });
          return;
        }
        console.error(`Snapshot rejected (${res.status})`);
      })
      .catch((err) => {
        console.error(`Snapshot failed: ${err.message}`);
        chrome.runtime.sendMessage({ type: 'SERVER_UNREACHABLE' });
      });

    flashIndicator(trigger);
  }

  function scheduleClickCapture() {
    clearTimeout(clickTimer);
    clickTimer = setTimeout(() => {
      if (pendingRequests === 0) captureSnapshot('user-click');
    }, CLICK_CAPTURE_DELAY);
  }

  function resetNetworkIdleTimer() {
    clearTimeout(networkIdleTimer);
    networkIdleTimer = setTimeout(() => {
      if (pendingRequests === 0) captureSnapshot('network-idle');
    }, NETWORK_IDLE_DELAY);
  }

  const OrigXHR = window.XMLHttpRequest;
  function PatchedXHR() {
    const xhr = new OrigXHR();
    const origOpen = xhr.open.bind(xhr);
    let requestMethod = 'GET';
    let requestUrl = '';
    let startAt = 0;

    xhr.open = function (...args) {
      requestMethod = String(args[0] || 'GET').toUpperCase();
      requestUrl = toAbsoluteUrl(args[1]);
      startAt = Date.now();

      if (isCollectorRequest(requestUrl)) {
        return origOpen(...args);
      }

      pendingRequests++;
      xhr.addEventListener('loadend', () => {
        pendingRequests = Math.max(0, pendingRequests - 1);

        pushApiCall({
          type: 'xhr',
          method: requestMethod,
          url: requestUrl,
          status: Number(xhr.status) || 0,
          durationMs: Date.now() - startAt,
          timestamp: Date.now()
        });

        resetNetworkIdleTimer();
      });
      return origOpen(...args);
    };
    return xhr;
  }
  PatchedXHR.prototype = OrigXHR.prototype;
  Object.defineProperty(PatchedXHR, 'DONE', { value: OrigXHR.DONE });
  window.XMLHttpRequest = PatchedXHR;

  const origFetch = window.fetch.bind(window);
  window.fetch = function (...args) {
    const requestUrl = toAbsoluteUrl(args[0]);
    if (isCollectorRequest(requestUrl)) return origFetch(...args);

    const requestMethod = String((args[1] && args[1].method) || 'GET').toUpperCase();
    const startAt = Date.now();

    pendingRequests++;
    return origFetch(...args)
      .then((response) => {
        pushApiCall({
          type: 'fetch',
          method: requestMethod,
          url: requestUrl,
          status: Number(response.status) || 0,
          durationMs: Date.now() - startAt,
          timestamp: Date.now()
        });
        return response;
      })
      .catch((err) => {
        pushApiCall({
          type: 'fetch',
          method: requestMethod,
          url: requestUrl,
          status: 0,
          error: String(err && err.message ? err.message : err),
          durationMs: Date.now() - startAt,
          timestamp: Date.now()
        });
        throw err;
      })
      .finally(() => {
        pendingRequests = Math.max(0, pendingRequests - 1);
        resetNetworkIdleTimer();
      });
  };

  const observer = new MutationObserver((mutations) => {
    let added = 0;
    let removed = 0;
    let attributes = 0;
    let textChanges = 0;
    const targets = [];

    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        added += mutation.addedNodes ? mutation.addedNodes.length : 0;
        removed += mutation.removedNodes ? mutation.removedNodes.length : 0;
      } else if (mutation.type === 'attributes') {
        attributes += 1;
      } else if (mutation.type === 'characterData') {
        textChanges += 1;
      }

      if (targets.length < 8) {
        targets.push(describeMutationTarget(mutation.target));
      }
    });

    pendingMutationSummary = {
      mutationCount: mutations.length,
      addedNodes: added,
      removedNodes: removed,
      attributeChanges: attributes,
      textChanges,
      targets,
      timestamp: Date.now()
    };

    clearTimeout(mutationTimer);
    mutationTimer = setTimeout(() => {
      if (pendingRequests === 0) captureSnapshot('dom-mutation');
    }, MUTATION_DEBOUNCE);
  });

  function hookHistoryNavigation() {
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function (...args) {
      originalPushState.apply(this, args);
      setTimeout(() => captureSnapshot('navigation'), 300);
    };

    history.replaceState = function (...args) {
      originalReplaceState.apply(this, args);
      setTimeout(() => captureSnapshot('navigation'), 300);
    };

    window.addEventListener('popstate', () => {
      setTimeout(() => captureSnapshot('navigation'), 300);
    });

    window.addEventListener('hashchange', () => {
      setTimeout(() => captureSnapshot('navigation'), 300);
    });
  }

  Promise.all([initializeSession(), initializeCaptureFilter()]).then(() => {
    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true
    });

    document.addEventListener(
      'click',
      (ev) => {
        lastClickElement = ev.target;
        scheduleClickCapture();
      },
      true
    );
    hookHistoryNavigation();

    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === 'MANUAL_SNAPSHOT') {
        captureSnapshot('manual');
      }
      if (msg.type === 'SET_CAPTURE_ENABLED') {
        captureEnabled = !!msg.enabled;
      }
    });

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local') return;

      if (changes.captureEnabled) {
        captureEnabled = changes.captureEnabled.newValue !== false;
      }
      if (changes.ignoreChatClientWidget) {
        ignoreChatClientWidget = changes.ignoreChatClientWidget.newValue !== false;
      }
      if (changes.focusUrls) {
        focusUrls = normalizeRuleList(changes.focusUrls.newValue);
      }
      if (changes.ignoreUrls) {
        ignoreUrls = normalizeRuleList(changes.ignoreUrls.newValue);
      }
      if (changes.captureDomain && focusUrls.length === 0 && changes.captureDomain.newValue) {
        focusUrls = [String(changes.captureDomain.newValue).trim().toLowerCase()];
      }
    });

    if (document.readyState === 'complete') {
      setTimeout(() => captureSnapshot('page-load'), 500);
    } else {
      window.addEventListener('load', () => {
        setTimeout(() => captureSnapshot('page-load'), 500);
      });
    }
  });
})();
