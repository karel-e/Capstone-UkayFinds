document.addEventListener('DOMContentLoaded', () => {

  /* ==========================================================================
     0. SHARED HELPERS (pin icon, store data)
     Used by the landing preview map AND the Find A Store dashboard map.
     ========================================================================== */
  const createCustomPin = () => L.divIcon({
    className: 'custom-leaflet-pin',
    html: `<div style="position:relative;width:32px;height:32px;filter:drop-shadow(0px 3px 6px rgba(0,0,0,0.3));cursor:pointer;">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="#7c3aed" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
        <circle cx="12" cy="9" r="2.5" fill="#ffffff"/>
      </svg></div>`,
    iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32]
  });

      function setupDropdown(triggerEl, menuEl, onSelect) {
      function close() {
        menuEl.classList.remove('open');
        triggerEl.classList.remove('open');
      }
    function toggle(e) {
      e.stopPropagation();
      document.querySelectorAll('.dropdown-menu.open').forEach(m => {
        if (m !== menuEl) { m.classList.remove('open'); m.previousElementSibling?.classList.remove('open'); }
    });
    const opening = !menuEl.classList.contains('open');
      menuEl.classList.toggle('open', opening);
      triggerEl.classList.toggle('open', opening);
    }
      triggerEl.addEventListener('click', toggle);
      menuEl.querySelectorAll('.dropdown-item').forEach(item => {
      item.addEventListener('click', () => {
        onSelect(item);
        close();
    });
  });
  document.addEventListener('click', (e) => {
    if (!menuEl.contains(e.target) && e.target !== triggerEl) close();
  });
  return { close };
}

// Formats large counts the way social apps usually do: 1234 -> "1.2k"
  function formatStatCount(n) {
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(n);
  }

    function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function formatTimeAgo(dateString) {
    const then = new Date(dateString.replace(' ', 'T'));
    const seconds = Math.floor((Date.now() - then.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  function showToast(message, type = 'success') {
    let toast = document.getElementById('app-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'app-toast';
      toast.setAttribute('role', 'status');
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.className = 'app-toast show ' + type;
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => toast.classList.remove('show'), 3200);
  }

    // Generic version of setHaulPreviewImage — works on any preview container.
  function setPreviewMedia(container, url) {
    let img = container.querySelector('img');
    let empty = container.querySelector('.post-preview-empty');
    if (url) {
      if (!img) {
        img = document.createElement('img');
        img.alt = 'Preview';
        container.insertBefore(img, container.firstChild);
      }
      img.src = url;
      if (empty) empty.remove();
    } else {
      if (img) img.remove();
      if (!empty) {
        empty = document.createElement('div');
        empty.className = 'post-preview-empty';
        empty.textContent = 'Your photo will appear here';
        container.insertBefore(empty, container.firstChild);
      }
    }
  }

  // Opens/closes a modal. On close it drops focus (avoids the "aria-hidden on a
  // focused element" warning) and collapses any dropdown left open inside it,
  // so reopening never shows a stale open menu.
  function setModalOpen(modalEl, open) {
    if (!open) {
      if (modalEl.contains(document.activeElement)) document.activeElement.blur();
      modalEl.querySelectorAll('.dropdown-menu.open, .dropdown-trigger.open').forEach(el => el.classList.remove('open'));
    }
    modalEl.classList.toggle('active', open);
    modalEl.setAttribute('aria-hidden', open ? 'false' : 'true');
  }

  const storeLocations = [
    { id: 1,  name: "Ukay-Ukay ni Aa",              coords: [10.3801, 123.9575], status: "Open until 7 PM", rating: 4.8, ratingCount: 132, price: "₱50–₱200 Bins",      distance: "500m from your location" },
    { id: 2,  name: "ThriftLift Consolacion",         coords: [10.3835, 123.9590], status: "Open Now",         rating: 4.6, ratingCount: 98,  price: "₱100–₱350 Jackets",   distance: "1.1km from your location" },
    { id: 3,  name: "Consolacion Street Market Spot",  coords: [10.3780, 123.9550], status: "Closes 6 PM",      rating: 4.5, ratingCount: 61,  price: "₱20–₱100 Vintage",    distance: "1.4km from your location" },
    { id: 4,  name: "Bagets Ukay Corner",              coords: [10.3822, 123.9605], status: "Open Now",         rating: 4.7, ratingCount: 74,  price: "₱80–₱250 Mixed",      distance: "1.6km from your location" },
    { id: 5,  name: "Rack & Roll Thrift",              coords: [10.3760, 123.9600], status: "Open Now",         rating: 4.3, ratingCount: 45,  price: "₱60–₱180 Casual",     distance: "1.8km from your location" },
    { id: 6,  name: "Second Story Finds",              coords: [10.3845, 123.9560], status: "Closes 8 PM",      rating: 4.9, ratingCount: 156, price: "₱150–₱400 Curated",   distance: "2.0km from your location" },
    { id: 7,  name: "Tita's Ukay Stall",               coords: [10.3795, 123.9540], status: "Open Now",         rating: 4.4, ratingCount: 52,  price: "₱30–₱120 Bins",       distance: "2.3km from your location" },
    { id: 8,  name: "Preloved Corner PH",              coords: [10.3810, 123.9620], status: "Open until 9 PM",  rating: 4.6, ratingCount: 87,  price: "₱100–₱300 Streetwear", distance: "2.5km from your location" },
    { id: 9,  name: "Vintage Vault Cebu",              coords: [10.3770, 123.9615], status: "Closes 7 PM",      rating: 4.8, ratingCount: 110, price: "₱200–₱500 Curated",   distance: "2.7km from your location" },
    { id: 10, name: "Kabuok Ukay Trading",             coords: [10.3855, 123.9600], status: "Open Now",         rating: 4.2, ratingCount: 38,  price: "₱40–₱150 Mixed",      distance: "3.0km from your location" },
    { id: 11, name: "Sunday Market Racks",             coords: [10.3745, 123.9565], status: "Open Weekends",    rating: 4.5, ratingCount: 66,  price: "₱50–₱200 Bins",       distance: "3.2km from your location" },
    { id: 12, name: "The Fit Repository",              coords: [10.3830, 123.9535], status: "Open Now",         rating: 4.7, ratingCount: 91,  price: "₱120–₱350 Curated",   distance: "3.4km from your location" }
  ];

  /* ==========================================================================
     0b. SHARED HAUL DATA
     Lives here (not inside a single view's init function) because a haul
     posted through the "Post Haul" form needs to show up in BOTH the
     Community Feed and the user's own Profile > My Hauls — two separate
     lazily-initialized modules that otherwise can't see each other's data.
     ========================================================================== */
  let currentUser = null; // set once login/register/session-check succeeds; used by Profile page

  let feedHauls = [
    { id: 1,  user: "@fitbymitz",       item: "Overall outfit check", price: "₱180", height: 260, tags: ["near-me", "trending"] },
    { id: 2,  user: "@fitme",           item: "Knitted jacket",       price: "₱150", height: 380, tags: ["trending"] },
    { id: 3,  user: "@outfitoftheday",  item: "Denim overall fit",    price: "₱100", height: 460, tags: ["budget"] },
    { id: 4,  user: "@thriftbyjade",    item: "Corduroy jacket",      price: "₱220", height: 280, tags: ["near-me"] },
    { id: 5,  user: "@rack.raider",     item: "Vintage sundress",     price: "₱190", height: 260, tags: ["budget", "near-me"] },
    { id: 6,  user: "@ukayqueen",       item: "Streetwear layers",    price: "₱260", height: 460, tags: ["trending"] },
    { id: 7,  user: "@secondstoryco",   item: "Curated blazer set",   price: "₱340", height: 300, tags: ["trending"] },
    { id: 8,  user: "@budgetfits",      item: "Bin-find graphic tee", price: "₱90",  height: 220, tags: ["budget"] },
    { id: 9,  user: "@preloved.ph",     item: "Cargo pants combo",    price: "₱180", height: 260, tags: ["budget", "near-me"] },
    { id: 10, user: "@vintagevault",    item: "Leather jacket find",  price: "₱450", height: 300, tags: ["trending"] },
    { id: 11, user: "@sundaymarket",    item: "Floral wrap top",      price: "₱120", height: 250, tags: ["budget"] }
  ];
  let nextHaulId = 100; // seed data uses 1-11, new posts start well above that

  /* ==========================================================================
     1. LANDING PREVIEW MAP (logged-out) — always initialized, landing is
        visible on first load.
     ========================================================================== */
  const mapElement = document.getElementById('map');
  if (mapElement) {
    const landingMap = L.map('map').setView(storeLocations[0].coords, 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; OpenStreetMap contributors'
    }).addTo(landingMap);

    storeLocations.slice(0, 3).forEach(store => {
      const popupContent = `
        <div class="map-popup-card">
          <h3>${store.name}</h3>
          <p><span class="status-dot">&bull;</span> ${store.status}</p>
          <p><strong>${store.rating.toFixed(1)}</strong> | ${store.price}</p>
          <a class="open-signup-modal">Get Directions &rarr;</a>
        </div>`;
      L.marker(store.coords, { icon: createCustomPin() })
        .addTo(landingMap)
        .bindPopup(popupContent, { closeButton: true, offset: [0, -5] });
    });
  }

  /* ==========================================================================
     2. TOP-LEVEL VIEW ROUTER — landing <-> dashboard, and between the
        4 dashboard views. Each dashboard view is initialized lazily
        (only the first time it's shown), which also fixes Leaflet's
        "map renders blank inside a hidden container" problem.
     ========================================================================== */
  const landingView = document.getElementById('landing-view');
  const dashboardShell = document.getElementById('dashboard-shell');

  const views = {
    'find-a-store':   { el: document.getElementById('find-a-store-view'),   init: initFindAStore,   inited: false, onShow: null },
    'community-feed': { el: document.getElementById('community-feed-view'), init: initCommunityFeed, inited: false, onShow: null },
    'notifications':  { el: document.getElementById('notifications-view'),  init: initNotifications, inited: false, onShow: null },
    'profile':        { el: document.getElementById('profile-view'),        init: initProfile,       inited: false, onShow: null }
  };

  function switchView(name, opts) {
    if (!views[name]) return;
    Object.keys(views).forEach(key => views[key].el.classList.toggle('hidden', key !== name));
    document.querySelectorAll('.nav-link[data-view]').forEach(a => {
      a.classList.toggle('active', a.dataset.view === name);
    });

    const view = views[name];
    if (!view.inited) {
      view.inited = true;
      view.init(opts || {});
    } else if (view.onShow) {
      view.onShow(opts || {});
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }

  function showDashboard(name, opts) {
    landingView.classList.add('hidden');
    dashboardShell.classList.remove('hidden');
    switchView(name || 'find-a-store', opts);
  }

  function showLanding() {
    dashboardShell.classList.add('hidden');
    landingView.classList.remove('hidden');
    window.scrollTo(0, 0);
  }

  // Top nav links
  document.querySelectorAll('.app-nav .nav-link[data-view]').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      switchView(a.dataset.view);
    });
  });

  // Dropdown links that jump to a specific view/tab ("Saved Spots", "My Shared Hauls")
  document.querySelectorAll('.dropdown-links a[data-view]').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const view = a.dataset.view;
      const tab = a.dataset.tab;
      document.getElementById('user-dropdown').classList.remove('open');
      switchView(view, { tab: tab });
    });
  });

  // "Account Settings" has no dedicated page yet — keep it a harmless no-op
  // instead of a dead "#" link jumping the page to the top.
  const accountSettingsLink = document.getElementById('account-settings-link');
  if (accountSettingsLink) {
    accountSettingsLink.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('user-dropdown').classList.remove('open');
    });
  }

  /* ==========================================================================
     3. SIGNUP / SIGNIN MODAL (landing-only)
     ========================================================================== */
  const modal = document.getElementById('signup-modal');
  const signupView = document.getElementById('signup-view');
  const signinView = document.getElementById('signin-view');
  const toSigninBtn = document.getElementById('to-signin-btn');
  const toSignupBtn = document.getElementById('to-signup-btn');

  function openModal(view) {
    signupView.style.display = view === 'signin' ? 'none' : 'block';
    signinView.style.display = view === 'signin' ? 'block' : 'none';
    setModalOpen(modal, true);
    document.getElementById('post-register-note').classList.add('hidden');
  }
  function closeModal() { setModalOpen(modal, false); }

  document.body.addEventListener('click', (e) => {
    if (e.target.closest('.open-signup-modal')) {
      e.preventDefault();
      openModal('signup');
    }
  });

  if (toSigninBtn) toSigninBtn.addEventListener('click', (e) => { e.preventDefault(); openModal('signin'); });
  if (toSignupBtn) toSignupBtn.addEventListener('click', (e) => { e.preventDefault(); openModal('signup'); });

  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.classList.contains('active')) closeModal(); });

  /* ==========================================================================
     4. REAL AUTH — talks to api/auth/*.php
        Relative paths (no leading slash) on purpose: they resolve against
        wherever this page is actually being served from, so this doesn't
        break if the project folder ever gets renamed or moved.
     ========================================================================== */
  const signupForm = document.getElementById('signup-form');
  const signinForm = document.getElementById('signin-form');
  const signupError = document.getElementById('signup-error');
  const signinError = document.getElementById('signin-error');

  function showFormError(el, message) {
    el.textContent = message;
    el.classList.add('visible');
  }
  function clearFormError(el) {
    el.classList.remove('visible');
  }

  // Applies a logged-in user's info to the header avatar/dropdown —
  // used by signup, login, and the session check on page load.
  function applyLoggedInUser(user) {
    currentUser = user;
    const label = user.display_name || user.username;
    document.getElementById('dropdown-name').textContent = label;
    document.getElementById('dropdown-email').textContent = user.email;
    document.getElementById('user-avatar-btn').textContent = label.charAt(0).toUpperCase();
  }

  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFormError(signupError);

    const username = document.getElementById('signup-username').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-confirm').value;

    try {
      const res = await fetch('api/auth/register.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, confirm_password: confirmPassword })
      });
      const data = await res.json();

      if (!data.success) {
        showFormError(signupError, data.error || 'Something went wrong. Please try again.');
        return;
      }

      // Deliberately NOT logging them in or opening the dashboard here —
      // registering only creates the account. Hand off to Sign In with
      // their username already filled in, so they still have to prove
      // they know the password before getting in.
      signupForm.reset();
      document.getElementById('signin-email').value = username;
      openModal('signin');
      document.getElementById('post-register-note').classList.remove('hidden');
    } catch (err) {
      // Most likely cause: PHP isn't running, or the fetch path is wrong —
      // same failure mode you already hit earlier with the 404s.
      showFormError(signupError, 'Could not reach the server. Is your PHP backend running?');
    }
  });

  signinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFormError(signinError);

    const identifier = document.getElementById('signin-email').value.trim();
    const password = document.getElementById('signin-password').value;

    try {
      const res = await fetch('api/auth/login.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password })
      });
      const data = await res.json();

      if (!data.success) {
        showFormError(signinError, data.error || 'Something went wrong. Please try again.');
        return;
      }

      applyLoggedInUser(data.user);
      signinForm.reset();
      closeModal();
      showDashboard('find-a-store');
    } catch (err) {
      showFormError(signinError, 'Could not reach the server. Is your PHP backend running?');
    }
  });

  /* ==========================================================================
     5. SHARED AVATAR DROPDOWN + LOGOUT
        One instance now (the header lives outside the 4 switchable views),
        so this replaces what used to be 4 separate copies of the same code.
     ========================================================================== */
  const avatarBtn = document.getElementById('user-avatar-btn');
  const dropdown = document.getElementById('user-dropdown');
  const logoutBtn = document.getElementById('logout-btn');

  avatarBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('open');
    avatarBtn.setAttribute('aria-expanded', dropdown.classList.contains('open'));
  });
  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target) && e.target !== avatarBtn) dropdown.classList.remove('open');
  });

  logoutBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    dropdown.classList.remove('open');
    try {
      await fetch('api/auth/logout.php');
    } catch (err) {
      // Even if this request fails, still send them back to the landing
      // view client-side — worst case their session just lingers
      // server-side until it naturally expires.
    }
    showLanding();
  });

  /* ==========================================================================
     5b. SESSION CHECK ON LOAD
        Ask the server "am I already logged in?" so refreshing the page
        doesn't silently dump a logged-in user back onto the landing view —
        this is the whole reason me.php exists.
     ========================================================================== */
  (async function checkExistingSession() {
    try {
      const res = await fetch('api/auth/me.php');
      const data = await res.json();
      if (data.success && data.logged_in) {
        applyLoggedInUser(data.user);
        showDashboard('find-a-store');
      }
    } catch (err) {
      // Backend not reachable — just stay on the landing page, same as
      // if the person had never logged in.
    }
  })();

  /* ==========================================================================
     5b. POST HAUL MODAL (dashboard-only, shared)
        Reachable from Community Feed's "+" AND Profile's "+" — defined here
        at the top level (like the modal above) rather than inside either
        view's init function, since posting a haul needs to update BOTH
        feedHauls and profileHaulsData and refresh whichever of those two
        views has already been visited.
     ========================================================================== */
  const postHaulModal = document.getElementById('post-haul-modal');
  const postHaulForm = document.getElementById('post-haul-form');
  const haulMediaInput = document.getElementById('haul-media-input');
  const haulDropzone = document.getElementById('haul-dropzone');
  const haulDropzoneBody = document.getElementById('haul-dropzone-body');
  let editingHaulDraftId = null;     // set while continuing a draft
  let editingHaulDraftImage = null;  // that draft's existing photo path, if any

    // ---- Specific Details popout ----
  const haulDetailsToggle = document.getElementById('haul-specific-details-toggle');
  const haulDetailsPanel = document.getElementById('haul-specific-details-panel');
  haulDetailsToggle.addEventListener('click', () => {
    const opening = !haulDetailsPanel.classList.contains('open');
    haulDetailsPanel.classList.toggle('open', opening);
    haulDetailsToggle.classList.toggle('open', opening);
  });

  // ---- Size dropdown ----
  let selectedHaulSize = '';
  setupDropdown(
    document.getElementById('haul-size-dropdown-btn'),
    document.getElementById('haul-size-dropdown-menu'),
    (item) => {
      document.querySelectorAll('#haul-size-dropdown-menu .dropdown-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      selectedHaulSize = item.dataset.value;
      document.getElementById('haul-size-label').textContent = item.textContent;
    }
  );

  // ---- Live preview ----
  const haulPreviewMedia = document.getElementById('haul-preview-media');
  const haulPreviewUsername = document.getElementById('haul-preview-username');
  const haulPreviewPrice = document.getElementById('haul-preview-price');
  const haulPreviewCaption = document.getElementById('haul-preview-caption');
  const haulPreviewLocation = document.getElementById('haul-preview-location');
  const haulPreviewLocationText = document.getElementById('haul-preview-location-text');

  function updateHaulPreviewLocation() {
    if (selectedHaulLocation) {
      haulPreviewLocationText.textContent = selectedHaulLocation;
      haulPreviewLocation.classList.remove('hidden');
    } else {
      haulPreviewLocation.classList.add('hidden');
    }
  }

  function updateHaulPreview() {
    const caption = document.getElementById('haul-caption').value.trim();
    const price = document.getElementById('haul-amount').value;
    haulPreviewCaption.textContent = caption || 'Your caption will show up here...';
    haulPreviewPrice.textContent = price ? `₱${price}` : '';
    haulPreviewUsername.textContent = currentUser ? '@' + currentUser.username : '@username';
  }

  function setHaulPreviewImage(url) {
    let img = haulPreviewMedia.querySelector('img');
    let empty = haulPreviewMedia.querySelector('.post-preview-empty');

    if (url) {
      if (!img) {
        img = document.createElement('img');
        img.alt = 'Preview';
        haulPreviewMedia.insertBefore(img, haulPreviewMedia.firstChild);
      }
      img.src = url;
      if (empty) empty.remove();
    } else {
      if (img) img.remove();
      if (!empty) {
        empty = document.createElement('div');
        empty.className = 'post-preview-empty';
        empty.textContent = 'Your photo will appear here';
        haulPreviewMedia.insertBefore(empty, haulPreviewMedia.firstChild);
      }
    }
  }

  document.getElementById('haul-caption').addEventListener('input', updateHaulPreview);
  document.getElementById('haul-amount').addEventListener('input', updateHaulPreview);

  // Populate "Tag Thrift Spot" from the same store data Find A Store uses.
let selectedHaulLocation = '';
const haulLocationMenu = document.getElementById('haul-location-dropdown-menu');
storeLocations.forEach(store => {
  const item = document.createElement('button');
  item.type = 'button';
  item.className = 'dropdown-item';
  item.dataset.value = store.name;
  item.textContent = store.name;
  haulLocationMenu.appendChild(item);
});
setupDropdown(
  document.getElementById('haul-location-dropdown-btn'),
  haulLocationMenu,
  (item) => {
    haulLocationMenu.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    selectedHaulLocation = item.dataset.value;
    document.getElementById('haul-location-label').textContent = item.textContent;
    updateHaulPreviewLocation();
  });

  function resetHaulDropzone() {
    haulMediaInput.value = '';
    haulDropzoneBody.innerHTML = `
      <div class="haul-dropzone-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 16V4M12 4l-4 4M12 4l4 4"/><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>
      </div>
      <p class="haul-dropzone-text">Click or drag photos/videos to upload<br><span>(PNG, JPG, MP4)</span></p>`;
  }

    function previewHaulFile(file) {
    if (!file) return;
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      haulDropzoneBody.innerHTML = `<img class="haul-dropzone-preview" src="${url}" alt="Selected haul photo"><span class="haul-dropzone-filename">${file.name}</span>`;
      setHaulPreviewImage(url);
    } else {
      haulDropzoneBody.innerHTML = `
        <div class="haul-dropzone-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
        </div>
        <span class="haul-dropzone-filename">${file.name}</span>`;
    }
  }

  haulMediaInput.addEventListener('change', () => previewHaulFile(haulMediaInput.files[0]));

  ['dragover', 'dragleave', 'drop'].forEach(evt => {
    haulDropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      haulDropzone.classList.toggle('dragover', evt === 'dragover');
      if (evt === 'drop' && e.dataTransfer.files[0]) {
        haulMediaInput.files = e.dataTransfer.files;
        previewHaulFile(e.dataTransfer.files[0]);
      }
    });
  });

  function resetHaulForm() {
    postHaulForm.reset();
    resetHaulDropzone();
    selectedHaulLocation = '';
    document.getElementById('haul-location-label').textContent = 'Select Location';
    haulLocationMenu.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active'));
    selectedHaulSize = '';
    document.getElementById('haul-size-label').textContent = 'Select size';
    document.querySelectorAll('#haul-size-dropdown-menu .dropdown-item').forEach(i => i.classList.remove('active'));
    haulDetailsPanel.classList.remove('open');
    haulDetailsToggle.classList.remove('open');
    editingHaulDraftId = null;
    editingHaulDraftImage = null;
    setHaulPreviewImage(null);
    updateHaulPreview();
    updateHaulPreviewLocation();
  }

  function openPostHaulModal() {
    updateHaulPreview();   // shows the real @username as soon as it opens
    setModalOpen(postHaulModal, true);
  }
  function closePostHaulModal() {
    setModalOpen(postHaulModal, false);
    // Don't leave a half-edited draft sitting in the "new haul" form
    if (editingHaulDraftId !== null) resetHaulForm();
  }

  document.getElementById('post-haul-close').addEventListener('click', closePostHaulModal);
  postHaulModal.addEventListener('click', (e) => { if (e.target === postHaulModal) closePostHaulModal(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && postHaulModal.classList.contains('active')) closePostHaulModal();
  });

  function openHaulDraft(d) {
    resetHaulForm();
    editingHaulDraftId = d.id;
    editingHaulDraftImage = d.image_path || null;
    document.getElementById('haul-caption').value = d.item_name || '';
    document.getElementById('haul-amount').value = d.price !== null ? d.price : '';
    selectedHaulLocation = d.store_name || '';
    document.getElementById('haul-location-label').textContent = d.store_name || 'Select Location';
    haulLocationMenu.querySelectorAll('.dropdown-item').forEach(i => i.classList.toggle('active', i.dataset.value === d.store_name));
    updateHaulPreviewLocation();
    
    if (d.image_path) {
      haulDropzoneBody.innerHTML = `<img class="haul-dropzone-preview" src="${escapeHtml(d.image_path)}" alt="Current photo"><span class="haul-dropzone-filename">Current photo (choose a file to replace it)</span>`;
    }
    setHaulPreviewImage(d.image_path || null);
    updateHaulPreview();
    
    if (d.size) {
      selectedHaulSize = d.size;
      document.getElementById('haul-size-label').textContent = d.size;
      document.querySelectorAll('#haul-size-dropdown-menu .dropdown-item').forEach(i => i.classList.toggle('active', i.dataset.value === d.size));
    }
    document.getElementById('haul-color').value = d.color || '';
    document.getElementById('haul-fabric').value = d.fabric || '';
    if (d.size || d.color || d.fabric) {
      haulDetailsPanel.classList.add('open');
      haulDetailsToggle.classList.add('open');
    }

    openPostHaulModal();
  }

      async function submitHaul(status) {
    const isDraft = status === 'draft';
    const caption = document.getElementById('haul-caption').value.trim();
    const hasImage = !!haulMediaInput.files[0] || !!editingHaulDraftImage;

    if (isDraft && !caption && !hasImage) {
      showToast('Add a photo or a caption to save a draft.', 'error');
      return;
    }
    if (!isDraft && !caption) {
      alert('Add a caption for your haul before posting.');
      return;
    }

    const amountInput = document.getElementById('haul-amount').value;
    const formData = new FormData();
    formData.append('status', isDraft ? 'draft' : 'published');
    formData.append('item_name', caption);
    if (amountInput) formData.append('price', amountInput);
    formData.append('store_name', selectedHaulLocation || '');
    formData.append('size', selectedHaulSize || '');
    formData.append('color', document.getElementById('haul-color').value.trim());
    formData.append('fabric', document.getElementById('haul-fabric').value.trim());
    formData.append('tags[]', 'near-me');
    if (editingHaulDraftId !== null) formData.append('draft_id', editingHaulDraftId);
    if (haulMediaInput.files[0]) formData.append('image', haulMediaInput.files[0]);

    const actionBtns = postHaulForm.querySelectorAll('.haul-form-actions button');
    actionBtns.forEach(b => b.disabled = true);   // no double-submits

    try {
      const res = await fetch('api/hauls/create.php', { method: 'POST', body: formData });
      const data = await res.json();

      if (!data.success) {
        alert(data.error || (isDraft ? 'Could not save your draft.' : 'Could not post your haul.'));
        return;
      }

      if (views['profile'].inited) {
        if (views['profile'].refreshDrafts) views['profile'].refreshDrafts();
        if (views['profile'].refreshStats) views['profile'].refreshStats();
        if (!isDraft && views['profile'].refreshHauls) views['profile'].refreshHauls();
      }
      if (!isDraft && views['community-feed'].inited && views['community-feed'].refreshHauls) {
        views['community-feed'].refreshHauls();
      }

      resetHaulForm();
      closePostHaulModal();
      showToast(isDraft ? 'Draft saved. Find it in Profile → My Drafts.' : 'Haul posted!');
    } catch (err) {
      alert('Could not reach the server. Is your PHP backend running?');
    } finally {
      actionBtns.forEach(b => b.disabled = false);
    }
  }

  postHaulForm.addEventListener('submit', (e) => { e.preventDefault(); submitHaul('published'); });
  document.getElementById('haul-save-draft').addEventListener('click', () => submitHaul('draft'));

  /* ==========================================================================
     6. FIND A STORE — lazily initialized on first visit
     ========================================================================== */
  function initFindAStore() {
    // Fallback center used only until we know the visitor's real location
    // (or if they deny/don't have geolocation at all) — matches
    // Ukay-Ukay ni Aa's coordinates from the seed data.
    const CENTER = [10.3801, 123.9575];

    let userCoords = null;       // {lat, lng} once geolocation succeeds
    let currentStores = [];      // the last list fetched from list.php
    let markers = {};            // store id -> Leaflet marker
    let userMarker = null;
    let activeSearch = '';
    let activeSort = 'nearby';   // matches the "Sort by: Nearby" default in the UI
    let hasOpenedInitialPopup = false;

    const mapLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; OpenStreetMap contributors'
    });
    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19, attribution: 'Tiles &copy; Esri'
    });

    const map = L.map('dashboard-map', { zoomControl: true, layers: [mapLayer] }).setView(CENTER, 14);

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

    /* ==========================================================================
       GEOLOCATION — a distinct "you are here" marker, separate from store pins
       ========================================================================== */
    const createUserLocationIcon = () => L.divIcon({
      className: 'user-location-marker',
      html: `<div style="position:relative;width:20px;height:20px;">
        <div style="position:absolute;inset:0;border-radius:50%;background:#4285F4;border:3px solid #fff;box-shadow:0 0 0 2px rgba(66,133,244,0.35), 0 2px 6px rgba(0,0,0,0.3);"></div>
      </div>`,
      iconSize: [20, 20], iconAnchor: [10, 10]
    });

    function setUserMarker(lat, lng) {
      if (userMarker) {
        userMarker.setLatLng([lat, lng]);
        return;
      }
      userMarker = L.marker([lat, lng], { icon: createUserLocationIcon(), zIndexOffset: 1000 })
        .addTo(map)
        .bindPopup('<div class="map-popup-card"><h3>You are here</h3></div>');
    }

    // notifyOnFailure: true for the manual locate-btn click (the person
    // expects some feedback), false for the silent check on page load
    // (denial there should never interrupt them with a popup).
    function requestPosition(notifyOnFailure) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          userCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserMarker(userCoords.lat, userCoords.lng);
          map.flyTo([userCoords.lat, userCoords.lng], 15, { duration: 0.8 });
          loadStores();
        },
        () => {
          if (notifyOnFailure) {
            alert('Could not get your location. Check that location access is allowed for this site in your browser settings.');
          }
          loadStores();
        },
        { timeout: 8000 }
      );
    }

    document.getElementById('locate-btn').addEventListener('click', () => {
      if (!navigator.geolocation) {
        alert('Your browser does not support location services.');
        return;
      }
      requestPosition(true);
    });

    // Runs once when this view first loads: checks the browser's current
    // permission state WITHOUT triggering a prompt, so a visitor who
    // already granted access on a past visit gets sorted results
    // immediately with no popup at all.
    async function initLocation() {
      if (!navigator.geolocation) {
        loadStores();
        return;
      }
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const status = await navigator.permissions.query({ name: 'geolocation' });
          if (status.state === 'denied') {
            // Browser already knows the answer is no — don't even ask,
            // just load with the default rating-based sort.
            loadStores();
          } else {
            // 'granted' resolves silently; 'prompt' triggers the native dialog.
            requestPosition(false);
          }
          return;
        } catch (err) {
          // Permissions API not fully supported here — fall through
          // to just asking directly.
        }
      }
      requestPosition(false);
    }

    /* ==========================================================================
       STORE DATA — fetched live from api/stores/list.php
       ========================================================================== */
    function clearStoreMarkers() {
      Object.values(markers).forEach(m => map.removeLayer(m));
      markers = {};
    }

    function renderMarkers(list) {
      clearStoreMarkers();
      list.forEach(store => {
        const ratingLabel = store.rating_count > 0 ? store.rating.toFixed(1) : 'New';
        const popupHtml = `
          <div class="map-popup-card">
            <h3>${store.name}</h3>
            <p><span class="status-dot">&bull;</span> ${store.status_text || ''}</p>
            <p><strong>${ratingLabel}</strong> | ${store.price_range || ''}</p>
            <a data-view-details="${store.id}">View Store Details &rarr;</a>
          </div>`;
        const marker = L.marker([store.latitude, store.longitude], { icon: createCustomPin() })
          .addTo(map)
          .bindPopup(popupHtml, { closeButton: true, offset: [0, -5] });
        markers[store.id] = marker;
      });

      if (!hasOpenedInitialPopup && list.length) {
        markers[list[0].id].openPopup();
        hasOpenedInitialPopup = true;
      }
    }

    function showLoadingState() {
      document.getElementById('spots-count-text').textContent = 'Finding spots…';
      document.getElementById('radius-note').classList.add('hidden');
      document.getElementById('store-cards-list').innerHTML =
        '<p class="no-results">Finding thrift spots near you…</p>';
    }

    async function loadStores() {
      const params = new URLSearchParams();
      if (activeSearch) params.set('search', activeSearch);
      params.set('sort', activeSort);
      if (userCoords) {
        params.set('lat', userCoords.lat);
        params.set('lng', userCoords.lng);
      } else if (activeSort === 'nearby') {
        // No location known and the sort is still sitting at its default
        // "Nearby" — there's nothing real to sort by yet, so ask the
        // server for a shuffled order instead of always returning the
        // same fixed list. (If the person manually picks "Top Rated"
        // instead, activeSort becomes 'rating' and this branch is
        // skipped — their explicit choice wins over randomizing.)
        params.set('random', '1');
      }

      try {
        const res = await fetch(`api/stores/list.php?${params.toString()}`);
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Failed to load stores.');

        currentStores = data.stores;
        document.getElementById('radius-note').classList.toggle('hidden', !data.radius_expanded);
        renderMarkers(currentStores);
        renderStoreCards(currentStores);
      } catch (err) {
        document.getElementById('store-cards-list').innerHTML =
          `<p class="no-results">Could not load stores — ${err.message}</p>`;
        document.getElementById('spots-count-text').textContent = '0 Spots Found';
      }
    }

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
        const ratingLabel = store.rating_count > 0 ? store.rating.toFixed(1) : 'New';
                card.innerHTML = `
          <div class="store-img-placeholder">${store.name.charAt(0)}</div>
          <div class="store-info">
            <div class="store-header">
              <h4>${store.name}</h4>
              <span class="rating clickable" title="Rate this spot">${ratingLabel}</span>
            </div>
            <p class="distance">${store.distance_label}</p>
            <div class="card-bottom-row">
              <button type="button" class="directions-btn">Get Directions</button>
              <div class="card-actions">
                <button type="button" class="save-btn${store.is_saved ? ' saved' : ''}"
                        aria-pressed="${store.is_saved ? 'true' : 'false'}"
                        aria-label="${store.is_saved ? 'Unsave this spot' : 'Save this spot'}"
                        title="${store.is_saved ? 'Unsave' : 'Save'}">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                </button>
                <button type="button" class="card-menu-btn" aria-label="More options">&#8942;</button>
              </div>
            </div>
          </div>
          <div class="card-menu">
            <button type="button" data-action="rate">Rate this spot</button>
            <button type="button" data-action="report">Report issue</button>
          </div>`;

        card.querySelector('.directions-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          focusStore(store.id);
        });

        card.querySelector('.rating').addEventListener('click', (e) => {
          e.stopPropagation();
          openRateSpotModal(store.id);
        });

                const menuBtn = card.querySelector('.card-menu-btn');
        const menu = card.querySelector('.card-menu');
        menuBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          document.querySelectorAll('.card-menu.open').forEach(m => { if (m !== menu) m.classList.remove('open'); });
          menu.classList.toggle('open');
        });

        menu.querySelector('[data-action="rate"]').addEventListener('click', (e) => {
          e.stopPropagation();
          menu.classList.remove('open');
          openRateSpotModal(store.id);
        });

                const saveBtn = card.querySelector('.save-btn');
        saveBtn.addEventListener('click', async (e) => {
          e.stopPropagation(); // don't trigger the card's "focus on map" click
          saveBtn.disabled = true;
          try {
            const res = await fetch('api/saved-spots/toggle.php', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ store_id: store.id })
            });
            const data = await res.json();
            if (data.success) {
              store.is_saved = data.saved;
              saveBtn.classList.toggle('saved', data.saved);
              saveBtn.setAttribute('aria-pressed', data.saved ? 'true' : 'false');
              saveBtn.setAttribute('aria-label', data.saved ? 'Unsave this spot' : 'Save this spot');
              saveBtn.title = data.saved ? 'Unsave' : 'Save';
              if (views['profile'].inited && views['profile'].refreshSavedSpots) {
                views['profile'].refreshSavedSpots();
              }
            } else {
              alert(data.error || 'Could not update this spot.');
            }
          } catch (err) {
            alert('Could not reach the server. Is your PHP backend running?');
          } finally {
            saveBtn.disabled = false;
          }
        });

        card.addEventListener('click', () => focusStore(store.id));
        container.appendChild(card);
      });
    }

    document.addEventListener('click', () => {
      document.querySelectorAll('.card-menu.open').forEach(m => m.classList.remove('open'));
    });

    function focusStore(id) {
      const store = currentStores.find(s => s.id === id);
      if (!store) return;
      map.flyTo([store.latitude, store.longitude], 16, { duration: 0.6 });
      const marker = markers[id];
      if (marker) marker.openPopup();

      document.querySelectorAll('.store-card').forEach(c => c.classList.remove('active'));
      const activeCard = document.querySelector(`.store-card[data-id="${id}"]`);
      if (activeCard) activeCard.classList.add('active');
    }

    document.getElementById('dashboard-map').addEventListener('click', (e) => {
      const link = e.target.closest('[data-view-details]');
      if (link) focusStore(Number(link.dataset.viewDetails));
    });

    let searchDebounce;
    document.getElementById('dashboard-search').addEventListener('input', (e) => {
      clearTimeout(searchDebounce);
      const val = e.target.value;
      searchDebounce = setTimeout(() => {
        activeSearch = val.trim();
        loadStores();
      }, 250);
    });

    // NOTE: "On Budget" doesn't have a real backend sort yet — price_range
    // is free text ("₱50–₱200 Bins"), not a structured numeric value, so
    // there's nothing meaningful to sort by yet. list.php only recognizes
    // 'nearby'; anything else (including 'budget') falls back to its
    // rating-based default, same as before this was wired to the API.
      setupDropdown(
        document.getElementById('sort-dropdown-btn'),
        document.getElementById('sort-dropdown-menu'),
          (item) => {
        document.querySelectorAll('#sort-dropdown-menu .dropdown-item').forEach(i => i.classList.remove('active'));
          item.classList.add('active');
        document.getElementById('sort-value-label').textContent = item.textContent;
        activeSort = item.dataset.value;
      loadStores();
  });

    /* -------- SUGGEST A NEW SPOT MODAL -------- */
    const suggestSpotModal = document.getElementById('suggest-spot-modal');
    const suggestSpotForm = document.getElementById('suggest-spot-form');
    const spotMediaInput = document.getElementById('spot-media-input');
    const spotDropzone = document.getElementById('spot-dropzone');
    const spotDropzoneBody = document.getElementById('spot-dropzone-body');

        // ---- Map picker ----
    let spotPickerMap = null;
    let spotPin = null;
    let spotPinCoords = null;
    const spotMapHint = document.getElementById('spot-map-hint');

    function updateSpotMapHint() {
      spotMapHint.textContent = spotPinCoords
        ? 'Pin set. Drag it to fine-tune.'
        : 'Click the map to drop a pin';
    }

    function setSpotPin(lat, lng, { pan = true } = {}) {
      spotPinCoords = { lat, lng };
      if (!spotPin) {
        spotPin = L.marker([lat, lng], { icon: createCustomPin(), draggable: true }).addTo(spotPickerMap);
        spotPin.on('dragend', () => {
          const p = spotPin.getLatLng();
          spotPinCoords = { lat: p.lat, lng: p.lng };
        });
      } else {
        spotPin.setLatLng([lat, lng]);
      }
      if (pan) spotPickerMap.setView([lat, lng], Math.max(spotPickerMap.getZoom(), 16));
      updateSpotMapHint();
    }

    // Built lazily on first open: Leaflet can't measure a map that was
    // created while its container wasn't laid out yet.
    function ensureSpotPickerMap() {
      if (!spotPickerMap) {
        spotPickerMap = L.map('spot-picker-map').setView(userCoords ? [userCoords.lat, userCoords.lng] : CENTER, 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19, attribution: '&copy; OpenStreetMap contributors'
        }).addTo(spotPickerMap);
        spotPickerMap.on('click', (e) => setSpotPin(e.latlng.lat, e.latlng.lng, { pan: false }));
      }
      setTimeout(() => spotPickerMap.invalidateSize(), 250);
    }

    function resetSpotForm() {
      suggestSpotForm.reset();
      resetSpotDropzone();
      if (spotPin && spotPickerMap) spotPickerMap.removeLayer(spotPin);
      spotPin = null;
      spotPinCoords = null;
      updateSpotMapHint();
    }

    // "Find on map": looks the address up on OpenStreetMap's free geocoder
    const spotFindBtn = document.getElementById('spot-find-btn');
    async function findSpotAddress() {
      const q = document.getElementById('spot-address').value.trim();
      if (!q) { showToast('Type an address or area first.', 'error'); return; }
      spotFindBtn.disabled = true;
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ph&q=${encodeURIComponent(q)}`);
        const results = await res.json();
        if (!results.length) {
          showToast("Couldn't find that address. Click the map to place the pin instead.", 'error');
          return;
        }
        setSpotPin(parseFloat(results[0].lat), parseFloat(results[0].lon));
      } catch (err) {
        showToast('Address lookup failed. Click the map to place the pin instead.', 'error');
      } finally {
        spotFindBtn.disabled = false;
      }
    }
    spotFindBtn.addEventListener('click', findSpotAddress);
    document.getElementById('spot-address').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); findSpotAddress(); }
    });

    document.getElementById('spot-locate-btn').addEventListener('click', () => {
      if (!navigator.geolocation) { showToast('Your browser does not support location services.', 'error'); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => setSpotPin(pos.coords.latitude, pos.coords.longitude),
        () => showToast('Could not get your location.', 'error'),
        { timeout: 8000 }
      );
    });

    function resetSpotDropzone() {
      spotMediaInput.value = '';
      spotDropzoneBody.innerHTML = `
        <div class="haul-dropzone-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 16V4M12 4l-4 4M12 4l4 4"/><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>
        </div>
        <p class="haul-dropzone-text">Click or drag a photo to upload<br><span>(PNG, JPG)</span></p>`;
    }
    function previewSpotFile(file) {
      if (!file || !file.type.startsWith('image/')) return;
      const url = URL.createObjectURL(file);
      spotDropzoneBody.innerHTML = `<img class="haul-dropzone-preview" src="${url}" alt="Selected spot photo"><span class="haul-dropzone-filename">${file.name}</span>`;
    }
    spotMediaInput.addEventListener('change', () => previewSpotFile(spotMediaInput.files[0]));
    ['dragover', 'dragleave', 'drop'].forEach(evt => {
      spotDropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        spotDropzone.classList.toggle('dragover', evt === 'dragover');
        if (evt === 'drop' && e.dataTransfer.files[0]) {
          spotMediaInput.files = e.dataTransfer.files;
          previewSpotFile(e.dataTransfer.files[0]);
        }
      });
    });

    function openSuggestSpotModal() { setModalOpen(suggestSpotModal, true); ensureSpotPickerMap(); }

    function closeSuggestSpotModal() { setModalOpen(suggestSpotModal, false); }
    document.getElementById('suggest-spot-close').addEventListener('click', closeSuggestSpotModal);
    document.getElementById('suggest-spot-cancel').addEventListener('click', closeSuggestSpotModal);
    suggestSpotModal.addEventListener('click', (e) => { if (e.target === suggestSpotModal) closeSuggestSpotModal(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && suggestSpotModal.classList.contains('active')) closeSuggestSpotModal();
    });

    document.getElementById('add-spot-btn').addEventListener('click', openSuggestSpotModal);

    suggestSpotForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('spot-name').value.trim();
      if (!name) {
        alert('Give the spot a name first.');
        return;
      }
      const address = document.getElementById('spot-address').value.trim();
      const hours = document.getElementById('spot-hours').value.trim();
      const priceRange = document.getElementById('spot-price-range').value.trim();

      if (!spotPinCoords) {
        alert('Drop a pin on the map first. Click where the spot is, or use "Find on map".');
        return;
      }
      const latitude = spotPinCoords.lat;
      const longitude = spotPinCoords.lng;

      try {
        const res = await fetch('api/stores/suggest.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, address, hours, price_range: priceRange, latitude, longitude })
        });
        const data = await res.json();

        if (!data.success) {
          alert(data.error || 'Could not submit that spot.');
          return;
        }
        resetSpotForm();
        closeSuggestSpotModal();
        await loadStores();
        alert(`Thanks! "${data.store.name}" was added to the map for other thrifters to find.`);
      } catch (err) {
        alert('Could not reach the server. Is your PHP backend running?');
      }
    });

    /* -------- RATE THIS SPOT MODAL -------- */
    const rateSpotModal = document.getElementById('rate-spot-modal');
    const rateSpotForm = document.getElementById('rate-spot-form');
    const rateSpotNameEl = document.getElementById('rate-spot-name');
    const starButtons = document.querySelectorAll('#star-picker .star-btn');
    let selectedStars = 0;
    let ratingTargetStoreId = null;

    function setStarDisplay(value) {
      selectedStars = value;
      starButtons.forEach(btn => btn.classList.toggle('filled', Number(btn.dataset.star) <= value));
    }
    starButtons.forEach(btn => {
      btn.addEventListener('click', () => setStarDisplay(Number(btn.dataset.star)));
    });

    function openRateSpotModal(storeId) {
      const store = currentStores.find(s => s.id === storeId);
      if (!store) return;
      ratingTargetStoreId = storeId;
      rateSpotNameEl.textContent = store.name;
      rateSpotForm.reset();
      setStarDisplay(0);
      setModalOpen(rateSpotModal, true);
    }
    function closeRateSpotModal() { setModalOpen(rateSpotModal, false); }
    document.getElementById('rate-spot-close').addEventListener('click', closeRateSpotModal);
    document.getElementById('rate-spot-cancel').addEventListener('click', closeRateSpotModal);
    rateSpotModal.addEventListener('click', (e) => { if (e.target === rateSpotModal) closeRateSpotModal(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && rateSpotModal.classList.contains('active')) closeRateSpotModal();
    });

    rateSpotForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (selectedStars === 0) {
        alert('Pick at least one star before submitting.');
        return;
      }
      const comment = document.getElementById('rate-comment').value.trim();
      const visibility = document.querySelector('input[name="rating-visibility"]:checked').value;
      const isAnonymous = visibility === 'anonymous';

      try {
        const res = await fetch('api/stores/rate.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ store_id: ratingTargetStoreId, stars: selectedStars, comment, anonymous: isAnonymous })
        });
        const data = await res.json();

        if (!data.success) {
          alert(data.error || 'Could not submit your rating.');
          return;
        }

        closeRateSpotModal();
        await loadStores();
        alert('Thanks for rating this spot!');
      } catch (err) {
        alert('Could not reach the server. Is your PHP backend running?');
      }
    });

    showLoadingState();
    initLocation();

    // Fix Leaflet's grey-tile bug: any time we re-show this view, make sure
    // the map recalculates its size (needed because it was first drawn
    // while a sibling view may have affected layout).
    views['find-a-store'].onShow = () => setTimeout(() => map.invalidateSize(), 100);
  }

  /* ==========================================================================
     7. COMMUNITY FEED — lazily initialized on first visit
     ========================================================================== */
      function initCommunityFeed() {
    const grid = document.getElementById('haul-masonry');
    const noHaulsMsg = document.getElementById('no-hauls');
    const pillsContainer = document.getElementById('feed-filter-pills');
    let activeFilter = 'all';
    let currentHauls = [];
    let pollTimer = null;

    async function fetchAndRenderHauls(showLoadingState = true) {
      if (showLoadingState) {
        grid.innerHTML = '<p class="no-results">Loading hauls…</p>';
      }
      try {
        const res = await fetch(`api/hauls/list.php?filter=${encodeURIComponent(activeFilter)}`);
        const data = await res.json();
        const newHauls = data.hauls || [];

        // Skip the re-render entirely if nothing actually changed — avoids
        // wiping out hover states / scroll position every poll cycle for no reason.
        const changed = JSON.stringify(newHauls.map(h => h.id)) !== JSON.stringify(currentHauls.map(h => h.id));
        currentHauls = newHauls;
        if (changed || showLoadingState) {
          renderHauls();
        }
      } catch (err) {
        if (showLoadingState) {
          grid.innerHTML = '<p class="no-results">Could not load the feed. Is your PHP backend running?</p>';
        }
        // Silent on background poll failures — don't interrupt the user
        // with an error every few seconds if the connection blips.
      }
    }

    function renderHauls() {
      grid.innerHTML = '';
      currentHauls.forEach(h => {
        const height = 220 + Math.floor(Math.random() * 240);
        const mediaHtml = h.image_path
          ? `<img class="haul-fill" src="${h.image_path}" alt="${h.item_name}" style="height:${height}px; object-fit:cover;">`
          : `<div class="haul-fill" style="height:${height}px;"></div>`;
        const card = document.createElement('div');
        card.className = 'haul-card';
        card.innerHTML = `
          ${mediaHtml}
          <div class="haul-caption">
            @${h.username} &middot; ${h.price !== null ? '₱' + h.price.toFixed(0) : 'Price N/A'}
            <span>${h.item_name}${h.store_name ? ' · ' + h.store_name : ''}</span>
          </div>`;
        grid.appendChild(card);
      });
      noHaulsMsg.classList.toggle('hidden', currentHauls.length > 0);
    }

    function startPolling() {
      stopPolling();
      pollTimer = setInterval(() => fetchAndRenderHauls(false), 8000); // check every 8s
    }
    function stopPolling() {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
    }

    fetchAndRenderHauls();
    startPolling();

    views['community-feed'].refreshHauls = () => fetchAndRenderHauls(false);
    // Pause polling while this view isn't showing, resume when it's shown again
    views['community-feed'].onShow = () => { fetchAndRenderHauls(false); startPolling(); };

    pillsContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.pill');
      if (!btn) return;

      pillsContainer.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      fetchAndRenderHauls();
    });

    document.getElementById('add-haul-btn').addEventListener('click', () => {
      openPostHaulModal();
    });
  }

  /* ==========================================================================
     8. NOTIFICATIONS — lazily initialized on first visit
     ========================================================================== */
    function initNotifications() {
    let notifications = [];

    const listEl = document.getElementById('notif-list');
    const noNotifsMsg = document.getElementById('no-notifs');
    const markAllBtn = document.getElementById('mark-all-read-btn');
    const pillsContainer = document.getElementById('notif-filter-pills');

    let activeFilter = 'all';
    let pollTimer = null;

    function timeAgo(dateString) {
      const then = new Date(dateString.replace(' ', 'T'));
      const seconds = Math.floor((Date.now() - then.getTime()) / 1000);
      if (seconds < 60) return 'Just now';
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes}m ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h ago`;
      return `${Math.floor(hours / 24)}d ago`;
    }

    async function fetchNotifications(showLoading = true) {
      if (showLoading) listEl.innerHTML = '<p class="no-results">Loading notifications…</p>';
      try {
        const res = await fetch('api/notifications/list.php');
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Failed to load notifications.');

        const changed = JSON.stringify(data.notifications.map(n => [n.id, n.is_read])) !==
                         JSON.stringify(notifications.map(n => [n.id, n.is_read]));
        notifications = data.notifications;
        if (changed || showLoading) render();
      } catch (err) {
        if (showLoading) {
          listEl.innerHTML = `<p class="no-results">Could not load notifications — ${err.message}</p>`;
        }
      }
    }

    function render() {
      listEl.innerHTML = '';
      const filtered = notifications.filter(n => activeFilter === 'all' || n.type === activeFilter);
      noNotifsMsg.classList.toggle('hidden', filtered.length > 0);

      filtered.forEach(n => {
        const item = document.createElement('div');
        item.className = 'notif-item' + (!n.is_read ? ' unread' : '');
        item.dataset.id = n.id;
        const isSystem = n.type === 'system';
        const actor = n.actor_username || 'UkayFinds';
        item.innerHTML = `
          <span class="notif-dot"></span>
          <div class="notif-avatar${isSystem ? ' notif-avatar-system' : ''}">${isSystem ? '★' : actor.charAt(0).toUpperCase()}</div>
          <div class="notif-body">
            <p class="notif-text">${isSystem ? '' : `<strong>@${actor}</strong> `}${n.message}</p>
            <p class="notif-location">${n.location_label || ''}</p>
          </div>
          <div class="notif-right">
            <span class="notif-time">${timeAgo(n.created_at)}</span>
            <div class="notif-thumb"></div>
          </div>`;
        item.addEventListener('click', () => markAsRead(n.id));
        listEl.appendChild(item);
      });

      updateMarkAllState();
    }

    async function markAsRead(id) {
      const n = notifications.find(n => n.id === id);
      if (!n || n.is_read) return;
      n.is_read = true;
      render();
      try {
        await fetch('api/notifications/mark_read.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id })
        });
      } catch (err) { /* next poll resyncs the real state */ }
    }

    function updateMarkAllState() {
      markAllBtn.disabled = !notifications.some(n => !n.is_read);
    }

    markAllBtn.addEventListener('click', async () => {
      notifications.forEach(n => n.is_read = true);
      render();
      try {
        await fetch('api/notifications/mark_read.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
      } catch (err) {}
    });

    function startPolling() {
      stopPolling();
      pollTimer = setInterval(() => fetchNotifications(false), 5000);
    }
    function stopPolling() {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
    }

    fetchNotifications();
    startPolling();
    views['notifications'].onShow = () => { fetchNotifications(false); startPolling(); };

    const allPill = pillsContainer.querySelector('.pill[data-filter="all"]');
    const dropdownBtn = document.getElementById('filter-dropdown-btn');
    const dropdownMenu = document.getElementById('filter-dropdown-menu');

    allPill.addEventListener('click', () => {
      activeFilter = 'all';
      allPill.classList.add('active');
      dropdownMenu.querySelectorAll('.dropdown-item').forEach(b => b.classList.remove('active'));
      dropdownBtn.classList.remove('active');
      render();
    });

    setupDropdown(dropdownBtn, dropdownMenu, (item) => {
      activeFilter = item.dataset.filter;
      allPill.classList.remove('active');
      dropdownMenu.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      dropdownBtn.classList.add('active');
      render();
    });
  }

  /* ==========================================================================
     9. PROFILE — lazily initialized on first visit
     ========================================================================== */
  function initProfile(opts) {

    // Overwrite the static placeholder profile card with the real logged-in user
    if (currentUser) {
      const displayName = currentUser.display_name || currentUser.username;
      document.getElementById('profile-name').textContent = displayName;
      document.getElementById('profile-handle').textContent = '@' + currentUser.username;
      document.getElementById('profile-location').textContent = currentUser.location || 'Location not set';
      document.getElementById('profile-bio').textContent = currentUser.bio || 'No bio yet.';
      document.querySelector('.profile-avatar').textContent = displayName.charAt(0).toUpperCase();
    }

    // Fetch real stats (hauls posted, likes received, spots saved) instead
    // of the static placeholder numbers baked into the HTML.
     function loadStats() {
      fetch('api/profile/stats.php')
        .then(res => res.json())
        .then(data => {
          if (!data.success) return;
          document.getElementById('stat-hauls-count').textContent = formatStatCount(data.hauls_count);
          document.getElementById('stat-likes-count').textContent = formatStatCount(data.likes_count);
          document.getElementById('stat-saved-count').textContent = formatStatCount(data.saved_count);
        })
        .catch(() => { /* leave the "–" placeholders if this fails */ });
    }
    loadStats();

    let showcaseItems = []; // populated from the database by renderShowcase(), not hardcoded
    let savedSpots = [];
    let savedSort = 'nearby';

    const grid = document.getElementById('profile-masonry');
    const savedPanel = document.getElementById('saved-spots-panel');
    const savedListEl = document.getElementById('saved-spots-list');
    const savedCountText = document.getElementById('saved-spots-count-text');
    const noItemsMsg = document.getElementById('no-items');
    const tabsContainer = document.getElementById('profile-tabs');

    const showcasePanel = document.getElementById('showcase-panel');
    const showcaseEmpty = document.getElementById('showcase-empty');
    const showcaseGrid = document.getElementById('showcase-masonry');

    const draftsPanel = document.getElementById('drafts-panel');
    const draftsListEl = document.getElementById('drafts-list');
    const noDraftsMsg = document.getElementById('no-drafts');

    let activeTab = 'hauls';

    function render() {
      grid.classList.toggle('hidden', activeTab !== 'hauls');
      savedPanel.classList.toggle('hidden', activeTab !== 'spots');
      showcasePanel.classList.toggle('hidden', activeTab !== 'showcase');
      draftsPanel.classList.toggle('hidden', activeTab !== 'drafts');
      // The generic "Nothing here yet" message only belongs to Hauls / Saved Spots
      if (activeTab === 'showcase' || activeTab === 'drafts') noItemsMsg.classList.add('hidden');

      if (activeTab === 'hauls') {
        renderHauls();
      } else if (activeTab === 'spots') {
        renderSavedSpots();
      } else if (activeTab === 'showcase') {
        renderShowcase();
      } else {
        renderDrafts();
      }
    }

    async function renderHauls() {
      grid.innerHTML = '<p class="no-results">Loading your hauls…</p>';
      try {
        const res = await fetch('api/hauls/list.php?mine=1');
        const data = await res.json();
        const myHauls = data.hauls || [];

        grid.innerHTML = '';
        noItemsMsg.classList.toggle('hidden', myHauls.length > 0);

        myHauls.forEach(h => {
          const height = 220 + Math.floor(Math.random() * 240);
          const mediaHtml = h.image_path
            ? `<img class="item-fill" src="${h.image_path}" alt="${h.item_name}" style="height:${height}px; object-fit:cover;">`
            : `<div class="item-fill" style="height:${height}px;"></div>`;
          const card = document.createElement('div');
          card.className = 'profile-card-item';
          card.innerHTML = `
            ${mediaHtml}
            <div class="item-caption">
              ${h.item_name}
              <span>${h.price !== null ? '₱' + h.price.toFixed(0) : 'Price N/A'}</span>
            </div>`;
          grid.appendChild(card);
        });
      } catch (err) {
        grid.innerHTML = '<p class="no-results">Could not load your hauls.</p>';
      }
    }

    async function renderSavedSpots() {
      savedListEl.innerHTML = '<p class="no-results">Loading saved spots…</p>';
      try {
        const res = await fetch('api/saved-spots/list.php');
        const data = await res.json();
        savedSpots = data.spots || [];
                
        if (savedSort === 'rating') savedSpots.sort((a, b) => b.rating - a.rating);

        savedListEl.innerHTML = '';
        noItemsMsg.classList.toggle('hidden', savedSpots.length > 0);
        savedCountText.textContent = `${savedSpots.length} Spot${savedSpots.length !== 1 ? 's' : ''} Found`;

        savedSpots.forEach(spot => {
          const ratingLabel = spot.rating_count > 0 ? spot.rating.toFixed(1) : 'New';
          const card = document.createElement('div');
          card.className = 'saved-spot-card';
          card.dataset.id = spot.id;
          card.innerHTML = `
            <div class="saved-spot-thumb">${spot.name.charAt(0)}</div>
            <div class="saved-spot-info">
              <div class="saved-spot-top">
                <h4>${spot.name}</h4>
                <div class="rating-menu">
                  <span class="rating">${ratingLabel}</span>
                  <button type="button" class="card-menu-btn" aria-label="More options">&#8942;</button>
                </div>
              </div>
              <p class="distance">${spot.address || ''}</p>
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
      } catch (err) {
        savedListEl.innerHTML = '<p class="no-results">Could not load saved spots.</p>';
      }
    }

    async function unsaveSpot(id) {
      try {
        await fetch('api/saved-spots/toggle.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ store_id: id })
        });
      } catch (err) { /* fall through to re-render anyway; next load will resync */ }
      renderSavedSpots();
    }

    async function renderShowcase() {
      try {
        const res = await fetch('api/showcase/list.php');
        const data = await res.json();
        showcaseItems = data.listings || [];
      } catch (err) {
        showcaseItems = [];
      }

      const isEmpty = showcaseItems.length === 0;
      showcaseEmpty.classList.toggle('hidden', !isEmpty);
      showcaseGrid.classList.toggle('hidden', isEmpty);

      if (isEmpty) return;

      showcaseGrid.innerHTML = '';
      showcaseItems.forEach(item => {
        const height = 220 + Math.floor(Math.random() * 200); // no real images yet
        const displayPrice = item.selling_method === 'bidding'
          ? `Starting at ₱${item.bid_start_price.toFixed(0)} (+₱${item.bid_increment.toFixed(0)})`
          : `${item.selling_method.charAt(0).toUpperCase() + item.selling_method.slice(1)} at ₱${(item[item.selling_method + '_price']).toFixed(0)}`;

        const mediaHtml = item.image_path
          ? `<img class="item-fill" src="${item.image_path}" alt="${item.item_name}" style="height:${height}px; object-fit:cover;">`
          : `<div class="item-fill" style="height:${height}px;"></div>`;

        const card = document.createElement('div');
        card.className = 'showcase-item';
        card.innerHTML = `
          <span class="showcase-method-badge showcase-method-${item.selling_method}">${item.selling_method}</span>
          ${mediaHtml}
          <div class="item-caption">
            ${item.item_name}
            <span>${displayPrice}</span>
          </div>`;
        showcaseGrid.appendChild(card);
      });
    }

        async function renderDrafts() {
      draftsListEl.innerHTML = '<p class="no-results">Loading drafts…</p>';
      try {
        const res = await fetch('api/drafts/list.php');
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Failed to load drafts.');

        const drafts = [
          ...data.hauls.map(d => ({ ...d, type: 'haul' })),
          ...data.showcase.map(d => ({ ...d, type: 'showcase' }))
        ].sort((a, b) => b.created_at.localeCompare(a.created_at));

        draftsListEl.innerHTML = '';
        noDraftsMsg.classList.toggle('hidden', drafts.length > 0);

        drafts.forEach(d => {
          const thumb = d.image_path
            ? `<img class="draft-thumb" src="${escapeHtml(d.image_path)}" alt="">`
            : `<div class="draft-thumb"></div>`;
          const card = document.createElement('div');
          card.className = 'draft-card';
          card.innerHTML = `
            ${thumb}
            <div class="draft-info">
              <span class="draft-type">${d.type === 'haul' ? 'Haul draft' : 'Showcase draft'}</span>
              <p class="draft-title${d.item_name ? '' : ' untitled'}">${d.item_name ? escapeHtml(d.item_name) : 'Untitled draft'}</p>
              <p class="draft-meta">Saved ${formatTimeAgo(d.created_at)}</p>
            </div>
            <div class="draft-actions">
              <button type="button" class="draft-btn primary" data-action="edit">Continue</button>
              <button type="button" class="draft-btn danger" data-action="delete">Delete</button>
            </div>`;

          card.querySelector('[data-action="edit"]').addEventListener('click', () => {
            if (d.type === 'haul') openHaulDraft(d); else openShowcaseDraft(d);
          });
          card.querySelector('[data-action="delete"]').addEventListener('click', async () => {
            if (!confirm('Delete this draft? This can\'t be undone.')) return;
            try {
              const r = await fetch('api/drafts/delete.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: d.type, id: d.id })
              });
              const out = await r.json();
              if (!out.success) { alert(out.error || 'Could not delete that draft.'); return; }
              renderDrafts();
            } catch (err) {
              alert('Could not reach the server. Is your PHP backend running?');
            }
          });
          draftsListEl.appendChild(card);
        });
      } catch (err) {
        draftsListEl.innerHTML = `<p class="no-results">Could not load drafts: ${escapeHtml(err.message)}</p>`;
      }
    }

    /* -------- POST TO SHOWCASE MODAL --------
       Lives inside initProfile (not shared at the top level like the Post
       Haul modal) because showcaseItems only exists here — no other view
       needs to read or write it. */
    const showcaseModal = document.getElementById('post-showcase-modal');
    const showcaseForm = document.getElementById('post-showcase-form');
    const showcaseMediaInput = document.getElementById('showcase-media-input');
    const showcaseDropzone = document.getElementById('showcase-dropzone');
    const showcaseDropzoneBody = document.getElementById('showcase-dropzone-body');
    const methodPills = document.querySelectorAll('#selling-method-group .method-pill');
    const methodFieldPanels = {
      bidding: document.getElementById('method-fields-bidding'),
      lock: document.getElementById('method-fields-lock'),
      grab: document.getElementById('method-fields-grab'),
      mine: document.getElementById('method-fields-mine')
    };
    const methodHints = {
      bidding: 'Buyers place increasing bids until the highest offer wins.',
      lock: 'One buyer pays the Lock price to reserve the item for pickup or payment.',
      grab: 'First buyer to pay the Grab price gets the item — no waiting.',
      mine: 'Buyers claim it by paying the Mine price — first valid claim wins.'
    };
    const methodHintEl = document.getElementById('method-hint');
    let selectedMethod = 'bidding';
    let editingShowcaseDraftId = null;
    let editingShowcaseDraftImage = null;

        // ---- Preview + Specific Details + Tag Thrift Spot ----
    const showcasePreviewMedia = document.getElementById('showcase-preview-media');
    const showcaseDetailsToggle = document.getElementById('showcase-specific-details-toggle');
    const showcaseDetailsPanel = document.getElementById('showcase-specific-details-panel');
    const showcaseSizeMenu = document.getElementById('showcase-size-dropdown-menu');
    const showcaseLocationMenu = document.getElementById('showcase-location-dropdown-menu');
    let selectedShowcaseSize = '';
    let selectedShowcaseLocation = '';

    showcaseDetailsToggle.addEventListener('click', () => {
      const opening = !showcaseDetailsPanel.classList.contains('open');
      showcaseDetailsPanel.classList.toggle('open', opening);
      showcaseDetailsToggle.classList.toggle('open', opening);
    });

    function setShowcaseSize(value) {
      selectedShowcaseSize = value || '';
      document.getElementById('showcase-size-label').textContent = value || 'Select size';
      showcaseSizeMenu.querySelectorAll('.dropdown-item').forEach(i =>
        i.classList.toggle('active', !!value && i.dataset.value === value));
    }
    function setShowcaseLocation(value) {
      selectedShowcaseLocation = value || '';
      document.getElementById('showcase-location-label').textContent = value || 'Select Location';
      showcaseLocationMenu.querySelectorAll('.dropdown-item').forEach(i =>
        i.classList.toggle('active', !!value && i.dataset.value === value));
      updateShowcasePreview();
    }

    storeLocations.forEach(store => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'dropdown-item';
      item.dataset.value = store.name;
      item.textContent = store.name;
      showcaseLocationMenu.appendChild(item);
    });
    setupDropdown(document.getElementById('showcase-size-dropdown-btn'), showcaseSizeMenu,
      (item) => setShowcaseSize(item.dataset.value));
    setupDropdown(document.getElementById('showcase-location-dropdown-btn'), showcaseLocationMenu,
      (item) => setShowcaseLocation(item.dataset.value));

    function updateShowcasePreview() {
      const val = (id) => document.getElementById(id).value.trim();
      document.getElementById('showcase-preview-name').textContent = val('showcase-item-name') || 'Item name';
      document.getElementById('showcase-preview-caption').textContent = val('showcase-caption') || 'Your description will show up here...';

      let price = '';
      if (selectedMethod === 'bidding') {
        if (val('bid-start-price')) price = `From ₱${val('bid-start-price')}`;
      } else if (val(`${selectedMethod}-price`)) {
        price = `₱${val(`${selectedMethod}-price`)}`;
      }
      document.getElementById('showcase-preview-price').textContent = price;

      const badge = document.getElementById('showcase-preview-badge');
      badge.textContent = selectedMethod;
      badge.className = 'showcase-method-badge showcase-method-' + selectedMethod;

      document.getElementById('showcase-preview-location-text').textContent = selectedShowcaseLocation;
      document.getElementById('showcase-preview-location').classList.toggle('hidden', !selectedShowcaseLocation);
    }
    ['showcase-item-name', 'showcase-caption', 'bid-start-price', 'bid-increment', 'lock-price', 'grab-price', 'mine-price']
      .forEach(id => document.getElementById(id).addEventListener('input', updateShowcasePreview));

    function setSellingMethod(method) {
      selectedMethod = method;
      methodPills.forEach(p => p.classList.toggle('active', p.dataset.method === method));
      Object.keys(methodFieldPanels).forEach(k => methodFieldPanels[k].classList.toggle('hidden', k !== method));
      methodHintEl.textContent = methodHints[method];
      updateShowcasePreview();
    }

    methodPills.forEach(btn => {
      btn.addEventListener('click', () => setSellingMethod(btn.dataset.method));
    });

    function resetShowcaseDropzone() {
      showcaseMediaInput.value = '';
      showcaseDropzoneBody.innerHTML = `
        <div class="haul-dropzone-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 16V4M12 4l-4 4M12 4l4 4"/><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>
        </div>
        <p class="haul-dropzone-text">Click or drag a photo to upload<br><span>(PNG, JPG)</span></p>`;
    }

    function previewShowcaseFile(file) {
      if (!file || !file.type.startsWith('image/')) return;
      const url = URL.createObjectURL(file);
      setPreviewMedia(showcasePreviewMedia, url);
      showcaseDropzoneBody.innerHTML = `<img class="haul-dropzone-preview" src="${url}" alt="Selected item photo"><span class="haul-dropzone-filename">${file.name}</span>`;
    }

    showcaseMediaInput.addEventListener('change', () => previewShowcaseFile(showcaseMediaInput.files[0]));
    ['dragover', 'dragleave', 'drop'].forEach(evt => {
      showcaseDropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        showcaseDropzone.classList.toggle('dragover', evt === 'dragover');
        if (evt === 'drop' && e.dataTransfer.files[0]) {
          showcaseMediaInput.files = e.dataTransfer.files;
          previewShowcaseFile(e.dataTransfer.files[0]);
        }
      });
    });

    function openPostShowcaseModal() { setModalOpen(showcaseModal, true); }

    function resetShowcaseForm() {
      showcaseForm.reset();
      resetShowcaseDropzone();
      setSellingMethod('bidding');
      setShowcaseSize('');
      setShowcaseLocation('');
      showcaseDetailsPanel.classList.remove('open');
      showcaseDetailsToggle.classList.remove('open');
      editingShowcaseDraftId = null;
      editingShowcaseDraftImage = null;
      setPreviewMedia(showcasePreviewMedia, null);
      updateShowcasePreview();
    }

    function closePostShowcaseModal() {
      setModalOpen(showcaseModal, false);
      if (editingShowcaseDraftId !== null) resetShowcaseForm();
    }

    // These three were missing: the X, clicking outside, and Escape never closed this modal.
    document.getElementById('post-showcase-close').addEventListener('click', closePostShowcaseModal);
    showcaseModal.addEventListener('click', (e) => { if (e.target === showcaseModal) closePostShowcaseModal(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && showcaseModal.classList.contains('active')) closePostShowcaseModal();
    });

    function openShowcaseDraft(d) {
      resetShowcaseForm();
      editingShowcaseDraftId = d.id;
      editingShowcaseDraftImage = d.image_path || null;
      document.getElementById('showcase-item-name').value = d.item_name || '';
      document.getElementById('showcase-caption').value = d.description || '';
      setSellingMethod(d.selling_method || 'bidding');
      const setVal = (id, v) => { document.getElementById(id).value = v !== null && v !== undefined ? v : ''; };
      setVal('bid-start-price', d.bid_start_price);
      setVal('bid-increment', d.bid_increment);
      setVal('lock-price', d.lock_price);
      setVal('grab-price', d.grab_price);
      setVal('mine-price', d.mine_price);
      setShowcaseSize(d.size);
      setShowcaseLocation(d.store_name);
      setVal('showcase-color', d.color);
      setVal('showcase-fabric', d.fabric);
      if (d.size || d.color || d.fabric) {
        showcaseDetailsPanel.classList.add('open');
        showcaseDetailsToggle.classList.add('open');
      }
      if (d.image_path) {
        showcaseDropzoneBody.innerHTML = `<img class="haul-dropzone-preview" src="${escapeHtml(d.image_path)}" alt="Current photo"><span class="haul-dropzone-filename">Current photo (choose a file to replace it)</span>`;
        setPreviewMedia(showcasePreviewMedia, d.image_path);
      }
      updateShowcasePreview();
      openPostShowcaseModal();
    }

    function readPrice(id) {
      const val = parseFloat(document.getElementById(id).value);
      return isNaN(val) || val < 0 ? null : val;
    }

    async function submitShowcase(status) {
      const isDraft = status === 'draft';
      const name = document.getElementById('showcase-item-name').value.trim();
      const hasImage = !!showcaseMediaInput.files[0] || !!editingShowcaseDraftImage;

      if (isDraft && !name && !hasImage) {
        showToast('Add a photo or an item name to save a draft.', 'error');
        return;
      }
      if (!isDraft && !name) {
        alert('Give your listing a name first.');
        return;
      }

      const formData = new FormData();
      formData.append('status', isDraft ? 'draft' : 'active');
      formData.append('item_name', name);
      formData.append('description', document.getElementById('showcase-caption').value.trim());
      formData.append('selling_method', selectedMethod);
      formData.append('size', selectedShowcaseSize || '');
      formData.append('color', document.getElementById('showcase-color').value.trim());
      formData.append('fabric', document.getElementById('showcase-fabric').value.trim());
      formData.append('store_name', selectedShowcaseLocation || '');
      if (editingShowcaseDraftId !== null) formData.append('draft_id', editingShowcaseDraftId);

      if (selectedMethod === 'bidding') {
        const start = readPrice('bid-start-price');
        const increment = readPrice('bid-increment');
        if (!isDraft && (start === null || increment === null)) {
          alert('Enter both a starting price and a bid increment.');
          return;
        }
        if (start !== null) formData.append('bid_start_price', start);
        if (increment !== null) formData.append('bid_increment', increment);
      } else {
        const price = readPrice(`${selectedMethod}-price`);
        if (!isDraft && price === null) {
          alert(`Enter a ${selectedMethod} price.`);
          return;
        }
        if (price !== null) formData.append(`${selectedMethod}_price`, price);
      }

      if (showcaseMediaInput.files[0]) formData.append('image', showcaseMediaInput.files[0]);

      const actionBtns = showcaseForm.querySelectorAll('.haul-form-actions button');
      actionBtns.forEach(b => b.disabled = true);

      try {
        const res = await fetch('api/showcase/create.php', { method: 'POST', body: formData });
        const data = await res.json();

        if (!data.success) {
          alert(data.error || (isDraft ? 'Could not save your draft.' : 'Could not post to showcase.'));
          return;
        }

        if (!isDraft) await renderShowcase();
        if (activeTab === 'drafts') renderDrafts();

        resetShowcaseForm();
        closePostShowcaseModal();
        showToast(isDraft ? 'Draft saved. Find it in My Drafts.' : 'Listed on your showcase!');
      } catch (err) {
        alert('Could not reach the server. Is your PHP backend running?');
      } finally {
        actionBtns.forEach(b => b.disabled = false);
      }
    }

    showcaseForm.addEventListener('submit', (e) => { e.preventDefault(); submitShowcase('active'); });
    document.getElementById('showcase-save-draft').addEventListener('click', () => submitShowcase('draft'));

    document.addEventListener('click', () => {
      document.querySelectorAll('.card-menu.open').forEach(m => m.classList.remove('open'));
    });

    setupDropdown(
      document.getElementById('saved-sort-dropdown-btn'),
      document.getElementById('saved-sort-dropdown-menu'),
        (item) => {
      document.querySelectorAll('#saved-sort-dropdown-menu .dropdown-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
      document.getElementById('saved-sort-value-label').textContent = item.textContent;
      savedSort = item.dataset.value;
      renderSavedSpots();
    });

    document.getElementById('showcase-add-card').addEventListener('click', openPostShowcaseModal);

    function setTab(tab) {
      activeTab = ['spots', 'showcase', 'drafts'].includes(tab) ? tab : 'hauls';
      tabsContainer.querySelectorAll('.pill').forEach(p => p.classList.toggle('active', p.dataset.tab === activeTab));
      render();
    }

    render();

    tabsContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.pill');
      if (!btn) return;
      setTab(btn.dataset.tab);
    });

    // Edit profile — toggles contenteditable fields
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

    document.getElementById('add-item-btn').addEventListener('click', () => {
      if (activeTab === 'showcase') {
        openPostShowcaseModal();
      } else {
        openPostHaulModal();
      }
    });

        // Only re-render the tab that's actually showing. They all share one
    // "Nothing here yet" message, so refreshing a hidden tab would flip it on.
    views['profile'].refreshHauls = () => { if (activeTab === 'hauls') renderHauls(); };
    views['profile'].refreshSavedSpots = () => { if (activeTab === 'spots') renderSavedSpots(); };
    views['profile'].refreshDrafts = () => { if (activeTab === 'drafts') renderDrafts(); };
    views['profile'].refreshStats = loadStats;

    // Allow the router to jump straight to a specific tab (used by the
    // header dropdown's "Saved Spots" / "My Shared Hauls" links).
    views['profile'].onShow = (nextOpts) => {
      if (nextOpts && nextOpts.tab) setTab(nextOpts.tab);
    };
    if (opts && opts.tab) {
      setTab(opts.tab);
    }
  }

});