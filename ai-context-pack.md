# AI AGENT CONTEXT PACK
# Generated: 2026-03-31T20:41:21.303Z
# Page: platform-new_bynry_com__cx__consumer-management__create__manual
# Session: session_1774987490873_sq30cl

╔══════════════════════════════════════════════════════════════════════════╗
║ SECTION 1: BASEPAGE API CONTRACT                                        ║
║ INSTRUCTIONS: Use ONLY these methods in your generated POM              ║
╚══════════════════════════════════════════════════════════════════════════╝

File: base_page.py
─────────────────────────────────────────────────────────────────────────────

"""
BasePage - Abstract base class for all Page Object Models

This module provides the foundation for Playwright-based Page Object Models.
All generated POM classes inherit from BasePage and use its wrapper methods
instead of calling Playwright page methods directly.

Usage:
    from base_page import BasePage
    
    class LoginPage(BasePage):
        BTN_SUBMIT = "//button[@type='submit']"
        
        def submit_login(self):
            self.click(self.BTN_SUBMIT)
"""

from abc import ABC
from typing import Optional
from playwright.sync_api import Page, Locator, expect


class BasePage(ABC):
    """
    Abstract base class for all Page Object Models.
    
    Provides a consistent interface for interacting with page elements
    using Playwright under the hood. All generated POMs inherit from
    this class and use its wrapper methods exclusively.
    
    Attributes:
        page: The Playwright Page instance
        base_url: Optional base URL for the application
    """
    
    def __init__(self, page: Page, base_url: Optional[str] = None):
        """
        Initialize the BasePage.
        
        Args:
            page: Playwright Page instance
            base_url: Optional base URL for relative navigation
        """
        self.page = page
        self.base_url = base_url
    
    # ══════════════════════════════════════════════════════════════════════════
    # NAVIGATION
    # ══════════════════════════════════════════════════════════════════════════
    
    def navigate(self, url: str) -> None:
        """
        Navigate to the specified URL.
        
        If url is relative and base_url is set, combines them.
        
        Args:
            url: The URL to navigate to (absolute or relative)
        """
        if not url.startswith(('http://', 'https://')) and self.base_url:
            url = f"{self.base_url.rstrip('/')}/{url.lstrip('/')}"
        self.page.goto(url, wait_until="domcontentloaded")
    
    def reload(self) -> None:
        """Reload the current page."""
        self.page.reload(wait_until="domcontentloaded")
    
    def go_back(self) -> None:
        """Navigate to the previous page in history."""
        self.page.go_back()
    
    def go_forward(self) -> None:
        """Navigate to the next page in history."""
        self.page.go_forward()
    
    # ══════════════════════════════════════════════════════════════════════════
    # LOCATOR RESOLUTION
    # ══════════════════════════════════════════════════════════════════════════
    
    def _resolve_locator(self, locator: str) -> Locator:
        """
        Convert a locator string to a Playwright Locator.
        
        Automatically detects XPath vs CSS selectors:
        - Strings starting with // or / are treated as XPath
        - Everything else is treated as CSS selector
        
        Args:
            locator: XPath or CSS selector string
            
        Returns:
            Playwright Locator instance
        """
        if locator.startswith('//') or locator.startswith('/'):
            return self.page.locator(f"xpath={locator}")
        return self.page.locator(locator)
    
    # ══════════════════════════════════════════════════════════════════════════
    # INTERACTIONS
    # ══════════════════════════════════════════════════════════════════════════
    
    def click(self, locator: str, **kwargs) -> None:
        """
        Click on an element.
        
        Args:
            locator: XPath or CSS selector
            **kwargs: Additional options passed to Playwright's click()
        """
        self._resolve_locator(locator).click(**kwargs)
    
    def double_click(self, locator: str, **kwargs) -> None:
        """
        Double-click on an element.
        
        Args:
            locator: XPath or CSS selector
            **kwargs: Additional options passed to Playwright's dblclick()
        """
        self._resolve_locator(locator).dblclick(**kwargs)
    
    def right_click(self, locator: str, **kwargs) -> None:
        """
        Right-click on an element.
        
        Args:
            locator: XPath or CSS selector
            **kwargs: Additional options passed to Playwright's click()
        """
        self._resolve_locator(locator).click(button="right", **kwargs)
    
    def fill(self, locator: str, value: str, **kwargs) -> None:
        """
        Fill a text input with the specified value.
        
        Clears existing content before typing.
        
        Args:
            locator: XPath or CSS selector for input element
            value: Text to fill into the input
            **kwargs: Additional options passed to Playwright's fill()
        """
        self._resolve_locator(locator).fill(value, **kwargs)
    
    def type_text(self, locator: str, text: str, delay: int = 50) -> None:
        """
        Type text character by character (simulates real typing).
        
        Args:
            locator: XPath or CSS selector for input element
            text: Text to type
            delay: Delay between keystrokes in milliseconds
        """
        self._resolve_locator(locator).type(text, delay=delay)
    
    def clear(self, locator: str) -> None:
        """
        Clear the contents of an input field.
        
        Args:
            locator: XPath or CSS selector for input element
        """
        self._resolve_locator(locator).clear()
    
    def select_option(self, locator: str, value: str, **kwargs) -> None:
        """
        Select an option from a dropdown/select element.
        
        Args:
            locator: XPath or CSS selector for select element
            value: Value or label of the option to select
            **kwargs: Additional options passed to Playwright's select_option()
        """
        self._resolve_locator(locator).select_option(value, **kwargs)
    
    def check(self, locator: str, **kwargs) -> None:
        """
        Check a checkbox or radio button.
        
        Args:
            locator: XPath or CSS selector
            **kwargs: Additional options passed to Playwright's check()
        """
        self._resolve_locator(locator).check(**kwargs)
    
    def uncheck(self, locator: str, **kwargs) -> None:
        """
        Uncheck a checkbox.
        
        Args:
            locator: XPath or CSS selector
            **kwargs: Additional options passed to Playwright's uncheck()
        """
        self._resolve_locator(locator).uncheck(**kwargs)
    
    def hover(self, locator: str, **kwargs) -> None:
        """
        Hover over an element.
        
        Args:
            locator: XPath or CSS selector
            **kwargs: Additional options passed to Playwright's hover()
        """
        self._resolve_locator(locator).hover(**kwargs)
    
    def focus(self, locator: str) -> None:
        """
        Focus on an element.
        
        Args:
            locator: XPath or CSS selector
        """
        self._resolve_locator(locator).focus()
    
    def press_key(self, locator: str, key: str) -> None:
        """
        Press a keyboard key while focused on an element.
        
        Args:
            locator: XPath or CSS selector
            key: Key to press (e.g., 'Enter', 'Tab', 'Escape')
        """
        self._resolve_locator(locator).press(key)
    
    def drag_to(self, source_locator: str, target_locator: str) -> None:
        """
        Drag an element to another element.
        
        Args:
            source_locator: XPath or CSS selector for source element
            target_locator: XPath or CSS selector for target element
        """
        source = self._resolve_locator(source_locator)
        target = self._resolve_locator(target_locator)
        source.drag_to(target)
    
    # ══════════════════════════════════════════════════════════════════════════
    # GETTERS
    # ══════════════════════════════════════════════════════════════════════════
    
    def get_text(self, locator: str) -> str:
        """
        Get the text content of an element.
        
        Args:
            locator: XPath or CSS selector
            
        Returns:
            The text content of the element
        """
        return self._resolve_locator(locator).text_content() or ""
    
    def get_inner_text(self, locator: str) -> str:
        """
        Get the inner text of an element (visible text only).
        
        Args:
            locator: XPath or CSS selector
            
        Returns:
            The inner text of the element
        """
        return self._resolve_locator(locator).inner_text()
    
    def get_attribute(self, locator: str, attribute: str) -> Optional[str]:
        """
        Get an attribute value from an element.
        
        Args:
            locator: XPath or CSS selector
            attribute: Name of the attribute
            
        Returns:
            The attribute value, or None if not present
        """
        return self._resolve_locator(locator).get_attribute(attribute)
    
    def get_input_value(self, locator: str) -> str:
        """
        Get the current value of an input element.
        
        Args:
            locator: XPath or CSS selector
            
        Returns:
            The input's current value
        """
        return self._resolve_locator(locator).input_value()
    
    def get_all_texts(self, locator: str) -> list[str]:
        """
        Get text content from all matching elements.
        
        Args:
            locator: XPath or CSS selector
            
        Returns:
            List of text contents from all matching elements
        """
        return self._resolve_locator(locator).all_text_contents()
    
    def count(self, locator: str) -> int:
        """
        Count the number of elements matching the locator.
        
        Args:
            locator: XPath or CSS selector
            
        Returns:
            Number of matching elements
        """
        return self._resolve_locator(locator).count()
    
    # ══════════════════════════════════════════════════════════════════════════
    # VISIBILITY & STATE
    # ══════════════════════════════════════════════════════════════════════════
    
    def is_visible(self, locator: str, timeout: int = 5000) -> bool:
        """
        Check if an element is visible.
        
        Args:
            locator: XPath or CSS selector
            timeout: Maximum time to wait in milliseconds
            
        Returns:
            True if element is visible, False otherwise
        """
        try:
            return self._resolve_locator(locator).is_visible(timeout=timeout)
        except Exception:
            return False
    
    def is_enabled(self, locator: str) -> bool:
        """
        Check if an element is enabled (not disabled).
        
        Args:
            locator: XPath or CSS selector
            
        Returns:
            True if element is enabled
        """
        return self._resolve_locator(locator).is_enabled()
    
    def is_checked(self, locator: str) -> bool:
        """
        Check if a checkbox/radio is checked.
        
        Args:
            locator: XPath or CSS selector
            
        Returns:
            True if element is checked
        """
        return self._resolve_locator(locator).is_checked()
    
    def is_hidden(self, locator: str) -> bool:
        """
        Check if an element is hidden.
        
        Args:
            locator: XPath or CSS selector
            
        Returns:
            True if element is hidden
        """
        return self._resolve_locator(locator).is_hidden()
    
    # ══════════════════════════════════════════════════════════════════════════
    # WAITING
    # ══════════════════════════════════════════════════════════════════════════
    
    def wait_for_element(self, locator: str, state: str = "visible", timeout: int = 30000) -> None:
        """
        Wait for an element to reach a specific state.
        
        Args:
            locator: XPath or CSS selector
            state: Expected state - 'attached', 'detached', 'visible', 'hidden'
            timeout: Maximum time to wait in milliseconds
        """
        self._resolve_locator(locator).wait_for(state=state, timeout=timeout)
    
    def wait_for_load_state(self, state: str = "load") -> None:
        """
        Wait for the page to reach a specific load state.
        
        Args:
            state: Load state - 'load', 'domcontentloaded', 'networkidle'
        """
        self.page.wait_for_load_state(state)
    
    def wait_for_url(self, url_pattern: str, timeout: int = 30000) -> None:
        """
        Wait for the page URL to match a pattern.
        
        Args:
            url_pattern: URL string or regex pattern
            timeout: Maximum time to wait in milliseconds
        """
        self.page.wait_for_url(url_pattern, timeout=timeout)
    
    def wait(self, milliseconds: int) -> None:
        """
        Wait for a fixed amount of time.
        
        Note: Prefer wait_for_element() when possible.
        
        Args:
            milliseconds: Time to wait in milliseconds
        """
        self.page.wait_for_timeout(milliseconds)
    
    # ══════════════════════════════════════════════════════════════════════════
    # ASSERTIONS (using Playwright expect)
    # ══════════════════════════════════════════════════════════════════════════
    
    def expect_visible(self, locator: str, timeout: int = 5000) -> None:
        """
        Assert that an element is visible.
        
        Args:
            locator: XPath or CSS selector
            timeout: Maximum time to wait in milliseconds
        """
        expect(self._resolve_locator(locator)).to_be_visible(timeout=timeout)
    
    def expect_hidden(self, locator: str, timeout: int = 5000) -> None:
        """
        Assert that an element is hidden.
        
        Args:
            locator: XPath or CSS selector
            timeout: Maximum time to wait in milliseconds
        """
        expect(self._resolve_locator(locator)).to_be_hidden(timeout=timeout)
    
    def expect_text(self, locator: str, text: str, timeout: int = 5000) -> None:
        """
        Assert that an element contains specific text.
        
        Args:
            locator: XPath or CSS selector
            text: Expected text content
            timeout: Maximum time to wait in milliseconds
        """
        expect(self._resolve_locator(locator)).to_have_text(text, timeout=timeout)
    
    def expect_text_contains(self, locator: str, text: str, timeout: int = 5000) -> None:
        """
        Assert that an element contains text (partial match).
        
        Args:
            locator: XPath or CSS selector
            text: Text to search for
            timeout: Maximum time to wait in milliseconds
        """
        expect(self._resolve_locator(locator)).to_contain_text(text, timeout=timeout)
    
    def expect_value(self, locator: str, value: str, timeout: int = 5000) -> None:
        """
        Assert that an input has a specific value.
        
        Args:
            locator: XPath or CSS selector
            value: Expected input value
            timeout: Maximum time to wait in milliseconds
        """
        expect(self._resolve_locator(locator)).to_have_value(value, timeout=timeout)
    
    def expect_enabled(self, locator: str, timeout: int = 5000) -> None:
        """
        Assert that an element is enabled.
        
        Args:
            locator: XPath or CSS selector
            timeout: Maximum time to wait in milliseconds
        """
        expect(self._resolve_locator(locator)).to_be_enabled(timeout=timeout)
    
    def expect_disabled(self, locator: str, timeout: int = 5000) -> None:
        """
        Assert that an element is disabled.
        
        Args:
            locator: XPath or CSS selector
            timeout: Maximum time to wait in milliseconds
        """
        expect(self._resolve_locator(locator)).to_be_disabled(timeout=timeout)
    
    # ══════════════════════════════════════════════════════════════════════════
    # PAGE INFO
    # ══════════════════════════════════════════════════════════════════════════
    
    @property
    def url(self) -> str:
        """Get the current page URL."""
        return self.page.url
    
    @property
    def title(self) -> str:
        """Get the current page title."""
        return self.page.title()
    
    def screenshot(self, path: str, full_page: bool = False) -> None:
        """
        Take a screenshot of the page.
        
        Args:
            path: File path to save the screenshot
            full_page: Whether to capture the full scrollable page
        """
        self.page.screenshot(path=path, full_page=full_page)


