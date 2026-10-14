document.addEventListener('DOMContentLoaded', () => {

  /* ==========================================
     TAB DATA
     Swap for real API data later — heights just
     control the masonry card proportions.
     ========================================== */
  const myHauls = [
    { id: 1, item: "Vintage denim jacket", price: "₱220", height: 300 },
    { id: 2, item: "Corduroy overshirt",    price: "₱180", height: 420 },
    { id: 3, item: "Graphic bin-find tee",  price: "₱90",  height: 260 },
    { id: 4, item: "Cargo pants combo",     price: "₱180", height: 340 },
    { id: 5, item: "Leather jacket find",   price: "₱450", height: 460 },
    { id: 6, item: "Floral wrap top",       price: "₱120", height: 250 },
    { id: 7, item: "Curated blazer set",    price: "₱340", height: 300 },
    { id: 8, item: "Denim overall fit",     price: "₱100", height: 220 }
  ];

  let savedSpots = [
    { id: 1, name: "Ukay-Ukay ni Aa",           distance: "500m from your location", rating: 4.8 },
    { id: 2, name: "Ukay-Ukay ni Aa",           distance: "500m from your location", rating: 4.8 },
    { id: 3, name: "Ukay-Ukay ni Aa",           distance: "500m from your location", rating: 4.8 },
    { id: 4, name: "Ukay-Ukay ni Aa",           distance: "500m from your location", rating: 4.8 }
  ];

  const grid = document.getElementById('profile-masonry');
  const savedPanel = document.getElementById('saved-spots-panel');
  const savedListEl = document.getElementById('saved-spots-list');
  const savedCountText = document.getElementById('saved-spots-count-text');
  const noItemsMsg = document.getElementById('no-items');
  let activeTab = 'hauls';

  function render() {
    grid.classList.toggle('hidden', activeTab !== 'hauls');
    savedPanel.classList.toggle('hidden', activeTab !== 'spots');

    if (activeTab === 'hauls') {
      renderHauls();
    } else {
      renderSavedSpots();
    }
  }

  function renderHauls() {
    grid.innerHTML = '';
    noItemsMsg.classList.toggle('hidden', myHauls.length > 0);

    myHauls.forEach(d => {
      const card = document.createElement('div');
      card.className = 'profile-card-item';
      card.innerHTML = `
        <div class="item-fill" style="height:${d.height}px;"></div>
        <div class="item-caption">
          ${d.item}
          <span>${d.price}</span>
        </div>`;
      grid.appendChild(card);
    });
  }

  function renderSavedSpots() {
    savedListEl.innerHTML = '';
    noItemsMsg.classList.toggle('hidden', savedSpots.length > 0);
    savedCountText.textContent = `${savedSpots.length} Spot${savedSpots.length !== 1 ? 's' : ''} Found`;

    savedSpots.forEach(spot => {
      const card = document.createElement('div');
      card.className = 'saved-spot-card';
      card.dataset.id = spot.id;
      card.innerHTML = `
        <div class="saved-spot-thumb">${spot.name.charAt(0)}</div>
        <div class="saved-spot-info">
          <div class="saved-spot-top">
            <h4>${spot.name}</h4>
            <div class="rating-menu">
              <span class="rating">${spot.rating.toFixed(1)}</span>
              <button type="button" class="card-menu-btn" aria-label="More options">&#8942;</button>
            </div>
          </div>
          <p class="distance">${spot.distance}</p>
          <div class="saved-spot-bottom">
            <button type="button" class="saved-directions-btn">Get Directions</button>
            <button type="button" class="saved-tag">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M6 2a2 2 0 0 0-2 2v18l8-6 8 6V4a2 2 0 0 0-2-2z"/></svg>
              Saved
            </button>
          </div>
        </div>
        <div class="card-menu">
          <button type="button" data-action="remove">Remove from saved</button>
          <button type="button" data-action="report">Report issue</button>
        </div>`;

      card.querySelector('.saved-tag').addEventListener('click', () => unsaveSpot(spot.id));
      card.querySelector('[data-action="remove"]').addEventListener('click', () => unsaveSpot(spot.id));

      const menuBtn = card.querySelector('.card-menu-btn');
      const menu = card.querySelector('.card-menu');
      menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.card-menu.open').forEach(m => { if (m !== menu) m.classList.remove('open'); });
        menu.classList.toggle('open');
      });

      savedListEl.appendChild(card);
    });
  }

  function unsaveSpot(id) {
    savedSpots = savedSpots.filter(s => s.id !== id);
    renderSavedSpots();
  }

  document.addEventListener('click', () => {
    document.querySelectorAll('.card-menu.open').forEach(m => m.classList.remove('open'));
  });

  document.getElementById('saved-sort-select').addEventListener('change', (e) => {
    if (e.target.value === 'rating') savedSpots.sort((a, b) => b.rating - a.rating);
    renderSavedSpots();
  });

  render();

  /* ==========================================
     TABS
     ========================================== */
  document.getElementById('profile-tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.pill');
    if (!btn) return;
    document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    activeTab = btn.dataset.tab;
    render();
  });

  /* ==========================================
     EDIT PROFILE — toggles contenteditable fields
     ========================================== */
  const editBtn = document.getElementById('edit-profile-btn');
  const editableFields = [
    document.getElementById('profile-name'),
    document.getElementById('profile-handle'),
    document.getElementById('profile-location'),
    document.getElementById('profile-bio')
  ];
  let editing = false;

  editBtn.addEventListener('click', () => {
    editing = !editing;
    editableFields.forEach(f => f.setAttribute('contenteditable', editing));
    editBtn.textContent = editing ? 'Save Profile' : 'Edit Profile';
    editBtn.classList.toggle('saving', editing);
    if (editing) editableFields[0].focus();
  });

  document.getElementById('avatar-edit-btn').addEventListener('click', () => {
    alert('Photo upload flow goes here — hook this up to your file input / storage.');
  });

  /* ==========================================
     ADD ITEM — placeholder action
     ========================================== */
  document.getElementById('add-item-btn').addEventListener('click', () => {
    alert('Share-a-haul upload flow goes here — hook this up to your submission form.');
  });

  /* ==========================================
     AVATAR DROPDOWN — same behavior as the other pages
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