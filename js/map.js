const DiveMap = {
  map: null,
  markers: [],
  clusterGroup: null,
  trips: {},

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

    this.clusterGroup = L.markerClusterGroup({
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      disableClusteringAtZoom: 12,
      iconCreateFunction: (cluster) => this.createClusterIcon(cluster),
    });

    this.map.addLayer(this.clusterGroup);

    return this;
  },

  createClusterIcon(cluster) {
    const childMarkers = cluster.getAllChildMarkers();
    const count = childMarkers.length;

    const tripIds = new Set(childMarkers.map(m => m.options.diveData?.trip).filter(Boolean));
    let label = count + ' dives';

    if (tripIds.size === 1) {
      const tripId = [...tripIds][0];
      const trip = this.trips[tripId];
      if (trip) label = trip.name;
    } else if (tripIds.size > 1) {
      label = tripIds.size + ' trips';
    }

    const size = count > 20 ? 56 : count > 10 ? 48 : 40;

    return L.divIcon({
      html: `<div class="cluster-icon" style="width:${size}px;height:${size}px;">
        <span class="cluster-count">${count}</span>
        <span class="cluster-label">${label}</span>
      </div>`,
      className: 'dive-cluster',
      iconSize: [size, size + 16],
    });
  },

  createPinIcon(type) {
    const typeEmoji = {
      reef: '\u{1F420}',
      wreck: '\u{2693}',
      wall: '\u{1F30A}',
      cave: '\u{1F573}',
      cenote: '\u{1F4A7}',
      night: '\u{1F31A}',
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
    const depthStr = dive.depth_m ? dive.depth_m + 'm' : '—';
    const durationStr = dive.duration_min ? dive.duration_min + ' min' : '—';
    const dateStr = dive.date || '—';
    const typeStr = dive.type || '—';

    const tags = (dive.highlights || [])
      .map(h => `<span class="popup-tag">${h}</span>`)
      .join('');

    const tripInfo = dive.trip && this.trips[dive.trip]
      ? `<div class="popup-trip">${this.trips[dive.trip].name}</div>`
      : '';

    const notesHtml = dive.notes
      ? `<div class="popup-notes">${dive.notes}</div>`
      : '';

    const trip = dive.trip ? this.trips[dive.trip] : null;
    const hasVideos = trip && trip.videos && trip.videos.length > 0;
    const videoBtn = hasVideos
      ? `<button class="popup-video-btn" onclick="DiveMap.openVideoGallery('${dive.trip}')">
           🎬 ${trip.videos.length} dive videos
         </button>`
      : '';

    return `
      ${tripInfo}
      <div class="popup-site">${dive.site}</div>
      <div class="popup-location">${dive.location}</div>
      <div class="popup-details">
        <div class="popup-detail">
          <div class="popup-detail-label">Depth</div>
          <div>${depthStr}</div>
        </div>
        <div class="popup-detail">
          <div class="popup-detail-label">Duration</div>
          <div>${durationStr}</div>
        </div>
        <div class="popup-detail">
          <div class="popup-detail-label">Date</div>
          <div>${dateStr}</div>
        </div>
        <div class="popup-detail">
          <div class="popup-detail-label">Type</div>
          <div>${typeStr}</div>
        </div>
      </div>
      ${notesHtml}
      ${tags ? `<div class="popup-tags">${tags}</div>` : ''}
      ${videoBtn}
    `;
  },

  loadTrips(trips) {
    this.trips = {};
    if (trips) {
      trips.forEach(t => { this.trips[t.id] = t; });
    }
    return this;
  },

  loadDives(dives) {
    this.clusterGroup.clearLayers();
    this.markers = [];

    dives.forEach(dive => {
      const marker = L.marker([dive.lat, dive.lng], {
        icon: this.createPinIcon(dive.type),
        diveData: dive,
      });

      marker.bindPopup(this.buildPopupHTML(dive), {
        maxWidth: 300,
        closeButton: true,
      });

      marker.on('click', () => {
        const targetZoom = Math.max(this.map.getZoom(), 10);
        this.map.flyTo([dive.lat, dive.lng], targetZoom, { duration: 1 });
      });

      this.clusterGroup.addLayer(marker);
      this.markers.push({ marker, dive });
    });

    return this;
  },

  openVideoGallery(tripId) {
    const trip = this.trips[tripId];
    if (!trip || !trip.videos || trip.videos.length === 0) return;

    const modal = document.getElementById('video-modal');
    const titleEl = document.getElementById('video-modal-trip');
    const gridEl = document.getElementById('video-modal-grid');

    titleEl.textContent = trip.name;

    // Clear previous content
    while (gridEl.firstChild) gridEl.removeChild(gridEl.firstChild);

    // Build video cards with safe DOM methods
    trip.videos.forEach(v => {
      const mins = Math.floor(v.duration / 60);
      const secs = v.duration % 60;
      const durStr = mins > 0
        ? `${mins}:${String(secs).padStart(2, '0')}`
        : `0:${String(secs).padStart(2, '0')}`;

      const card = document.createElement('div');
      card.className = 'video-card';

      const thumb = document.createElement('div');
      thumb.className = 'video-thumb';
      thumb.dataset.videoId = v.id;

      const img = document.createElement('img');
      img.src = `https://img.youtube.com/vi/${v.id}/mqdefault.jpg`;
      img.alt = v.title;
      img.loading = 'lazy';

      const playBtn = document.createElement('div');
      playBtn.className = 'video-play-btn';
      playBtn.textContent = '▶';

      const duration = document.createElement('span');
      duration.className = 'video-duration';
      duration.textContent = durStr;

      thumb.appendChild(img);
      thumb.appendChild(playBtn);
      thumb.appendChild(duration);

      const title = document.createElement('div');
      title.className = 'video-card-title';
      title.textContent = v.title;

      card.appendChild(thumb);
      card.appendChild(title);
      gridEl.appendChild(card);

      // Click-to-play: replace thumbnail with iframe
      thumb.addEventListener('click', () => {
        while (thumb.firstChild) thumb.removeChild(thumb.firstChild);
        const iframe = document.createElement('iframe');
        iframe.src = `https://www.youtube.com/embed/${encodeURIComponent(v.id)}?autoplay=1&mute=1&playsinline=1&rel=0`;
        iframe.frameBorder = '0';
        iframe.allowFullscreen = true;
        iframe.allow = 'autoplay; encrypted-media';
        thumb.appendChild(iframe);
        thumb.classList.add('playing');
      });
    });

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Close handlers
    modal.querySelector('.video-modal-backdrop').onclick = () => this.closeVideoGallery();
    modal.querySelector('.video-modal-close').onclick = () => this.closeVideoGallery();
  },

  closeVideoGallery() {
    const modal = document.getElementById('video-modal');
    modal.classList.remove('open');
    document.body.style.overflow = '';
    // Stop all playing videos by clearing iframes
    const grid = document.getElementById('video-modal-grid');
    while (grid.firstChild) grid.removeChild(grid.firstChild);
  },

  fitBounds() {
    if (this.markers.length > 0) {
      const group = L.featureGroup(this.markers.map(m => m.marker));
      this.map.fitBounds(group.getBounds().pad(0.1));
    }
    return this;
  },
};