╔══════════════════════════════════════════════════════════════════════════╗
║ SECTION 2: PAGE DOCUMENTATION                                           ║
║ INSTRUCTIONS: This is what the page looks like - implement all elements ║
╚══════════════════════════════════════════════════════════════════════════╝

File: index.md
─────────────────────────────────────────────────────────────────────────────

# SMART360

## Page Identity

| Field | Value |
|-------|-------|
| **Page Name** | SMART360 |
| **Full URL** | https://platform-new.bynry.com/cx/consumer-management/create/manual#application-details |
| **Pathname** | /cx/consumer-management/create/manual |
| **URL Key** | `platform-new_bynry_com__cx__consumer-management__create__manual` |
| **Session ID** | `session_1774987490873_sq30cl` |
| **First Seen** | 2026-03-31T20:05:50.385Z |
| **Total Snapshots** | 8 |

## Navigation Trail

```
[START] platform-new_bynry_com__cx__consumer-management
  └─ Clicked: "Accounts" (span)
      → opened: platform-new_bynry_com__cx__consumer-management__create__manual
```

## Dropdowns & Select Fields (9)

### 1. "Genco Pura Oil & Gas"

| Property | Value |
|----------|-------|
| **type** | `custom-dropdown` |
| **xpath** | `/html[1]/body[1]/div[1]/div[1]/div[1]/header[1]/div[2]/button[1]` |
| **xpath_relative** | `//button[normalize-space()='Genco Pura Oil & Gas']` |
| **css_selector** | `body > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1) > header > div:nth-of-type(2) > button:nth-of-type(1)` |
| **option_count** | 0 |

_Options not captured. Click the dropdown during capture to record values._

### 2. "DV"

| Property | Value |
|----------|-------|
| **type** | `custom-dropdown` |
| **id** | `radix-:r5:` |
| **xpath** | `/html[1]/body[1]/div[1]/div[1]/div[1]/header[1]/div[2]/button[2]` |
| **xpath_relative** | `//*[@id="radix-:r5:"]` |
| **css_selector** | `body > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1) > header > div:nth-of-type(2) > button:nth-of-type(2)` |
| **option_count** | 0 |

_Options not captured. Click the dropdown during capture to record values._

### 3. "United States: + 1"

