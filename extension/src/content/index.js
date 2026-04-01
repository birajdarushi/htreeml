// Main entry point for the content script

import { patchNetwork } from './network-patch.js';
import { shouldCaptureUrl, normalizeRuleList } from './filter-rules.js';
import { getHtmlForCapture, createDomSignature, quickHash } from './capture-engine.js';
import { describeMutationTarget, buildInteractionContext } from './dom-observer.js';

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
  let lastClickElement = null;

  console.log('DOM Tree Capture initialized (Modularized)');

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

  function captureSnapshot(trigger) {
    if (!sessionInitialized || !captureInitialized) return;
    if (!shouldCaptureUrl(location.href, captureEnabled, ignoreUrls, focusUrls)) return;

    const html = getHtmlForCapture(ignoreChatClientWidget);
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
      interactionContext: buildInteractionContext(trigger, lastClickElement),
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

  // --- Setup Listeners ---

  function scheduleClickCapture() {
    clearTimeout(clickTimer);
    clickTimer = setTimeout(() => {
        // Assume pending requests are tracked via network idle
        captureSnapshot('user-click');
    }, CLICK_CAPTURE_DELAY);
  }

  patchNetwork(
    (event) => {
        recentApiCalls.push(event);
        lastApiEventAt = Date.now();
        if (recentApiCalls.length > MAX_API_EVENTS) {
            recentApiCalls = recentApiCalls.slice(recentApiCalls.length - MAX_API_EVENTS);
        }
    },
    (pendingRequests) => {
        if (pendingRequests === 0) {
            clearTimeout(networkIdleTimer);
            networkIdleTimer = setTimeout(() => captureSnapshot('network-idle'), NETWORK_IDLE_DELAY);
        }
    }
  );

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
       captureSnapshot('dom-mutation');
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