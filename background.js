// DOM Tree Capture - Background Service Worker

chrome.commands.onCommand.addListener((command) => {
  if (command === 'manual-snapshot') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'MANUAL_SNAPSHOT' });
      }
    });
  }
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'SERVER_UNREACHABLE') {
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
  } else if (msg.type === 'SERVER_OK') {
    chrome.action.setBadgeText({ text: '' });
  }
});