| Property | Value |
|----------|-------|
| **type** | `custom-dropdown` |
| **xpath** | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[1]/div[2]/div[2]/div[2]/div[1]/div[1]/div[1]/div[2]/div[1]/form[1]/div[1]/div[1]/div[4]/div[2]/div[1]/div[2]/div[1]` |
| **xpath_relative** | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[1]/div[2]/div[2]/div[2]/div[1]/div[1]/div[1]/div[2]/div[1]/form[1]/div[1]/div[1]/div[4]/div[2]/div[1]/div[2]/div[1]` |
| **css_selector** | `div.selected-flag` |
| **option_count** | 0 |

_Options not captured. Click the dropdown during capture to record values._

### 4. "Select category..."

| Property | Value |
|----------|-------|
| **type** | `custom-dropdown` |
| **xpath** | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[1]/div[2]/div[2]/div[2]/div[1]/div[1]/div[1]/div[2]/div[1]/form[1]/div[1]/div[1]/div[5]/button[1]` |
| **xpath_relative** | `//button[normalize-space()='Select category...']` |
| **css_selector** | `body > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(2) > main > div > div > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(2) > div > div > div > div:nth-of-type(2) > div > form > div:nth-of-type(1) > div > div:nth-of-type(5) > button` |
| **option_count** | 0 |

_Options not captured. Click the dropdown during capture to record values._

### 5. "Select sub-category..."

| Property | Value |
|----------|-------|
| **type** | `custom-dropdown` |
| **xpath** | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[1]/div[2]/div[2]/div[2]/div[1]/div[1]/div[1]/div[2]/div[1]/form[1]/div[1]/div[1]/div[6]/button[1]` |
| **xpath_relative** | `//button[normalize-space()='Select sub-category...']` |
| **css_selector** | `body > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(2) > main > div > div > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(2) > div > div > div > div:nth-of-type(2) > div > form > div:nth-of-type(1) > div > div:nth-of-type(6) > button` |
| **option_count** | 0 |

_Options not captured. Click the dropdown during capture to record values._

### 6. "Enter city"

| Property | Value |
|----------|-------|
| **type** | `custom-dropdown` |
| **xpath** | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[1]/div[2]/div[2]/div[2]/div[1]/div[1]/div[1]/div[4]/div[1]/form[1]/div[1]/div[2]/div[1]/div[3]/button[1]` |
| **xpath_relative** | `//*[@role="combobox"][normalize-space()='Enter city']` |
| **css_selector** | `body > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(2) > main > div > div > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(2) > div > div > div > div:nth-of-type(4) > div > form > div:nth-of-type(1) > div:nth-of-type(2) > div > div:nth-of-type(3) > button` |
| **option_count** | 0 |

_Options not captured. Click the dropdown during capture to record values._

### 7. "Enter city"

| Property | Value |
|----------|-------|
| **type** | `custom-dropdown` |
| **xpath** | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[1]/div[2]/div[2]/div[2]/div[1]/div[1]/div[1]/div[4]/div[1]/form[1]/div[1]/div[3]/div[1]/div[5]/button[1]` |
| **xpath_relative** | `//*[@role="combobox"][normalize-space()='Enter city']` |
| **css_selector** | `body > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(2) > main > div > div > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(2) > div > div > div > div:nth-of-type(4) > div > form > div:nth-of-type(1) > div:nth-of-type(3) > div > div:nth-of-type(5) > button` |
| **option_count** | 0 |

_Options not captured. Click the dropdown during capture to record values._

### 8. "Select Sub Type"

| Property | Value |
|----------|-------|
| **type** | `custom-dropdown` |
| **xpath** | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[1]/div[2]/div[2]/div[2]/div[1]/div[1]/div[1]/div[5]/div[1]/div[2]/div[1]/div[1]/div[2]/div[2]/button[1]` |
| **xpath_relative** | `//*[@role="combobox"][normalize-space()='Select Sub Type']` |
| **css_selector** | `body > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(2) > main > div > div > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(2) > div > div > div > div:nth-of-type(5) > div > div:nth-of-type(2) > div:nth-of-type(1) > div > div:nth-of-type(2) > div:nth-of-type(2) > button` |
| **option_count** | 0 |

_Options not captured. Click the dropdown during capture to record values._

### 9. "Select Sub Type"

| Property | Value |
|----------|-------|
| **type** | `custom-dropdown` |
| **xpath** | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[1]/div[2]/div[2]/div[2]/div[1]/div[1]/div[1]/div[5]/div[1]/div[2]/div[2]/div[1]/div[2]/div[2]/button[1]` |
| **xpath_relative** | `//*[@role="combobox"][normalize-space()='Select Sub Type']` |
| **css_selector** | `body > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(2) > main > div > div > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(2) > div > div > div > div:nth-of-type(5) > div > div:nth-of-type(2) > div:nth-of-type(2) > div > div:nth-of-type(2) > div:nth-of-type(2) > button` |
| **option_count** | 0 |

_Options not captured. Click the dropdown during capture to record values._

## Interactive Elements (48)

### 1. "Open bento menu"

| Locator Strategy | Value |
|-----------------|-------|
| **tag** | `button` |
| **css_selector** | `body > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1) > header > div:nth-of-type(1) > button` |
| **xpath** | `/html[1]/body[1]/div[1]/div[1]/div[1]/header[1]/div[1]/button[1]` |
| **xpath_relative** | `//button[@aria-label="Open bento menu"]` |

### 2. "Genco Pura Oil & Gas"

| Locator Strategy | Value |
|-----------------|-------|
| **tag** | `button` |
| **role** | `combobox` |
| **css_selector** | `body > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1) > header > div:nth-of-type(2) > button:nth-of-type(1)` |
| **xpath** | `/html[1]/body[1]/div[1]/div[1]/div[1]/header[1]/div[2]/button[1]` |
| **xpath_relative** | `//button[normalize-space()='Genco Pura Oil & Gas']` |

### 3. "DV"

| Locator Strategy | Value |
|-----------------|-------|
| **tag** | `button` |
| **id** | `radix-:r5:` |
| **css_selector** | `body > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1) > header > div:nth-of-type(2) > button:nth-of-type(2)` |
| **xpath** | `/html[1]/body[1]/div[1]/div[1]/div[1]/header[1]/div[2]/button[2]` |
| **xpath_relative** | `//*[@id="radix-:r5:"]` |

### 4. "Close menu"

| Locator Strategy | Value |
|-----------------|-------|
| **tag** | `button` |
| **css_selector** | `button.text-2xl` |
| **xpath** | `/html[1]/body[1]/div[1]/div[1]/div[1]/header[1]/div[3]/div[1]/div[1]/button[1]` |
| **xpath_relative** | `//button[normalize-space()='×']` |

### 5. "Menu"

| Locator Strategy | Value |
|-----------------|-------|
| **tag** | `button` |
| **css_selector** | `body > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(2) > div > aside > button` |
| **xpath** | `/html[1]/body[1]/div[1]/div[1]/div[2]/div[1]/aside[1]/button[1]` |
| **xpath_relative** | `//button[normalize-space()='Menu']` |

### 6. "Dashboard"

| Locator Strategy | Value |
|-----------------|-------|
| **tag** | `a` |
| **css_selector** | `body > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(2) > div > aside > nav > div > div:nth-of-type(1) > ul > li:nth-of-type(1) > a` |
| **xpath** | `/html[1]/body[1]/div[1]/div[1]/div[2]/div[1]/aside[1]/nav[1]/div[1]/div[1]/ul[1]/li[1]/a[1]` |
| **xpath_relative** | `//a[normalize-space()='Dashboard']` |

### 7. "Accounts"

| Locator Strategy | Value |
|-----------------|-------|
| **tag** | `a` |
| **css_selector** | `body > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(2) > div > aside > nav > div > div:nth-of-type(1) > ul > li:nth-of-type(2) > a` |
| **xpath** | `/html[1]/body[1]/div[1]/div[1]/div[2]/div[1]/aside[1]/nav[1]/div[1]/div[1]/ul[1]/li[2]/a[1]` |
| **xpath_relative** | `⚠ UNSTABLE — no id/text/aria, positional only: /html[1]/body[1]/div[1]/div[1]/div[2]/div[1]/aside[1]/nav[1]/div[1]/div[1]/ul[1]/li[2]/a[1]` |

### 8. "Payments"

