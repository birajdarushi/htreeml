# 🌿 htreeml (DOM Tree Capture)

Automatically captures live DOM snapshots as a URL-based tree while you browse.  
Designed for **QA engineers** to build Playwright Page Object Models (POMs) faster with AI-ready snapshots and mutation analysis.

![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)
![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=google-chrome&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue)

---

## ✨ Key Features

| Feature | Description |
|---------|-------------|
| 🎯 **Auto-Capture** | Snapshots on page load, clicks, DOM mutations, and network idle |
| 🤖 **AI-Ready Output** | Clean `latest.ai.html` stripped of noise for LLM consumption |
| 🔍 **Mutation Tracking** | Automatic DOM diff analysis between snapshots |
| 📊 **Indexer** | Generates navigation indexes and POM Python skeletons |
| 🌐 **API Monitoring** | Tracks all `fetch` and `XHR` calls per snapshot |
| 🖱 **Click Context** | Captures XPath and element info for every user click |

---

## 🚀 Quick Start

### Step 1 — Install & Start Server

```bash
npm install
npm start
```

You should see:
```
DOM Tree Capture Server (Modularized)
Running   : http://localhost:7700
Snapshots : /path/to/project/server/snapshots
```

### Step 2 — Build & Load Chrome Extension

```bash
npm run build
```

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** → select the `extension/` folder

The 🌿 icon appears in your toolbar.

---

## 📖 How to Use

### Capture Snapshots

1. Ensure `npm start` is running
2. Browse your application normally
3. Snapshots are captured **automatically** on:
   - **Page load** — Initial page render
   - **Navigation** — SPA route changes (`pushState`, `popstate`)
   - **Network idle** — After all API calls complete
   - **DOM mutations** — Dropdowns, modals, dynamic content
   - **User clicks** — Every interactive element clicked
4. Press **Ctrl+Shift+S** (Mac: **Cmd+Shift+S**) for manual capture
5. View the tree at **http://localhost:7700**

### Generate POM Indexes

After capturing snapshots, run the **Indexer** to generate:
- **Navigation Index** (`index.md`) — Human-readable page documentation
- **POM Skeleton** (`pom_*.py`) — Playwright Page Object Model

```bash
# Generate indexes for all captured pages
npm run index

# Force regenerate existing indexes
npm run index:force
```

Output location: `server/index-output/{sessionId}/{urlKey}/`

---

## 📁 Project Structure

```
htreeml/
├── extension/                 ← Chrome extension (load this)
│   ├── content.js             ← Bundled capture script
│   ├── src/content/           ← Source modules
│   │   ├── index.js           ← Main orchestrator
│   │   ├── capture-engine.js  ← DOM cloning & cleaning
│   │   ├── dom-observer.js    ← Mutation tracking
│   │   ├── network-patch.js   ← XHR/fetch interception
│   │   ├── filter-rules.js    ← URL filtering logic
│   │   └── xpath-utils.js     ← XPath generation
│   └── icons/                 ← Extension icons
│
├── server/
│   ├── src/
│   │   ├── index.js           ← HTTP server (port 7700)
│   │   ├── routes/
│   │   │   ├── api.js         ← Tree & snapshot APIs
│   │   │   ├── snapshot.js    ← POST /snapshot handler
│   │   │   └── index-api.js   ← Index serving API
│   │   └── services/
│   │       ├── snapshot-storage.js  ← Storage & persistence
│   │       └── html-cleaner.js      ← AI-friendly HTML
│   │
│   ├── public/                ← Dashboard UI
│   ├── snapshots/             ← Captured data (gitignored)
│   ├── index-output/          ← Generated POMs (gitignored)
│   └── scripts/
│       ├── indexer.js         ← POM & index generator
│       └── base_page.py       ← BasePage class for POMs
│
└── scripts/                   ← Analysis utilities
    ├── analyze_latest_html.js
    ├── analyze_latest_mutations.js
    └── mutation_compare.js
```

