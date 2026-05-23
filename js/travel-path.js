const TravelPath = {
  map: null,
  layerGroup: null,
  visible: false,
  data: null,
  controlBtn: null,

  VALID_TYPES: new Set(['home', 'hub', 'transit', 'stop', 'dive']),

  init(map) {
    this.map = map;
    this.layerGroup = L.layerGroup();
    this.addToggleControl();
    return this;
  },

  async load() {
    const res = await fetch(`data/travel-path.json?v=${Date.now()}`);
    this.data = await res.json();
    this.build();
    return this;
  },

  buildStopIcon(num, type, size) {
    const safeType = this.VALID_TYPES.has(type) ? type : 'stop';
    const div = document.createElement('div');
    div.className = `travel-stop-num t-${safeType}`;
    div.style.width = size + 'px';
    div.style.height = size + 'px';
    div.style.lineHeight = size + 'px';
    div.style.fontSize = (size < 26 ? 9 : 11) + 'px';
    div.textContent = num;
    return div.outerHTML;
  },

  build() {
    const stops = this.data.stops;
    const pathCoords = stops.map(s => [s.lat, s.lng]);

    const antPath = L.polyline.antPath(pathCoords, {
      delay: 500,
      dashArray: [12, 25],
      weight: 2.5,
      color: 'rgba(255, 111, 97, 0.35)',
      pulseColor: '#ffd54f',
      paused: false,
      reverse: false,
      hardwareAccelerated: true,
    });
    this.layerGroup.addLayer(antPath);

    const positionCounts = {};

    stops.forEach(stop => {
      const key = stop.lat.toFixed(3) + ',' + stop.lng.toFixed(3);
      const visitIndex = positionCounts[key] || 0;
      positionCounts[key] = visitIndex + 1;

      let markerLat = stop.lat;
      let markerLng = stop.lng;
      if (visitIndex > 0) {
        const angle = (visitIndex * Math.PI) / 2.5;
        const radius = 0.25 + visitIndex * 0.12;
        markerLat += radius * Math.cos(angle);
        markerLng += radius * Math.sin(angle);
      }

      const size = (stop.type === 'home') ? 28 : 22;

      const marker = L.marker([markerLat, markerLng], {
        icon: L.divIcon({
          className: 'travel-stop',
          html: this.buildStopIcon(stop.num, stop.type, size),
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        }),
        zIndexOffset: -500,
      });

      let label = stop.num + '. ' + stop.name;
      if (visitIndex > 0) label += ' (return)';

      marker.bindTooltip(label, {
        direction: 'top',
        offset: [0, -size / 2 - 4],
        className: 'travel-tooltip',
      });

      this.layerGroup.addLayer(marker);
    });
  },

  addToggleControl() {
    const self = this;
    const Control = L.Control.extend({
      options: { position: 'topright' },
      onAdd() {
        const container = L.DomUtil.create('div', 'leaflet-bar travel-toggle');
        const btn = L.DomUtil.create('a', 'travel-toggle-btn', container);
        btn.href = '#';
        btn.title = '2023 Backpacking Route — 32 stops across SE Asia, Indonesia & the Middle East';

        const icon = document.createElement('span');
        icon.className = 'travel-toggle-icon';
        icon.textContent = '✈';
        btn.appendChild(icon);
        btn.appendChild(document.createTextNode(' Route'));

        self.controlBtn = btn;

        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.on(btn, 'click', (e) => {
          L.DomEvent.preventDefault(e);
          self.toggle();
        });

        return container;
      },
    });
    new Control().addTo(this.map);
  },

  toggle() {
    this.visible = !this.visible;
    if (this.visible) {
      this.layerGroup.addTo(this.map);
    } else {
      this.layerGroup.remove();
    }
    if (this.controlBtn) {
      this.controlBtn.classList.toggle('active', this.visible);
    }
  },
};