| Locator Strategy | Value |
|-----------------|-------|
| **tag** | `a` |
| **css_selector** | `body > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(2) > div > aside > nav > div > div:nth-of-type(1) > ul > li:nth-of-type(3) > a` |
| **xpath** | `/html[1]/body[1]/div[1]/div[1]/div[2]/div[1]/aside[1]/nav[1]/div[1]/div[1]/ul[1]/li[3]/a[1]` |
| **xpath_relative** | `//a[normalize-space()='Payments']` |

### 9. "Outstandings"

| Locator Strategy | Value |
|-----------------|-------|
| **tag** | `a` |
| **css_selector** | `body > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(2) > div > aside > nav > div > div:nth-of-type(1) > ul > li:nth-of-type(4) > a` |
| **xpath** | `/html[1]/body[1]/div[1]/div[1]/div[2]/div[1]/aside[1]/nav[1]/div[1]/div[1]/ul[1]/li[4]/a[1]` |
| **xpath_relative** | `//a[normalize-space()='Outstandings']` |

### 10. "Services"

| Locator Strategy | Value |
|-----------------|-------|
| **tag** | `a` |
| **css_selector** | `body > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(2) > div > aside > nav > div > div:nth-of-type(1) > ul > li:nth-of-type(5) > a` |
| **xpath** | `/html[1]/body[1]/div[1]/div[1]/div[2]/div[1]/aside[1]/nav[1]/div[1]/div[1]/ul[1]/li[5]/a[1]` |
| **xpath_relative** | `//a[normalize-space()='Services']` |

### 11. "Complaints"

| Locator Strategy | Value |
|-----------------|-------|
| **tag** | `a` |
| **css_selector** | `body > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(2) > div > aside > nav > div > div:nth-of-type(1) > ul > li:nth-of-type(6) > a` |
| **xpath** | `/html[1]/body[1]/div[1]/div[1]/div[2]/div[1]/aside[1]/nav[1]/div[1]/div[1]/ul[1]/li[6]/a[1]` |
| **xpath_relative** | `//a[normalize-space()='Complaints']` |

### 12. "Onboarding"

| Locator Strategy | Value |
|-----------------|-------|
| **tag** | `a` |
| **css_selector** | `body > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(2) > div > aside > nav > div > div:nth-of-type(2) > ul > li:nth-of-type(1) > a` |
| **xpath** | `/html[1]/body[1]/div[1]/div[1]/div[2]/div[1]/aside[1]/nav[1]/div[1]/div[2]/ul[1]/li[1]/a[1]` |
| **xpath_relative** | `//a[normalize-space()='Onboarding']` |

### 13. "Disconnection"

| Locator Strategy | Value |
|-----------------|-------|
| **tag** | `a` |
| **css_selector** | `body > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(2) > div > aside > nav > div > div:nth-of-type(2) > ul > li:nth-of-type(2) > a` |
| **xpath** | `/html[1]/body[1]/div[1]/div[1]/div[2]/div[1]/aside[1]/nav[1]/div[1]/div[2]/ul[1]/li[2]/a[1]` |
| **xpath_relative** | `//a[normalize-space()='Disconnection']` |

### 14. "Reconnect"

| Locator Strategy | Value |
|-----------------|-------|
| **tag** | `a` |
| **css_selector** | `body > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(2) > div > aside > nav > div > div:nth-of-type(2) > ul > li:nth-of-type(3) > a` |
| **xpath** | `/html[1]/body[1]/div[1]/div[1]/div[2]/div[1]/aside[1]/nav[1]/div[1]/div[2]/ul[1]/li[3]/a[1]` |
| **xpath_relative** | `//a[normalize-space()='Reconnect']` |

### 15. "Transfer"

| Locator Strategy | Value |
|-----------------|-------|
| **tag** | `a` |
| **css_selector** | `body > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(2) > div > aside > nav > div > div:nth-of-type(2) > ul > li:nth-of-type(4) > a` |
| **xpath** | `/html[1]/body[1]/div[1]/div[1]/div[2]/div[1]/aside[1]/nav[1]/div[1]/div[2]/ul[1]/li[4]/a[1]` |
| **xpath_relative** | `//a[normalize-space()='Transfer']` |

### 16. "Self Service"

| Locator Strategy | Value |
|-----------------|-------|
| **tag** | `a` |
| **css_selector** | `body > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(2) > div > aside > nav > div > div:nth-of-type(2) > ul > li:nth-of-type(5) > a` |
| **xpath** | `/html[1]/body[1]/div[1]/div[1]/div[2]/div[1]/aside[1]/nav[1]/div[1]/div[2]/ul[1]/li[5]/a[1]` |
| **xpath_relative** | `//a[normalize-space()='Self Service']` |

### 17. "Settings"

| Locator Strategy | Value |
|-----------------|-------|
| **tag** | `a` |
| **css_selector** | `body > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(2) > div > aside > nav > div > div:nth-of-type(3) > ul > li > a` |
| **xpath** | `/html[1]/body[1]/div[1]/div[1]/div[2]/div[1]/aside[1]/nav[1]/div[1]/div[3]/ul[1]/li[1]/a[1]` |
| **xpath_relative** | `//a[normalize-space()='Settings']` |

### 18. "CX"

| Locator Strategy | Value |
|-----------------|-------|
| **tag** | `a` |
| **css_selector** | `body > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(2) > main > div > div > div:nth-of-type(1) > div > div:nth-of-type(2) > nav > ol > li:nth-of-type(1) > a` |
| **xpath** | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[1]/div[1]/div[1]/div[2]/nav[1]/ol[1]/li[1]/a[1]` |
| **xpath_relative** | `//a[normalize-space()='CX']` |

### 19. "MANAGEMENT"

| Locator Strategy | Value |
|-----------------|-------|
| **tag** | `a` |
| **css_selector** | `body > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(2) > main > div > div > div:nth-of-type(1) > div > div:nth-of-type(2) > nav > ol > li:nth-of-type(3) > a` |
| **xpath** | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[1]/div[1]/div[1]/div[2]/nav[1]/ol[1]/li[3]/a[1]` |
| **xpath_relative** | `//a[normalize-space()='MANAGEMENT']` |

### 20. "Create"

| Locator Strategy | Value |
|-----------------|-------|
| **tag** | `span` |
| **role** | `link` |
| **css_selector** | `span.font-normal` |
| **xpath** | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[1]/div[1]/div[1]/div[2]/nav[1]/ol[1]/li[7]/span[1]` |
| **xpath_relative** | `//span[normalize-space()='Create']` |

### 21. "Important Information"

| Locator Strategy | Value |
|-----------------|-------|
| **tag** | `button` |
| **id** | `radix-:r2r:` |
| **css_selector** | `body > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(2) > main > div > div > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(2) > div > div > div > div:nth-of-type(1) > div > h3 > button` |
| **xpath** | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[1]/div[2]/div[2]/div[2]/div[1]/div[1]/div[1]/div[1]/div[1]/h3[1]/button[1]` |
| **xpath_relative** | `//*[@id="radix-:r2r:"]` |

### 22. "Enter first name"

| Locator Strategy | Value |
|-----------------|-------|
| **tag** | `input` |
| **id** | `firstName` |
| **name** | `firstName` |
| **css_selector** | `input[name="firstName"]` |
| **xpath** | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[1]/div[2]/div[2]/div[2]/div[1]/div[1]/div[1]/div[2]/div[1]/form[1]/div[1]/div[1]/div[1]/div[2]/div[1]/input[1]` |
| **xpath_relative** | `//*[@id="firstName"]` |

### 23. "Enter last name"

| Locator Strategy | Value |
|-----------------|-------|
| **tag** | `input` |
| **id** | `lastName` |
| **name** | `lastName` |
| **css_selector** | `input[name="lastName"]` |
| **xpath** | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[1]/div[2]/div[2]/div[2]/div[1]/div[1]/div[1]/div[2]/div[1]/form[1]/div[1]/div[1]/div[2]/div[2]/div[1]/input[1]` |
| **xpath_relative** | `//*[@id="lastName"]` |

### 24. "example@email.com"

| Locator Strategy | Value |
|-----------------|-------|
| **tag** | `input` |
| **id** | `email` |
| **name** | `email` |
| **css_selector** | `input[name="email"]` |
| **xpath** | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[1]/div[2]/div[2]/div[2]/div[1]/div[1]/div[1]/div[2]/div[1]/form[1]/div[1]/div[1]/div[3]/div[2]/div[1]/input[1]` |
| **xpath_relative** | `//*[@id="email"]` |

