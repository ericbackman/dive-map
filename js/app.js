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
    renderBreathingPage(appData);

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
    if (['map', 'videos', 'log', 'breathing'].includes(hash)) {
      switchTab(hash, false);
    }

    window.addEventListener('hashchange', () => {
      const h = window.location.hash.replace('#', '');
      if (['map', 'videos', 'log', 'breathing'].includes(h)) switchTab(h, false);
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
    const breathingEl = document.getElementById('page-breathing');

    mapEl.classList.toggle('active', tabId === 'map');
    videosEl.classList.toggle('active', tabId === 'videos');
    logEl.classList.toggle('active', tabId === 'log');
    breathingEl.classList.toggle('active', tabId === 'breathing');

    // Body scroll: map tab locks scroll, others allow it
    document.body.style.overflow = tabId === 'map' ? 'hidden' : 'auto';

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
          iframe.src = `https://www.youtube.com/embed/${encodeURIComponent(v.id)}?autoplay=1&mute=1&playsinline=1&rel=0`;
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
          iframe.src = `https://www.youtube.com/embed/${encodeURIComponent(v.id)}?autoplay=1&mute=1&playsinline=1&rel=0`;
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

  /* ───────────────── Breathing Page ───────────────── */

  function renderBreathingPage(data) {
    const container = document.getElementById('breathing-content');
    const breathing = data.breathing;
    if (!container || !breathing || !breathing.series || breathing.series.length === 0) {
      if (container) {
        const empty = document.createElement('div');
        empty.className = 'videos-empty';
        empty.textContent = 'No breathing data yet.';
        container.appendChild(empty);
      }
      return;
    }

    const trips = {};
    (data.trips || []).forEach(t => { trips[t.id] = t; });
    const S = breathing.series.slice().sort((a, b) => a.month.localeCompare(b.month));

    const monthName = m => {
      const [y, mo] = m.split('-');
      return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+mo - 1] + " '" + y.slice(2);
    };
    const labelOf = s => s.logged ? (s.label || (trips[s.trip_id] && trips[s.trip_id].name) || monthName(s.month)) : monthName(s.month);

    // ── Stat cards ──
    const calmest = S.reduce((a, b) => (b.sec_per_breath > a.sec_per_breath ? b : a));
    const totalClips = S.reduce((n, s) => n + s.n_clips, 0);
    const loggedCount = S.filter(s => s.logged).length;
    const cards = [
      { big: calmest.sec_per_breath.toFixed(1) + ' s', label: 'Calmest breathing', sub: labelOf(calmest) },
      { big: (60 / calmest.sec_per_breath).toFixed(1), label: 'Breaths per minute there', sub: 'vs a topside ~12–16' },
      { big: totalClips + '', label: 'Clips analysed', sub: 'across ' + loggedCount + ' logged trips' }
    ];
    const cardRow = document.createElement('div');
    cardRow.className = 'breath-cards';
    cards.forEach(c => {
      const el = document.createElement('div');
      el.className = 'breath-card';
      el.innerHTML = `<div class="breath-card-big">${c.big}</div>`
        + `<div class="breath-card-label">${c.label}</div>`
        + `<div class="breath-card-sub">${c.sub}</div>`;
      cardRow.appendChild(el);
    });
    container.appendChild(cardRow);

    // ── Legend ──
    const legend = document.createElement('div');
    legend.className = 'breath-legend';
    legend.innerHTML =
      '<span class="breath-leg"><span class="breath-leg-dot filled"></span>logged trip</span>'
      + '<span class="breath-leg"><span class="breath-leg-dot hollow"></span>date cluster (not yet logged)</span>'
      + '<span class="breath-leg"><span class="breath-leg-band"></span>middle 50% of that trip’s clips</span>';
    container.appendChild(legend);

    // ── Chart (hand-built SVG, no chart library — matches the no-build-step site) ──
    const chartWrap = document.createElement('div');
    chartWrap.className = 'breath-chart-wrap';
    const W = 900, H = 440, ML = 52, MR = 26, MT = 26, MB = 96;
    const PW = W - ML - MR, PH = H - MT - MB, YMAX = 12;
    const X = i => ML + PW * (i + 0.5) / S.length;
    const Y = v => MT + PH * (1 - v / YMAX);
    const BLUE = '#3fa7d6', BAND = 'rgba(63,167,214,0.16)', GRID = 'rgba(154,160,166,0.16)';
    const AXIS = 'rgba(154,160,166,0.4)', DEEP = '#0a1628', MUTED = '#9aa0a6';

    let svg = `<svg viewBox="0 0 ${W} ${H}" class="breath-svg" role="img" aria-label="Line chart of median seconds per breath across ${S.length} dive date-clusters from ${monthName(S[0].month)} to ${monthName(S[S.length - 1].month)}. Values rise from about 7.5 seconds in 2022 to a calm 8.6 to 10.7 seconds through the spring 2023 dive season, then fall to a more variable 5.3 seconds in December 2025 after time away from diving.">`;
    for (let g = 2; g <= YMAX; g += 2) {
      svg += `<line x1="${ML}" y1="${Y(g)}" x2="${W - MR}" y2="${Y(g)}" stroke="${GRID}" stroke-width="1"/>`;
      svg += `<text x="${ML - 10}" y="${Y(g) + 4}" text-anchor="end" font-size="12" fill="${MUTED}">${g}</text>`;
    }
    svg += `<line x1="${ML}" y1="${Y(0)}" x2="${W - MR}" y2="${Y(0)}" stroke="${AXIS}" stroke-width="1"/>`;
    svg += `<text x="14" y="${MT + PH / 2}" font-size="12" fill="${MUTED}" transform="rotate(-90 14 ${MT + PH / 2})" text-anchor="middle">seconds per breath</text>`;

    // IQR bands
    S.forEach((s, i) => {
      if (s.q3 > s.q1) {
        const w = 16, y = Y(s.q3), h = Math.max(2, Y(s.q1) - Y(s.q3));
        svg += `<rect x="${(X(i) - w / 2).toFixed(1)}" y="${y.toFixed(1)}" width="${w}" height="${h.toFixed(1)}" rx="5" fill="${BAND}"/>`;
      }
    });
    // median line
    let d = '';
    S.forEach((s, i) => { d += (i ? ' L ' : 'M ') + X(i).toFixed(1) + ' ' + Y(s.sec_per_breath).toFixed(1); });
    svg += `<path d="${d}" fill="none" stroke="${BLUE}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" opacity="0.85"/>`;

    // gap annotation if any adjacent pair is >1 year apart
    for (let i = 1; i < S.length; i++) {
      const gapYrs = (new Date(S[i].month) - new Date(S[i - 1].month)) / 3.15576e10;
      if (gapYrs >= 1) {
        const gx = (X(i) + X(i - 1)) / 2;
        svg += `<line x1="${gx}" y1="${MT}" x2="${gx}" y2="${MT + PH}" stroke="${AXIS}" stroke-width="1" stroke-dasharray="4 5"/>`;
        svg += `<text x="${gx}" y="${MT + 12}" text-anchor="middle" font-size="11" fill="${MUTED}">${Math.round(gapYrs * 10) / 10} yrs away</text>`;
      }
    }
    // dots + labels + hit targets
    S.forEach((s, i) => {
      const cx = X(i), cy = Y(s.sec_per_breath);
      svg += `<text x="${cx}" y="${cy - 12}" text-anchor="middle" font-size="12" font-weight="600" fill="#e8eaed">${s.sec_per_breath.toFixed(1)}</text>`;
      if (s.logged) {
        svg += `<circle cx="${cx}" cy="${cy}" r="6" fill="${BLUE}" stroke="${DEEP}" stroke-width="2"/>`;
      } else {
        svg += `<circle cx="${cx}" cy="${cy}" r="6" fill="${DEEP}" stroke="${BLUE}" stroke-width="2"/>`;
      }
      const lbl = labelOf(s).replace(/\s*\(.*?\)/, '');  // drop parentheticals for the axis
      svg += `<text x="${cx}" y="${H - MB + 26}" text-anchor="end" font-size="12" fill="${MUTED}" transform="rotate(-32 ${cx} ${H - MB + 26})">${lbl}</text>`;
      svg += `<text x="${cx}" y="${H - 8}" text-anchor="middle" font-size="10.5" fill="${AXIS}">n=${s.n_clips}</text>`;
      svg += `<rect class="breath-hit" data-i="${i}" x="${(cx - PW / S.length / 2).toFixed(1)}" y="${MT}" width="${(PW / S.length).toFixed(1)}" height="${PH}" fill="transparent"/>`;
    });
    svg += '</svg>';
    chartWrap.innerHTML = svg;

    const tip = document.createElement('div');
    tip.className = 'breath-tip';
    tip.style.display = 'none';
    chartWrap.appendChild(tip);
    container.appendChild(chartWrap);

    chartWrap.querySelectorAll('.breath-hit').forEach(r => {
      r.addEventListener('mousemove', e => {
        const s = S[+r.dataset.i];
        const trip = s.logged ? trips[s.trip_id] : null;
        const where = trip ? `${trip.region || ''}` : 'Trip not yet in the dive log';
        const dates = trip ? (trip.dates || '') : monthName(s.month);
        tip.innerHTML =
          `<div class="breath-tip-name">${labelOf(s)}</div>`
          + `<div class="breath-tip-sub">${dates}${where ? ' · ' + where : ''}</div>`
          + `<div class="breath-tip-val">${s.sec_per_breath.toFixed(1)} s / breath &middot; ${s.breaths_per_min.toFixed(1)} /min</div>`
          + `<div class="breath-tip-sub">middle 50%: ${s.q1.toFixed(1)}–${s.q3.toFixed(1)} s · ${s.n_clips} clip${s.n_clips > 1 ? 's' : ''}</div>`;
        const b = chartWrap.getBoundingClientRect();
        let x = e.clientX - b.left + 14, y = e.clientY - b.top - 8;
        if (x > b.width - 220) x -= 240;
        tip.style.left = x + 'px';
        tip.style.top = y + 'px';
        tip.style.display = 'block';
      });
      r.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
    });

    // ── Method note (honest about how it's measured and its limits) ──
    const note = document.createElement('p');
    note.className = 'breath-note';
    note.innerHTML =
      'Each point is the median gap between exhales, detected from the natural regulator sound in my own '
      + 'GoPro Hero10 clips (no dive-computer data — this is pulled straight from the audio). Fast dolphin-chase '
      + 'clips are set aside as exertion rather than resting technique, and a trip needs at least three clean clips '
      + 'to earn a point. Breathing lengthened across the back-to-back 2023 liveaboards, then came back faster and '
      + 'more variable in late 2025 after a long spell out of the water.';
    container.appendChild(note);
  }
});
