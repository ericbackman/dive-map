/**
 * App entry point — loads data, boots map, manages tab navigation,
 * renders Videos page and searchable Dive Log.
 */
document.addEventListener('DOMContentLoaded', async () => {
  const loading = document.getElementById('loading');
  let appData = null; // { trips: [], dives: [] }

  // Dive log sort/filter state (declared early to avoid temporal dead zone)
  let logSortCol = 'date';
  let logSortAsc = false;
  let logActiveType = null;

  try {
    const response = await fetch(`data/dives.json?v=${Date.now()}`);
    appData = await response.json();

    DiveMap.init()
      .loadTrips(appData.trips)
      .loadDives(appData.dives);

    TravelPath.init(DiveMap.map);
    TravelPath.load();

    // Stats
    document.getElementById('dive-count').textContent = appData.dives.length;
    document.getElementById('trip-count').textContent = appData.trips ? appData.trips.length : 0;
    document.getElementById('country-count').textContent = new Set(
      appData.dives.map(d => d.location.split(',').pop().trim())
    ).size;

    // Boot tabs
    initTabs();
    renderVideosPage(appData);
    initDiveLog(appData);

    // Escape key closes video gallery
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') DiveMap.closeVideoGallery();
    });

    setTimeout(() => {
      loading.classList.add('hidden');
      DiveMap.fitBounds();
    }, 600);
  } catch (err) {
    console.error('Failed to load dive data:', err);
    const msg = loading.querySelector('.loading-text');
    if (msg) msg.textContent = 'Failed to load dive data';
  }

  /* ───────────────── Tab Navigation ───────────────── */

  function initTabs() {
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Support hash routing
    const hash = window.location.hash.replace('#', '') || 'map';
    if (['map', 'videos', 'log'].includes(hash)) {
      switchTab(hash, false);
    }

    window.addEventListener('hashchange', () => {
      const h = window.location.hash.replace('#', '');
      if (['map', 'videos', 'log'].includes(h)) switchTab(h, false);
    });
  }

  function switchTab(tabId, updateHash = true) {
    // Update buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    // Show/hide pages
    const mapEl = document.getElementById('map');
    const videosEl = document.getElementById('page-videos');
    const logEl = document.getElementById('page-log');

    mapEl.classList.toggle('active', tabId === 'map');
    videosEl.classList.toggle('active', tabId === 'videos');
    logEl.classList.toggle('active', tabId === 'log');

    // Body scroll: map tab locks scroll, others allow it
    document.body.style.overflow = tabId === 'map' ? 'hidden' : '';

    // Leaflet needs invalidateSize after being hidden/shown
    if (tabId === 'map' && DiveMap.map) {
      setTimeout(() => DiveMap.map.invalidateSize(), 100);
    }

    if (updateHash) {
      history.replaceState(null, '', '#' + tabId);
    }
  }

  /* ───────────────── Videos Page ───────────────── */

  function renderVideosPage(data) {
    const container = document.getElementById('videos-content');
    const bestVideos = data.bestVideos || [];
    const tripsWithVideos = (data.trips || []).filter(t => t.videos && t.videos.length > 0);

    if (bestVideos.length === 0 && tripsWithVideos.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'videos-empty';
      empty.textContent = 'No dive videos uploaded yet. Check back soon!';
      container.appendChild(empty);
      return;
    }

    // Count total videos
    const tripVids = tripsWithVideos.reduce((sum, t) => sum + t.videos.length, 0);
    const totalVids = tripVids + bestVideos.length;
    document.getElementById('videos-subtitle').textContent =
      `${totalVids} clips from ${tripsWithVideos.length} trip${tripsWithVideos.length > 1 ? 's' : ''}`;

    // ── Best Of section ──
    if (bestVideos.length > 0) {
      const bestSection = document.createElement('div');
      bestSection.className = 'videos-best-of';

      const bestHeader = document.createElement('div');
      bestHeader.className = 'videos-best-header';

      const bestTitle = document.createElement('h3');
      bestTitle.className = 'videos-best-title';
      bestTitle.textContent = 'Best Of';

      const bestMeta = document.createElement('span');
      bestMeta.className = 'videos-best-meta';
      bestMeta.textContent = `${bestVideos.length} curated highlight${bestVideos.length > 1 ? 's' : ''}`;

      bestHeader.appendChild(bestTitle);
      bestHeader.appendChild(bestMeta);
      bestSection.appendChild(bestHeader);

      const bestGrid = document.createElement('div');
      bestGrid.className = 'videos-grid videos-grid-best';

      bestVideos.forEach(v => {
        const card = document.createElement('div');
        card.className = 'video-card video-card-best';

        const thumb = document.createElement('div');
        thumb.className = 'video-thumb';

        const img = document.createElement('img');
        img.src = `https://img.youtube.com/vi/${v.id}/maxresdefault.jpg`;
        img.alt = v.title;
        img.loading = 'lazy';

        const playBtn = document.createElement('div');
        playBtn.className = 'video-play-btn';
        playBtn.textContent = '▶';

        const mins = Math.floor(v.duration / 60);
        const secs = v.duration % 60;
        const dur = document.createElement('span');
        dur.className = 'video-duration';
        dur.textContent = mins > 0
          ? `${mins}:${String(secs).padStart(2, '0')}`
          : `0:${String(secs).padStart(2, '0')}`;

        thumb.appendChild(img);
        thumb.appendChild(playBtn);
        thumb.appendChild(dur);

        const cardTitle = document.createElement('div');
        cardTitle.className = 'video-card-title';
        cardTitle.textContent = v.title;

        const cardTrip = document.createElement('div');
        cardTrip.className = 'video-card-trip';
        cardTrip.textContent = v.trip;

        card.appendChild(thumb);
        card.appendChild(cardTitle);
        card.appendChild(cardTrip);
        bestGrid.appendChild(card);

        thumb.addEventListener('click', () => {
          while (thumb.firstChild) thumb.removeChild(thumb.firstChild);
          const iframe = document.createElement('iframe');
          iframe.src = `https://www.youtube.com/embed/${encodeURIComponent(v.id)}?autoplay=1&rel=0`;
          iframe.frameBorder = '0';
          iframe.allowFullscreen = true;
          iframe.allow = 'autoplay; encrypted-media';
          thumb.appendChild(iframe);
          thumb.classList.add('playing');
        });
      });

      bestSection.appendChild(bestGrid);
      container.appendChild(bestSection);
    }

    tripsWithVideos.forEach(trip => {
      const section = document.createElement('div');
      section.className = 'videos-trip-section';

      // Trip header
      const header = document.createElement('div');
      header.className = 'videos-trip-header';

      const title = document.createElement('h3');
      title.className = 'videos-trip-name';
      title.textContent = trip.name;

      const meta = document.createElement('span');
      meta.className = 'videos-trip-meta';
      meta.textContent = `${trip.region || ''} ${trip.year ? '(' + trip.year + ')' : ''} • ${trip.videos.length} clips`;

      header.appendChild(title);
      header.appendChild(meta);
      section.appendChild(header);

      // Video grid
      const grid = document.createElement('div');
      grid.className = 'videos-grid';

      trip.videos.forEach(v => {
        const card = document.createElement('div');
        card.className = 'video-card';

        const thumb = document.createElement('div');
        thumb.className = 'video-thumb';

        const img = document.createElement('img');
        img.src = `https://img.youtube.com/vi/${v.id}/mqdefault.jpg`;
        img.alt = v.title;
        img.loading = 'lazy';

        const playBtn = document.createElement('div');
        playBtn.className = 'video-play-btn';
        playBtn.textContent = '▶';

        const mins = Math.floor(v.duration / 60);
        const secs = v.duration % 60;
        const durStr = mins > 0
          ? `${mins}:${String(secs).padStart(2, '0')}`
          : `0:${String(secs).padStart(2, '0')}`;

        const dur = document.createElement('span');
        dur.className = 'video-duration';
        dur.textContent = durStr;

        thumb.appendChild(img);
        thumb.appendChild(playBtn);
        thumb.appendChild(dur);

        const cardTitle = document.createElement('div');
        cardTitle.className = 'video-card-title';
        cardTitle.textContent = `${trip.name} – ${v.title}`;

        card.appendChild(thumb);
        card.appendChild(cardTitle);
        grid.appendChild(card);

        // Click-to-play
        thumb.addEventListener('click', () => {
          while (thumb.firstChild) thumb.removeChild(thumb.firstChild);
          const iframe = document.createElement('iframe');
          iframe.src = `https://www.youtube.com/embed/${encodeURIComponent(v.id)}?autoplay=1&rel=0`;
          iframe.frameBorder = '0';
          iframe.allowFullscreen = true;
          iframe.allow = 'autoplay; encrypted-media';
          thumb.appendChild(iframe);
          thumb.classList.add('playing');
        });
      });

      section.appendChild(grid);
      container.appendChild(section);
    });
  }

  /* ───────────────── Dive Log ───────────────── */

  function initDiveLog(data) {
    const dives = data.dives || [];
    const trips = {};
    (data.trips || []).forEach(t => { trips[t.id] = t; });

    document.getElementById('log-count').textContent = dives.length;

    // Build type filter pills
    const types = [...new Set(dives.map(d => d.type).filter(Boolean))].sort();
    const filtersEl = document.getElementById('log-filters');
    types.forEach(type => {
      const pill = document.createElement('button');
      pill.className = 'log-filter-pill';
      pill.textContent = type;
      pill.addEventListener('click', () => {
        if (logActiveType === type) {
          logActiveType = null;
          pill.classList.remove('active');
        } else {
          logActiveType = type;
          filtersEl.querySelectorAll('.log-filter-pill').forEach(p => p.classList.remove('active'));
          pill.classList.add('active');
        }
        renderLogTable(dives, trips);
      });
      filtersEl.appendChild(pill);
    });

    // Sort headers
    document.querySelectorAll('.log-th-sortable').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.sort;
        if (logSortCol === col) {
          logSortAsc = !logSortAsc;
        } else {
          logSortCol = col;
          logSortAsc = true;
        }
        // Update sort indicators
        document.querySelectorAll('.log-th-sortable').forEach(h => {
          h.classList.remove('sort-asc', 'sort-desc');
        });
        th.classList.add(logSortAsc ? 'sort-asc' : 'sort-desc');
        renderLogTable(dives, trips);
      });
    });

    // Search
    const searchInput = document.getElementById('log-search');
    searchInput.addEventListener('input', () => {
      renderLogTable(dives, trips);
    });

    // Initial render
    renderLogTable(dives, trips);
  }

  function renderLogTable(dives, trips) {
    const query = (document.getElementById('log-search').value || '').toLowerCase().trim();
    const tbody = document.getElementById('log-tbody');
    const emptyEl = document.getElementById('log-empty');

    // Filter
    let filtered = dives.filter(d => {
      if (logActiveType && d.type !== logActiveType) return false;
      if (!query) return true;

      const tripName = d.trip && trips[d.trip] ? trips[d.trip].name : '';
      const searchStr = [
        d.site, d.location, tripName, d.type,
        ...(d.highlights || []),
        d.notes || '', d.date || ''
      ].join(' ').toLowerCase();

      return searchStr.includes(query);
    });

    // Sort
    filtered.sort((a, b) => {
      let va, vb;
      if (logSortCol === 'trip') {
        va = (a.trip && trips[a.trip]) ? trips[a.trip].name : '';
        vb = (b.trip && trips[b.trip]) ? trips[b.trip].name : '';
      } else {
        va = a[logSortCol];
        vb = b[logSortCol];
      }
      if (va == null) va = '';
      if (vb == null) vb = '';
      if (typeof va === 'number' && typeof vb === 'number') {
        return logSortAsc ? va - vb : vb - va;
      }
      va = String(va);
      vb = String(vb);
      return logSortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    });

    // Update count
    document.getElementById('log-count').textContent = filtered.length;

    // Render rows with DOM methods
    while (tbody.firstChild) tbody.removeChild(tbody.firstChild);

    if (filtered.length === 0) {
      emptyEl.style.display = 'block';
    } else {
      emptyEl.style.display = 'none';
    }

    filtered.forEach(d => {
      const tr = document.createElement('tr');
      tr.className = 'log-row';

      // Site
      const tdSite = document.createElement('td');
      tdSite.className = 'log-cell-site';
      tdSite.textContent = d.site || '—';

      // Location
      const tdLoc = document.createElement('td');
      tdLoc.className = 'log-cell-loc';
      tdLoc.textContent = d.location || '—';

      // Trip
      const tdTrip = document.createElement('td');
      tdTrip.className = 'log-cell-trip';
      tdTrip.textContent = (d.trip && trips[d.trip]) ? trips[d.trip].name : '—';

      // Depth
      const tdDepth = document.createElement('td');
      tdDepth.textContent = d.depth_m ? d.depth_m + 'm' : '—';

      // Date
      const tdDate = document.createElement('td');
      tdDate.textContent = d.date || '—';

      // Type
      const tdType = document.createElement('td');
      if (d.type) {
        const badge = document.createElement('span');
        badge.className = 'log-type-badge';
        badge.textContent = d.type;
        tdType.appendChild(badge);
      } else {
        tdType.textContent = '—';
      }

      // Highlights
      const tdHigh = document.createElement('td');
      tdHigh.className = 'log-cell-highlights';
      (d.highlights || []).forEach(h => {
        const tag = document.createElement('span');
        tag.className = 'log-tag';
        tag.textContent = h;
        tdHigh.appendChild(tag);
      });

      tr.appendChild(tdSite);
      tr.appendChild(tdLoc);
      tr.appendChild(tdTrip);
      tr.appendChild(tdDepth);
      tr.appendChild(tdDate);
      tr.appendChild(tdType);
      tr.appendChild(tdHigh);

      // Click row to fly to dive on map
      tr.addEventListener('click', () => {
        switchTab('map');
        if (d.lat && d.lng) {
          DiveMap.map.flyTo([d.lat, d.lng], 13, { duration: 1.2 });
          // Open popup for this dive
          const match = DiveMap.markers.find(m => m.dive.id === d.id);
          if (match) {
            setTimeout(() => match.marker.openPopup(), 1300);
          }
        }
      });

      tbody.appendChild(tr);
    });
  }
});