### 25. "+1 (555) 000-0000"

| Locator Strategy | Value |
|-----------------|-------|
| **tag** | `input` |
| **css_selector** | `input.form-control` |
| **xpath** | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[1]/div[2]/div[2]/div[2]/div[1]/div[1]/div[1]/div[2]/div[1]/form[1]/div[1]/div[1]/div[4]/div[2]/div[1]/input[1]` |
| **xpath_relative** | `//input[@placeholder="+1 (555) 000-0000"]` |

### 26. "United States: + 1"

| Locator Strategy | Value |
|-----------------|-------|
| **tag** | `div` |
| **role** | `button` |
| **css_selector** | `div.selected-flag` |
| **xpath** | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[1]/div[2]/div[2]/div[2]/div[1]/div[1]/div[1]/div[2]/div[1]/form[1]/div[1]/div[1]/div[4]/div[2]/div[1]/div[2]/div[1]` |
| **xpath_relative** | `⚠ UNSTABLE — no id/text/aria, positional only: /html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[1]/div[2]/div[2]/div[2]/div[1]/div[1]/div[1]/div[2]/div[1]/form[1]/div[1]/div[1]/div[4]/div[2]/div[1]/div[2]/div[1]` |

### 27. "Select category..."

| Locator Strategy | Value |
|-----------------|-------|
| **tag** | `button` |
| **role** | `combobox` |
| **css_selector** | `body > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(2) > main > div > div > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(2) > div > div > div > div:nth-of-type(2) > div > form > div:nth-of-type(1) > div > div:nth-of-type(5) > button` |
| **xpath** | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[1]/div[2]/div[2]/div[2]/div[1]/div[1]/div[1]/div[2]/div[1]/form[1]/div[1]/div[1]/div[5]/button[1]` |
| **xpath_relative** | `//button[normalize-space()='Select category...']` |

### 28. "Select sub-category..."

| Locator Strategy | Value |
|-----------------|-------|
| **tag** | `button` |
| **role** | `combobox` |
| **css_selector** | `body > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(2) > main > div > div > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(2) > div > div > div > div:nth-of-type(2) > div > form > div:nth-of-type(1) > div > div:nth-of-type(6) > button` |
| **xpath** | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[1]/div[2]/div[2]/div[2]/div[1]/div[1]/div[1]/div[2]/div[1]/form[1]/div[1]/div[1]/div[6]/button[1]` |
| **xpath_relative** | `//button[normalize-space()='Select sub-category...']` |

### 29. "Enter SSN or Tax ID"

| Locator Strategy | Value |
|-----------------|-------|
| **tag** | `input` |
| **id** | `ssnTaxId` |
| **name** | `ssnTaxId` |
| **css_selector** | `input[name="ssnTaxId"]` |
| **xpath** | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[1]/div[2]/div[2]/div[2]/div[1]/div[1]/div[1]/div[2]/div[1]/form[1]/div[1]/div[1]/div[7]/div[2]/div[1]/input[1]` |
| **xpath_relative** | `//*[@id="ssnTaxId"]` |

### 30. "[name: vipDesignation]"

| Locator Strategy | Value |
|-----------------|-------|
| **tag** | `input` |
| **id** | `vipDesignation` |
| **name** | `vipDesignation` |
| **css_selector** | `input[name="vipDesignation"]` |
| **xpath** | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[1]/div[2]/div[2]/div[2]/div[1]/div[1]/div[1]/div[2]/div[1]/form[1]/div[1]/div[1]/div[8]/label[1]/input[1]` |
| **xpath_relative** | `//*[@id="vipDesignation"]` |

### 31. "[name: addCoApplicant]"

| Locator Strategy | Value |
|-----------------|-------|
| **tag** | `input` |
| **id** | `addCoApplicant` |
| **name** | `addCoApplicant` |
| **css_selector** | `input[name="addCoApplicant"]` |
| **xpath** | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[1]/div[2]/div[2]/div[2]/div[1]/div[1]/div[1]/div[2]/div[1]/form[1]/div[1]/div[1]/div[9]/label[1]/input[1]` |
| **xpath_relative** | `//*[@id="addCoApplicant"]` |

### 32. "Service Information"

| Locator Strategy | Value |
|-----------------|-------|
| **tag** | `button` |
| **id** | `radix-:r2v:` |
| **css_selector** | `body > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(2) > main > div > div > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(2) > div > div > div > div:nth-of-type(3) > div > h3 > button` |
| **xpath** | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[1]/div[2]/div[2]/div[2]/div[1]/div[1]/div[1]/div[3]/div[1]/h3[1]/button[1]` |
| **xpath_relative** | `//*[@id="radix-:r2v:"]` |

### 33. "[name: serviceStartDate]"

| Locator Strategy | Value |
|-----------------|-------|
| **tag** | `input` |
| **id** | `serviceStartDate` |
| **name** | `serviceStartDate` |
| **css_selector** | `input[name="serviceStartDate"]` |
| **xpath** | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[1]/div[2]/div[2]/div[2]/div[1]/div[1]/div[1]/div[4]/div[1]/form[1]/div[1]/div[1]/div[1]/div[1]/input[1]` |
| **xpath_relative** | `//*[@id="serviceStartDate"]` |

### 34. "e.g. 123, Apt 4B"

| Locator Strategy | Value |
|-----------------|-------|
| **tag** | `input` |
| **id** | `serviceHouseUnit` |
| **name** | `serviceHouseUnit` |
| **css_selector** | `input[name="serviceHouseUnit"]` |
| **xpath** | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[1]/div[2]/div[2]/div[2]/div[1]/div[1]/div[1]/div[4]/div[1]/form[1]/div[1]/div[2]/div[1]/div[1]/div[2]/div[1]/input[1]` |
| **xpath_relative** | `//*[@id="serviceHouseUnit"]` |

### 35. "e.g. 12345"

| Locator Strategy | Value |
|-----------------|-------|
| **tag** | `input` |
| **id** | `serviceZipCode` |
| **name** | `serviceZipCode` |
| **css_selector** | `input[name="serviceZipCode"]` |
| **xpath** | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[1]/div[2]/div[2]/div[2]/div[1]/div[1]/div[1]/div[4]/div[1]/form[1]/div[1]/div[2]/div[1]/div[2]/div[2]/div[1]/input[1]` |
| **xpath_relative** | `//*[@id="serviceZipCode"]` |

### 36. "Enter city"

| Locator Strategy | Value |
|-----------------|-------|
| **tag** | `button` |
| **role** | `combobox` |
| **css_selector** | `body > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(2) > main > div > div > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(2) > div > div > div > div:nth-of-type(4) > div > form > div:nth-of-type(1) > div:nth-of-type(2) > div > div:nth-of-type(3) > button` |
| **xpath** | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[1]/div[2]/div[2]/div[2]/div[1]/div[1]/div[1]/div[4]/div[1]/form[1]/div[1]/div[2]/div[1]/div[3]/button[1]` |
| **xpath_relative** | `//*[@role="combobox"][normalize-space()='Enter city']` |

### 37. "e.g. 123 Main Street"

| Locator Strategy | Value |
|-----------------|-------|
| **tag** | `input` |
| **id** | `serviceStreetAddress` |
| **name** | `serviceStreetAddress` |
| **css_selector** | `input[name="serviceStreetAddress"]` |
| **xpath** | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[1]/div[2]/div[2]/div[2]/div[1]/div[1]/div[1]/div[4]/div[1]/form[1]/div[1]/div[2]/div[1]/div[4]/div[2]/div[1]/input[1]` |
| **xpath_relative** | `//*[@id="serviceStreetAddress"]` |

### 38. "[name: sameAsServiceAddress]"

| Locator Strategy | Value |
|-----------------|-------|
| **tag** | `input` |
| **id** | `sameAsServiceAddress` |
| **name** | `sameAsServiceAddress` |
| **css_selector** | `input[name="sameAsServiceAddress"]` |
| **xpath** | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[1]/div[2]/div[2]/div[2]/div[1]/div[1]/div[1]/div[4]/div[1]/form[1]/div[1]/div[3]/div[1]/div[1]/label[1]/input[1]` |
| **xpath_relative** | `//*[@id="sameAsServiceAddress"]` |

### 39. "[name: paperlessBilling]"

