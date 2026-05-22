# Research: Free Hosting Options for a Personal Dive Map

**Date:** 2026-05-22
**Decision:** GitHub Pages for V1, Cloudflare Pages as upgrade option

## Context

Static site (HTML/CSS/JS) with ~150 map pins. Future versions add embedded video. Need free hosting with HTTPS and ideally auto-deploy from GitHub.

## Platforms Evaluated

| Platform | Bandwidth | Storage | HTTPS | CI/CD | Custom Domain |
|----------|-----------|---------|-------|-------|---------------|
| **GitHub Pages** | 100 GB/mo | 1 GB repo | Yes | Yes (Actions) | Yes |
| **Cloudflare Pages** | Unlimited | 25 MiB/file, 20K files | Yes | Yes | Yes |
| **Netlify** | Credit-based (~100 GB) | No hard cap | Yes | Yes | Yes |
| **Vercel** | 100 GB/mo | 100 MB CLI upload | Yes | Yes | Yes |
| **Render** | Included | Unlimited static | Yes | Yes | Yes (2 free) |
| **Surge.sh** | Undisclosed | Undisclosed | Paid only | No | Yes |

### GitHub Pages (V1 choice)
- Simplest path — already using GitHub, zero additional accounts
- Auto-deploys via GitHub Actions or direct from branch
- 1 GB site limit is fine for HTML/CSS/JS + JSON data
- Must be public repo on free plan
- No server-side logic (not needed for this project)

### Cloudflare Pages (recommended upgrade)
- Unlimited bandwidth on a 300-city global CDN — zero cost
- Auto-deploy from GitHub repo
- 25 MiB per-file limit (fine for everything except self-hosted video)
- Best choice if the map gets shared widely or traffic spikes

### Netlify
- Credit-based pricing (changed Sept 2025) — less transparent limits
- Deploy previews and serverless functions are nice but unnecessary here
- Site pauses when credits run out

### Vercel
- Optimized for Next.js — overkill for pure static
- 100 MB CLI upload limit
- Hobby plan is personal/non-commercial only

## Video Hosting Strategy

**Key insight: Do NOT self-host video files on any of these platforms.**

- A 1-minute 1080p clip is ~100-150 MB
- 20 dive videos would exceed GitHub Pages' 1 GB limit
- No adaptive bitrate streaming = poor mobile experience

**Recommended hybrid approach:**
1. Host the map site on GitHub Pages (or Cloudflare Pages)
2. Host videos on YouTube (free, unlimited, adaptive streaming) or Vimeo (cleaner player)
3. For ad-free without Vimeo cost: Cloudinary free tier (25 GB bandwidth, 10 GB storage)
4. Use `loading="lazy"` on iframes to avoid page-weight penalty

## Decision Rationale

GitHub Pages for V1 because:
1. Zero additional account setup — already on GitHub
2. Push to `main` and it deploys
3. 150-pin map with JSON data is well within limits
4. Custom domain support when ready
5. Cloudflare Pages is the clear upgrade when traffic or video storage needs grow
