# Google Analytics 4 Setup — 5-Minute Guide

GA4 gives you: page views, session duration, geographic location (country/city), device type,
referral source, and approximate repeat visitors via cookie-based user IDs.

It works the moment you drop the snippet into `index.html` — no server required.

---

## Step 1 — Create a Google account (if you don't have one)

Skip this if you have a Gmail or Google Workspace account.

## Step 2 — Create a GA4 property

1. Go to [analytics.google.com](https://analytics.google.com) and sign in.
2. Click **Admin** (gear icon, bottom-left).
3. Under **Account**, click **Create Account** → give it a name (e.g., "Eric's Sites").
4. Under **Property**, click **Create Property**.
   - Property name: `Eric's Dive Map`
   - Reporting time zone: pick yours
   - Currency: USD (or yours)
5. Click **Next** → choose **Web** as the platform.
6. Enter your site URL: `https://ericbackman.github.io/dive-map` (or your Pages URL)
7. Stream name: `Dive Map`
8. Click **Create stream**.

## Step 3 — Get your Measurement ID

After creating the stream, you'll see a panel with a **Measurement ID** that looks like `G-XXXXXXXXXX`.
Copy it — you'll need it in the next step.

## Step 4 — Add the ID to index.html

Open `index.html` and find this block (already added near the bottom of `<head>`):

```html
<!-- Google Analytics 4 -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

Replace both instances of `G-XXXXXXXXXX` with your real Measurement ID and push the change.

## Step 5 — Verify it's working

1. Open your live site in a browser.
2. In the GA4 dashboard, click **Reports → Realtime**.
3. You should see yourself appear within a few seconds.

---

## What GA4 tracks automatically (no extra code)

| Signal | How it works |
|--------|-------------|
| Page views | Fires on every load |
| Session duration | Time between first and last event in a session |
| Geographic location | IP-based (country → city) — Google does this, not you |
| Device / browser | From User-Agent header |
| Referral source | From HTTP `Referer` header |
| Returning users | GA4 cookie (`_ga`) persists across visits |

## Custom events already wired in

The dive map fires these custom events (see `js/app.js`):

| Event | When it fires | Parameters |
|-------|--------------|-----------|
| `tab_view` | Map / Videos / Log tab switched | `tab_name` |
| `dive_site_view` | Dive site popup opened | `dive_site`, `dive_type`, `dive_location` |
| `video_play` | Video thumbnail clicked | `video_id`, `video_title`, `video_source`, `trip_name` |
| `video_gallery_open` | Trip gallery opened from map popup | `trip_id`, `trip_name` |
| `dive_log_search` | Search term typed (1.2 s debounce) | `search_term` |

To explore these in GA4: **Reports → Engagement → Events** (they appear within 24–48 hours).
For real-time testing: **Configure → DebugView** (use the GA4 Chrome extension to enable debug mode).

---

## Privacy note

GA4 anonymises IPs by default since 2023. It uses cookies (`_ga`, `_ga_XXXXXXXX`) to identify
returning users — if a visitor clears cookies or uses a different browser, they appear as a new user.
For the Cloudflare layer with IP-hash-based repeat visitor detection, see `docs/cloudflare-setup.md`.