| Locator Strategy | Value |
|-----------------|-------|
| **tag** | `input` |
| **id** | `paperlessBilling` |
| **name** | `paperlessBilling` |
| **css_selector** | `input[name="paperlessBilling"]` |
| **xpath** | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[1]/div[2]/div[2]/div[2]/div[1]/div[1]/div[1]/div[4]/div[1]/form[1]/div[1]/div[3]/div[1]/div[2]/label[1]/input[1]` |
| **xpath_relative** | `//*[@id="paperlessBilling"]` |

### 40. "e.g. 123, Apt 4B"

| Locator Strategy | Value |
|-----------------|-------|
| **tag** | `input` |
| **id** | `mailingHouseUnit` |
| **name** | `mailingHouseUnit` |
| **css_selector** | `input[name="mailingHouseUnit"]` |
| **xpath** | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[1]/div[2]/div[2]/div[2]/div[1]/div[1]/div[1]/div[4]/div[1]/form[1]/div[1]/div[3]/div[1]/div[3]/div[2]/div[1]/input[1]` |
| **xpath_relative** | `//*[@id="mailingHouseUnit"]` |

### 41. "e.g. 12345"

| Locator Strategy | Value |
|-----------------|-------|
| **tag** | `input` |
| **id** | `mailingZipCode` |
| **name** | `mailingZipCode` |
| **css_selector** | `input[name="mailingZipCode"]` |
| **xpath** | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[1]/div[2]/div[2]/div[2]/div[1]/div[1]/div[1]/div[4]/div[1]/form[1]/div[1]/div[3]/div[1]/div[4]/div[2]/div[1]/input[1]` |
| **xpath_relative** | `//*[@id="mailingZipCode"]` |

### 42. "e.g. 123 Main Street"

| Locator Strategy | Value |
|-----------------|-------|
| **tag** | `input` |
| **id** | `mailingStreetAddress` |
| **name** | `mailingStreetAddress` |
| **css_selector** | `input[name="mailingStreetAddress"]` |
| **xpath** | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[1]/div[2]/div[2]/div[2]/div[1]/div[1]/div[1]/div[4]/div[1]/form[1]/div[1]/div[3]/div[1]/div[6]/div[2]/div[1]/input[1]` |
| **xpath_relative** | `//*[@id="mailingStreetAddress"]` |

### 43. "Document Information"

| Locator Strategy | Value |
|-----------------|-------|
| **tag** | `button` |
| **id** | `radix-:r33:` |
| **css_selector** | `body > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(2) > main > div > div > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(2) > div > div > div > div:nth-of-type(5) > div > div:nth-of-type(1) > div > h3 > button` |
| **xpath** | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[1]/div[2]/div[2]/div[2]/div[1]/div[1]/div[1]/div[5]/div[1]/div[1]/div[1]/h3[1]/button[1]` |
| **xpath_relative** | `//*[@id="radix-:r33:"]` |

### 44. "Select Sub Type"

| Locator Strategy | Value |
|-----------------|-------|
| **tag** | `button` |
| **role** | `combobox` |
| **css_selector** | `body > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(2) > main > div > div > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(2) > div > div > div > div:nth-of-type(5) > div > div:nth-of-type(2) > div:nth-of-type(1) > div > div:nth-of-type(2) > div:nth-of-type(2) > button` |
| **xpath** | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[1]/div[2]/div[2]/div[2]/div[1]/div[1]/div[1]/div[5]/div[1]/div[2]/div[1]/div[1]/div[2]/div[2]/button[1]` |
| **xpath_relative** | `//*[@role="combobox"][normalize-space()='Select Sub Type']` |

### 45. "[id: file-upload-ID Proof#3]"

| Locator Strategy | Value |
|-----------------|-------|
| **tag** | `input` |
| **id** | `file-upload-ID Proof#3` |
| **css_selector** | `body > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(2) > main > div > div > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(2) > div > div > div > div:nth-of-type(5) > div > div:nth-of-type(2) > div:nth-of-type(1) > div > div:nth-of-type(2) > div:nth-of-type(3) > input` |
| **xpath** | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[1]/div[2]/div[2]/div[2]/div[1]/div[1]/div[1]/div[5]/div[1]/div[2]/div[1]/div[1]/div[2]/div[3]/input[1]` |
| **xpath_relative** | `//*[@id="file-upload-ID Proof#3"]` |

### 46. "[id: file-upload-Address Proof#4]"

| Locator Strategy | Value |
|-----------------|-------|
| **tag** | `input` |
| **id** | `file-upload-Address Proof#4` |
| **css_selector** | `body > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(2) > main > div > div > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(2) > div > div > div > div:nth-of-type(5) > div > div:nth-of-type(2) > div:nth-of-type(2) > div > div:nth-of-type(2) > div:nth-of-type(3) > input` |
| **xpath** | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[1]/div[2]/div[2]/div[2]/div[1]/div[1]/div[1]/div[5]/div[1]/div[2]/div[2]/div[1]/div[2]/div[3]/input[1]` |
| **xpath_relative** | `//*[@id="file-upload-Address Proof#4"]` |

### 47. "Cancel"

| Locator Strategy | Value |
|-----------------|-------|
| **tag** | `button` |
| **css_selector** | `body > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(2) > main > div > div > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(2) > div > div > div > div:nth-of-type(6) > button:nth-of-type(1)` |
| **xpath** | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[1]/div[2]/div[2]/div[2]/div[1]/div[1]/div[1]/div[6]/button[1]` |
| **xpath_relative** | `//button[normalize-space()='Cancel']` |

### 48. "Continue to Review"

| Locator Strategy | Value |
|-----------------|-------|
| **tag** | `button` |
| **css_selector** | `body > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(2) > main > div > div > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(2) > div > div > div > div:nth-of-type(6) > button:nth-of-type(2)` |
| **xpath** | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[1]/div[2]/div[2]/div[2]/div[1]/div[1]/div[1]/div[6]/button[2]` |
| **xpath_relative** | `//button[normalize-space()='Continue to Review']` |

## API Calls Observed (0)

_No API calls captured for this page._

## Snapshot Timeline

| # | Trigger | Timestamp | Has API Calls |
|---|---------|-----------|---------------|
| 9 | navigation | 1:35:50 AM | No |
| 10 | dom-mutation | 1:35:53 AM | No |
| 11 | user-click | 1:35:55 AM | No |
| 12 | user-click | 1:36:01 AM | No |
| 13 | dom-mutation | 1:36:04 AM | No |
| 14 | user-click | 1:36:07 AM | No |
| 15 | user-click | 1:36:08 AM | No |
| 16 | user-click | 1:36:10 AM | No |



╔══════════════════════════════════════════════════════════════════════════╗
║ SECTION 3: AUTO-GENERATED SKELETON (REFERENCE)                          ║
║ INSTRUCTIONS: Use this as starting point, enhance with business logic   ║
╚══════════════════════════════════════════════════════════════════════════╝

File: pom_platform-new_bynry_com_cx_consumer-management_create_manual.py
─────────────────────────────────────────────────────────────────────────────

"""
Page Object Model for: SMART360
Auto-generated by DOM Snapshot Indexer
"""

from base_page import BasePage


