# 🤖 AI Agent Integration Guide

Generate **best-in-class, production-ready Page Object Models** using AI agents with complete page context.

---

## 📦 What is the AI Context Pack?

The **AI Context Pack** bundles all necessary information into a single markdown file that gives an AI agent everything it needs to generate perfect POMs:

1. **BasePage API Contract** - All available methods your POM can use
2. **Complete Page Documentation** - Every element, dropdown, and interaction
3. **Auto-generated Skeleton** - Pre-computed XPath/CSS selectors
4. **Generation Instructions** - Clear requirements and examples

---

## 🚀 Quick Start

### 1. Generate Index Files (if not done)

```bash
# Run the indexer on your snapshots
npm run index

# Or force regenerate all
npm run index:force
```

### 2. List Available Pages

```bash
node server/scripts/generate-ai-context.js --list
```

Output:
```
📁 Available Sessions and Pages:

Session: session_1774987490873_sq30cl
  └─ platform-new_bynry_com__cx__dashboard
  └─ platform-new_bynry_com__cx__consumer-management
  └─ platform-new_bynry_com__cx__consumer-management__create__manual

Total: 7 sessions, 10 pages
```

### 3. Generate AI Context Pack

```bash
# Generate context pack for a specific page
node server/scripts/generate-ai-context.js \
  --session session_1774987490873_sq30cl \
  --page platform-new_bynry_com__cx__consumer-management__create__manual \
  --output consumer-form-pom-context.md
```

### 4. Feed to AI Agent

```bash
# Option A: Pipe directly to your AI tool
cat consumer-form-pom-context.md | your-ai-tool

# Option B: Upload file to AI chat interface
# (Claude, ChatGPT, Cursor, etc.)

# Option C: Use in VS Code with AI extension
code consumer-form-pom-context.md
```

---

## 📋 What's Inside the Context Pack?

### Section 1: BasePage API Contract

The complete API your POM must use:

```python
"""
BasePage - Abstract base class for all Page Object Models
All generated POM classes inherit from BasePage and use its 
wrapper methods instead of calling Playwright page methods directly.
"""

class BasePage(ABC):
    def click(self, locator: str, **kwargs) -> None
    def fill(self, locator: str, value: str, **kwargs) -> None
    def get_text(self, locator: str) -> str
    def is_visible(self, locator: str, timeout: int = 5000) -> bool
    def select_option(self, locator: str, value: str, **kwargs) -> None
    # ... and more
```

**AI Instruction:** Use ONLY these methods in your generated POM.

### Section 2: Page Documentation

Complete documentation from `index.md`:

- ✅ Page identity (URL, title, session info)
- ✅ Navigation trail (how user reaches this page)
- ✅ Interactive elements table (label, tag, XPath, CSS)
- ✅ Dropdowns & Select Fields with options
- ✅ API calls observed during capture
- ✅ Timeline of interactions

### Section 3: Auto-generated Skeleton

Reference implementation showing:
- Element constants with pre-computed locators
- Basic structure following BasePage patterns
- XPath and CSS selectors extracted from actual HTML

### Section 4: Generation Instructions

Detailed requirements:
1. Inheritance pattern
2. Method usage restrictions
3. Element constant naming conventions
4. Business method guidelines
5. Type hints and docstrings
6. Dropdown handling strategies
7. Assertion patterns

---

## 💡 Example AI Prompt

When using the context pack, use this prompt:

```markdown
You are an expert SDET creating a production-ready Playwright Page Object Model.

Using the provided AI Context Pack, generate a complete POM class for the 
"Consumer Management - Create Manual" page.

Requirements:
1. Inherit from BasePage (Section 1)
2. Implement ALL elements listed in Section 2 "Element Mapping"
3. Handle dropdowns as described in "Dropdowns to Implement"
4. Follow Python type hints and docstring conventions
5. Create business methods for common user actions
6. Add validation methods (is_page_loaded, verify_success, etc.)

Focus on:
- Stability: Use XPath locators provided
- Readability: Clear method names and docstrings
- Maintainability: Constants for all locators
- Completeness: Cover all interactive elements

Generate the complete Python class now.
```

---

## 🎯 Best Practices for AI-Generated POMs

### ✅ DO:

1. **Review Generated Code**
   - Verify all critical elements are included
   - Check XPath/CSS selectors match your needs
   - Ensure business logic makes sense

2. **Enhance with Domain Knowledge**
   - Add domain-specific validation
   - Include error handling scenarios
   - Create composite methods for workflows

3. **Test Locators**
   - Run the POM against the actual application
   - Verify all elements are found
   - Adjust if UI changes

4. **Follow Team Conventions**
   - Naming standards
   - Code organization
   - Comment style

### ❌ DON'T:

1. **Don't blindly trust AI output**
   - Always review and test
   - Verify locators work
   - Check edge cases

2. **Don't skip BasePage contract**
   - Must use only BasePage methods
   - Don't call Playwright page directly
   - Maintain abstraction layer

3. **Don't ignore dropdown data**
   - If options show 0, recapture with clicks
   - Use the dropdown section for reference
   - Implement proper custom dropdown handling

---

## 🔧 Advanced Usage

### Batch Generation

Generate context packs for multiple pages:

```bash
#!/bin/bash
# Generate context packs for entire session

SESSION="session_1774987490873_sq30cl"

for page in $(node server/scripts/generate-ai-context.js --list | grep "$SESSION" -A 100 | grep "└─" | awk '{print $2}'); do
  echo "Generating context pack for: $page"
  node server/scripts/generate-ai-context.js \
    --session $SESSION \
    --page "$page" \
    --output "context-packs/${page//\//_}.md"
done
```

