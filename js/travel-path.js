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
  tour: null, // active guided-tour state, or null when no tour is running

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

          // Only ordered (linear) trips have a meaningful "next stop", so only
          // they get a ▶ button that launches the step-through guided tour.
          if (trip.mode === 'linear' && trip.data.stops && trip.data.stops.length > 1) {
            var play = document.createElement('span');
            play.className   = 'tour-play-btn';
            play.textContent = '▶';
            play.title       = 'Play guided tour';
            btn.appendChild(play);
            trip.playBtn = play;
            L.DomEvent.on(play, 'click', function (e) {
              L.DomEvent.stop(e); // don't also fire the row's line-toggle
              self.startTour(trip);
            });
          }
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

  // ─── Guided tour — step through a trip one stop at a time ──────────────────

  startTour(trip) {
    if (!trip.data.stops || trip.data.stops.length === 0) return;

    this.endTour(); // only one tour at a time

    // Hide this trip's "all lines at once" overlay while touring so the map
    // shows just the current leg, not the full spaghetti. Remember its state
    // so we can put it back on exit.
    var wasVisible = trip.visible;
    if (trip.visible) this.toggle(trip);

    this.tour = {
      trip: trip,
      stops: trip.data.stops,
      index: 0,
      layer: L.layerGroup().addTo(this.map),
      card: null,
      els: null,
      keyHandler: null,
      restoreVisible: wasVisible,
    };

    if (trip.playBtn) trip.playBtn.classList.add('touring');

    this.buildTourCard();

    // Keyboard: ← / → to move between stops, Esc to exit.
    var self = this;
    this.tour.keyHandler = function (e) {
      if (!self.tour) return;
      if (e.key === 'ArrowRight') self.tourStep(1);
      else if (e.key === 'ArrowLeft') self.tourStep(-1);
      else if (e.key === 'Escape') self.endTour();
    };
    document.addEventListener('keydown', this.tour.keyHandler);

    this.tourGoTo(0);
  },

  tourStep(delta) {
    if (this.tour) this.tourGoTo(this.tour.index + delta);
  },

  tourGoTo(index) {
    if (!this.tour) return;
    var stops = this.tour.stops;
    var clamped = Math.max(0, Math.min(index, stops.length - 1));
    this.tour.index = clamped;

    var from = clamped > 0 ? stops[clamped - 1] : null;
    var to = stops[clamped];

    this.frameHop(from, to);
    this.renderTourPath(stops, clamped);
    this.updateTourCard();
  },

  /**
   * Decide how the camera moves as you step from one stop to the next.
   *
   * THIS is the knob that controls how the tour *feels*. Two pure strategies:
   *   • "fit both"    — frame the previous AND next stop together so the viewer
   *                     sees the leg of the journey. Great storytelling, but a
   *                     long leg (e.g. Makassar → Singapore) zooms way out.
   *   • "fly to next" — fly straight to the destination at a fixed zoom. Always
   *                     readable, but you lose the sense of distance travelled.
   *
   * The current behaviour is a hybrid: short legs frame both endpoints; long
   * legs just fly to the destination. Tune FAR_KM / the zooms to taste.
   *
   * @param {?{lat:number,lng:number}} from previous stop (null on the first stop)
   * @param {{lat:number,lng:number}}  to   the stop we're moving to
   */
  frameHop(from, to) {
    var map = this.map;
    var toLL = [to.lat, to.lng];

    if (!from) {
      map.flyTo(toLL, Math.max(map.getZoom(), 6), { duration: 1.2 });
      return;
    }

    var fromLL = [from.lat, from.lng];
    var FAR_KM = 1500;
    var legKm = map.distance(fromLL, toLL) / 1000;

    if (legKm > FAR_KM) {
      map.flyTo(toLL, 6, { duration: 1.6 });
    } else {
      map.flyToBounds(L.latLngBounds([fromLL, toLL]).pad(0.4), {
        duration: 1.4,
        maxZoom: 9,
      });
    }
  },

  renderTourPath(stops, index) {
    var trip = this.tour.trip;
    var layer = this.tour.layer;
    layer.clearLayers();
    var ll = function (s) { return [s.lat, s.lng]; };

    // Faint trace of everywhere visited so far
    if (index > 1) {
      layer.addLayer(L.polyline(stops.slice(0, index + 1).map(ll), {
        color: trip.color, weight: 2, opacity: 0.25,
      }));
    }

    // The leg you just travelled, animated
    if (index > 0) {
      layer.addLayer(L.polyline.antPath([ll(stops[index - 1]), ll(stops[index])], {
        delay: 500,
        dashArray: [10, 20],
        weight: 3.5,
        color: trip.pathColor,
        pulseColor: trip.color,
        hardwareAccelerated: true,
      }));
    }

    // Faint dashed preview of where "Next" will take you
    if (index < stops.length - 1) {
      layer.addLayer(L.polyline([ll(stops[index]), ll(stops[index + 1])], {
        color: trip.color, weight: 2, opacity: 0.3, dashArray: '4, 10',
      }));
    }

    // Stop dots: small for visited, big highlighted dot for the current stop
    stops.slice(0, index + 1).forEach(function (s, i) {
      var current = i === index;
      var size = current ? 30 : 14;
      var marker = L.marker(ll(s), {
        icon: L.divIcon({
          className: 'travel-stop tour-stop' + (current ? ' tour-stop-current' : ''),
          html: this.buildStopIcon(s.num, current ? s.type : 'transit', size, trip.color),
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        }),
        zIndexOffset: current ? 1000 : 100,
      });
      if (current) {
        marker.bindTooltip(s.name, {
          direction: 'top',
          offset: [0, -size / 2 - 6],
          className: 'travel-tooltip',
          permanent: true,
        }).openTooltip();
      }
      layer.addLayer(marker);
    }, this);
  },

  buildTourCard() {
    var self = this;
    var trip = this.tour.trip;

    var card = document.createElement('div');
    card.className = 'tour-card';

    // Top row: trip identity + close
    var top = document.createElement('div');
    top.className = 'tour-card-top';

    var label = document.createElement('span');
    label.className = 'tour-card-trip';
    label.textContent = trip.icon + ' ' + trip.name;

    var close = document.createElement('button');
    close.className = 'tour-card-close';
    close.setAttribute('aria-label', 'Exit tour');
    close.textContent = '✕';
    L.DomEvent.on(close, 'click', function (e) { L.DomEvent.stop(e); self.endTour(); });

    top.appendChild(label);
    top.appendChild(close);

    // Stop counter + name
    var counter = document.createElement('div');
    counter.className = 'tour-card-num';
    var name = document.createElement('div');
    name.className = 'tour-card-name';

    // Nav row: prev + next arrows
    var nav = document.createElement('div');
    nav.className = 'tour-card-nav';

    var prev = document.createElement('button');
    prev.className = 'tour-btn tour-prev';
    prev.textContent = '← Prev';
    L.DomEvent.on(prev, 'click', function (e) { L.DomEvent.stop(e); self.tourStep(-1); });

    var next = document.createElement('button');
    next.className = 'tour-btn tour-next';
    next.textContent = 'Next →';
    L.DomEvent.on(next, 'click', function (e) { L.DomEvent.stop(e); self.tourStep(1); });

    nav.appendChild(prev);
    nav.appendChild(next);

    card.appendChild(top);
    card.appendChild(counter);
    card.appendChild(name);
    card.appendChild(nav);

    // The card floats over the map — keep map drag/zoom from firing through it.
    L.DomEvent.disableClickPropagation(card);
    L.DomEvent.disableScrollPropagation(card);

    this.map.getContainer().appendChild(card);

    this.tour.card = card;
    this.tour.els = { counter: counter, name: name, prev: prev, next: next };
  },

  updateTourCard() {
    if (!this.tour || !this.tour.els) return;
    var stops = this.tour.stops;
    var i = this.tour.index;
    var els = this.tour.els;
    els.counter.textContent = 'Stop ' + (i + 1) + ' of ' + stops.length;
    els.name.textContent = stops[i].name;
    els.prev.disabled = i === 0;
    els.next.disabled = i === stops.length - 1;
  },

  endTour() {
    if (!this.tour) return;
    var t = this.tour;

    if (t.keyHandler) document.removeEventListener('keydown', t.keyHandler);
    if (t.card && t.card.parentNode) t.card.parentNode.removeChild(t.card);
    if (t.layer) this.map.removeLayer(t.layer);
    if (t.trip && t.trip.playBtn) t.trip.playBtn.classList.remove('touring');

    var trip = t.trip;
    var restore = t.restoreVisible;
    this.tour = null;

    // Put the static line overlay back if it was on before the tour started
    if (restore && trip && !trip.visible) this.toggle(trip);
  },
};