class Platform-newBynryComCxConsumer-managementCreateManualPage(BasePage):
    """
    URL      : https://platform-new.bynry.com/cx/consumer-management/create/manual#application-details
    Pathname : /cx/consumer-management/create/manual
    Reached  : After clicking 'Accounts' on SMART360
    """

    # ══════════════════════════════════════════════════════════════════════════
    # LOCATORS
    # ══════════════════════════════════════════════════════════════════════════
    BTN_OPEN_BENTO_MENU = "//button[@aria-label=\"Open bento menu\"]"
    BTN_GENCO_PURA_OIL_GAS = "//button[normalize-space()='Genco Pura Oil & Gas']"
    BTN_RADIX_R5 = "//*[@id=\"radix-:r5:\"]"
    BTN_CLOSE_MENU = "//button[normalize-space()='×']"
    BTN_MENU = "//button[normalize-space()='Menu']"
    LNK_DASHBOARD = "//a[normalize-space()='Dashboard']"
    LNK_PAYMENTS = "//a[normalize-space()='Payments']"
    LNK_OUTSTANDINGS = "//a[normalize-space()='Outstandings']"
    LNK_SERVICES = "//a[normalize-space()='Services']"
    LNK_COMPLAINTS = "//a[normalize-space()='Complaints']"
    LNK_ONBOARDING = "//a[normalize-space()='Onboarding']"
    LNK_DISCONNECTION = "//a[normalize-space()='Disconnection']"
    LNK_RECONNECT = "//a[normalize-space()='Reconnect']"
    LNK_TRANSFER = "//a[normalize-space()='Transfer']"
    LNK_SELF_SERVICE = "//a[normalize-space()='Self Service']"
    LNK_SETTINGS = "//a[normalize-space()='Settings']"
    LNK_CX = "//a[normalize-space()='CX']"
    LNK_MANAGEMENT = "//a[normalize-space()='MANAGEMENT']"
    LNK_CREATE = "//span[normalize-space()='Create']"
    BTN_RADIX_R2R = "//*[@id=\"radix-:r2r:\"]"
    TXT_FIRSTNAME = "//*[@id=\"firstName\"]"
    TXT_LASTNAME = "//*[@id=\"lastName\"]"
    TXT_EMAIL = "//*[@id=\"email\"]"
    TXT_1_555_000_0000 = "//input[@placeholder=\"+1 (555) 000-0000\"]"
    BTN_SELECT_CATEGORY = "//button[normalize-space()='Select category...']"
    BTN_SELECT_SUB_CATEGORY = "//button[normalize-space()='Select sub-category...']"
    TXT_SSNTAXID = "//*[@id=\"ssnTaxId\"]"
    TXT_VIPDESIGNATION = "//*[@id=\"vipDesignation\"]"
    TXT_ADDCOAPPLICANT = "//*[@id=\"addCoApplicant\"]"
    BTN_RADIX_R2V = "//*[@id=\"radix-:r2v:\"]"
    TXT_SERVICESTARTDATE = "//*[@id=\"serviceStartDate\"]"
    TXT_SERVICEHOUSEUNIT = "//*[@id=\"serviceHouseUnit\"]"
    TXT_SERVICEZIPCODE = "//*[@id=\"serviceZipCode\"]"
    BTN_ENTER_CITY = "//*[@role=\"combobox\"][normalize-space()='Enter city']"
    TXT_SERVICESTREETADDRESS = "//*[@id=\"serviceStreetAddress\"]"
    TXT_SAMEASSERVICEADDRESS = "//*[@id=\"sameAsServiceAddress\"]"
    TXT_PAPERLESSBILLING = "//*[@id=\"paperlessBilling\"]"
    TXT_MAILINGHOUSEUNIT = "//*[@id=\"mailingHouseUnit\"]"
    TXT_MAILINGZIPCODE = "//*[@id=\"mailingZipCode\"]"
    TXT_MAILINGSTREETADDRESS = "//*[@id=\"mailingStreetAddress\"]"
    BTN_RADIX_R33 = "//*[@id=\"radix-:r33:\"]"
    BTN_SELECT_SUB_TYPE = "//*[@role=\"combobox\"][normalize-space()='Select Sub Type']"
    TXT_FILE_UPLOAD_ID_PROOF3 = "//*[@id=\"file-upload-ID Proof#3\"]"
    TXT_FILE_UPLOAD_ADDRESS_PROOF4 = "//*[@id=\"file-upload-Address Proof#4\"]"
    BTN_CANCEL = "//button[normalize-space()='Cancel']"
    BTN_CONTINUE_TO_REVIEW = "//button[normalize-space()='Continue to Review']"

    # ══════════════════════════════════════════════════════════════════════════
    # ACTIONS
    # ══════════════════════════════════════════════════════════════════════════

    def navigate_to(self):
        """Navigate directly to this page."""
        self.navigate("https://platform-new.bynry.com/cx/consumer-management/create/manual#application-details")

    def click_open_bento_menu(self):
        """Click the 'Open bento menu' button."""
        self.click(self.BTN_OPEN_BENTO_MENU)

    def click_genco_pura_oil_gas(self):
        """Click the 'Genco Pura Oil & Gas' button."""
        self.click(self.BTN_GENCO_PURA_OIL_GAS)

    def click_radix_r5(self):
        """Click the 'DV' button."""
        self.click(self.BTN_RADIX_R5)

    def click_close_menu(self):
        """Click the 'Close menu' button."""
        self.click(self.BTN_CLOSE_MENU)

    def click_menu(self):
        """Click the 'Menu' button."""
        self.click(self.BTN_MENU)

    def click_dashboard(self):
        """Click the 'Dashboard' a."""
        self.click(self.LNK_DASHBOARD)

    def click_payments(self):
        """Click the 'Payments' a."""
        self.click(self.LNK_PAYMENTS)

    def click_outstandings(self):
        """Click the 'Outstandings' a."""
        self.click(self.LNK_OUTSTANDINGS)

    def click_services(self):
        """Click the 'Services' a."""
        self.click(self.LNK_SERVICES)

    def click_complaints(self):
        """Click the 'Complaints' a."""
        self.click(self.LNK_COMPLAINTS)

    def click_onboarding(self):
        """Click the 'Onboarding' a."""
        self.click(self.LNK_ONBOARDING)

    def click_disconnection(self):
        """Click the 'Disconnection' a."""
        self.click(self.LNK_DISCONNECTION)

    def click_reconnect(self):
        """Click the 'Reconnect' a."""
        self.click(self.LNK_RECONNECT)

    def click_transfer(self):
        """Click the 'Transfer' a."""
        self.click(self.LNK_TRANSFER)

    def click_self_service(self):
        """Click the 'Self Service' a."""
        self.click(self.LNK_SELF_SERVICE)

    def click_settings(self):
        """Click the 'Settings' a."""
        self.click(self.LNK_SETTINGS)

    def click_cx(self):
        """Click the 'CX' a."""
        self.click(self.LNK_CX)

    def click_management(self):
        """Click the 'MANAGEMENT' a."""
        self.click(self.LNK_MANAGEMENT)

    def click_radix_r2r(self):
        """Click the 'Important Information' button."""
        self.click(self.BTN_RADIX_R2R)

    def fill_firstname(self, value: str):
        """Fill the 'Enter first name' input field."""
        self.fill(self.TXT_FIRSTNAME, value)

    def fill_lastname(self, value: str):
        """Fill the 'Enter last name' input field."""
        self.fill(self.TXT_LASTNAME, value)

    def fill_email(self, value: str):
        """Fill the 'example@email.com' input field."""
        self.fill(self.TXT_EMAIL, value)

    def fill_1_555_000_0000(self, value: str):
        """Fill the '+1 (555) 000-0000' input field."""
        self.fill(self.TXT_1_555_000_0000, value)

    def click_select_category(self):
        """Click the 'Select category...' button."""
        self.click(self.BTN_SELECT_CATEGORY)

    def click_select_sub_category(self):
        """Click the 'Select sub-category...' button."""
        self.click(self.BTN_SELECT_SUB_CATEGORY)

    def fill_ssntaxid(self, value: str):
        """Fill the 'Enter SSN or Tax ID' input field."""
        self.fill(self.TXT_SSNTAXID, value)

    def fill_vipdesignation(self, value: str):
        """Fill the '[name: vipDesignation]' input field."""
        self.fill(self.TXT_VIPDESIGNATION, value)

    def fill_addcoapplicant(self, value: str):
        """Fill the '[name: addCoApplicant]' input field."""
        self.fill(self.TXT_ADDCOAPPLICANT, value)

    def click_radix_r2v(self):
        """Click the 'Service Information' button."""
        self.click(self.BTN_RADIX_R2V)

    def fill_servicestartdate(self, value: str):
        """Fill the '[name: serviceStartDate]' input field."""
        self.fill(self.TXT_SERVICESTARTDATE, value)

    def fill_servicehouseunit(self, value: str):
        """Fill the 'e.g. 123, Apt 4B' input field."""
        self.fill(self.TXT_SERVICEHOUSEUNIT, value)

    def fill_servicezipcode(self, value: str):
        """Fill the 'e.g. 12345' input field."""
        self.fill(self.TXT_SERVICEZIPCODE, value)

    def click_enter_city(self):
        """Click the 'Enter city' button."""
        self.click(self.BTN_ENTER_CITY)

    def fill_servicestreetaddress(self, value: str):
        """Fill the 'e.g. 123 Main Street' input field."""
        self.fill(self.TXT_SERVICESTREETADDRESS, value)

    def fill_sameasserviceaddress(self, value: str):
        """Fill the '[name: sameAsServiceAddress]' input field."""
        self.fill(self.TXT_SAMEASSERVICEADDRESS, value)

    def fill_paperlessbilling(self, value: str):
        """Fill the '[name: paperlessBilling]' input field."""
        self.fill(self.TXT_PAPERLESSBILLING, value)

    def fill_mailinghouseunit(self, value: str):
        """Fill the 'e.g. 123, Apt 4B' input field."""
        self.fill(self.TXT_MAILINGHOUSEUNIT, value)

    def fill_mailingzipcode(self, value: str):
        """Fill the 'e.g. 12345' input field."""
        self.fill(self.TXT_MAILINGZIPCODE, value)

    def fill_mailingstreetaddress(self, value: str):
        """Fill the 'e.g. 123 Main Street' input field."""
        self.fill(self.TXT_MAILINGSTREETADDRESS, value)

    def click_radix_r33(self):
        """Click the 'Document Information' button."""
        self.click(self.BTN_RADIX_R33)

    def click_select_sub_type(self):
        """Click the 'Select Sub Type' button."""
        self.click(self.BTN_SELECT_SUB_TYPE)

    def fill_file_upload_id_proof3(self, value: str):
        """Fill the '[id: file-upload-ID Proof#3]' input field."""
        self.fill(self.TXT_FILE_UPLOAD_ID_PROOF3, value)

    def fill_file_upload_address_proof4(self, value: str):
        """Fill the '[id: file-upload-Address Proof#4]' input field."""
        self.fill(self.TXT_FILE_UPLOAD_ADDRESS_PROOF4, value)

    def click_cancel(self):
        """Click the 'Cancel' button."""
        self.click(self.BTN_CANCEL)

    def click_continue_to_review(self):
        """Click the 'Continue to Review' button."""
        self.click(self.BTN_CONTINUE_TO_REVIEW)

    # ══════════════════════════════════════════════════════════════════════════
    # ASSERTIONS / VISIBILITY
    # ══════════════════════════════════════════════════════════════════════════

    def is_page_loaded(self) -> bool:
        """Check if the page has loaded by verifying key elements are visible."""
        return self.is_visible(self.BTN_OPEN_BENTO_MENU)


