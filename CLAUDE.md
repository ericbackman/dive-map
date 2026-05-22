# Eric's Dive Map

Interactive world map showcasing 150+ scuba dive sites with pins, details, and (future) video/data integration.

## Project structure

```
dive-map/
├── index.html          # Main page — loads Leaflet map
├── css/style.css       # Dark ocean-themed styles
├── js/
│   ├── map.js          # DiveMap module — map init, markers, popups
│   └── app.js          # Entry point — loads data, boots map
├── data/
│   └── dives.json      # All dive site data (pins, metadata)
├── assets/
│   ├── icons/          # Custom marker icons (future)
│   └── images/         # Site images, thumbnails (future)
├── docs/               # Research documents
└── .gitignore
```

## Tech stack

- **Map**: Leaflet.js 1.9.4 via CDN (no build step)
- **Tiles**: CARTO Dark Matter (free, no API key)
- **Data**: Static JSON (`data/dives.json`)
- **Hosting**: GitHub Pages (static files, auto-deploy)
- **No build tools** — pure HTML/CSS/JS, edit and push

## Version roadmap

- **V1** (current): Interactive map with dive site pins and popups
- **V2**: Video albums per dive site (Plyr + sidebar/modal)
- **V3**: Dive computer data integration (depth profiles, temps)
- **V4**: Dive logs with narrative entries

## Development

Open `index.html` in a browser or use any static server:
```bash
python -m http.server 8000
# or
npx serve .
```

## Conventions

- All dive data lives in `data/dives.json` — add new dives there
- Coordinates are decimal degrees (lat, lng)
- Marker popups render from data — no hardcoded HTML per dive
- Keep JS modular: `map.js` for map logic, `app.js` for orchestration
- CSS uses custom properties (vars) for the ocean color palette

## Adding a dive site

Add an entry to `data/dives.json`:
```json
{
  "id": 11,
  "site": "Site Name",
  "location": "Region, Country",
  "lat": 0.0000,
  "lng": 0.0000,
  "depth_m": 20,
  "date": "2024-03-15",
  "type": "reef",
  "highlights": ["tag1", "tag2"],
  "rating": 4,
  "media": []
}
```

Types: `reef`, `wreck`, `wall`, `cave`, `cenote`, `crater`, `sinkhole`, `freshwater`, `drift`
