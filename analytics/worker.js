/**
 * Cloudflare Worker — Dive Map analytics beacon & dashboard API
 *
 * Endpoints:
 *   POST /beacon    — record a page visit (hashes IP, stores in KV)
 *   GET  /dashboard — return 30-day aggregates (token-protected)
 *
 * KV bindings required (wrangler.toml):
 *   [[kv_namespaces]]
 *   binding = "ANALYTICS_KV"
 *   id      = "<your KV namespace id>"
 *
 * Environment variables (Cloudflare dashboard → Settings → Variables):
 *   ANALYTICS_TOKEN — secret for GET /dashboard (leave unset to disable auth)
 *
 * See docs/cloudflare-setup.md for full deployment instructions.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    const { pathname } = new URL(request.url);

    if (request.method === 'POST' && (pathname === '/' || pathname === '/beacon')) {
      return handleBeacon(request, env);
    }
    if (request.method === 'GET' && pathname === '/dashboard') {
      return handleDashboard(request, env);
    }

    return new Response('Not found', { status: 404 });
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

// We never store raw IPs — only a one-way SHA-256 hash.
// The salt prevents cross-service correlation of the same IP hash.
const SALT = 'dive-map-analytics';

async function sha256hex(text) {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text + SALT),
  );
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function normalizeReferrer(raw) {
  if (!raw) return '(direct)';
  try { return new URL(raw).hostname || '(direct)'; }
  catch { return '(direct)'; }
}

function todayUTC() {
  return new Date().toISOString().split('T')[0];
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// ─── POST /beacon ─────────────────────────────────────────────────────────────

async function handleBeacon(request, env) {
  let body;
  try { body = await request.json(); }
  catch { return new Response('Bad request', { status: 400, headers: CORS }); }

  const ip = request.headers.get('CF-Connecting-IP') || '0.0.0.0';
  const ipHash = await sha256hex(ip);
  const visitorId = typeof body.visitor_id === 'string' ? body.visitor_id : 'unknown';
  const today = todayUTC();

  // ── Daily aggregate ─────────────────────────────────────────────────────────
  // Uses objects-as-sets (key = id/hash, value = 1) for O(1) dedup.
  // Race conditions under concurrent load are acceptable on a personal site —
  // an occasional missed increment beats adding a Durable Object.
  const aggKey = `daily:${today}`;
  const existing = await env.ANALYTICS_KV.get(aggKey);
  const agg = existing
    ? JSON.parse(existing)
    : { visits: 0, unique_visitors: {}, unique_ips: {}, referrers: {} };

  agg.visits += 1;
  agg.unique_visitors[visitorId] = 1;
  agg.unique_ips[ipHash] = 1;

  const ref = normalizeReferrer(body.referrer);
  agg.referrers[ref] = (agg.referrers[ref] || 0) + 1;

  await env.ANALYTICS_KV.put(aggKey, JSON.stringify(agg), {
    expirationTtl: 90 * 86_400,  // 90-day auto-expire
  });

  // ── Cross-browser / same-IP detection ───────────────────────────────────────
  // ip_visitors:{ipHash} stores every localStorage UUID seen from this IP.
  // Multiple UUIDs from one IP = same person using different browsers/devices
  // (or a shared NAT/VPN — the Worker returns this as a signal, not a verdict).
  const ipKey = `ip_visitors:${ipHash}`;
  const knownRaw = await env.ANALYTICS_KV.get(ipKey);
  const knownVisitors = knownRaw ? JSON.parse(knownRaw) : [];

  let crossBrowserMatch = false;
  if (!knownVisitors.includes(visitorId)) {
    if (knownVisitors.length > 0) crossBrowserMatch = true;
    knownVisitors.push(visitorId);
    await env.ANALYTICS_KV.put(ipKey, JSON.stringify(knownVisitors), {
      expirationTtl: 365 * 86_400,
    });
  }

  // Reverse mapping: UUID → ip_hashes (lets you query "did this visitor use a VPN?")
  const visitorKey = `visitor_ips:${visitorId}`;
  const visitorRaw = await env.ANALYTICS_KV.get(visitorKey);
  const knownIPs = visitorRaw ? JSON.parse(visitorRaw) : [];
  if (!knownIPs.includes(ipHash)) {
    knownIPs.push(ipHash);
    await env.ANALYTICS_KV.put(visitorKey, JSON.stringify(knownIPs), {
      expirationTtl: 365 * 86_400,
    });
  }

  return json({ ok: true, crossBrowserMatch });
}

// ─── GET /dashboard ───────────────────────────────────────────────────────────

async function handleDashboard(request, env) {
  const token = env.ANALYTICS_TOKEN;
  if (token) {
    const authHeader = request.headers.get('Authorization') || '';
    const urlToken   = new URL(request.url).searchParams.get('token') || '';
    if (authHeader !== `Bearer ${token}` && urlToken !== token) {
      return new Response('Unauthorized', { status: 401, headers: CORS });
    }
  }

  // Fetch last 30 days in ascending chronological order
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - (29 - i));
    return d.toISOString().split('T')[0];
  });

  const results = await Promise.all(
    days.map(async date => {
      const raw = await env.ANALYTICS_KV.get(`daily:${date}`);
      if (!raw) return { date, visits: 0, unique_visitors: 0, unique_ips: 0, referrers: {} };
      const d = JSON.parse(raw);
      return {
        date,
        visits:           d.visits || 0,
        unique_visitors:  Object.keys(d.unique_visitors || {}).length,
        unique_ips:       Object.keys(d.unique_ips      || {}).length,
        referrers:        d.referrers || {},
      };
    }),
  );

  // Aggregate totals and referrers across all days
  const allReferrers = {};
  const totals = { visits: 0, unique_visitors: 0, unique_ips: 0 };

  results.forEach(r => {
    totals.visits          += r.visits;
    totals.unique_visitors += r.unique_visitors;
    totals.unique_ips      += r.unique_ips;
    Object.entries(r.referrers).forEach(([ref, count]) => {
      allReferrers[ref] = (allReferrers[ref] || 0) + count;
    });
  });

  return json(
    { days: results, referrers: allReferrers, totals },
    200,
  );
}