### Custom Output Templates

Modify `generate-ai-context.js` to add custom sections:
- Team-specific coding standards
- Additional validation patterns
- Project-specific utilities

### Integration with CI/CD

```yaml
# .github/workflows/generate-poms.yml
name: Generate POMs from Snapshots

on:
  workflow_dispatch:
    inputs:
      sessionId:
        description: 'Session ID to process'
        required: true

jobs:
  generate-poms:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Generate indexes
        run: npm run index
      
      - name: Generate AI context packs
        run: |
          node server/scripts/generate-ai-context.js \
            --session ${{ github.event.inputs.sessionId }} \
            --output poms-context.md
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: ai-context-packs
          path: poms-context.md
```

---

## 📊 Comparison: Before vs After AI Context Pack

### ❌ Before (Manual POM Creation)

```python
# Developer manually inspects page
# Writes POM from memory/notes
# Might miss elements
# Locators might be outdated
# Inconsistent method naming
# No dropdown documentation
# Takes 2-4 hours per page

class ConsumerPage(BasePage):
    # What elements exist?
    # What are the best locators?
    # How many dropdowns?
    # What are the validation rules?
    
    def fill_name(self, name):
        self.page.fill('#name', name)  # Inconsistent!
    
    def submit(self):
        self.page.click('button[type=submit]')  # Direct page access!
```

### ✅ After (AI with Context Pack)

```python
# AI has complete page documentation
# All elements listed with optimal locators
# Dropdowns documented with options
# API calls known
# Validation points clear
# Takes 5 minutes to generate + 15 min review

class ConsumerManagementCreateManual(BasePage):
    """Page Object Model for Consumer Creation - Manual Entry."""
    
    # Constants from index.md data
    EL_FIRST_NAME = "//input[@placeholder='Enter first name']"
    EL_LAST_NAME = "//input[@placeholder='Enter last name']"
    EL_EMAIL = "//input[@type='email']"
    EL_CONSUMER_TYPE = "//select[@id='consumer-type']"
    BTN_SUBMIT = "//button[normalize-space()='Create Consumer']"
    
    def __init__(self, page: Page, base_url: Optional[str] = None):
        super().__init__(page, base_url)
    
    def create_consumer(self, consumer_data: Dict[str, str]) -> None:
        """Create a new consumer with provided data.
        
        Args:
            consumer_data: Dictionary with keys:
                - first_name: str
                - last_name: str
                - email: str
                - phone: str
                - consumer_type: str (individual|business|enterprise)
        """
        self.fill(self.EL_FIRST_NAME, consumer_data['first_name'])
        self.fill(self.EL_LAST_NAME, consumer_data['last_name'])
        self.fill(self.EL_EMAIL, consumer_data['email'])
        self.select_option(self.EL_CONSUMER_TYPE, consumer_data['consumer_type'])
        self.click(self.BTN_SUBMIT)
    
    def is_page_loaded(self) -> bool:
        """Verify page loaded by checking key elements."""
        return self.is_visible(self.EL_FIRST_NAME)
```

---

## 🎓 Learning Resources

### Understanding the Architecture

```
┌─────────────────────┐
│  Chrome Extension   │  ← Captures DOM snapshots
│  (Ctrl+Shift+S)     │     Triggers: page-load, click, mutation
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  Server (Port 7700) │  ← Stores snapshots
│  POST /api/snapshot │     {sessionId}/{urlKey}/
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│     Indexer         │  ← Analyzes snapshots
│  npm run index      │     Extracts elements, APIs, dropdowns
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  AI Context Pack    │  ← Bundles for AI consumption
│  generator script   │     BasePage + index.md + skeleton
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│   AI Agent (You)    │  ← Generates production POM
│  Claude/Cursor/GPT  │     Complete, tested, ready to use
└─────────────────────┘
```

### Related Documentation

- [Indexer Feature Specification](../../README.md#indexer-feature)
- [BasePage API Reference](server/scripts/base_page.py)
- [Snapshot Storage Schema](server/src/services/snapshot-storage.js)
- [Extension Capture Triggers](extension/src/content/index.js)

---

## 🆘 Troubleshooting

### Issue: "No dropdowns found" but page has dropdowns

**Cause:** Dropdowns weren't clicked during capture.

**Solution:**
1. Reload Chrome extension
2. Browse to page
3. Click each dropdown to open it
4. Trigger another snapshot (Ctrl+Shift+S)
5. Regenerate index: `npm run index:force`
6. Check dropdown options in new index.md

### Issue: "XPath not working" in generated POM

**Cause:** Dynamic content or shadow DOM.

**Solution:**
1. Check if element appears in `latest.ai.html`
2. Look for better locators in index.md (CSS selector, data-testid)
3. Use wait strategies in POM
4. Consider iframe/shadow DOM handling

### Issue: "Too many elements" in context pack

**Cause:** Page has navigation, menus, footers with hundreds of elements.

**Solution:**
1. Edit `generate-ai-context.js` to filter elements
2. Focus on main content area only
3. Exclude repeated navigation elements
4. Generate separate POMs for different sections

---

## 📞 Support

For issues or questions:
- Check project README.md
- Review indexer documentation
- Examine generated index.md files
- Consult BasePage implementation

---

**Generated:** 2026-04-01  
**Version:** 1.0.0  
**Project:** htreeml - DOM Tree Capture & Analysis