---

## 🔌 API Reference

### Capture Server (localhost:7700)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Dashboard UI |
| `GET` | `/ping` | Health check |
| `POST` | `/snapshot` | Receive snapshot from extension |
| `GET` | `/api/tree` | List all sessions and branches |
| `GET` | `/api/snapshots?session=X&branch=Y` | Get branch metadata |
| `GET` | `/api/file?session=X&branch=Y&file=Z` | Get snapshot HTML |

### Index API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/index` | List all generated indexes |
| `GET` | `/api/index/:sessionId` | List pages in session |
| `GET` | `/api/index/:sessionId/:urlKey` | Get index metadata |
| `GET` | `/api/index/:sessionId/:urlKey/index.md` | Download navigation index |
| `GET` | `/api/index/:sessionId/:urlKey/pom_*.py` | Download POM skeleton |

---

## 📊 Snapshot Data Schema

Each captured page creates a branch folder:

```
server/snapshots/{sessionId}/{urlKey}/
├── meta.json           ← Branch metadata & snapshot list
├── latest.html         ← Combined timeline of all snapshots
├── latest.ai.html      ← AI-friendly cleaned HTML
├── api-events.ndjson   ← API calls (newline-delimited JSON)
└── 0001_page-load_*.html  ← Individual full snapshots
```

### Trigger Types

| Trigger | Description | Full Snapshot |
|---------|-------------|---------------|
| `page-load` | Initial page render | ✅ Always |
| `navigation` | SPA route change | ✅ Always |
| `manual` | User pressed Ctrl+Shift+S | ✅ Always |
| `user-click` | User clicked an element | Every 10s |
| `dom-mutation` | DOM changed | Every 20s |
| `network-idle` | All API calls completed | Every 10s |

---

## 🎯 URL Filtering

Configure in the extension popup:

- **Focus URLs** — Only capture these URLs (supports wildcards)
  - `example.com` — Match domain
  - `*.example.com/dashboard/*` — Wildcard matching
- **Ignore URLs** — Never capture these

The collector URL (`localhost:7700`) is always ignored.

---

## 🛠 NPM Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start the capture server |
| `npm run build` | Bundle extension with esbuild |
| `npm run index` | Generate POM indexes |
| `npm run index:force` | Regenerate all indexes |
| `npm run analyze` | Run mutation analysis |

---

## 🐍 Generated POM Example

The indexer generates Playwright-ready Python POMs:

```python
from base_page import BasePage

class DashboardOrdersPage(BasePage):
    """
    URL      : https://app.example.com/dashboard/orders
    Reached  : After clicking 'Orders' link on DashboardPage
    """

    # ── Locators ──────────────────────────────────────────────────
    BTN_SUBMIT_ORDER = "//button[normalize-space()='Submit Order']"
    LNK_BACK = "#back-link"
    TXT_ORDER_ID = "//span[@data-testid='order-id']"

    # ── Actions ───────────────────────────────────────────────────
    def navigate_to(self):
        self.navigate("https://app.example.com/dashboard/orders")

    def click_submit_order(self):
        self.click(self.BTN_SUBMIT_ORDER)

    def get_order_id(self) -> str:
        return self.get_text(self.TXT_ORDER_ID)
```

POMs inherit from `BasePage` which wraps Playwright methods:
- `self.click(locator)`
- `self.fill(locator, value)`
- `self.get_text(locator)`
- `self.is_visible(locator)`
- `self.wait_for_element(locator)`
- `self.navigate(url)`

---

## 🔧 Development

### Rebuild Extension

```bash
npm run build
```

Then reload the extension in Chrome.

### Tech Stack

- **Server**: Node.js 18+, native `http` module
- **HTML Parsing**: jsdom 23.x
- **Extension Build**: esbuild 0.27.x

---

## 📝 License

MIT License — see [LICENSE](LICENSE) for details.
