const SERVER = 'http://localhost:7700';
const SETTINGS_KEYS = ['captureEnabled', 'focusUrls', 'ignoreUrls', 'captureDomain', 'ignoreChatClientWidget'];

async function checkServer() {
  try {
    const res = await fetch(`${SERVER}/ping`, { signal: AbortSignal.timeout(1500) });
    if (res.ok) {
      document.getElementById('dot').classList.add('connected');
      document.getElementById('status-text').textContent = 'Server running on :7700';
      return true;
    }
  } catch (_) {}
  document.getElementById('dot').classList.remove('connected');
  document.getElementById('status-text').textContent = 'Server not running — start server.js';
  return false;
}

function normalizeList(raw) {
  return String(raw || '')
    .split(/[\n,]/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function listToText(list) {
  return (Array.isArray(list) ? list : []).join(', ');
}

function updateRuleBadges(focusUrls, ignoreUrls) {
  const focusBadge = document.getElementById('focus-status');
  const ignoreBadge = document.getElementById('ignore-status');

  if (focusUrls.length) {
    focusBadge.textContent = `Focus rules: ${focusUrls.length}`;
    focusBadge.style.color = '#10b981';
  } else {
    focusBadge.textContent = 'No focus rules';
    focusBadge.style.color = '#999';
  }

  if (ignoreUrls.length) {
    ignoreBadge.textContent = `Ignore rules: ${ignoreUrls.length}`;
    ignoreBadge.style.color = '#f59e0b';
  } else {
    ignoreBadge.textContent = 'No ignore rules';
    ignoreBadge.style.color = '#999';
  }
}

function updateCaptureToggle(enabled) {
  const btn = document.getElementById('toggle-capture-btn');
  const status = document.getElementById('capture-state-text');
  if (enabled) {
    btn.textContent = '⏸ Stop Capture';
    btn.classList.remove('btn-primary');
    btn.classList.add('btn-secondary');
    status.textContent = 'Auto capture is ON';
    status.style.color = '#10b981';
  } else {
    btn.textContent = '▶ Start Capture';
    btn.classList.remove('btn-secondary');
    btn.classList.add('btn-primary');
    status.textContent = 'Auto capture is OFF';
    status.style.color = '#f59e0b';
  }
}

function loadSettings() {
  chrome.storage.local.get(SETTINGS_KEYS, (res) => {
    const focusUrls = Array.isArray(res.focusUrls)
      ? res.focusUrls
      : (res.captureDomain ? [String(res.captureDomain).trim().toLowerCase()] : []);
    const ignoreUrls = Array.isArray(res.ignoreUrls) ? res.ignoreUrls : [];
    const captureEnabled = res.captureEnabled !== false;
    const ignoreChatClientWidget = res.ignoreChatClientWidget !== false;

    document.getElementById('focus-urls').value = listToText(focusUrls);
    document.getElementById('ignore-urls').value = listToText(ignoreUrls);
    document.getElementById('ignore-chatclient').checked = ignoreChatClientWidget;
    updateRuleBadges(focusUrls, ignoreUrls);
    updateCaptureToggle(captureEnabled);
  });
}

function saveRules() {
  const focusUrls = normalizeList(document.getElementById('focus-urls').value);
  const ignoreUrls = normalizeList(document.getElementById('ignore-urls').value);
  const ignoreChatClientWidget = document.getElementById('ignore-chatclient').checked;

  chrome.storage.local.set({
    focusUrls,
    ignoreUrls,
    ignoreChatClientWidget,
    // Keep backward compatibility so old code still works with a single domain rule.
    captureDomain: focusUrls[0] || ''
  });

  updateRuleBadges(focusUrls, ignoreUrls);
}

function toggleCaptureEnabled() {
  chrome.storage.local.get(['captureEnabled'], (res) => {
    const next = !(res.captureEnabled !== false);
    chrome.storage.local.set({ captureEnabled: next });
    updateCaptureToggle(next);
  });
}

function applyBynryPreset() {
  const preset = '*.bynry.com/*';
  document.getElementById('focus-urls').value = preset;
  saveRules();
}

document.getElementById('focus-urls').addEventListener('change', saveRules);
document.getElementById('focus-urls').addEventListener('blur', saveRules);
document.getElementById('ignore-urls').addEventListener('change', saveRules);
document.getElementById('ignore-urls').addEventListener('blur', saveRules);
document.getElementById('ignore-chatclient').addEventListener('change', saveRules);
document.getElementById('toggle-capture-btn').addEventListener('click', toggleCaptureEnabled);
document.getElementById('preset-bynry-btn').addEventListener('click', applyBynryPreset);

checkServer();
loadSettings();

document.getElementById('snap-btn').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'MANUAL_SNAPSHOT' });
      window.close();
    }
  });
});

document.getElementById('viewer-btn').addEventListener('click', () => {
  chrome.tabs.create({ url: SERVER });
});
