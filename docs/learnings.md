# Dive Map — Project Learnings

Retrospective on building V1 of the interactive dive map from idea to live site.

## What went well

### 1. Research-first approach paid off

Starting with three research documents (maps, hosting, video) before writing any code meant we made informed technology choices from the start. Leaflet.js was picked over MapLibre GL JS specifically because V1 didn't need vector tiles or 3D terrain — it needed to ship fast. The research also documented the upgrade path to MapLibre for V3 (dive computer data with depth profiles), so the migration plan already exists when it's needed.

### 2. Data-driven architecture from day one

Every pin on the map comes from `data/dives.json` — no hardcoded HTML, no per-dive templates. This one decision enabled:
- Adding 94 dives from email logs without touching any JS/HTML
- Swapping the Sipadan placeholder for 11 detailed entries with a Python script
- The stats in the header auto-computing from the data (dive count, trip count, country count)
- Future versions (V2 video, V3 computer data) to extend the JSON schema without rewriting the rendering layer

### 3. Gmail as a data source

Using Gmail MCP tools to read self-emailed dive logs turned unstructured notes into structured JSON. The dive logs had inconsistent formatting (some had depth, some didn't; dates written three different ways), but parsing them once into a canonical JSON schema normalized everything. The personal notes and highlights came through — things like "Simon literally hugged the group" and "felt like swimming around an underwater village" give each pin character that a simple lat/lng list wouldn't have.

### 4. Shipping incrementally

The project went live in stages, each with a working deployed site:
1. Scaffold with sample pins (proves the map works)
2. Real dive locations replacing samples (proves the data pipeline)
3. Full dive logs with details and clustering (the actual V1 feature set)
4. Sipadan addition (proves the workflow for adding new trips)

Each stage was a commit, a push, and a live verification. At no point was the site broken for more than a few minutes.

### 5. Cluster UX design

Marker clustering wasn't just "group nearby pins." The custom `iconCreateFunction` inspects child markers to detect if they share a trip ID, then renders the trip name as a label beneath the cluster. At world zoom you see "RED SEA LIVEABOARD" and "HAWAII BIG ISLAND" instead of anonymous numbered circles. This transforms the map from a dot plot into a trip-oriented story.

### 6. Cache-busting solved the CDN problem early

GitHub Pages caches static files aggressively through Fastly CDN. After the first data update showed stale pins, adding `?v=${Date.now()}` to the JSON fetch fixed it permanently. Catching this on the second deploy (rather than the tenth) saved a lot of debugging time.

### 7. Zero build tooling

Pure HTML/CSS/JS with CDN dependencies (Leaflet, MarkerCluster) means:
- No `npm install`, no webpack, no build step
- Edit a file, push, it's live in 60 seconds
- Any browser can view the source — no transpilation obscuring the code
- GitHub Pages deploys automatically with no CI/CD configuration

For a personal project at this scale, a build system would have added complexity with zero benefit.

## What to watch for

### GitHub Pages CDN latency
Builds take 30-90 seconds. The `?v=` cache-buster handles JSON freshness, but if you update HTML/CSS/JS, hard-refresh (Ctrl+Shift+R) is needed to bypass the browser cache during development.

### Sipadan Island coordinate density
9 of 11 Sipadan dives are on a 200m-wide island. At max zoom they overlap and need Leaflet's spiderfy behavior to separate. This works but isn't beautiful — V2 could add a sidebar list view for dense areas.

### ID renumbering on every data change
The backwards-from-156 numbering means adding or removing dives requires renumbering all IDs. The Python scripts handle this reliably, but it's a step that could be forgotten. A future improvement could auto-assign IDs at render time instead of storing them in the JSON.

## Technical decisions worth documenting

| Decision | Why | Trade-off |
|----------|-----|-----------|
| Leaflet over MapLibre | Simpler API, smaller bundle, no build step needed for V1 | Loses vector tiles, 3D terrain, GPU rendering |
| CARTO Dark Matter tiles | Free, no API key, dark ocean aesthetic matches the diving theme | Less detail than satellite imagery |
| GitHub Pages over Netlify | Already using GitHub for the repo, free, zero config for static sites | No server-side rendering, no environment variables |
| Static JSON over API | No backend to maintain, data changes through git commits | Manual editing, no real-time updates |
| MarkerCluster plugin | Handles 100+ pins without performance issues, trip-aware grouping | External dependency, custom styling needed to match theme |
| Cache-busting with Date.now() | Ensures fresh data on every page load | Never caches JSON (acceptable for ~50KB file) |

## V2 priorities (informed by V1)

1. **Video integration** — The `media: []` field already exists in every dive entry. V2 adds a player (Plyr.js or similar) triggered from popups.
2. **Sidebar/detail panel** — Dense areas like Sipadan need a list view, not just spiderfied pins.
3. **Photo thumbnails** — Quick visual preview in popups before opening the full media viewer.
4. **Search/filter** — Filter by trip, country, dive type, or highlight tags.