╔══════════════════════════════════════════════════════════════════════════╗
║ SECTION 4: AI AGENT INSTRUCTIONS                                        ║
╚══════════════════════════════════════════════════════════════════════════╝

## YOUR TASK

Generate a production-ready Playwright Page Object Model class.

## REQUIREMENTS

1. **Inheritance**: Your class MUST inherit from BasePage
   ```python
   class YourPageName(BasePage):
       def __init__(self, page: Page, base_url: Optional[str] = None):
           super().__init__(page, base_url)
   ```

2. **Method Usage**: Use ONLY methods defined in BasePage API:
   - self.click(locator, **kwargs)
   - self.fill(locator, value, **kwargs)
   - self.get_text(locator)
   - self.is_visible(locator, timeout=5000)
   - self.wait_for_element(locator, state="visible", timeout=30000)
   - self.get_attribute(locator, attribute)
   - self.select_option(locator, value, **kwargs)
   - self.check(locator, **kwargs)
   - self.uncheck(locator, **kwargs)
   - self.hover(locator, **kwargs)
   - self.focus(locator, **kwargs)
   - self.clear(locator, **kwargs)
   - self.navigate(url)
   - self.get_current_url()
   - self.get_page_title()
   - self.screenshot(path, **kwargs)

3. **Element Constants**: Define ALL element locators as class constants
   - Use naming convention: EL_<ELEMENT_NAME>
   - Prefer XPath for stability (from index.md)
   - Include data-testid when available

4. **Business Methods**: Create meaningful methods for user actions
   - Example: `create_consumer(consumer_data)` instead of just click/fill
   - Combine multiple steps into single method
   - Add validation/assertions

5. **Type Hints**: Always use Python type hints
   - Parameters: str, int, bool, Optional[str], Dict, List
   - Return types: -> None, -> str, -> bool

6. **Docstrings**: Every method must have a docstring
   ```python
   def my_method(self, param: str) -> bool:
       """Description of what method does.
       
       Args:
           param: Description of parameter
       
       Returns:
           Description of return value
       """
   ```

7. **Dropdown Handling**: Use information from "Dropdowns & Select Fields"
   - For native <select>: use self.select_option()
   - For custom dropdowns: click trigger, wait for options, click option
   - Reference the captured options from index.md

8. **Assertions**: Add validation methods
   - is_page_loaded() - check key elements visible
   - verify_success_message() - validate expected outcomes
   - assert_error_present() - negative test cases

## ELEMENT MAPPING

From the index.md, implement these elements:

| Element Label | Tag | XPath |
|---------------|-----|-------|
| Genco Pura Oil & Gas | button | `/html[1]/body[1]/div[1]/div[1]/div[1]/header[1]/div[1]/bu...` |
| Genco Pura Oil & Gas | button | `/html[1]/body[1]/div[1]/div[1]/div[1]/header[1]/div[2]/bu...` |
| DV | button | `/html[1]/body[1]/div[1]/div[1]/div[1]/header[1]/div[2]/bu...` |
| Close menu | button | `/html[1]/body[1]/div[1]/div[1]/div[1]/header[1]/div[3]/di...` |
| Menu | button | `/html[1]/body[1]/div[1]/div[1]/div[2]/div[1]/aside[1]/but...` |
| Dashboard | a | `/html[1]/body[1]/div[1]/div[1]/div[2]/div[1]/aside[1]/nav...` |
| Accounts | a | `/html[1]/body[1]/div[1]/div[1]/div[2]/div[1]/aside[1]/nav...` |
| Payments | a | `/html[1]/body[1]/div[1]/div[1]/div[2]/div[1]/aside[1]/nav...` |
| Outstandings | a | `/html[1]/body[1]/div[1]/div[1]/div[2]/div[1]/aside[1]/nav...` |
| Services | a | `/html[1]/body[1]/div[1]/div[1]/div[2]/div[1]/aside[1]/nav...` |
| Complaints | a | `/html[1]/body[1]/div[1]/div[1]/div[2]/div[1]/aside[1]/nav...` |
| Onboarding | a | `/html[1]/body[1]/div[1]/div[1]/div[2]/div[1]/aside[1]/nav...` |
| Disconnection | a | `/html[1]/body[1]/div[1]/div[1]/div[2]/div[1]/aside[1]/nav...` |
| Reconnect | a | `/html[1]/body[1]/div[1]/div[1]/div[2]/div[1]/aside[1]/nav...` |
| Transfer | a | `/html[1]/body[1]/div[1]/div[1]/div[2]/div[1]/aside[1]/nav...` |
| Self Service | a | `/html[1]/body[1]/div[1]/div[1]/div[2]/div[1]/aside[1]/nav...` |
| Settings | a | `/html[1]/body[1]/div[1]/div[1]/div[2]/div[1]/aside[1]/nav...` |
| CX | a | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[...` |
| MANAGEMENT | a | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[...` |
| Create | span | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[...` |
| Important Information | button | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[...` |
| Enter first name | input | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[...` |
| Enter last name | input | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[...` |
| example@email.com | input | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[...` |
| +1 (555) 000-0000 | input | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[...` |
| United States: + 1 | div | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[...` |
| Select category... | button | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[...` |
| Select sub-category... | button | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[...` |
| Enter SSN or Tax ID | input | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[...` |
| [name: vipDesignation] | input | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[...` |
| [name: addCoApplicant] | input | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[...` |
| Service Information | button | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[...` |
| [name: serviceStartDate] | input | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[...` |
| e.g. 123, Apt 4B | input | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[...` |
| e.g. 12345 | input | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[...` |
| Enter city | button | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[...` |
| e.g. 123 Main Street | input | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[...` |
| [name: sameAsServiceAddress] | input | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[...` |
| [name: paperlessBilling] | input | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[...` |
| e.g. 123, Apt 4B | input | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[...` |
| e.g. 12345 | input | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[...` |
| e.g. 123 Main Street | input | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[...` |
| Document Information | button | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[...` |
| Select Sub Type | button | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[...` |
| [id: file-upload-ID Proof#3] | input | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[...` |
| [id: file-upload-Address Proof#4] | input | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[...` |
| Cancel | button | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[...` |
| Continue to Review | button | `/html[1]/body[1]/div[1]/div[1]/div[2]/main[1]/div[1]/div[...` |

## DROPDOWNS TO IMPLEMENT


