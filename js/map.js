const DiveMap = {
  map: null,
  markers: [],
  markerLayer: null,

  init() {
    this.map = L.map('map', {
      center: [10, 25],
      zoom: 3,
      minZoom: 2,
      maxZoom: 18,
      zoomControl: true,
      worldCopyJump: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(this.map);

    this.markerLayer = L.layerGroup().addTo(this.map);

    return this;
  },

  createPinIcon(type) {
    const typeEmoji = {
      reef: '\u{1F420}',
      wreck: '\u{2693}',
      wall: '\u{1F30A}',
      cave: '\u{1F573}',
      cenote: '\u{1F4A7}',
      crater: '\u{1F30B}',
      sinkhole: '\u{1F573}',
      freshwater: '\u{2744}',
      drift: '\u{1F32C}',
      default: '\u{1F93F}',
    };

    const emoji = typeEmoji[type] || typeEmoji.default;

    return L.divIcon({
      className: 'dive-marker',
      html: `<div class="dive-pin"><span class="dive-pin-inner">${emoji}</span></div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32],
    });
  },

  buildPopupHTML(dive) {
    const stars = '★'.repeat(dive.rating || 0) + '☆'.repeat(5 - (dive.rating || 0));
    const tags = (dive.highlights || [])
      .map(h => `<span class="popup-tag">${h}</span>`)
      .join('');

    return `
      <div class="popup-site">${dive.site}</div>
      <div class="popup-location">${dive.location}</div>
      <div class="popup-details">
        <div class="popup-detail">
          <div class="popup-detail-label">Depth</div>
          <div>${dive.depth_m ? dive.depth_m + 'm' : '—'}</div>
        </div>
        <div class="popup-detail">
          <div class="popup-detail-label">Type</div>
          <div>${dive.type || '—'}</div>
        </div>
        <div class="popup-detail">
          <div class="popup-detail-label">Date</div>
          <div>${dive.date || '—'}</div>
        </div>
        <div class="popup-detail">
          <div class="popup-detail-label">Rating</div>
          <div class="popup-rating">${stars}</div>
        </div>
      </div>
      ${tags ? `<div class="popup-tags">${tags}</div>` : ''}
    `;
  },

  loadDives(dives) {
    this.markerLayer.clearLayers();
    this.markers = [];

    dives.forEach(dive => {
      const marker = L.marker([dive.lat, dive.lng], {
        icon: this.createPinIcon(dive.type),
      });

      marker.bindPopup(this.buildPopupHTML(dive), {
        maxWidth: 280,
        closeButton: true,
      });

      marker.on('click', () => {
        this.map.flyTo([dive.lat, dive.lng], Math.max(this.map.getZoom(), 8), {
          duration: 1,
        });
      });

      this.markerLayer.addLayer(marker);
      this.markers.push({ marker, dive });
    });

    return this;
  },

  fitBounds() {
    if (this.markers.length > 0) {
      const group = L.featureGroup(this.markers.map(m => m.marker));
      this.map.fitBounds(group.getBounds().pad(0.1));
    }
    return this;
  },
};
