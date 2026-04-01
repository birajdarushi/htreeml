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
