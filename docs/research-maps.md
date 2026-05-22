# Research: Interactive Map Libraries for a Personal Dive Map

**Date:** 2026-05-22
**Decision:** Leaflet.js for V1, MapLibre GL JS for future upgrade

## Context

Need a JavaScript map library for an interactive dive map with ~150 pins, click popups, and future video/data overlays. Hosted as a static site on GitHub Pages.

## Libraries Evaluated

### Leaflet.js (V1 choice)
- **Cost:** Free, MIT license. OpenStreetMap/CARTO tiles are free with no API key.
- **Bundle:** ~42 KB gzipped — lightest option by far.
- **Markers/Popups:** First-class HTML popups with custom icons, click events. Best ecosystem for this.
- **Mobile:** Responsive out of the box, touch/pinch-zoom.
- **Video:** Can embed `<video>` or iframes directly in HTML popups.
- **Tiles:** Raster only. Satellite via Esri World Imagery (free) or MapTiler.
- **Community:** Massive plugin ecosystem, mature docs, huge community.
- **Verdict:** Perfect for V1. Lowest barrier to entry, smallest bundle, zero build step.

### MapLibre GL JS (recommended upgrade path)
- **Cost:** Free, BSD-3 license. MapTiler free tier covers 100K tiles/month.
- **Bundle:** ~290 KB gzipped.
- **Rendering:** WebGL-based vector tiles — smooth 60fps zoom, dynamic styling.
- **Satellite:** Vector tiles with satellite options from MapTiler or Esri.
- **Future-proof:** Handles data overlays (depth charts, heatmaps) cleanly.
- **Backed by:** AWS, Microsoft, Meta. Rapidly growing community.
- **Verdict:** Best long-term choice. Upgrade when adding V3 data visualizations.

### Mapbox GL JS
- **Cost:** Free tier of 50K loads/month, but proprietary license. Costs scale.
- **Bundle:** ~250 KB gzipped. Requires API key.
- **Verdict:** Great maps, but license lock-in. MapLibre is the open-source fork.

### Google Maps JavaScript API
- **Cost:** ~10K loads/month free, then $100+/month. Requires billing account.
- **Verdict:** Too expensive and rigid for a personal static site.

### OpenLayers
- **Cost:** Free, BSD-2.
- **Bundle:** ~160 KB gzipped (tree-shakeable).
- **Verdict:** Designed for GIS professionals. Overpowered for pin-and-popup use cases.

### Deck.gl
- **Cost:** Free, MIT.
- **Verdict:** Built for 100K+ data point visualizations. Wrong tool for 150 pins with popups.

## Decision Rationale

Leaflet for V1 because:
1. Zero build step — CDN script tags, works on GitHub Pages immediately
2. Smallest bundle (42 KB) — fast load on any connection
3. HTML popups are perfect for embedding future video players
4. 150 pins is trivial — no performance concerns
5. Upgrade path to MapLibre is well-documented when V3 data overlays arrive

## Tile Provider Choice

CARTO Dark Matter tiles selected for V1:
- Free, no API key required
- Dark theme matches the ocean/dive aesthetic
- Good coastline and ocean detail
- Can switch to satellite tiles (Esri) for V2+ with one line change
