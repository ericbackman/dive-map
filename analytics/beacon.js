/**
 * Dive Map analytics beacon — client-side, ~1 KB
 *
 * Fires once per page load. Sends a lightweight payload to the Cloudflare
 * Worker so it can hash your IP, count the visit, and detect repeat visitors.
 *
 * After deploying your Worker, replace ENDPOINT below with your Worker URL.
 * See docs/cloudflare-setup.md for setup instructions.
 */
(function () {
  'use strict';

  // ── Config ──────────────────────────────────────────────────────────────────
  // Replace with your deployed Worker URL (include the /beacon path)
  var ENDPOINT = 'https://dive-analytics.YOUR_SUBDOMAIN.workers.dev/beacon';

  // Skip during local development to avoid polluting analytics data
  if (location.hostname === 'localhost' ||
      location.hostname === '127.0.0.1' ||
      location.protocol === 'file:') {
    return;
  }

  // ── Visitor identity ────────────────────────────────────────────────────────
  // A random ID stored in localStorage persists across sessions in the same
  // browser. This is the "localStorage UUID" the Worker uses for repeat-visitor
  // detection. Multiple UUIDs arriving from the same hashed IP signal that one
  // person is browsing from different browsers or devices.

  function getVisitorId() {
    var KEY = '_dm_vid';
    var id = null;
    try { id = localStorage.getItem(KEY); } catch (_) {}
    if (!id) {
      id = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
          });
      try { localStorage.setItem(KEY, id); } catch (_) {}
    }
    return id;
  }

  // ── Payload ─────────────────────────────────────────────────────────────────
  // Decides what page-context data to send with the beacon.
  //
  // This is where you make privacy and granularity trade-offs for your site:
  //
  //   path     — location.pathname only (just the page) or + location.hash
  //              (reveals current tab: #map, #videos, #log). Useful signal for
  //              a single-page app like this map. Not PII.
  //
  //   referrer — document.referrer gives the full URL the visitor came from,
  //              which can include search terms and private paths. Use
  //              new URL(document.referrer).hostname to capture only the source
  //              domain (e.g. "google.com"), which is privacy-safe and still
  //              useful for referrer stats.
  //
  //   screen   — window.screen.width + 'x' + window.screen.height is useful
  //              for understanding mobile vs. desktop breakdown. Not PII at
  //              this granularity. Omit if you prefer not to collect it.
  //
  //   language — navigator.language ("en-US", "de", etc.) for rough geography.

  function buildPayload(visitorId) {
    var ref = '';
    if (document.referrer) {
      try { ref = new URL(document.referrer).hostname; } catch (_) {}
    }

    return {
      visitor_id: visitorId,
      path:       location.pathname + location.hash,
      referrer:   ref,
      timestamp:  new Date().toISOString(),
      screen:     window.screen.width + 'x' + window.screen.height,
      language:   navigator.language || '',
    };
  }

  // ── Transport ───────────────────────────────────────────────────────────────
  // sendBeacon is preferred: it fires reliably even if the page is closing.
  // The Blob wrapper is required so the Worker receives Content-Type: application/json
  // (passing a raw string sends text/plain, which breaks request.json() in the Worker).

  function send(payload) {
    if (!ENDPOINT || ENDPOINT.indexOf('YOUR_SUBDOMAIN') !== -1) return;
    var body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }));
    } else {
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
        keepalive: true,
      }).catch(function () {});
    }
  }

  // ── Init ────────────────────────────────────────────────────────────────────

  function init() {
    var visitorId = getVisitorId();
    send(buildPayload(visitorId));
    // Expose to GA4 custom dimensions and map.js event tracking
    window.__diveVisitorId = visitorId;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());
