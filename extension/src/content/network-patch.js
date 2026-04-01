// Handle network interception and URL normalization

export function toAbsoluteUrl(value) {
  try {
    return new URL(String(value || ''), location.href).href;
  } catch (_) {
    return String(value || '');
  }
}

export function isCollectorRequest(apiUrl) {
  return String(apiUrl || '').includes(':7700');
}

export function patchNetwork(onNetworkActivity, onNetworkIdle) {
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
    let requestMethod = 'GET';
    let requestUrl = '';
    let startAt = 0;

    xhr.open = function (...args) {
      requestMethod = String(args[0] || 'GET').toUpperCase();
      requestUrl = toAbsoluteUrl(args[1]);
      startAt = Date.now();

      if (isCollectorRequest(requestUrl)) {
        return origOpen(...args);
      }

      pendingRequests++;
      xhr.addEventListener('loadend', () => {
        pushActivity({
          type: 'xhr',
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
  Object.defineProperty(PatchedXHR, 'DONE', { value: OrigXHR.DONE });
  window.XMLHttpRequest = PatchedXHR;

  const origFetch = window.fetch.bind(window);
  window.fetch = function (...args) {
    const requestUrl = toAbsoluteUrl(args[0]);
    if (isCollectorRequest(requestUrl)) return origFetch(...args);

    const requestMethod = String((args[1] && args[1].method) || 'GET').toUpperCase();
    const startAt = Date.now();

    pendingRequests++;
    return origFetch(...args)
      .then((response) => {
        pushActivity({
          type: 'fetch',
          method: requestMethod,
          url: requestUrl,
          status: Number(response.status) || 0,
          durationMs: Date.now() - startAt,
          timestamp: Date.now()
        });
        return response;
      })
      .catch((err) => {
        pushActivity({
          type: 'fetch',
          method: requestMethod,
          url: requestUrl,
          status: 0,
          error: String(err && err.message ? err.message : err),
          durationMs: Date.now() - startAt,
          timestamp: Date.now()
        });
        throw err;
      })
      .finally(() => {
        handleComplete();
      });
  };
}