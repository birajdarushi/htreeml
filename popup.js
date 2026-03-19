const SERVER = 'http://localhost:7700';

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

checkServer();

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
