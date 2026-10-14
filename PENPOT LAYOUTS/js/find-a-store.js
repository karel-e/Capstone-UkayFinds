document.addEventListener('DOMContentLoaded', () => {

  /* ==========================================
     STORE DATA
     Swap this for a real API call later —
     everything below just reads from this array.
     ========================================== */
  const storeLocations = [
    { id: 1,  name: "Ukay-Ukay ni Aa",              coords: [10.3801, 123.9575], status: "Open until 7 PM", rating: 4.8, price: "₱50–₱200 Bins",      distance: "500m from your location" },
    { id: 2,  name: "ThriftLift Consolacion",         coords: [10.3835, 123.9590], status: "Open Now",         rating: 4.6, price: "₱100–₱350 Jackets",   distance: "1.1km from your location" },
    { id: 3,  name: "Consolacion Street Market Spot",  coords: [10.3780, 123.9550], status: "Closes 6 PM",      rating: 4.5, price: "₱20–₱100 Vintage",    distance: "1.4km from your location" },
    { id: 4,  name: "Bagets Ukay Corner",              coords: [10.3822, 123.9605], status: "Open Now",         rating: 4.7, price: "₱80–₱250 Mixed",      distance: "1.6km from your location" },
    { id: 5,  name: "Rack & Roll Thrift",              coords: [10.3760, 123.9600], status: "Open Now",         rating: 4.3, price: "₱60–₱180 Casual",     distance: "1.8km from your location" },
    { id: 6,  name: "Second Story Finds",              coords: [10.3845, 123.9560], status: "Closes 8 PM",      rating: 4.9, price: "₱150–₱400 Curated",   distance: "2.0km from your location" },
    { id: 7,  name: "Tita's Ukay Stall",               coords: [10.3795, 123.9540], status: "Open Now",         rating: 4.4, price: "₱30–₱120 Bins",       distance: "2.3km from your location" },
    { id: 8,  name: "Preloved Corner PH",              coords: [10.3810, 123.9620], status: "Open until 9 PM",  rating: 4.6, price: "₱100–₱300 Streetwear", distance: "2.5km from your location" },
    { id: 9,  name: "Vintage Vault Cebu",              coords: [10.3770, 123.9615], status: "Closes 7 PM",      rating: 4.8, price: "₱200–₱500 Curated",   distance: "2.7km from your location" },
    { id: 10, name: "Kabuok Ukay Trading",             coords: [10.3855, 123.9600], status: "Open Now",         rating: 4.2, price: "₱40–₱150 Mixed",      distance: "3.0km from your location" },
    { id: 11, name: "Sunday Market Racks",             coords: [10.3745, 123.9565], status: "Open Weekends",    rating: 4.5, price: "₱50–₱200 Bins",       distance: "3.2km from your location" },
    { id: 12, name: "The Fit Repository",              coords: [10.3830, 123.9535], status: "Open Now",         rating: 4.7, price: "₱120–₱350 Curated",   distance: "3.4km from your location" }
  ];

  const CENTER = storeLocations[0].coords;

  /* ==========================================
     MAP SETUP — OSM "Map" layer + Esri "Satellite"
     ========================================== */
  const mapLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  });

  const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    attribution: 'Tiles &copy; Esri'
  });

  const map = L.map('dashboard-map', { zoomControl: true, layers: [mapLayer] }).setView(CENTER, 14);

  const createCustomPin = () => L.divIcon({
    className: 'custom-leaflet-pin',
    html: `<div style="position:relative;width:32px;height:32px;filter:drop-shadow(0px 3px 6px rgba(0,0,0,0.3));cursor:pointer;">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="#7c3aed" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
        <circle cx="12" cy="9" r="2.5" fill="#ffffff"/>
      </svg></div>`,
    iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32]
  });

  const markers = {};
  storeLocations.forEach(store => {
    const popupHtml = `
      <div class="map-popup-card">
        <h3>${store.name}</h3>
        <p><span class="status-dot">&bull;</span> ${store.status}</p>
        <p><strong>${store.rating.toFixed(1)}</strong> | ${store.price}</p>
        <a data-view-details="${store.id}">View Store Details &rarr;</a>
      </div>`;
    const marker = L.marker(store.coords, { icon: createCustomPin() })
      .addTo(map)
      .bindPopup(popupHtml, { closeButton: true, offset: [0, -5] });
    markers[store.id] = marker;
  });

  // Open the first store's popup by default, like the mockup
  markers[storeLocations[0].id].openPopup();

  // Map / Satellite toggle
  document.querySelectorAll('.map-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.map-toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (btn.dataset.layer === 'satellite') {
        map.removeLayer(mapLayer);
        satelliteLayer.addTo(map);
      } else {
        map.removeLayer(satelliteLayer);
        mapLayer.addTo(map);
      }
    });
  });

  // Locate-me button
  const locateBtn = document.getElementById('locate-btn');
  locateBtn.addEventListener('click', () => {
    if (!navigator.geolocation) {
      map.flyTo(CENTER, 15, { duration: 0.6 });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => map.flyTo([pos.coords.latitude, pos.coords.longitude], 15, { duration: 0.8 }),
      () => map.flyTo(CENTER, 15, { duration: 0.6 })
    );
  });

  // "Add a spot" placeholder action
  document.getElementById('add-spot-btn').addEventListener('click', () => {
    alert('Suggest-a-spot form goes here — hook this up to your submission flow.');
  });

  /* ==========================================
     SIDEBAR — cards synced with the map
     ========================================== */
  function renderStoreCards(list) {
    const container = document.getElementById('store-cards-list');
    const countText = document.getElementById('spots-count-text');
    container.innerHTML = '';

    if (!list.length) {
      container.innerHTML = '<p class="no-results">No spots match that search.</p>';
      countText.textContent = '0 Spots Found';
      return;
    }

    countText.textContent = `${list.length} Spot${list.length > 1 ? 's' : ''} Found`;

    list.forEach(store => {
      const card = document.createElement('div');
      card.className = 'store-card';
      card.dataset.id = store.id;
      card.innerHTML = `
        <div class="store-img-placeholder">${store.name.charAt(0)}</div>
        <div class="store-info">
          <div class="store-header">
            <h4>${store.name}</h4>
            <span class="rating">${store.rating.toFixed(1)}</span>
          </div>
          <p class="distance">${store.distance}</p>
          <div class="card-bottom-row">
            <button type="button" class="directions-btn">Get Directions</button>
            <button type="button" class="card-menu-btn" aria-label="More options">&#8942;</button>
          </div>
        </div>
        <div class="card-menu">
          <button type="button" data-action="save">Save spot</button>
          <button type="button" data-action="report">Report issue</button>
        </div>`;

      card.querySelector('.directions-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        focusStore(store.id);
      });

      const menuBtn = card.querySelector('.card-menu-btn');
      const menu = card.querySelector('.card-menu');
      menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.card-menu.open').forEach(m => { if (m !== menu) m.classList.remove('open'); });
        menu.classList.toggle('open');
      });

      card.addEventListener('click', () => focusStore(store.id));
      container.appendChild(card);
    });
  }

  document.addEventListener('click', () => {
    document.querySelectorAll('.card-menu.open').forEach(m => m.classList.remove('open'));
  });

  function focusStore(id) {
    const store = storeLocations.find(s => s.id === id);
    if (!store) return;
    map.flyTo(store.coords, 16, { duration: 0.6 });
    markers[id].openPopup();

    document.querySelectorAll('.store-card').forEach(c => c.classList.remove('active'));
    const activeCard = document.querySelector(`.store-card[data-id="${id}"]`);
    if (activeCard) activeCard.classList.add('active');
  }

  renderStoreCards(storeLocations);

  // Clicking "View Store Details" inside a map popup focuses that card
  document.getElementById('dashboard-map').addEventListener('click', (e) => {
    const link = e.target.closest('[data-view-details]');
    if (link) focusStore(Number(link.dataset.viewDetails));
  });

  /* ==========================================
     SEARCH + SORT
     ========================================== */
  document.getElementById('dashboard-search').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    renderStoreCards(storeLocations.filter(s => s.name.toLowerCase().includes(q)));
  });

  document.getElementById('sort-select').addEventListener('change', (e) => {
    const sorted = [...storeLocations];
    if (e.target.value === 'rating') sorted.sort((a, b) => b.rating - a.rating);
    if (e.target.value === 'budget') sorted.sort((a, b) => a.price.localeCompare(b.price));
    renderStoreCards(sorted);
  });

  /* ==========================================
     AVATAR DROPDOWN
     ========================================== */
  const avatarBtn = document.getElementById('user-avatar-btn');
  const dropdown = document.getElementById('user-dropdown');

  avatarBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('open');
    avatarBtn.setAttribute('aria-expanded', dropdown.classList.contains('open'));
  });

  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target) && e.target !== avatarBtn) dropdown.classList.remove('open');
  });

});