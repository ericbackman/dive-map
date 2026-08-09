# dive-map

**[ericbackman.github.io/dive-map](https://ericbackman.github.io/dive-map/)** — an
interactive world map of every scuba dive I've logged: **147 dives, 20 trips, 11
countries, 2013–2024**.

Click a pin for the site, date, depth, dive type and what was actually down there.

## Why it's built this way

No build step, no framework, no API keys. It is a static `index.html` plus one
JSON file, served straight from GitHub Pages — which means it cannot break in a
dependency update, costs nothing to run, and will still load in ten years.

- **Map** — Leaflet 1.9.4 from a CDN
- **Tiles** — CARTO Dark Matter (free, keyless)
- **Data** — `data/dives.json`, hand-curated from my dive logs
- **Hosting** — GitHub Pages off `main`

## The data

`data/dives.json` holds `diver`, `trips`, `bestVideos` and the `dives` array.
Each dive:

```json
{
  "id": 6,
  "trip": "grand-cayman-2014",
  "site": "Castle Wall",
  "location": "Grand Cayman, Cayman Islands",
  "lat": 19.282, "lng": -81.419,
  "depth_m": 29.6, "duration_min": 42,
  "date": "2014-04-17",
  "type": "wall",
  "highlights": ["moray eels", "wall dive"],
  "notes": "Eels, deepest dive to date. Huge wall, variety of aquatic life.",
  "rating": null,
  "media": []
}
```

`rating` is nullable — the early logs predate my rating them.

Site types: `reef` (110), `wall` (12), `drift` (10), `night` (7), `wreck` (4),
plus `cave`, `cenote`, `crater`, `sinkhole`, `freshwater`.

Depths run 6.1–37.0 m (median 20.5 m).

## Running it locally

Any static server — there's nothing to compile:

```bash
python -m http.server 8000
```

Then open <http://localhost:8000>. Opening `index.html` directly works too,
though some browsers block the `fetch` of `dives.json` over `file://`.

## Repo layout

```
index.html          the whole page
css/style.css       dark ocean theme
js/map.js           DiveMap module — init, markers, popups
js/app.js           entry point — loads data, boots the map
data/dives.json     every dive
scripts/            one-off helpers (log import, video classification)
analysis/breathing/ dive-computer breathing-rate analysis (separate from the map)
```

`scripts/` and `analysis/` are working tools, not part of the deployed site — the
page only needs `index.html`, `css/`, `js/` and `data/`.

## Roadmap

- **V1 (now)** — map, pins, popups
- **V2** — video album per site (`media` is already in the schema, currently empty)
- **V3** — dive-computer profiles: depth over time, temperature
- **V4** — written dive logs

## Notes

Coordinates are approximate site locations, not exact GPS entries — dive sites
are areas, and a few are deliberately fuzzed. Nothing here is a navigation aid;
dive with a guide and your own plan.
