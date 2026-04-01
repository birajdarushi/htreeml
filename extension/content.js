(() => {
  // extension/src/content/network-patch.js
  function toAbsoluteUrl(value) {
    try {
      return new URL(String(value || ""), location.href).href;
    } catch (_) {
      return String(value || "");
    }
  }
  function isCollectorRequest(apiUrl) {
    return String(apiUrl || "").includes(":7700");
  }
  function patchNetwork(onNetworkActivity, onNetworkIdle) {
    let pendingRequests = 0;
    function pushActivity(event) {
      onNetworkActivity(event);
    }
    function handleComplete() {
      pendingRequests = Math.max(0, pendingRequests - 1);
      onNetworkIdle(pendingRequests);
    }
    const OrigXHR = window.XMLHttpRequest;
    function PatchedXHR() {
      const xhr = new OrigXHR();
      const origOpen = xhr.open.bind(xhr);
      let requestMethod = "GET";
      let requestUrl = "";
      let startAt = 0;
      xhr.open = function(...args) {
        requestMethod = String(args[0] || "GET").toUpperCase();
        requestUrl = toAbsoluteUrl(args[1]);
        startAt = Date.now();
        if (isCollectorRequest(requestUrl)) {
          return origOpen(...args);
        }
        pendingRequests++;
        xhr.addEventListener("loadend", () => {
          pushActivity({
            type: "xhr",
            method: requestMethod,
            url: requestUrl,
            status: Number(xhr.status) || 0,
            durationMs: Date.now() - startAt,
            timestamp: Date.now()
          });
          handleComplete();
        });
        return origOpen(...args);
      };
      return xhr;
    }
    PatchedXHR.prototype = OrigXHR.prototype;
    Object.defineProperty(PatchedXHR, "DONE", { value: OrigXHR.DONE });
    window.XMLHttpRequest = PatchedXHR;
    const origFetch = window.fetch.bind(window);
    window.fetch = function(...args) {
      const requestUrl = toAbsoluteUrl(args[0]);
      if (isCollectorRequest(requestUrl)) return origFetch(...args);
      const requestMethod = String(args[1] && args[1].method || "GET").toUpperCase();
      const startAt = Date.now();
      pendingRequests++;
      return origFetch(...args).then((response) => {
        pushActivity({
          type: "fetch",
          method: requestMethod,
          url: requestUrl,
          status: Number(response.status) || 0,
          durationMs: Date.now() - startAt,
          timestamp: Date.now()
        });
        return response;
      }).catch((err) => {
        pushActivity({
          type: "fetch",
          method: requestMethod,
          url: requestUrl,
          status: 0,
          error: String(err && err.message ? err.message : err),
          durationMs: Date.now() - startAt,
          timestamp: Date.now()
        });
        throw err;
      }).finally(() => {
        handleComplete();
      });
    };
  }

  // extension/src/content/filter-rules.js
  function normalizeRuleList(list) {
    if (!Array.isArray(list)) return [];
    return list.map((item) => String(item).trim().toLowerCase()).filter(Boolean);
  }
  function wildcardToRegex(pattern) {
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    return new RegExp(escaped, "i");
  }
  function matchHostPathWildcard(urlValue, rule) {
    const parsedUrl = (() => {
      try {
        return new URL(String(urlValue || "").toLowerCase());
      } catch (_) {
        return null;
      }
    })();
    if (!parsedUrl) return false;
    const normalizedRule = String(rule || "").toLowerCase();
    const noSchemeRule = normalizedRule.replace(/^https?:\/\//, "");
    const slashIndex = noSchemeRule.indexOf("/");
    const hostPattern = slashIndex >= 0 ? noSchemeRule.slice(0, slashIndex) : noSchemeRule;
    const pathPattern = slashIndex >= 0 ? noSchemeRule.slice(slashIndex) : "/*";
    const host = parsedUrl.hostname;
    const pathAndQuery = `${parsedUrl.pathname}${parsedUrl.search}`;
    let hostMatch = false;
    if (hostPattern.startsWith("*.")) {
      const bare = hostPattern.slice(2);
      hostMatch = host === bare || host.endsWith(`.${bare}`);
    } else if (hostPattern.includes("*")) {
      hostMatch = wildcardToRegex(hostPattern).test(host);
    } else {
      hostMatch = host === hostPattern;
    }
    if (!hostMatch) return false;
    return wildcardToRegex(pathPattern).test(pathAndQuery);
  }
  function matchRule(urlValue, rule) {
    if (!rule) return false;
    const urlLower = String(urlValue || "").toLowerCase();
    const parsed = (() => {
      try {
        return new URL(urlLower);
      } catch (_) {
        return null;
      }
    })();
    const hostname = parsed ? parsed.hostname : "";
    if (rule.includes("*")) {
      if (!rule.includes("://")) {
        const wildcardHostPathMatch = matchHostPathWildcard(urlValue, rule);
        if (wildcardHostPathMatch) return true;
      }
      return wildcardToRegex(rule).test(urlLower);
    }
    if (rule.includes("://") || rule.includes("/") || rule.includes("?")) {
      return urlLower.includes(rule);
    }
    if (!hostname) return false;
    return hostname === rule || hostname.endsWith("." + rule);
  }
  function shouldCaptureUrl(urlValue, captureEnabled, ignoreUrls, focusUrls) {
    if (!captureEnabled) return false;
    const lowered = String(urlValue || "").toLowerCase();
    if (lowered.includes("://localhost:7700") || lowered.includes("://127.0.0.1:7700")) {
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

  // extension/src/content/capture-engine.js
  function removeNodes(root, selectors) {
    selectors.forEach((selector) => {
      root.querySelectorAll(selector).forEach((el) => el.remove());
    });
  }
  function getHtmlForCapture(ignoreChatClientWidget) {
    const clone = document.documentElement.cloneNode(true);
    removeNodes(clone, ["script", "style", 'link[rel="stylesheet"]', "noscript"]);
    clone.querySelectorAll("svg").forEach((svg) => {
      svg.innerHTML = "<!-- SVG paths removed for size -->";
    });
    clone.querySelectorAll('img[src^="data:image/"]').forEach((img) => {
      img.setAttribute("src", "data:image/svg+xml,...[TRUNCATED]");
    });
    removeNodes(clone, ['[data-dom-tree-capture-overlay="1"]']);
    if (ignoreChatClientWidget) {
      removeNodes(clone, [
        'script[src*="chatclient.ai"]',
        'iframe[src*="chatclient.ai"]',
        "#chatclient-bubble-button",
        "#mobile-close-button",
        "#chatbot-widget-script",
        '[id*="chatclient"]',
        '[src*="chatclient.ai/chatbot-widget"]',
        '[src*="chatclient.ai/api/embed"]'
      ]);
    }
    return clone.outerHTML;
  }
  function quickHash(str) {
    if (!str) return 0;
    const len = str.length;
    const chunk = Math.min(4e3, len);
    const midStart = Math.max(0, Math.floor((len - chunk) / 2));
    const tailStart = Math.max(0, len - chunk);
    const sampled = str.slice(0, chunk) + "|" + str.slice(midStart, midStart + chunk) + "|" + str.slice(tailStart);
    let h = 0;
    for (let i = 0; i < sampled.length; i++) {
      h = Math.imul(31, h) + sampled.charCodeAt(i) | 0;
    }
    return `${h}:${len}`;
  }
  function createDomSignature(html) {
    const structural = html.replace(/<!--([\s\S]*?)-->/g, "").replace(/\s(data-react\S*|data-v-\S*|data-testid|aria-describedby|aria-controls)="[^"]*"/g, "").replace(/\s(id|for|name)="[^"]{8,}"/g, "").replace(/>[^<]{1,80}</g, "></g").replace(/\s+/g, " ").slice(0, 2e4);
    return `sig_${quickHash(structural)}`;
  }

  // extension/src/content/xpath-utils.js
  function getRelativeXpath(element) {
    if (!element || element.nodeType !== 1) return "";
    if (element.hasAttribute("id")) return `//*[@id="${element.id}"]`;
    if (element.tagName === "BODY") return "//BODY";
    if (element.tagName === "HTML") return "/HTML";
    let ix = 1;
    let siblings = element.parentNode ? element.parentNode.children : [];
    for (let i = 0; i < siblings.length; i++) {
      let sibling = siblings[i];
      if (sibling === element) {
        const parentPath = getRelativeXpath(element.parentNode);
        return parentPath + "/" + element.tagName + "[" + ix + "]";
      }
      if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
        ix++;
      }
    }
    return "";
  }
  function getFullXpath(element) {
    if (!element || element.nodeType !== 1) return "";
    if (element.tagName === "HTML") return "/HTML[1]";
    if (element.tagName === "BODY") return "/HTML[1]/BODY[1]";
    let ix = 1;
    let siblings = element.parentNode ? element.parentNode.children : [];
    for (let i = 0; i < siblings.length; i++) {
      let sibling = siblings[i];
      if (sibling === element) {
        return getFullXpath(element.parentNode) + "/" + element.tagName + "[" + ix + "]";
      }
      if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
        ix++;
      }
    }
    return "";
  }
  function getElementName(element) {
    if (!element || element.nodeType !== 1) return "";
    let text = (element.getAttribute("aria-label") || element.title || element.getAttribute("name") || element.getAttribute("alt") || "").trim();
    if (!text && element.textContent) {
      text = element.textContent.trim().replace(/\s+/g, " ").substring(0, 50);
    }
    if (!text && (element.tagName.toLowerCase() === "svg" || element.querySelector("svg") || typeof element.className === "string" && element.className.includes("icon"))) {
      text = "icon";
    }
    return text;
  }

  // extension/src/content/dom-observer.js
  function describeMutationTarget(node) {
    if (!node || node.nodeType !== 1) return "unknown";
    const el = node;
    const tag = (el.tagName || "node").toLowerCase();
    const id = el.id ? `#${el.id}` : "";
    const cls = typeof el.className === "string" && el.className.trim() ? `.${el.className.trim().split(/\s+/).slice(0, 2).join(".")}` : "";
    return `${tag}${id}${cls}`;
  }
  function collectOpenOverlayContext() {
    const openMenus = [];
    document.querySelectorAll('[role="listbox"]').forEach((lb) => {
      const rect = lb.getBoundingClientRect();
      if (rect.width < 2 && rect.height < 2) return;
      if (lb.getAttribute("hidden") !== null) return;
      const opts = Array.from(
        lb.querySelectorAll('[role="option"], [data-radix-collection-item]')
      ).slice(0, 400);
      if (!opts.length) return;
      openMenus.push({
        kind: "listbox",
        xpath: getFullXpath(lb),
        triggerId: lb.getAttribute("aria-labelledby") || "",
        itemCount: opts.length,
        items: opts.map((el) => ({
          text: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 500),
          value: el.getAttribute("data-value") || el.getAttribute("value") || "",
          disabled: el.getAttribute("aria-disabled") === "true" || el.hasAttribute("data-disabled"),
          selected: el.getAttribute("aria-selected") === "true" || el.getAttribute("data-state") === "checked"
        }))
      });
    });
    document.querySelectorAll('[role="menu"]').forEach((menu) => {
      const rect = menu.getBoundingClientRect();
      if (rect.width < 2 && rect.height < 2) return;
      const items = Array.from(
        menu.querySelectorAll('[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]')
      ).slice(0, 400);
      if (!items.length) return;
      openMenus.push({
        kind: "menu",
        xpath: getFullXpath(menu),
        itemCount: items.length,
        items: items.map((el) => ({
          text: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 500),
          value: el.getAttribute("data-value") || "",
          disabled: el.getAttribute("aria-disabled") === "true"
        }))
      });
    });
    document.querySelectorAll('[data-radix-popper-content-wrapper], [data-headlessui-state], [data-state="open"]').forEach((portal) => {
      const rect = portal.getBoundingClientRect();
      if (rect.width < 10 || rect.height < 10) return;
      const opts = Array.from(
        portal.querySelectorAll('[role="option"], [role="menuitem"], [data-radix-collection-item], [cmdk-item]')
      ).slice(0, 400);
      if (opts.length > 0) {
        openMenus.push({
          kind: "radix-portal",
          xpath: getFullXpath(portal),
          itemCount: opts.length,
          items: opts.map((el) => ({
            text: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 500),
            value: el.getAttribute("data-value") || el.getAttribute("value") || "",
            disabled: el.getAttribute("aria-disabled") === "true" || el.hasAttribute("data-disabled"),
            selected: el.getAttribute("aria-selected") === "true" || el.getAttribute("data-state") === "checked"
          }))
        });
      }
    });
    document.querySelectorAll('.country-list:not([style*="display: none"]), .iti__country-list').forEach((list) => {
      const items = Array.from(list.querySelectorAll("li, .country")).slice(0, 250);
      if (items.length > 0) {
        openMenus.push({
          kind: "country-selector",
          xpath: getFullXpath(list),
          itemCount: items.length,
          items: items.map((el) => ({
            text: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 100),
            value: el.getAttribute("data-country-code") || el.getAttribute("data-dial-code") || ""
          }))
        });
      }
    });
    document.querySelectorAll("select").forEach((sel) => {
      if (sel.options.length === 0) return;
      openMenus.push({
        kind: "native-select",
        id: sel.id || "",
        name: sel.name || "",
        xpath: getFullXpath(sel),
        options: Array.from(sel.options).map((o) => ({
          text: o.text,
          value: o.value,
          selected: o.selected
        }))
      });
    });
    document.querySelectorAll('[class*="dropdown"][class*="open"], [class*="dropdown"][class*="show"], [class*="menu"][class*="visible"]').forEach((dd) => {
      const rect = dd.getBoundingClientRect();
      if (rect.width < 10 || rect.height < 10) return;
      const items = Array.from(dd.querySelectorAll('li, [class*="item"], [class*="option"]')).filter((el) => el.textContent?.trim()).slice(0, 100);
      if (items.length > 0) {
        openMenus.push({
          kind: "generic-dropdown",
          xpath: getFullXpath(dd),
          itemCount: items.length,
          items: items.map((el) => ({
            text: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 200)
          }))
        });
      }
    });
    return { openMenus, capturedAt: Date.now() };
  }
  function buildInteractionContext(trigger, lastClickElement) {
    if (trigger !== "user-click" && trigger !== "dom-mutation") return null;
    let clickTarget = null;
    let targetElement = lastClickElement;
    if (targetElement && targetElement.nodeType !== 1 && targetElement.parentElement) {
      targetElement = targetElement.parentElement;
    }
    if (targetElement && targetElement.nodeType === 1) {
      clickTarget = describeMutationTarget(targetElement);
    }
    let clickData = null;
    if (trigger === "user-click" && targetElement && targetElement.nodeType === 1) {
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

  // extension/src/content/index.js
  (function() {
    if (window.__domTreeCaptureInitialized) return;
    window.__domTreeCaptureInitialized = true;
    const SERVER_URL = "http://localhost:7700";
    const SESSION_KEY = "domCaptureSessionId";
    const CLIENT_KEY = "domCaptureClientId";
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
    console.log("DOM Tree Capture initialized (Modularized)");
    function getSessionStorageArea() {
      if (chrome?.storage?.session && typeof chrome.storage.session.get === "function") {
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
        chrome.storage.local.get(["captureEnabled", "focusUrls", "ignoreUrls", "captureDomain", "ignoreChatClientWidget"], (res) => {
          const legacyDomain = String(res.captureDomain || "").trim().toLowerCase();
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
      const el = document.createElement("div");
      el.setAttribute("data-dom-tree-capture-overlay", "1");
      el.style.cssText = [
        "position:fixed",
        "bottom:20px",
        "right:20px",
        "z-index:2147483647",
        `background:${trigger === "manual" ? "#6366f1" : "#10b981"}`,
        "color:white",
        "font-family:monospace",
        "font-size:12px",
        "padding:6px 12px",
        "border-radius:6px",
        "box-shadow:0 4px 12px rgba(0,0,0,0.3)",
        "transition:opacity 0.35s ease",
        "pointer-events:none"
      ].join(";");
      el.textContent = `Saved ${trigger}`;
      document.body.appendChild(el);
      setTimeout(() => {
        el.style.opacity = "0";
      }, 1e3);
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
      if (snapshotKey === lastSnapshotKey && trigger !== "manual" && trigger !== "navigation" && !hasFreshApiActivity) return;
      if (now - lastSnapshotAt < 350 && trigger !== "manual") return;
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
        mutationSummary: trigger === "dom-mutation" ? pendingMutationSummary : null,
        interactionContext: buildInteractionContext(trigger, lastClickElement),
        html
      };
      if (trigger === "dom-mutation") {
        pendingMutationSummary = null;
      }
      fetch(`${SERVER_URL}/snapshot`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Dom-Client-Id": clientId
        },
        body: JSON.stringify(payload)
      }).then((res) => {
        if (res.ok) {
          chrome.runtime.sendMessage({ type: "SERVER_OK" });
          return;
        }
        console.error(`Snapshot rejected (${res.status})`);
      }).catch((err) => {
        console.error(`Snapshot failed: ${err.message}`);
        chrome.runtime.sendMessage({ type: "SERVER_UNREACHABLE" });
      });
      flashIndicator(trigger);
    }
    function scheduleClickCapture() {
      clearTimeout(clickTimer);
      clickTimer = setTimeout(() => {
        captureSnapshot("user-click");
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
          networkIdleTimer = setTimeout(() => captureSnapshot("network-idle"), NETWORK_IDLE_DELAY);
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
        if (mutation.type === "childList") {
          added += mutation.addedNodes ? mutation.addedNodes.length : 0;
          removed += mutation.removedNodes ? mutation.removedNodes.length : 0;
        } else if (mutation.type === "attributes") {
          attributes += 1;
        } else if (mutation.type === "characterData") {
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
        captureSnapshot("dom-mutation");
      }, MUTATION_DEBOUNCE);
    });
    function hookHistoryNavigation() {
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;
      history.pushState = function(...args) {
        originalPushState.apply(this, args);
        setTimeout(() => captureSnapshot("navigation"), 300);
      };
      history.replaceState = function(...args) {
        originalReplaceState.apply(this, args);
        setTimeout(() => captureSnapshot("navigation"), 300);
      };
      window.addEventListener("popstate", () => {
        setTimeout(() => captureSnapshot("navigation"), 300);
      });
      window.addEventListener("hashchange", () => {
        setTimeout(() => captureSnapshot("navigation"), 300);
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
        "click",
        (ev) => {
          lastClickElement = ev.target;
          scheduleClickCapture();
        },
        true
      );
      hookHistoryNavigation();
      chrome.runtime.onMessage.addListener((msg) => {
        if (msg.type === "MANUAL_SNAPSHOT") {
          captureSnapshot("manual");
        }
        if (msg.type === "SET_CAPTURE_ENABLED") {
          captureEnabled = !!msg.enabled;
        }
      });
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== "local") return;
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
      if (document.readyState === "complete") {
        setTimeout(() => captureSnapshot("page-load"), 500);
      } else {
        window.addEventListener("load", () => {
          setTimeout(() => captureSnapshot("page-load"), 500);
        });
      }
    });
  })();
})();
