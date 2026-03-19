# 🌿 DOM Tree Capture

Automatically captures live DOM snapshots as a URL-based tree while you browse.
Designed for QA engineers to build Playwright POMs faster.

---

## Setup (2 steps, done once)

### Step 1 — Start the local server

```bash
cd server
node server.js
```

You should see:
```
🌿 DOM Tree Capture Server
   Running at  → http://localhost:7700
   Snapshots   → ./snapshots
   Viewer      → http://localhost:7700
```

> No npm install needed. Uses only Node.js built-ins.

---

### Step 2 — Install the Chrome extension

1. Open Chrome → go to `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `extension/` folder from this project

The 🌿 icon will appear in your toolbar.

---

## How to use

1. Make sure `node server.js` is running
2. Browse your app normally
3. Snapshots are captured **automatically** after:
   - Page load
   - Network goes idle (after API calls)
   - DOM mutations settle (dropdowns, modals, new data)
4. Press **Ctrl+Shift+S** (or Cmd+Shift+S on Mac) to capture manually
5. Open **http://localhost:7700** to view the tree

---

## The Tree Structure

```
Session (browser session)
└── Branch per unique URL
    ├── 0000_page-load_<timestamp>.html
    ├── 0001_network-idle_<timestamp>.html   ← after login API
    ├── 0002_dom-mutation_<timestamp>.html   ← after dropdown loads
    └── 0003_manual_<timestamp>.html         ← you pressed Ctrl+Shift+S
```

Files are saved in `server/snapshots/<sessionId>/<urlKey>/`.

---

## Snapshot triggers (color coded in viewer)

| Color  | Trigger        | When                                      |
|--------|----------------|-------------------------------------------|
| 🟢 Green  | page-load      | Initial page load complete                |
| 🟣 Indigo | network-idle   | All API/XHR requests finished             |
| 🟡 Amber  | dom-mutation   | DOM settled after React/SPA updates       |
| 🔴 Red    | manual         | You pressed Ctrl+Shift+S                  |

---

## Viewer features

- **Tree sidebar** — all sessions and URL branches
- **Timeline bar** — every snapshot for the selected branch, in order
- **Preview pane** — live rendered HTML in iframe
- **Search** — filter branches by URL/pathname
- **Live updates** — viewer polls every 2s, new snapshots appear automatically

---

## Tips for POM building

- Open a branch → scan snapshots in order to see full page lifecycle
- `network-idle` snapshots contain fully loaded dropdown options, loaded data tables, etc.
- `dom-mutation` snapshots capture modals/overlays after they open
- HTML files are plain static files — open them in browser, grep them, or feed into Claude

---

## File layout

```
dom-tree-capture/
├── extension/          ← Load this in chrome://extensions
│   ├── manifest.json
│   ├── content.js      ← Runs on every page, captures DOM
│   ├── background.js   ← Handles keyboard shortcut
│   ├── popup.html/js   ← Extension popup
│   └── icons/
└── server/
    ├── server.js       ← node server.js
    ├── public/
    │   └── index.html  ← Viewer UI at localhost:7700
    └── snapshots/      ← Created automatically
        └── <session>/
            └── <urlKey>/
                ├── meta.json
                └── *.html
```
