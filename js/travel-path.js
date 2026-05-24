/**
 * TravelPath — multi-trip overlay system.
 *
 * Supports three rendering modes per trip:
 *   "linear"    — ordered ant-path polyline with numbered stop markers
 *   "hub-spoke" — emoji hub with dashed spokes radiating to destinations;
 *                 spoke entries with a "chain" array render as a mini ant-path
 *   "pins"      — standalone city dots with no connecting path
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
    } else if (trip.mode === 'pins') {
      this.buildPins(trip);
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
        ? stop.num + '. ' + stop.name + ' (return)'
        : stop.num + '. ' + stop.name;
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
    var hub = trip.data.hub;
    var spokes = trip.data.spokes;
    var hubLL = [hub.lat, hub.lng];

    var hubMarker = L.marker(hubLL, {
      icon: L.divIcon({
        className: 'travel-hub-emoji',
        html: this.buildHubIcon(hub.emoji || '📍'),
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
        var chainCoords = spoke.chain.map(p => [p.lat, p.lng]);

        trip.layerGroup.addLayer(L.polyline([hubLL, chainCoords[0]], {
          color: trip.pathColor,
          weight: 1.5,
          dashArray: '6, 10',
          opacity: 0.8,
        }));

        trip.layerGroup.addLayer(L.polyline.antPath(chainCoords, {
          delay: 700,
          dashArray: [8, 18],
          weight: 2,
          color: trip.pathColor,
          pulseColor: trip.color,
          hardwareAccelerated: true,
        }));

        spoke.chain.forEach((pt, i) => {
          var size = 20;
          var marker = L.marker([pt.lat, pt.lng], {
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
        var destLL = [spoke.lat, spoke.lng];
        trip.layerGroup.addLayer(L.polyline([hubLL, destLL], {
          color: trip.pathColor,
          weight: 1.5,
          dashArray: '6, 10',
          opacity: 0.8,
        }));

        var size = 22;
        var marker = L.marker(destLL, {
          icon: L.divIcon({
            className: 'travel-stop',
            html: this.buildSpokeIcon(size, trip.color),
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
          }),
          zIndexOffset: -400,
        });
        var label = spoke.note ? spoke.name + ' — ' + spoke.note : spoke.name;
        marker.bindTooltip(label, {
          direction: 'top',
          offset: [0, -size / 2 - 4],
          className: 'travel-tooltip',
        });
        trip.layerGroup.addLayer(marker);
      }
    });
  },

  // ─── Pins mode (standalone city markers, no path) ─────────────────────────

  buildPins(trip) {
    var cities = trip.data.cities;
    cities.forEach(city => {
      var size = 16;
      var marker = L.marker([city.lat, city.lng], {
        icon: L.divIcon({
          className: 'travel-stop',
          html: this.buildPinIcon(size, trip.color),
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        }),
        zIndexOffset: -700,
      });
      var label = city.note ? city.name + ' — ' + city.note : city.name;
      marker.bindTooltip(label, {
        direction: 'top',
        offset: [0, -size / 2 - 4],
        className: 'travel-tooltip',
      });
      trip.layerGroup.addLayer(marker);
    });
  },

  // ─── Icon builders ────────────────────────────────────────────────────────

  buildStopIcon(num, type, size, accentColor) {
    var safeType = this.VALID_TYPES.has(type) ? type : 'stop';
    var div = document.createElement('div');
    div.className = 'travel-stop-num t-' + safeType;
    div.style.width  = size + 'px';
    div.style.height = size + 'px';
    div.style.lineHeight = size + 'px';
    div.style.fontSize = (size < 26 ? 9 : 11) + 'px';
    if (accentColor && (safeType === 'stop' || safeType === 'hub')) {
      div.style.background = accentColor;
      div.style.color = '#0a1628';
    }
    div.textContent = num;
    return div.outerHTML;
  },

  buildHubIcon(emoji) {
    var div = document.createElement('div');
    div.className = 'travel-hub-icon';
    div.textContent = emoji;
    return div.outerHTML;
  },

  buildSpokeIcon(size, color) {
    var div = document.createElement('div');
    div.className = 'travel-stop-num';
    div.style.width      = size + 'px';
    div.style.height     = size + 'px';
    div.style.background = color;
    div.style.border     = '2px solid rgba(255, 255, 255, 0.65)';
    div.style.boxShadow  = '0 2px 6px rgba(0, 0, 0, 0.4)';
    div.style.borderRadius = '50%';
    return div.outerHTML;
  },

  buildPinIcon(size, color) {
    var div = document.createElement('div');
    div.style.width        = size + 'px';
    div.style.height       = size + 'px';
    div.style.background   = color;
    div.style.borderRadius = '50%';
    div.style.border       = '2px solid rgba(255, 255, 255, 0.6)';
    div.style.boxShadow    = '0 1px 4px rgba(0, 0, 0, 0.4)';
    return div.outerHTML;
  },

  // ─── Control panel (topleft, collapsible dropdown) ────────────────────────

  addToggleControl() {
    var self = this;
    var Control = L.Control.extend({
      options: { position: 'topleft' },
      onAdd: function () {
        var container = L.DomUtil.create('div', 'leaflet-bar travel-trips-panel');
        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);

        // ── Collapsible header ────────────────────────────
        var header = L.DomUtil.create('div', 'travel-trips-header', container);
        var headerLabel = document.createElement('span');
        headerLabel.className = 'travel-trips-header-label';
        headerLabel.textContent = '🗺️ Trips';
        var chevron = document.createElement('span');
        chevron.className = 'travel-trips-chevron';
        chevron.textContent = '▾';
        header.appendChild(headerLabel);
        header.appendChild(chevron);

        // ── Trip button list (collapsed by default) ───────
        var list = L.DomUtil.create('div', 'travel-trips-list', container);
        var expanded = false;

        L.DomEvent.on(header, 'click', function (e) {
          L.DomEvent.stopPropagation(e);
          L.DomEvent.preventDefault(e);
          expanded = !expanded;
          list.style.display = expanded ? 'block' : 'none';
          chevron.textContent = expanded ? '▴' : '▾';
          container.classList.toggle('panel-expanded', expanded);
        });

        // ── One button per trip ───────────────────────────
        self.trips.forEach(function (trip) {
          var btn = L.DomUtil.create('a', 'travel-toggle-btn', list);
          btn.href  = '#';
          btn.title = trip.name + ' (' + trip.year + ')';
          btn.style.setProperty('--trip-color', trip.color);

          var icon = document.createElement('span');
          icon.className   = 'travel-toggle-icon';
          icon.textContent = trip.icon;
          btn.appendChild(icon);
          btn.appendChild(document.createTextNode(' ' + trip.name));

          trip.controlBtn = btn;
          L.DomEvent.on(btn, 'click', function (e) {
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
