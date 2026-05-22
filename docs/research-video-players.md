# Research: Web Video Players for a Personal Dive Map

**Date:** 2026-05-22
**Decision:** Native `<video>` + Plyr for V2 implementation

## Context

V2 of the dive map will add video playback at dive site pins. Need a player that works in a Leaflet-based static site hosted on GitHub Pages. Videos are short underwater clips (30s-3min).

## Self-Hosted Players

| Player | Bundle (gzip) | Mobile | Map Integration |
|--------|--------------|--------|-----------------|
| **Plyr** | ~30 KB | Good | Lightweight, simple API |
| **Vidstack** | ~53 KB | Excellent | Web components, tree-shakeable |
| **Video.js v10** | ~195 KB | Excellent | Heavy for popups |
| **Native `<video>`** | 0 KB | Excellent | Inline HTML, zero deps |
| **MediaElement.js** | ~80 KB | Fair | Dated, Flash fallback irrelevant |

### Plyr (V2 choice)
- 30 KB gzipped — minimal impact on page load
- Clean, accessible UI with customizable controls
- Easy to initialize: `new Plyr('#player')`
- Supports MP4, WebM, YouTube embeds, Vimeo embeds
- Active maintenance, good docs

### Vidstack (future consideration)
- Modern web component architecture
- Tree-shakeable — only load what you use
- Plyr and Vidstack maintainers merged efforts into Video.js v10, but Vidstack remains independently usable
- Better for complex use cases (HLS, DASH streaming)

### Native `<video>` (fallback)
- Zero dependencies, works everywhere
- Sufficient for simple MP4 playback
- Missing: consistent UI across browsers, easy customization

## Embed-Based Options

- **YouTube:** Free unlimited hosting. Branding/ads can be intrusive. iframes in Leaflet popups are sluggish on mobile.
- **Vimeo:** Cleaner embed, privacy controls. Free tier caps at 500 MB/week upload.
- **Cloudinary:** Free tier gives 25 GB bandwidth, 10 GB storage. Built-in CDN, thumbnail generation, format auto-negotiation.

## Video UX in Map Applications

**Critical insight: Do NOT play video inside Leaflet popups.**

Popups are small, clip on mobile, and fight with map gestures. Best practice:

1. Map pin shows a **thumbnail image** (poster frame)
2. Click opens a **sidebar panel or modal** outside the map container
3. Video player lives in the sidebar/modal with full controls
4. This avoids z-index issues, gives room for controls, works on mobile

## Underwater Video Encoding Tips

- **Format:** MP4 (H.264) as universal fallback; WebM (VP9) for 40-60% size savings
- **Resolution:** 720p is sufficient for 30s-3min clips (~5 MB/minute)
- **Compression:** Variable bitrate, target 2,500-3,000 kbps for 720p
- **Color correction:** Apply white-balance before encoding — raw underwater blue/green casts compress poorly
- **Thumbnails:** Generate poster frames with FFmpeg: `ffmpeg -i clip.mp4 -ss 2 -frames:v 1 thumb.jpg`

## Decision Rationale

Native `<video>` + Plyr for V2 because:
1. 30 KB total bundle addition — keeps the site fast
2. Sidebar/modal pattern works naturally with the existing Leaflet map
3. Supports both self-hosted MP4 and YouTube/Vimeo embeds
4. Plyr gives a polished, consistent UI without the weight of Video.js
5. Cloudinary free tier handles video hosting/CDN if GitHub Pages storage is tight
6. Upgrade path to Vidstack if adaptive streaming is needed later
