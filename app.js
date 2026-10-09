/* Tokyo Companion — app logic
   - Day tab switching with persistence
   - Place grid with category + "now open" filter
   - Leaflet map with custom markers
   - Add-place modal + localStorage
   - Theme toggle (light/dark)
   - Geolocation "near me" highlight (optional)
*/

(() => {
  'use strict';

  // ── STATE ──────────────────────────────────────────────
  const STORAGE_KEY = 'tokyo-companion-v1';
  const state = loadState() || {
    activeDay: '2026-10-14',
    customPlaces: [],
    doneIds: [],
    theme: 'light',
  };

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }

  const ALL_PLACES = [...PLACES, ...state.customPlaces];

  // ── UTILITIES ──────────────────────────────────────────
  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return Array.from(document.querySelectorAll(sel)); }

  function fmtDay(iso) {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  function timeNow() {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }
  function timeStrToMin(t) {
    if (!t) return null;
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  }
  function isOpenNow(place) {
    const open = timeStrToMin(place.hours24?.open);
    const close = timeStrToMin(place.hours24?.close);
    if (open == null || close == null) return false;
    const now = timeNow();
    if (close > open) return now >= open && now < close;
    // crosses midnight
    return now >= open || now < close;
  }

  // ── CATEGORY ICONS ─────────────────────────────────────
  const ICON_MAP = {
    sightseeing: 'camera',
    food: 'utensils',
    activity: 'activity',
    shopping: 'bag',
    hotel: 'bed',
    work: 'briefcase',
    other: 'map',
  };

  // ── RENDER DAY BANNER + SCHEDULE ───────────────────────
  function renderDay() {
    const day = SCHEDULE[state.activeDay];
    if (!day) return;
    $('#dayKicker').textContent = `Day ${dayNumber(state.activeDay)} of 3`;
    $('#dayTitle').textContent = fmtDay(state.activeDay);
    $('#daySummary').textContent = day.summary;

    const list = $('#schedule');
    list.innerHTML = day.items.map(it => {
      const isWork = it.icon === 'work';
      return `
        <li>
          <span class="time ${isWork ? 'work-time' : ''}">${escapeHTML(it.time)}</span>
          <span class="title">${escapeHTML(it.title)}</span>
        </li>
      `;
    }).join('');
    $('#scheduleMeta').textContent = `${day.items.length} item${day.items.length === 1 ? '' : 's'}`;
  }

  function dayNumber(iso) {
    return ['2026-10-14', '2026-10-15', '2026-10-16'].indexOf(iso) + 1 || 1;
  }

  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  // ── RENDER PLACES GRID ─────────────────────────────────
  let currentCategory = 'all';
  let showOnlyOpen = false;

  function renderPlaces() {
    const grid = $('#placesGrid');
    let list = ALL_PLACES.filter(p => p.category !== 'hotel' && p.category !== 'work');

    if (currentCategory !== 'all') {
      list = list.filter(p => p.category === currentCategory);
    }
    if (showOnlyOpen) {
      list = list.filter(p => isOpenNow(p));
    }
    // pinned (anchors) first
    list.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

    grid.innerHTML = list.map(p => {
      const icon = ICON_MAP[p.category] || 'map';
      const open = isOpenNow(p);
      const done = state.doneIds.includes(p.id);
      return `
        <article class="place ${open ? '' : 'closed'}" data-id="${p.id}">
          ${open ? '<span class="now-badge">Now open</span>' : ''}
          <div class="place-head">
            <div class="place-icon"><span data-icon="${icon}"></span></div>
            <div>
              <h4 class="place-name">${escapeHTML(p.name)}</h4>
              <div class="place-name-jp">${escapeHTML(p.name_jp || '')}</div>
            </div>
          </div>
          <div>
            <p class="place-hours">${escapeHTML(p.hours)}</p>
            <div class="place-meta">
              <span class="tag">${escapeHTML(p.area)}</span>
              <span class="tag">${escapeHTML(p.price)}</span>
              <span class="tag">${escapeHTML(p.duration)}</span>
            </div>
            ${p.notes ? `<p class="place-notes">${escapeHTML(p.notes)}</p>` : ''}
          </div>
          <div class="place-actions">
            <a class="btn primary" href="${p.maps}" target="_blank" rel="noopener">Maps →</a>
            <button class="btn done-btn" data-toggle="${p.id}" type="button">${done ? '✓ Done' : 'Mark done'}</button>
          </div>
        </article>
      `;
    }).join('');

    // wire done buttons
    grid.querySelectorAll('.done-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        const id = btn.dataset.toggle;
        const idx = state.doneIds.indexOf(id);
        if (idx >= 0) state.doneIds.splice(idx, 1);
        else state.doneIds.push(id);
        saveState();
        renderPlaces();
        updateMapMarkers();
      });
    });
  }

  // ── MAP ────────────────────────────────────────────────
  let map, markers = [];
  function initMap() {
    map = L.map('map', { scrollWheelZoom: false, zoomControl: true })
      .setView([35.685, 139.700], 11);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://openstreetmap.org">OSM</a> · &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 19,
    }).addTo(map);

    updateMapMarkers();
  }

  function customIcon(category) {
    return L.divIcon({
      className: '',
      html: `<div class="marker-pin ${category}"><span data-icon="${ICON_MAP[category] || 'map'}"></span></div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 28],
      popupAnchor: [0, -28],
    });
  }

  function updateMapMarkers() {
    markers.forEach(m => m.remove());
    markers = [];
    const list = ALL_PLACES.filter(p => p.lat && p.lng);
    list.forEach(p => {
      const m = L.marker([p.lat, p.lng], { icon: customIcon(p.category) })
        .addTo(map)
        .bindPopup(`
          <strong>${escapeHTML(p.name)}</strong>
          <div class="meta">${escapeHTML(p.area)} · ${escapeHTML(p.hours)}</div>
          ${p.notes ? `<div style="font-size:12px;color:#666;margin-top:4px;">${escapeHTML(p.notes.slice(0, 80))}${p.notes.length > 80 ? '…' : ''}</div>` : ''}
          <a href="${p.maps}" target="_blank" rel="noopener">Open in Google Maps →</a>
        `);
      markers.push(m);
    });
    $('#mapCount').textContent = markers.length;
  }

  // ── DAY TABS ───────────────────────────────────────────
  function wireDayTabs() {
    $$('.day-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        $$('.day-tab').forEach(t => {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        state.activeDay = tab.dataset.day;
        saveState();
        renderDay();
        // fly map to area centroid of pinned places
        flyToDay();
      });
    });
    flyToDay();
  }

  function flyToDay() {
    const day = state.activeDay;
    let focus;
    if (day === '2026-10-14') focus = [35.6762, 139.6503];   // Shinjuku / west
    else if (day === '2026-10-15') focus = [35.685, 139.700]; // central / Hatsudai
    else focus = [35.659, 139.700];                            // central / Shibuya
    if (map) map.flyTo(focus, 12, { duration: 0.8 });
  }

  // ── FILTER CHIPS ───────────────────────────────────────
  function wireFilters() {
    $$('#filterChips .chip').forEach(c => {
      c.addEventListener('click', () => {
        $$('#filterChips .chip').forEach(x => x.classList.remove('active'));
        c.classList.add('active');
        currentCategory = c.dataset.cat;
        renderPlaces();
      });
    });
  }

  // ── NOW OPEN TOGGLE ────────────────────────────────────
  function wireNowBtn() {
    const btn = $('#nowBtn');
    btn.addEventListener('click', () => {
      showOnlyOpen = !showOnlyOpen;
      btn.setAttribute('aria-pressed', String(showOnlyOpen));
      btn.textContent = showOnlyOpen ? '✓ Now open' : 'Now open';
      renderPlaces();
    });
    // initial state — refresh every minute
    setInterval(renderPlaces, 60000);
  }

  // ── THEME TOGGLE ───────────────────────────────────────
  function wireTheme() {
    const btn = $('#themeBtn');
    if (state.theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    btn.addEventListener('click', () => {
      const next = state.theme === 'dark' ? 'light' : 'dark';
      state.theme = next;
      if (next === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
      else document.documentElement.removeAttribute('data-theme');
      btn.textContent = next === 'dark' ? '☾' : '☼';
      saveState();
    });
    btn.textContent = state.theme === 'dark' ? '☾' : '☼';
  }

  // ── ANCHOR CLICKS (fly to place) ───────────────────────
  function wireAnchors() {
    $$('.anchor').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault();
        const id = a.dataset.place;
        const p = ALL_PLACES.find(x => x.id === id);
        if (!p) return;
        map.flyTo([p.lat, p.lng], 15, { duration: 0.9 });
        const m = markers.find(x => x.getLatLng().lat === p.lat && x.getLatLng().lng === p.lng);
        if (m) setTimeout(() => m.openPopup(), 900);
        document.getElementById('map').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  // ── ADD PLACE MODAL ────────────────────────────────────
  function wireAddModal() {
    const modal = $('#addModal');
    const form = $('#addForm');
    $('#addBtn').addEventListener('click', () => {
      modal.hidden = false;
      form.elements.name.focus();
    });
    modal.querySelectorAll('[data-close]').forEach(el => {
      el.addEventListener('click', () => { modal.hidden = true; });
    });
    form.addEventListener('submit', e => {
      e.preventDefault();
      const f = new FormData(form);
      const place = {
        id: 'custom_' + Date.now(),
        name: f.get('name').trim(),
        name_jp: '',
        category: f.get('category'),
        area: f.get('area') || 'Custom',
        address: f.get('address') || '',
        hours: [f.get('open'), f.get('close')].filter(Boolean).join('–') || '—',
        hours24: { open: f.get('open') || '00:00', close: f.get('close') || '23:59' },
        maps: f.get('maps') || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(f.get('name'))}`,
        notes: f.get('notes') || '',
        price: 'Custom',
        duration: '—',
        custom: true,
      };
      // default coords: 0,0 (will need user to set, or click to set on map)
      // we'll center on the active day for now
      const day = state.activeDay;
      place.lat = 35.685; place.lng = 139.700;
      state.customPlaces.push(place);
      saveState();
      ALL_PLACES.push(place);
      form.reset();
      modal.hidden = true;
      renderPlaces();
      updateMapMarkers();
    });
  }

  // ── INIT ───────────────────────────────────────────────
  function init() {
    renderDay();
    renderPlaces();
    initMap();
    wireDayTabs();
    wireFilters();
    wireNowBtn();
    wireTheme();
    wireAnchors();
    wireAddModal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
