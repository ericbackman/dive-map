/**
 * TravelPath — multi-trip overlay system.
 *
 * Supports two rendering modes per trip:
 *   "linear"    — ordered ant-path polyline with numbered stop markers
 *   "hub-spoke" — emoji hub with dashed spokes radiating to destinations;
 *                 spoke entries with a "chain" array render as a mini ant-path
 */
const TravelPath = {
  map: null,
  trips: [],

  VALID_TYPES: new Set(['home', 'hub', 'transit', 'stop', 'dive']),

  init(map) {
    this.map = map;
    return this;
  },

  async load() {
    const res = await fetch(`data/travel-path.json?v=${Date.now()}`);
    const data = await res.json();

    // Support both old single-trip format and new multi-trip format
    const tripsData = data.trips || [{
      ...data, key: 'default', icon: '✈',
      color: '#ffd54f', pathColor: 'rgba(255,213,79,0.35)', mode: 'linear',
    }];

    this.trips = tripsData.map(td => ({
      key:       td.key,
      name:      td.name,
      year:      td.year,
      icon:      td.icon      || '✈',
      color:     td.color     || '#ffd54f',
      pathColor: td.pathColor || 'rgba(255,213,79,0.35)',
      mode:      td.mode      || 'linear',
      data:      td,
      layerGroup: L.layerGroup(),
      visible:   false,
      controlBtn: null,
    }));

    this.trips.forEach(trip => this.buildTrip(trip));
    this.addToggleControl();
    return this;
  },

  // ─── Dispatch ─────────────────────────────────────────────────────────────

  buildTrip(trip) {
    if (trip.mode === 'hub-spoke') {
      this.buildHubSpoke(trip);
    } else {
      this.buildLinear(trip);
    }
  },

  // ─── Linear mode ──────────────────────────────────────────────────────────

  buildLinear(trip) {
    const stops = trip.data.stops;
    const pathCoords = stops.map(s => [s.lat, s.lng]);

    trip.layerGroup.addLayer(L.polyline.antPath(pathCoords, {
      delay: 500,
      dashArray: [12, 25],
      weight: 2.5,
      color: trip.pathColor,
      pulseColor: trip.color,
      paused: false,
      reverse: false,
      hardwareAccelerated: true,
    }));

    // Track how many times we've visited each position so repeated stops offset
    const positionCounts = {};
    stops.forEach(stop => {
      const posKey = stop.lat.toFixed(3) + ',' + stop.lng.toFixed(3);
      const visitIndex = positionCounts[posKey] || 0;
      positionCounts[posKey] = visitIndex + 1;

      let lat = stop.lat;
      let lng = stop.lng;
      if (visitIndex > 0) {
        const angle = (visitIndex * Math.PI) / 2.5;
        const r = 0.25 + visitIndex * 0.12;
        lat += r * Math.cos(angle);
        lng += r * Math.sin(angle);
      }

      const size = stop.type === 'home' ? 28 : 22;
      const marker = L.marker([lat, lng], {
        icon: L.divIcon({
          className: 'travel-stop',
          html: this.buildStopIcon(stop.num, stop.type, size, trip.color),
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        }),
        zIndexOffset: -500,
      });

      const label = visitIndex > 0
        ? `${stop.num}. ${stop.name} (return)`
        : `${stop.num}. ${stop.name}`;
      marker.bindTooltip(label, {
        direction: 'top',
        offset: [0, -size / 2 - 4],
        className: 'travel-tooltip',
      });
      trip.layerGroup.addLayer(marker);
    });
  },

  // ─── Hub-and-spoke mode ───────────────────────────────────────────────────

  buildHubSpoke(trip) {
    const { hub, spokes } = trip.data;
    const hubLL = [hub.lat, hub.lng];

    // Central hub — emoji marker
    const hubMarker = L.marker(hubLL, {
      icon: L.divIcon({
        className: 'travel-hub-emoji',
        html: `<div class="travel-hub-icon">${hub.emoji || '📍'}</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      }),
      zIndexOffset: 200,
    });
    hubMarker.bindTooltip(hub.name, {
      direction: 'top',
      offset: [0, -22],
      className: 'travel-tooltip',
    });
    trip.layerGroup.addLayer(hubMarker);

    spokes.forEach(spoke => {
      if (spoke.chain) {
        // Sequential sub-trip attached to one spoke ─────────────────────────
        const chainCoords = spoke.chain.map(p => [p.lat, p.lng]);

        // Dashed spoke: hub → first city in chain
        trip.layerGroup.addLayer(L.polyline([hubLL, chainCoords[0]], {
          color: trip.pathColor,
          weight: 1.5,
          dashArray: '6, 10',
          opacity: 0.8,
        }));

        // Animated ant-path for the ordered chain
        trip.layerGroup.addLayer(L.polyline.antPath(chainCoords, {
          delay: 700,
          dashArray: [8, 18],
          weight: 2,
          color: trip.pathColor,
          pulseColor: trip.color,
          hardwareAccelerated: true,
        }));

        // Numbered markers for each city in the chain
        spoke.chain.forEach((pt, i) => {
          const size = 20;
          const marker = L.marker([pt.lat, pt.lng], {
            icon: L.divIcon({
              className: 'travel-stop',
              html: this.buildStopIcon(i + 1, 'stop', size, trip.color),
              iconSize: [size, size],
              iconAnchor: [size / 2, size / 2],
            }),
            zIndexOffset: -400,
          });
          marker.bindTooltip(pt.name, {
            direction: 'top',
            offset: [0, -size / 2 - 4],
            className: 'travel-tooltip',
          });
          trip.layerGroup.addLayer(marker);
        });
      } else {
        // Simple spoke: dashed line from hub ─────────────────────────────────
        const destLL = [spoke.lat, spoke.lng];
        trip.layerGroup.addLayer(L.polyline([hubLL, destLL], {
          color: trip.pathColor,
          weight: 1.5,
          dashArray: '6, 10',
          opacity: 0.8,
        }));

        // Dot marker at destination
        const size = 22;
        const marker = L.marker(destLL, {
          icon: L.divIcon({
            className: 'travel-stop',
            html: this.buildSpokeIcon(size, trip.color),
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
          }),
          zIndexOffset: -400,
        });
        const label = spoke.note ? `${spoke.name} — ${spoke.note}` : spoke.name;
        marker.bindTooltip(label, {
          direction: 'top',
          offset: [0, -size / 2 - 4],
          className: 'travel-tooltip',
        });
        trip.layerGroup.addLayer(marker);
      }
    });
  },

  // ─── Icon builders ────────────────────────────────────────────────────────

  buildStopIcon(num, type, size, accentColor) {
    const safeType = this.VALID_TYPES.has(type) ? type : 'stop';
    const div = document.createElement('div');
    div.className = `travel-stop-num t-${safeType}`;
    div.style.width  = size + 'px';
    div.style.height = size + 'px';
    div.style.lineHeight = size + 'px';
    div.style.fontSize = (size < 26 ? 9 : 11) + 'px';
    // Apply trip accent colour for generic stop/hub types
    if (accentColor && (safeType === 'stop' || safeType === 'hub')) {
      div.style.background = accentColor;
      div.style.color = '#0a1628';
    }
    div.textContent = num;
    return div.outerHTML;
  },

  buildSpokeIcon(size, color) {
    const div = document.createElement('div');
    div.className = 'travel-stop-num';
    div.style.width      = size + 'px';
    div.style.height     = size + 'px';
    div.style.background = color;
    div.style.border     = '2px solid rgba(255, 255, 255, 0.65)';
    div.style.boxShadow  = '0 2px 6px rgba(0, 0, 0, 0.4)';
    div.style.borderRadius = '50%';
    return div.outerHTML;
  },

  // ─── Control panel (topleft, below zoom buttons) ──────────────────────────

  addToggleControl() {
    const self = this;
    const Control = L.Control.extend({
      options: { position: 'topleft' },
      onAdd() {
        const container = L.DomUtil.create('div', 'leaflet-bar travel-trips-panel');
        L.DomEvent.disableClickPropagation(container);

        self.trips.forEach(trip => {
          const btn = L.DomUtil.create('a', 'travel-toggle-btn', container);
          btn.href  = '#';
          btn.title = `${trip.name} (${trip.year})`;
          btn.style.setProperty('--trip-color', trip.color);

          const icon = document.createElement('span');
          icon.className   = 'travel-toggle-icon';
          icon.textContent = trip.icon;
          btn.appendChild(icon);
          btn.appendChild(document.createTextNode(' ' + trip.name));

          trip.controlBtn = btn;
          L.DomEvent.on(btn, 'click', (e) => {
            L.DomEvent.preventDefault(e);
            self.toggle(trip);
          });
        });

        return container;
      },
    });
    new Control().addTo(this.map);
  },

  // ─── Toggle individual trip visibility ────────────────────────────────────

  toggle(trip) {
    trip.visible = !trip.visible;
    if (trip.visible) {
      trip.layerGroup.addTo(this.map);
    } else {
      trip.layerGroup.remove();
    }
    if (trip.controlBtn) {
      trip.controlBtn.classList.toggle('active', trip.visible);
    }
  },
};
