// Filter and rule logic

export function normalizeRuleList(list) {
  if (!Array.isArray(list)) return [];
  return list.map((item) => String(item).trim().toLowerCase()).filter(Boolean);
}

export function wildcardToRegex(pattern) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(escaped, 'i');
}

export function matchHostPathWildcard(urlValue, rule) {
  const parsedUrl = (() => {
    try {
      return new URL(String(urlValue || '').toLowerCase());
    } catch (_) {
      return null;
    }
  })();

  if (!parsedUrl) return false;

  const normalizedRule = String(rule || '').toLowerCase();
  const noSchemeRule = normalizedRule.replace(/^https?:\/\//, '');
  const slashIndex = noSchemeRule.indexOf('/');
  const hostPattern = slashIndex >= 0 ? noSchemeRule.slice(0, slashIndex) : noSchemeRule;
  const pathPattern = slashIndex >= 0 ? noSchemeRule.slice(slashIndex) : '/*';

  const host = parsedUrl.hostname;
  const pathAndQuery = `${parsedUrl.pathname}${parsedUrl.search}`;

  let hostMatch = false;
  if (hostPattern.startsWith('*.')) {
    const bare = hostPattern.slice(2);
    hostMatch = host === bare || host.endsWith(`.${bare}`);
  } else if (hostPattern.includes('*')) {
    hostMatch = wildcardToRegex(hostPattern).test(host);
  } else {
    hostMatch = host === hostPattern;
  }

  if (!hostMatch) return false;
  return wildcardToRegex(pathPattern).test(pathAndQuery);
}

export function matchRule(urlValue, rule) {
  if (!rule) return false;

  const urlLower = String(urlValue || '').toLowerCase();
  const parsed = (() => {
    try {
      return new URL(urlLower);
    } catch (_) {
      return null;
    }
  })();

  const hostname = parsed ? parsed.hostname : '';

  if (rule.includes('*')) {
    if (!rule.includes('://')) {
      const wildcardHostPathMatch = matchHostPathWildcard(urlValue, rule);
      if (wildcardHostPathMatch) return true;
    }
    return wildcardToRegex(rule).test(urlLower);
  }

  if (rule.includes('://') || rule.includes('/') || rule.includes('?')) {
    return urlLower.includes(rule);
  }

  if (!hostname) return false;
  return hostname === rule || hostname.endsWith('.' + rule);
}

export function shouldCaptureUrl(urlValue, captureEnabled, ignoreUrls, focusUrls) {
  if (!captureEnabled) return false;

  const lowered = String(urlValue || '').toLowerCase();
  if (
    lowered.includes('://localhost:7700') ||
    lowered.includes('://127.0.0.1:7700')
  ) {
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