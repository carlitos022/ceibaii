const base = (import.meta as any).env.BASE_URL.replace(/\/$/, '');
export function scopedUrl(value: string): string {
  if (!base || value.startsWith(base + '/')) return value;
  if (value.startsWith('/api/') || value.startsWith('/admin-downloader/') ||
      value.startsWith('/build-version.json') || value.startsWith('/updates/')) return base + value;
  return value;
}

// Preserve the existing components while mounting the replica beside the downloader.
const nativeFetch = window.fetch.bind(window);
window.fetch = (input, options) => {
  if (typeof input === 'string') input = scopedUrl(input);
  else if (input instanceof URL && input.origin === location.origin) input = new URL(scopedUrl(input.pathname + input.search), location.origin);
  return nativeFetch(input, options);
};
const NativeEventSource = window.EventSource;
window.EventSource = class extends NativeEventSource {
  constructor(url: string | URL, options?: EventSourceInit) {
    super(scopedUrl(String(url)), options);
  }
};
