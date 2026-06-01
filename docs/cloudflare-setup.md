# Cloudflare Workers Analytics — Setup Guide

This sets up the custom analytics backend: IP-hashed visit tracking, repeat visitor
detection, and a self-hosted dashboard — no third-party cookies, free on Cloudflare's
free tier (100k requests/day).

**Time required: ~15 minutes.**

---

## How it works

```
Browser  →  POST /beacon  →  Cloudflare Worker  →  KV Storage (daily aggregates)
                                   ↑                       ↓
                              SHA-256 hash IP         GET /dashboard  →  dashboard.html
                              (raw IP never stored)
```

---

## Prerequisites

- Free [Cloudflare account](https://dash.cloudflare.com/sign-up) — no credit card
- Node.js 18+ installed locally
- Wrangler CLI: `npm install -g wrangler`

---

## Step 1 — Log in

```bash
wrangler login
```

A browser window opens. Log in with your Cloudflare account.

---

## Step 2 — Create the KV namespace

```bash
cd dive-map/analytics
wrangler kv namespace create ANALYTICS_KV
```

Output looks like:

```
✅ Success! Add the following to your configuration file:
[[kv_namespaces]]
binding = "ANALYTICS_KV"
id = "abc123def456..."
```

Open `analytics/wrangler.toml` and paste the `id`:

```toml
[[kv_namespaces]]
binding = "ANALYTICS_KV"
id      = "abc123def456..."   # ← paste here
```

---

## Step 3 — Deploy the Worker

```bash
wrangler deploy
```

At the end you'll see your Worker URL:

```
https://dive-analytics.YOUR_SUBDOMAIN.workers.dev
```

---

## Step 4 — Wire the beacon

Open `analytics/beacon.js` and set `ENDPOINT`:

```js
var ENDPOINT = 'https://dive-analytics.YOUR_SUBDOMAIN.workers.dev/beacon';
```

---

## Step 5 — Configure the dashboard

Open `analytics/dashboard.html` and set `WORKER_URL`:

```js
var WORKER_URL = 'https://dive-analytics.YOUR_SUBDOMAIN.workers.dev';
```

---

## Step 6 — (Optional) Protect the dashboard with a token

Without a token, anyone who knows your Worker URL can read your stats.

1. Go to **Cloudflare Dashboard → Workers & Pages → dive-analytics → Settings → Variables**.
2. Add a **secret** variable named `ANALYTICS_TOKEN` with a random value
   (e.g. output of `openssl rand -hex 32`).
3. Click **Save and deploy**.

Open the dashboard and enter your token in the password field at the top right.

---

## Step 7 — Commit and push

```bash
git add analytics/beacon.js analytics/wrangler.toml analytics/dashboard.html
git commit -m "chore: configure Cloudflare analytics endpoint"
git push
```

GitHub Pages redeploys in ~1 minute. Every page load now fires a beacon.

---

## Step 8 — Verify it's working

```bash
# List today's KV keys
wrangler kv key list --namespace-id=YOUR_NAMESPACE_ID --prefix=daily:

# Read today's aggregate
wrangler kv key get --namespace-id=YOUR_NAMESPACE_ID "daily:2026-06-01"
```

Or open `analytics/dashboard.html` — you should see today's visit count.

---

## KV storage schema

| Key | Value | TTL |
|-----|-------|-----|
| `daily:YYYY-MM-DD` | `{ visits, unique_visitors: {}, unique_ips: {}, referrers: {} }` | 90 days |
| `ip_visitors:<sha256>` | Array of visitor UUIDs seen from this IP | 365 days |
| `visitor_ips:<uuid>` | Array of IP hashes seen for this UUID | 365 days |

Raw IPs are **never stored** — only a salted SHA-256 hash (`SALT = 'dive-map-analytics'`
in `worker.js`).

---

## Repeat visitor detection

The Worker's `crossBrowserMatch` flag is `true` when a new `visitor_id` UUID arrives
from an IP hash already linked to other UUIDs — same physical location, different
browser or cleared localStorage.

**Note:** shared NATs (coffee shops, corporate offices, mobile carriers) produce
false positives. For a personal dive log the rate is acceptably low.

---

## Free tier limits (2026)

| Resource | Free limit | Typical per visit |
|----------|------------|------------------|
| Worker requests | 100,000/day | 1 |
| KV reads | 100,000/day | ~3 |
| KV writes | 1,000/day | ~2–3 |
| KV storage | 1 GB | ~1 KB/day |

See [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/).
