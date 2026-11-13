// Output-encoding and URL-safety helpers. Kept separate and dependency-free so they're easy to reuse
// anywhere this site (or a future one) renders text/links built from data it doesn't fully control --
// today that's update.json, fetched at runtime over the same public CDN this site is served from.

/** Escapes the five characters that matter when a string is interpolated into HTML markup (as text, or
 * inside a double- or single-quoted attribute). Never use the result as a CSS or JS context. */
export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Only accept http(s) URLs for anything assigned to href/src -- rejects javascript:, data:, and anything
 * malformed, falling back to a known-safe URL instead of silently emitting an unsafe one. Defense in depth:
 * update.json is first-party today, but it's fetched at runtime from the same public host as everything
 * else, so a future compromise there shouldn't be able to turn a release note into a clickable payload. */
export function safeUrl(value, fallback = '#') {
  try {
    const url = new URL(String(value), window.location.href);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : fallback;
  } catch {
    return fallback;
  }
}
