# Eric's Dive Map

Interactive world map of 147 logged scuba dives across 20 trips and 11 countries,
2013-2026, with a video gallery and a searchable dive log.

## Project structure

```
dive-map/
├── index.html          # Main page: three tabs (Map, Videos, Dive Log)
├── _config.yml         # Jekyll excludes: keeps working files off GitHub Pages
├── css/style.css       # Dark ocean-themed styles
├── js/
│   ├── map.js          # DiveMap module: map init, markers, popups
│   ├── travel-path.js  # Animated trip-to-trip travel path + guided tour
│   └── app.js          # Entry point: loads data, boots map, renders tabs
├── data/
│   ├── dives.json      # All dive data (diver, trips, bestVideos, dives)
│   └── travel-path.json# Great-circle route between trips
├── scripts/            # Working tools, NOT deployed
│   ├── check_video_liveness.py   # Guards against deleted YouTube embeds
│   ├── classify_dive_videos.py   # AI titling, see "Titles are generated"
│   └── ...
├── analysis/breathing/ # Dive-computer breathing analysis, separate from the map
├── docs/               # Research + retrospective notes
└── .github/workflows/  # cf-deploy.yml, video-liveness.yml
```

## Tech stack

- **Map**: Leaflet 1.9.4 via CDN (no build step), plus markercluster 1.5.3 and
  leaflet-ant-path 1.3.0
- **Tiles**: CARTO Dark Matter (free, no API key)
- **Data**: Static JSON (`data/dives.json`)
- **Video**: YouTube iframe embeds, thumbnails from `img.youtube.com`
- **Hosting**: dual-served, see below
- **No build tools.** Pure HTML/CSS/JS, edit and push

## Hosting: three live surfaces

| URL | Host | Deploy |
|---|---|---|
| `dive.ericbackman.com` | Cloudflare Pages (`dive-map-c4c`) | GitHub Actions on push to main |
| `dives.ericbackman.com` | same project, alias | same |
| `ericbackman.github.io/dive-map` | GitHub Pages | native, on push to main |

`dive-map.pages.dev` is **not ours**. That name was already taken globally, so
Cloudflare suffixed the project to `dive-map-c4c`. The bare name redirects to an
unrelated Thai dive site. Always verify against `dive-map-c4c.pages.dev`.

Cloudflare Pages falls back to `index.html` for unknown paths, so a 200 there
proves nothing about whether a file exists. GitHub Pages serves real bytes.

## Data model

`data/dives.json` has four top-level keys:

- `diver`: name and `totalDives` (156; this counts dives beyond the 147 logged)
- `trips`: 20 entries with `id`, `name`, `region`, `year`, `dates`, `diveCount`,
  and an optional `videos` array of `{id, title}`
- `bestVideos`: 4 curated highlights for the top of the Videos tab
- `dives`: 147 entries, each keyed to a trip by `trip` id

**Videos hang off trips, not dives.** Each dive carries a `media` array, but it
is empty on all 147 and nothing reads it. Do not add videos there.

Types actually in use: `reef` (110), `wall` (12), `drift` (10), `night` (7),
`wreck` (4), `cave` (2), `cenote` (2).

## Titles are generated, and have been wrong

Video titles came from `scripts/classify_dive_videos.py` (AI vision labelling),
and the YouTube descriptions were then generated **from the trip assignment** in
this file. That makes the YouTube metadata circular: it cannot be used to verify
which trip a clip belongs to.

Misattribution has been corrected twice already (commits `2b9639e`, `02ed0fb`).
Two clips on `cayman-2026` name Indo-Pacific-only species (`1BZ9SQSr93E`
"Clownfish In Anemone 2", `B9zGvYAY9wo` "Bubble Coral") and are unresolved.
Eric places them in Raja Ampat or Komodo. **Treat any species name as a claim to
check, not a fact.**

## The videos can be deleted out from under this repo

dive-map's clips are the `RAW-STOCK` bucket of the Scuba Sessions YouTube
channel, which the `dive-channel` project treats as disposable. On 2026-08-30,
23 of 116 embedded videos (20%) were found deleted, including one of four
`bestVideos`. Nothing had detected it.

`scripts/check_video_liveness.py` now runs weekly in CI and on any change to
`data/dives.json`. Before adding a video, confirm it is alive. Details and the
recovery procedure: [PLAYBOOK.md](PLAYBOOK.md).

## Development

Open `index.html` in a browser or use any static server:
```bash
python -m http.server 8000
```

Check every embedded video still exists:
```bash
python scripts/check_video_liveness.py
```

## Conventions

- All dive data lives in `data/dives.json`: add new dives there
- Coordinates are decimal degrees (lat, lng), deliberately approximate
- Marker popups render from data: no hardcoded HTML per dive
- Keep JS modular: `map.js` for map logic, `app.js` for orchestration
- CSS uses custom properties (vars) for the ocean color palette
- A dive's `trip` must match a `trips[].id`, or it renders nowhere

## Adding a dive site

Add an entry to the `dives` array in `data/dives.json`:
```json
{
  "id": 148,
  "trip": "cayman-2026",
  "site": "Site Name",
  "location": "Region, Country",
  "lat": 0.0000,
  "lng": 0.0000,
  "depth_m": 20,
  "duration_min": 42,
  "date": "2026-03-15",
  "type": "reef",
  "highlights": ["tag1", "tag2"],
  "notes": "What was actually down there.",
  "rating": 4,
  "media": []
}
```

`rating` is nullable: the early logs predate rating them.
