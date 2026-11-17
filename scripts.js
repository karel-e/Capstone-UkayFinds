document.addEventListener('DOMContentLoaded', () => {

  /* ==========================================================================
     0. SHARED HELPERS (pin icon, store data)
     Used by the landing preview map AND the Find A Store dashboard map.
     ========================================================================== */
  const createCustomPin = () => L.divIcon({
    className: 'custom-leaflet-pin',
    html: `<div style="position:relative;width:32px;height:32px;filter:drop-shadow(0px 3px 6px rgba(0,0,0,0.3));cursor:pointer;">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="#C3291D" xmlns="http://www.w3.org/2000/svg">
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

  /* ---- Styled replacements for showAlert() / confirm() / prompt() ----
     showAlert(message, tone?, title?)  -> Promise, resolves when closed
     confirmDialog(message, opts?)      -> Promise<boolean>
     showDialog({...})                  -> the one dialog both are built on */
  let dialogEl = null, dialogDone = null, dialogReturnFocus = null;
  function buildDialog() {
    dialogEl = document.createElement('div');
    dialogEl.className = 'modal-overlay app-dialog-overlay';
    dialogEl.setAttribute('aria-hidden', 'true');
    dialogEl.innerHTML = `
      <div class="app-dialog" role="alertdialog" aria-modal="true" aria-labelledby="app-dialog-title" aria-describedby="app-dialog-msg">
        <div class="app-dialog-icon" aria-hidden="true"></div>
        <h3 id="app-dialog-title"></h3>
        <p id="app-dialog-msg"></p>
        <input type="text" class="app-dialog-input" readonly aria-label="Link">
        <div class="app-dialog-actions">
          <button type="button" class="btn-secondary app-dialog-cancel"></button>
          <button type="button" class="btn-primary app-dialog-ok"></button>
        </div>
      </div>`;
    document.body.appendChild(dialogEl);
    dialogEl.querySelector('.app-dialog-ok').addEventListener('click', () => closeDialog(true));
    dialogEl.querySelector('.app-dialog-cancel').addEventListener('click', () => closeDialog(false));
    dialogEl.addEventListener('click', (e) => { if (e.target === dialogEl) closeDialog(false); });
    // capture phase so Escape closes only this dialog, not the window behind it
    window.addEventListener('keydown', (e) => {
      if (!dialogEl.classList.contains('active')) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); closeDialog(false); }
      else if (e.key === 'Tab') {
        const btns = [...dialogEl.querySelectorAll('button')].filter(b => b.offsetParent !== null);
        const i = btns.indexOf(document.activeElement);
        e.preventDefault();
        btns[(i + (e.shiftKey ? -1 : 1) + btns.length) % btns.length].focus();
      }
    }, true);
  }
  function closeDialog(result) {
    if (!dialogEl || !dialogDone) return;
    const done = dialogDone;
    dialogDone = null;
    dialogEl.classList.remove('active');
    dialogEl.setAttribute('aria-hidden', 'true');
    if (dialogReturnFocus && document.contains(dialogReturnFocus)) dialogReturnFocus.focus();
    done(result);
  }
  function showDialog({ title = '', message = '', tone = 'info', confirmText = 'OK', cancelText = '', danger = false, input = '' } = {}) {
    if (!dialogEl) buildDialog();
    if (dialogDone) closeDialog(false);               // only one dialog at a time
    const icons = { success: '✓', error: '!', warn: '!', ask: '?', info: 'i' };
    const icon = dialogEl.querySelector('.app-dialog-icon');
    icon.textContent = icons[tone] || 'i';
    dialogEl.querySelector('.app-dialog').className = 'app-dialog tone-' + tone + (danger ? ' danger' : '');
    dialogEl.querySelector('#app-dialog-title').textContent = title;
    dialogEl.querySelector('#app-dialog-msg').textContent = message;
    const inp = dialogEl.querySelector('.app-dialog-input');
    inp.style.display = input ? 'block' : 'none';
    inp.value = input || '';
    const ok = dialogEl.querySelector('.app-dialog-ok');
    const cancel = dialogEl.querySelector('.app-dialog-cancel');
    ok.textContent = confirmText;
    cancel.textContent = cancelText;
    cancel.style.display = cancelText ? '' : 'none';
    dialogReturnFocus = document.activeElement;
    dialogEl.classList.add('active');
    dialogEl.setAttribute('aria-hidden', 'false');
    // a question starts on the safe button; an alert starts on OK
    setTimeout(() => { (danger && cancelText ? cancel : ok).focus(); if (input) { inp.focus(); inp.select(); } }, 30);
    return new Promise((resolve) => { dialogDone = resolve; });
  }
  function showAlert(message, tone, title) {
    if (!tone) tone = /could not|couldn't|failed|error|expired|reach the server|not support|too large|try again/i.test(String(message)) ? 'error' : 'warn';
    const titles = { error: 'Something went wrong', warn: 'Hold on', success: 'Done', info: 'Heads up' };
    return showDialog({ title: title || titles[tone] || 'Heads up', message: String(message), tone });
  }
  function confirmDialog(message, opts = {}) {
    const m = String(message);
    const danger = opts.danger !== undefined ? opts.danger : /^\s*(delete|remove|decline|cancel the)/i.test(m);
    const verb = /^\s*delete/i.test(m) ? 'Delete' : /^\s*remove/i.test(m) ? 'Remove' : /^\s*decline/i.test(m) ? 'Decline' : 'Yes, continue';
    return showDialog({
      title: opts.title || 'Are you sure?', message: m, tone: 'ask', danger,
      confirmText: opts.confirmText || verb, cancelText: opts.cancelText || 'Cancel'
    });
  }

  // Small badge: admins have checked this stall is real (reviewed = 1), or not yet
  function verifiedBadge(store) {
    return store.reviewed === 0
      ? '<span class="vbadge pending" title="Suggested by a thrifter, waiting for an admin to check it">Unverified</span>'
      : '<span class="vbadge ok" title="Checked by an admin">\u2713 Verified</span>';
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
        dashboard views. Each dashboard view is initialized lazily
        (only the first time it's shown), which also fixes Leaflet's
        "map renders blank inside a hidden container" problem.
     ========================================================================== */
  const landingView = document.getElementById('landing-view');
  const dashboardShell = document.getElementById('dashboard-shell');

  /* ---- Ukay Trail (5.7): stamps are collected by tapping "I'm here" at a stall ----
     The server checks the distance, the one-stamp-per-day rule and trail progress.
     Nothing here involves payment. */
  const stampedIds = new Set();      // stalls the person has stamped at least once
  let trailData = [];                // last answer from api/trail/mine.php

  function refreshStamps() {
    return apiFetch('api/trail/mine.php').then(r => r.json()).then(d => {
      if (d && d.success) {
        stampedIds.clear();
        (d.stamped_ids || []).forEach(id => stampedIds.add(Number(id)));
        trailData = d.trails || [];
      }
      return d;
    }).catch(() => null);
  }

  function checkInAt(store) {
    if (!navigator.geolocation) { showToast('Your browser cannot share your location.', 'error'); return; }
    showToast('Checking where you are\u2026');
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const res = await apiFetch('api/trail/checkin.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ store_id: store.id, lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy })
        });
        const data = await res.json();
        if (!data.success) { showToast(data.error || 'Could not stamp this stall.', 'error'); return; }
        stampedIds.add(Number(store.id));
        showToast(data.message);
        await refreshStamps();
        if (views['find-a-store'].inited && views['find-a-store'].refreshCards) views['find-a-store'].refreshCards();
        if (data.completed && data.completed.length) {
          showToast('You finished the ' + data.completed[0].name + '! Your reward code is ' + data.completed[0].code + '.');
          switchView('trail');
        } else if (views['trail'].inited && views['trail'].reload) {
          views['trail'].reload();
        }
      } catch (err) {
        showToast('Could not reach the server. Try again.', 'error');
      }
    }, () => showToast('We could not get your location. Allow location for this site and try again.', 'error'),
    { enableHighAccuracy: true, timeout: 10000 });
  }

  // Get Directions stays on this site: it opens the stall on the Find a Stall
  // map and draws the route from the visitor's position (see showRoute in
  // initFindAStore). Used by the Saved Stalls list in Profile too.
  function openDirections(place) {
    switchView('find-a-store');
    const finder = views['find-a-store'];
    if (finder.directionsTo) finder.directionsTo(place);
  }

  // 5.12: remember where the visitor was (only after the browser's own
  // location prompt was allowed), so we can tell them about new stalls near
  // them. Rounded on the server; at most once every 10 minutes.
  let lastLocationSave = 0;
  function saveMyLocation(lat, lng) {
    if (!currentUser || Date.now() - lastLocationSave < 10 * 60 * 1000) return;
    lastLocationSave = Date.now();
    apiFetch('api/profile/location.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lng })
    }).catch(() => {});
  }

  // The visitor's position, shared by every view (Feed "Near Me", Saved Spots
  // "Nearby"). askIfNeeded=false never triggers a browser permission prompt: it
  // only returns coordinates when we already have them or access was already
  // granted. Resolves to {lat, lng} or null.
  /* ---- Haul detail window (5.2): opened from feed cards and My Hauls ---- */
  const haulDetailModal = document.getElementById('haul-detail-modal');
  const haulDetailBody = document.getElementById('haul-detail-body');

  function closeHaulDetail() { setModalOpen(haulDetailModal, false); }
  document.getElementById('haul-detail-close').addEventListener('click', closeHaulDetail);
  haulDetailModal.addEventListener('click', (e) => { if (e.target === haulDetailModal) closeHaulDetail(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && haulDetailModal.classList.contains('active')) closeHaulDetail();
  });

  function formatHaulDate(dateString) {
    const d = new Date(String(dateString).replace(' ', 'T'));
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  // Like / unlike, shared by the feed cards and the detail window.
  // Returns {liked, like_count} or null if it failed.
  async function toggleHaulLike(haulId) {
    try {
      const res = await apiFetch('api/hauls/like.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ haul_id: haulId })
      });
      const data = await res.json();
      if (!data.success) { showToast(data.error || 'Could not save your like.', 'error'); return null; }
      return { liked: data.liked, like_count: data.like_count };
    } catch (err) {
      showToast('Could not reach the server. Try again.', 'error');
      return null;
    }
  }

  function likeLabel(count) {
    return count + ' like' + (count === 1 ? '' : 's');
  }

  /* ---- 5.5: three-dot menu on feed cards ---- */
  let savedHaulIds = new Set();
  async function loadSavedHaulIds() {
    try {
      const res = await apiFetch('api/saved-hauls/ids.php');
      const data = await res.json();
      if (data.success) savedHaulIds = new Set((data.ids || []).map(Number));
    } catch (err) { /* menu just shows "Save item" */ }
  }

  async function toggleSavedHaul(haulId) {
    try {
      const res = await apiFetch('api/saved-hauls/toggle.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ haul_id: haulId })
      });
      const data = await res.json();
      if (!data.success) { showToast(data.error || 'Could not update your saved items.', 'error'); return null; }
      if (data.saved) savedHaulIds.add(Number(haulId)); else savedHaulIds.delete(Number(haulId));
      if (views['profile'].inited && views['profile'].refreshSavedHauls) views['profile'].refreshSavedHauls();
      return data.saved;
    } catch (err) {
      showToast('Could not reach the server. Try again.', 'error');
      return null;
    }
  }

  async function shareHaul(haulId) {
    const url = location.origin + location.pathname + '#haul-' + haulId;
    if (navigator.share) {
      try { await navigator.share({ title: 'UkayFinds haul', url }); return; }
      catch (err) { if (err && err.name === 'AbortError') return; }
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast('Link copied.');
    } catch (err) {
      await showDialog({ title: 'Copy this link', message: 'Your browser blocked copying, so copy it from here:', input: url, confirmText: 'Done' });
    }
  }

  async function deleteHaulById(id) {
    if (!(await confirmDialog('Delete this haul? This can\'t be undone.'))) return;
    try {
      const res = await apiFetch('api/hauls/delete.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      if (!data.success) { showToast(data.error || 'Could not delete that haul.', 'error'); return; }
      showToast('Haul deleted.');
      if (views['community-feed'].inited && views['community-feed'].refreshHauls) views['community-feed'].refreshHauls();
      if (views['profile'].inited) {
        if (views['profile'].refreshHauls) views['profile'].refreshHauls();
        if (views['profile'].refreshStats) views['profile'].refreshStats();
        if (views['profile'].refreshSavedHauls) views['profile'].refreshSavedHauls();
      }
    } catch (err) {
      showToast('Could not reach the server. Try again.', 'error');
    }
  }

  // The Edit/Delete buttons are only a convenience: the server re-checks
  // ownership in update.php and delete.php.
  /* ---- Report a haul or a comment (the admin reviews these) ---- */
  const reportModal = document.getElementById('report-modal');
  let reportTarget = null;   // { type: 'haul' | 'comment', id }

  function openReport(type, id) {
    reportTarget = { type, id };
    document.getElementById('report-title').textContent = type === 'comment' ? 'Report this comment' : 'Report this haul';
    reportModal.querySelector('input[name="report-reason"][value="spam"]').checked = true;
    setModalOpen(reportModal, true);
  }
  function closeReport() { setModalOpen(reportModal, false); reportTarget = null; }
  document.getElementById('report-close').addEventListener('click', closeReport);
  document.getElementById('report-cancel').addEventListener('click', closeReport);
  reportModal.addEventListener('click', (e) => { if (e.target === reportModal) closeReport(); });
  document.getElementById('report-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!reportTarget) return;
    const reason = reportModal.querySelector('input[name="report-reason"]:checked').value;
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      const res = await apiFetch('api/reports/submit.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_type: reportTarget.type, target_id: reportTarget.id, reason })
      });
      const data = await res.json();
      showToast(data.success ? (data.message || 'Thanks. An admin will take a look.') : (data.error || 'Could not send the report.'),
                data.success ? 'success' : 'error');
      if (data.success || res.status === 409) closeReport();
    } catch (err) {
      showToast('Could not reach the server. Try again.', 'error');
    } finally {
      btn.disabled = false;
    }
  });

  function buildHaulMenu(h) {
    const mine = !!currentUser && h.username === currentUser.username;
    const wrap = document.createElement('div');
    wrap.className = 'haul-menu';
    wrap.innerHTML = `
      <button type="button" class="haul-menu-btn" aria-label="More options" aria-haspopup="true" aria-expanded="false">&#8942;</button>
      <div class="haul-menu-list" role="menu">
        <button type="button" role="menuitem" data-action="share">Share</button>
        <button type="button" role="menuitem" data-action="save">${savedHaulIds.has(Number(h.id)) ? 'Unsave item' : 'Save item'}</button>
        ${mine ? '<button type="button" role="menuitem" data-action="edit">Edit</button><button type="button" role="menuitem" data-action="delete" class="danger">Delete</button>' : ''}
        ${!mine && currentUser ? '<button type="button" role="menuitem" data-action="report" class="danger">Report</button>' : ''}
      </div>`;
    const btn = wrap.querySelector('.haul-menu-btn');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const opening = !wrap.classList.contains('open');
      document.querySelectorAll('.haul-menu.open').forEach(m => m.classList.remove('open'));
      wrap.classList.toggle('open', opening);
      btn.setAttribute('aria-expanded', opening ? 'true' : 'false');
    });
    wrap.querySelector('.haul-menu-list').addEventListener('click', async (e) => {
      e.stopPropagation();
      const item = e.target.closest('button[data-action]');
      if (!item) return;
      wrap.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
      const action = item.dataset.action;
      if (action === 'share') shareHaul(h.id);
      else if (action === 'save') {
        const saved = await toggleSavedHaul(h.id);
        if (saved !== null) {
          item.textContent = saved ? 'Unsave item' : 'Save item';
          showToast(saved ? 'Saved to your items.' : 'Removed from saved items.');
        }
      }
      else if (action === 'edit') openHaulEdit(h);
      else if (action === 'delete') deleteHaulById(h.id);
      else if (action === 'report') openReport('haul', h.id);
    });
    return wrap;
  }
  document.addEventListener('click', () => {
    document.querySelectorAll('.haul-menu.open').forEach(m => m.classList.remove('open'));
  });

  // landing.html#haul-12 opens that haul once you're signed in
  function openHaulFromHash() {
    const m = /^#haul-(\d+)$/.exec(location.hash);
    if (m) openHaulDetail(Number(m[1]));
  }

  // ---- Comments inside the detail window (5.4) ----
  function commentHtml(c) {
    return `<div class="haul-comment" data-id="${c.id}">
        <p><button type="button" class="user-link" data-username="${escapeHtml(c.username)}">@${escapeHtml(c.username)}</button> <span>${escapeHtml(formatTimeAgo(c.created_at))}</span></p>
        <p class="haul-comment-body">${escapeHtml(c.body)}</p>
        ${c.is_mine ? '<button type="button" class="haul-comment-delete" aria-label="Delete your comment">Delete</button>' : ''}
        ${!c.is_mine && currentUser ? '<button type="button" class="haul-comment-report" aria-label="Report this comment">Report</button>' : ''}
      </div>`;
  }

  async function setupHaulComments(haulId) {
    const section = haulDetailBody.querySelector('.haul-comments');
    const listEl = section.querySelector('.haul-comments-list');
    const titleEl = section.querySelector('.haul-comments-title');
    const form = section.querySelector('.haul-comment-form');
    const input = form.querySelector('input');
    let comments = [];

    function render() {
      titleEl.textContent = comments.length ? `Comments (${comments.length})` : 'Comments';
      listEl.innerHTML = comments.length
        ? comments.map(commentHtml).join('')
        : '<p class="haul-comments-empty">No comments yet. Be the first!</p>';
    }

    try {
      const res = await apiFetch('api/comments/list.php?haul_id=' + encodeURIComponent(haulId));
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Could not load comments.');
      comments = data.comments || [];
      render();
    } catch (err) {
      listEl.innerHTML = `<p class="haul-comments-empty">${escapeHtml(err.message)}</p>`;
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = input.value.trim();
      if (!body) return;
      const btn = form.querySelector('button');
      btn.disabled = true;
      try {
        const res = await apiFetch('api/comments/create.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ haul_id: haulId, body })
        });
        const data = await res.json();
        if (!data.success) { showToast(data.error || 'Could not post your comment.', 'error'); return; }
        comments.push(data.comment);
        input.value = '';
        render();
        listEl.scrollTop = listEl.scrollHeight;
      } catch (err) {
        showToast('Could not reach the server. Try again.', 'error');
      } finally {
        btn.disabled = false;
      }
    });

    listEl.addEventListener('click', async (e) => {
      const reportBtn = e.target.closest('.haul-comment-report');
      if (reportBtn) { openReport('comment', Number(reportBtn.closest('.haul-comment').dataset.id)); return; }
      const btn = e.target.closest('.haul-comment-delete');
      if (!btn) return;
      const id = Number(btn.closest('.haul-comment').dataset.id);
      if (!(await confirmDialog('Delete your comment?'))) return;
      try {
        const res = await apiFetch('api/comments/delete.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id })
        });
        const data = await res.json();
        if (!data.success) { showToast(data.error || 'Could not delete your comment.', 'error'); return; }
        comments = comments.filter(c => c.id !== id);
        render();
      } catch (err) {
        showToast('Could not reach the server. Try again.', 'error');
      }
    });
  }

  async function openHaulDetail(haulId) {
    haulDetailBody.innerHTML = '<p class="no-results haul-detail-loading">Loading…</p>';
    setModalOpen(haulDetailModal, true);
    try {
      const res = await apiFetch('api/hauls/get.php?id=' + encodeURIComponent(haulId));
      const data = await res.json();
      if (!data.success) {
        haulDetailBody.innerHTML = `<p class="no-results haul-detail-loading">${escapeHtml(data.error || 'Could not load this haul.')}</p>`;
        return;
      }
      const h = data.haul;
      const media = h.image_path
        ? `<img src="${escapeHtml(h.image_path)}" alt="${escapeHtml(h.item_name)}">`
        : '<div class="haul-detail-noimg">No photo</div>';
      const rows = [['Size', h.size], ['Color', h.color], ['Fabric', h.fabric]]
        .filter(r => r[1])
        .map(r => `<div class="haul-detail-row"><span>${r[0]}</span><strong>${escapeHtml(r[1])}</strong></div>`)
        .join('');
      const spot = h.store_id
        ? `<button type="button" class="haul-detail-spot" data-store-id="${h.store_id}" data-store-name="${escapeHtml(h.store_name || '')}">
             <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5" fill="#fff"/></svg>
             ${escapeHtml(h.store_name || 'View spot')} &rarr;</button>`
        : '';
      haulDetailBody.innerHTML = `
        <div class="haul-detail-media">${media}</div>
        <div class="haul-detail-info">
          <p class="haul-detail-user"><button type="button" class="user-link" data-username="${escapeHtml(h.username)}">@${escapeHtml(h.username)}</button> <span>&middot; ${escapeHtml(formatHaulDate(h.created_at))}</span></p>
          <p class="haul-detail-caption">${escapeHtml(h.item_name)}</p>
          <p class="haul-detail-price">${h.price !== null ? '₱' + h.price.toFixed(0) : 'Price not shared'}</p>
          ${rows ? `<div class="haul-detail-rows">${rows}</div>` : ''}
          ${spot}
          <button type="button" class="haul-detail-like${h.liked_by_me ? ' liked' : ''}" aria-pressed="${h.liked_by_me ? 'true' : 'false'}">
            <span class="heart">${h.liked_by_me ? '&#9829;' : '&#9825;'}</span> <span class="count">${likeLabel(h.like_count)}</span>
          </button>
          <div class="haul-comments">
            <h4 class="haul-comments-title">Comments</h4>
            <div class="haul-comments-list"><p class="haul-comments-empty">Loading comments…</p></div>
            <form class="haul-comment-form" novalidate>
              <input type="text" maxlength="300" placeholder="Add a comment…" aria-label="Add a comment">
              <button type="submit">Post</button>
            </form>
          </div>
        </div>`;
      setupHaulComments(h.id);
      const likeBtn = haulDetailBody.querySelector('.haul-detail-like');
      likeBtn.addEventListener('click', async () => {
        likeBtn.disabled = true;
        const result = await toggleHaulLike(h.id);
        likeBtn.disabled = false;
        if (!result) return;
        h.liked_by_me = result.liked;
        h.like_count = result.like_count;
        likeBtn.classList.toggle('liked', result.liked);
        likeBtn.setAttribute('aria-pressed', result.liked ? 'true' : 'false');
        likeBtn.querySelector('.heart').innerHTML = result.liked ? '&#9829;' : '&#9825;';
        likeBtn.querySelector('.count').textContent = likeLabel(result.like_count);
        // keep the feed behind the window in step
        if (views['community-feed'].inited && views['community-feed'].refreshHauls) views['community-feed'].refreshHauls();
      });
      const spotBtn = haulDetailBody.querySelector('.haul-detail-spot');
      if (spotBtn) {
        spotBtn.addEventListener('click', () => {
          closeHaulDetail();
          switchView('find-a-store');
          const finder = views['find-a-store'];
          if (finder.showStore) finder.showStore(spotBtn.dataset.storeId, spotBtn.dataset.storeName);
        });
      }
    } catch (err) {
      haulDetailBody.innerHTML = '<p class="no-results haul-detail-loading">Could not reach the server. Try again.</p>';
    }
  }

  let sharedCoords = null;
  function getUserCoords(askIfNeeded) {
    if (sharedCoords) return Promise.resolve(sharedCoords);
    if (!navigator.geolocation) return Promise.resolve(null);
    const locate = () => new Promise(resolve => {
      navigator.geolocation.getCurrentPosition(
        pos => {
          sharedCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          saveMyLocation(sharedCoords.lat, sharedCoords.lng);
          resolve(sharedCoords);
        },
        () => resolve(null),
        { timeout: 8000, maximumAge: 60000 }
      );
    });
    if (askIfNeeded || !navigator.permissions || !navigator.permissions.query) {
      return askIfNeeded ? locate() : Promise.resolve(null);
    }
    return navigator.permissions.query({ name: 'geolocation' })
      .then(p => (p.state === 'granted' ? locate() : null))
      .catch(() => null);
  }

  const views = {
    'find-a-store':   { el: document.getElementById('find-a-store-view'),   init: initFindAStore,   inited: false, onShow: null },
    'community-feed': { el: document.getElementById('community-feed-view'), init: initCommunityFeed, inited: false, onShow: null },
    'notifications':  { el: document.getElementById('notifications-view'),  init: initNotifications, inited: false, onShow: null },
    'profile':        { el: document.getElementById('profile-view'),        init: initProfile,       inited: false, onShow: null },
    'user-profile':   { el: document.getElementById('user-profile-view'),   init: initUserProfile,   inited: false, onShow: null },
    // --- new layout views ---
    'trail':          { el: document.getElementById('trail-view'),          init: initTrail,         inited: false, onShow: null },
    'fresh-bale':     { el: document.getElementById('fresh-bale-view'),     init: initFreshBale,     inited: false, onShow: null },
    'seller':         { el: document.getElementById('seller-view'),         init: initSeller,        inited: false, onShow: null },
    'admin':          { el: document.getElementById('admin-view'),          init: initAdmin,         inited: false, onShow: null }
  };

  let currentViewName = null;

  function switchView(name, opts) {
    if (!views[name]) return;
    // Tell the view we're leaving (e.g. stop its polling timer)
    if (currentViewName && currentViewName !== name && views[currentViewName].onHide) {
      views[currentViewName].onHide();
    }
    currentViewName = name;
    // The admin screen gets its own plain header (no shopper links), like the layout
    document.getElementById('dashboard-shell').classList.toggle('admin-mode', name === 'admin');
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

  /* ---- 5.15: usernames open that person's public page ---- */
  let userProfileFrom = 'community-feed';

  function openUserProfile(username) {
    if (!username) return;
    if (haulDetailModal.classList.contains('active')) closeHaulDetail();
    if (currentUser && currentUser.username === username) { switchView('profile'); return; }
    if (currentViewName && currentViewName !== 'user-profile') userProfileFrom = currentViewName;
    switchView('user-profile', { username });
  }

  function openStoreOnMap(id, name) {
    switchView('find-a-store');
    const finder = views['find-a-store'];
    if (finder.showStore) finder.showStore(id, name);
  }

  // Capture phase: runs before the card's own click handler, so tapping a
  // name opens the profile instead of the haul window behind it.
  document.addEventListener('click', (e) => {
    const link = e.target.closest('.user-link[data-username]');
    if (!link) return;
    e.preventDefault();
    e.stopPropagation();
    openUserProfile(link.dataset.username);
  }, true);

  function showDashboard(name, opts) {
    legalView.classList.add('hidden');
    landingView.classList.add('hidden');
    dashboardShell.classList.remove('hidden');
    switchView(name || 'find-a-store', opts);
  }

  function showLanding() {
    legalView.classList.add('hidden');
    dashboardShell.classList.add('hidden');
    landingView.classList.remove('hidden');
    window.scrollTo(0, 0);
  }

  /* ---- Privacy Policy / Terms of Service: open with #privacy or #terms ----
     They live inside this page so they share the site's styles. The Back button
     and the browser's own back both return to wherever the person was. */
  const legalView = document.getElementById('legal-view');
  const LEGAL_TITLES = { privacy: 'Privacy Policy', terms: 'Terms of Service' };
  let legalReturnTo = null;      // 'landing' | 'dashboard'
  let pageTitleBeforeLegal = document.title;

  function openLegal(which) {
    if (!legalReturnTo) {
      legalReturnTo = dashboardShell.classList.contains('hidden') ? 'landing' : 'dashboard';
      pageTitleBeforeLegal = document.title;
    }
    landingView.classList.add('hidden');
    dashboardShell.classList.add('hidden');
    legalView.classList.remove('hidden');
    legalView.querySelectorAll('[data-legal]').forEach(s => s.classList.toggle('hidden', s.dataset.legal !== which));
    document.title = LEGAL_TITLES[which] + ' - UkayFinds';
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }

  function closeLegal() {
    if (!legalReturnTo) return;
    legalView.classList.add('hidden');
    (legalReturnTo === 'dashboard' ? dashboardShell : landingView).classList.remove('hidden');
    legalReturnTo = null;
    document.title = pageTitleBeforeLegal;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }

  function syncLegalWithHash() {
    const m = /^#(privacy|terms)$/.exec(location.hash);
    if (m) openLegal(m[1]); else closeLegal();
  }

  window.addEventListener('hashchange', syncLegalWithHash);
  document.getElementById('legal-back').addEventListener('click', (e) => {
    e.preventDefault();
    history.replaceState(null, '', location.pathname + location.search);
    closeLegal();
  });
  syncLegalWithHash();   // opened straight from a link like landing.html#terms
  // One place that handles "your session is gone". Every logged-in API call
  // goes through this instead of plain fetch().
  let sessionEnding = false;
  async function apiFetch(url, options) {
    const res = await fetch(url, options);
    if (res.status === 401 && currentUser && !sessionEnding) {
      sessionEnding = true;
      currentUser = null;
      await showAlert('Your session expired. Please sign in again.', 'info', 'Session expired');
      location.reload(); // clears state and timers, and me.php sends us to the landing page
    }
    return res;
  }

  // ---- Live spot list for the "Tag Thrift Spot" dropdowns (ids, not names) ----
  let spotChoices = [];   // [{ id, name, address }]
  async function loadSpotChoices() {
    try {
      const res = await apiFetch('api/stores/list.php');
      const data = await res.json();
      if (data.success && Array.isArray(data.stores)) {
        spotChoices = data.stores
          .map(s => ({ id: s.id, name: s.name, address: s.address }))
          .sort((a, b) => a.name.localeCompare(b.name));
      }
    } catch (err) {
      // keep the previous list; the menu says so if it is empty
    }
  }
  // Two spots can share a name, so add the address to tell them apart.
  function spotLabel(spot) {
    const dupes = spotChoices.filter(s => s.name.toLowerCase() === spot.name.toLowerCase()).length > 1;
    return dupes && spot.address ? spot.name + ' \u00b7 ' + spot.address : spot.name;
  }
  // Small "Size M · olive · cotton · Spot" line for cards.
  function detailsHtml(item, withSpot) {
    const parts = [];
    if (item.size) parts.push('Size ' + item.size);
    if (item.color) parts.push(item.color);
    if (item.fabric) parts.push(item.fabric);
    if (withSpot && item.store_name) parts.push(item.store_name);
    return parts.length ? '<small class="card-details">' + escapeHtml(parts.join(' \u00b7 ')) + '</small>' : '';
  }
  function fillSpotMenu(menuEl, selectedId) {
    menuEl.innerHTML = '';
    if (!spotChoices.length) {
      const empty = document.createElement('button');
      empty.type = 'button';
      empty.className = 'dropdown-item';
      empty.disabled = true;
      empty.textContent = 'No spots available yet';
      menuEl.appendChild(empty);
      return;
    }
    spotChoices.forEach(spot => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'dropdown-item';
      item.dataset.value = String(spot.id);   // the id is what gets saved
      item.textContent = spotLabel(spot);
      if (selectedId && String(spot.id) === String(selectedId)) item.classList.add('active');
      menuEl.appendChild(item);
    });
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
    const dropdownAvatar = document.querySelector('.dropdown-avatar');
    if (dropdownAvatar) dropdownAvatar.textContent = label.charAt(0).toUpperCase();
    // The Admin dashboard link is only shown to admins (needs a "role" field from api/auth/me.php)
    const adminItem = document.getElementById('admin-link-item');
    if (adminItem) adminItem.classList.toggle('hidden', user.role !== 'admin');
  }

  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFormError(signupError);

    const username = document.getElementById('signup-username').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-confirm').value;
    const acceptTerms = document.getElementById('signup-terms').checked;

    if (!acceptTerms) {
      showFormError(signupError, 'Please agree to the Terms of Service and Privacy Policy to create an account.');
      return;
    }

    try {
      const res = await fetch('api/auth/register.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, confirm_password: confirmPassword, accept_terms: true })
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
      openHaulFromHash();
    } catch (err) {
      showFormError(signinError, 'Could not reach the server. Is your PHP backend running?');
    }
  });

  /* ==========================================================================
     5. SHARED AVATAR DROPDOWN + LOGOUT
        One instance now (the header lives outside the switchable views),
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
      await fetch('api/auth/logout.php', { method: 'POST' });
    } catch (err) {
      // Even if this request fails, still send them back to the landing
      // view client-side — worst case their session just lingers
      // server-side until it naturally expires.
    }
    location.reload();   // fresh page: stops all timers, clears cached views and currentUser
  });

  /* ==========================================================================
     5a. SESSION CHECK ON LOAD
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
        openHaulFromHash();
      }
    } catch (err) {
      // Backend not reachable — just stay on the landing page, same as
      // if the person had never logged in.
    }
  })();

  /* ==========================================================================
     5b. POST HAUL PAGE (dashboard-only, shared)
        Now a full page (#post-haul-view) instead of a modal. It is still reachable
        from Community Feed's "+", Profile's "+" and "Continue" on a draft, so it
        lives here at the top level (not inside one view's init function).
        Function names (openPostHaulModal, closePostHaulModal, openHaulDraft,
        openHaulEdit ...) are kept so the rest of scripts.js keeps working.
     ========================================================================== */
  const postHaulForm = document.getElementById('post-haul-form');
  const haulMediaInput = document.getElementById('haul-media-input');
  const haulDropzone = document.getElementById('haul-dropzone');
  const haulDropzoneBody = document.getElementById('haul-dropzone-body');
  let editingHaulDraftId = null;     // set while continuing a draft
  let editingHaulDraftImage = null;  // that draft's existing photo path, if any
  let editingHaulId = null;          // set while editing an already-published haul
  let postHaulReturnView = 'community-feed';   // where Back / a successful post goes

  // Register the page with the view router (switchView hides/shows it like the others)
  views['post-haul'] = {
    el: document.getElementById('post-haul-view'),
    init: () => {},
    inited: false,
    onShow: null,
    // Leaving the page mid-edit must not leave a half-edited draft in the "new haul" form
    onHide: () => { if (editingHaulDraftId !== null || editingHaulId !== null) resetHaulForm(); }
  };

  // ---- Specific Details popout (open by default on the page) ----
  const haulDetailsToggle = document.getElementById('haul-specific-details-toggle');
  const haulDetailsPanel = document.getElementById('haul-specific-details-panel');
  haulDetailsToggle.addEventListener('click', () => {
    const opening = !haulDetailsPanel.classList.contains('open');
    haulDetailsPanel.classList.toggle('open', opening);
    haulDetailsToggle.classList.toggle('open', opening);
  });

  // ---- Size dropdown: XXXS … XXXL, then Free size / Not specified / Other… ----
  const KNOWN_HAUL_SIZES = ['XXXS', 'XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'Free size', 'One Size'];  // 'One Size' kept so older hauls still load
  const haulSizeMenu = document.getElementById('haul-size-dropdown-menu');
  const haulSizeLabel = document.getElementById('haul-size-label');
  const haulSizeOther = document.getElementById('haul-size-other');
  let selectedHaulSize = '';   // '' (not specified) | a known size | '__other'

  function paintHaulSize(value, labelText) {
    selectedHaulSize = value;
    haulSizeLabel.textContent = labelText;
    haulSizeMenu.querySelectorAll('.dropdown-item').forEach(i =>
      i.classList.toggle('active', i.dataset.value === value && labelText !== 'Select size'));
    document.getElementById('haul-size-other-row').classList.toggle('hidden', value !== '__other');
  }
  setupDropdown(
    document.getElementById('haul-size-dropdown-btn'),
    haulSizeMenu,
    (item) => {
      paintHaulSize(item.dataset.value, item.dataset.value === '__other' ? 'Other' : item.textContent);
      if (item.dataset.value === '__other') haulSizeOther.focus();
      updateHaulPreview();
    }
  );
  haulSizeOther.addEventListener('input', updateHaulPreview);

  // The size string the server stores ('' when not specified)
  function currentHaulSize() {
    return selectedHaulSize === '__other' ? haulSizeOther.value.trim() : selectedHaulSize;
  }
  // Used when loading a draft / published haul back into the form
  function setHaulSizeFromValue(value) {
    haulSizeOther.value = '';
    if (!value) { paintHaulSize('', 'Select size'); return; }
    if (KNOWN_HAUL_SIZES.includes(value)) { paintHaulSize(value, value); return; }
    paintHaulSize('__other', 'Other');
    haulSizeOther.value = value;
  }

  // ---- Measurements: H × W × L with an in / cm switch ----
  const measureEls = {
    h: document.getElementById('haul-measure-h'),
    w: document.getElementById('haul-measure-w'),
    l: document.getElementById('haul-measure-l')
  };
  const unitButtons = document.querySelectorAll('#haul-unit-toggle .unit-btn');
  const measureHint = document.getElementById('haul-measure-hint');
  const MEASURE_HINT_DEFAULT = '';   // the box subtitle already explains H × W × L
  let haulUnit = 'in';

  const roundOne = n => Math.round(n * 10) / 10;
  const convertMeasure = (n, from, to) => (from === to ? n : roundOne(from === 'in' ? n * 2.54 : n / 2.54));
  function readMeasure(el) {
    const v = parseFloat(el.value);
    return isNaN(v) || v < 0 ? null : v;
  }
  // "H 20 × W 15 × L 30 in" — only the sides that were filled in
  function measureText(unit) {
    const parts = [['H', 'h'], ['W', 'w'], ['L', 'l']]
      .map(([label, key]) => {
        const v = readMeasure(measureEls[key]);
        return v === null ? null : label + ' ' + convertMeasure(v, haulUnit, unit);
      })
      .filter(Boolean);
    return parts.length ? parts.join(' × ') + ' ' + unit : '';
  }
  function updateMeasureHint() {
    const other = haulUnit === 'in' ? 'cm' : 'in';
    const converted = measureText(other);
    measureHint.textContent = converted ? '≈ ' + converted : MEASURE_HINT_DEFAULT;
  }
  function setHaulUnit(unit, convertValues) {
    if (convertValues && unit !== haulUnit) {
      Object.values(measureEls).forEach(el => {
        const v = readMeasure(el);
        if (v !== null) el.value = convertMeasure(v, haulUnit, unit);
      });
    }
    haulUnit = unit;
    unitButtons.forEach(b => b.classList.toggle('active', b.dataset.unit === unit));
    document.querySelectorAll('#haul-specific-details-panel .measure-unit').forEach(s => { s.textContent = unit; });
    updateMeasureHint();
    updateHaulPreview();
  }
  unitButtons.forEach(b => b.addEventListener('click', () => setHaulUnit(b.dataset.unit, true)));
  Object.values(measureEls).forEach(el => el.addEventListener('input', () => { updateMeasureHint(); updateHaulPreview(); }));

  // ---- Live preview ----
  const haulPreviewMedia = document.getElementById('haul-preview-media');
  const haulPreviewUsername = document.getElementById('haul-preview-username');
  const haulPreviewPrice = document.getElementById('haul-preview-price');
  const haulPreviewCaption = document.getElementById('haul-preview-caption');
  const haulPreviewLocation = document.getElementById('haul-preview-location');
  const haulPreviewLocationText = document.getElementById('haul-preview-location-text');
  const haulPreviewChips = document.getElementById('haul-preview-chips');

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

    // size / color / fabric / measurements as small chips under the photo
    const chips = [];
    const size = currentHaulSize();
    if (size) chips.push('Size ' + size);
    const color = document.getElementById('haul-color').value.trim();
    const fabric = document.getElementById('haul-fabric').value.trim();
    if (color) chips.push(color);
    if (fabric) chips.push(fabric);
    const m = measureText(haulUnit);
    if (m) chips.push(m);
    haulPreviewChips.innerHTML = chips.map(c => `<span class="post-preview-chip">${escapeHtml(c)}</span>`).join('');
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

  ['haul-caption', 'haul-amount', 'haul-color', 'haul-fabric'].forEach(id =>
    document.getElementById(id).addEventListener('input', updateHaulPreview));

  // Populate "Tag Thrift Spot" from the live spot list.
  let selectedHaulLocation = '';   // spot name, for the label and preview
  let selectedHaulStoreId = '';    // spot id, what the server saves
  const haulLocationMenu = document.getElementById('haul-location-dropdown-menu');
  const haulLocationBtn = document.getElementById('haul-location-dropdown-btn');
  setupDropdown(haulLocationBtn, haulLocationMenu, () => {});
  // The menu items are rebuilt each time the page opens, so listen on the menu itself
  haulLocationMenu.addEventListener('click', (e) => {
    const item = e.target.closest('.dropdown-item');
    if (!item || item.disabled) return;
    haulLocationMenu.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    selectedHaulStoreId = item.dataset.value;
    selectedHaulLocation = item.textContent;
    document.getElementById('haul-location-label').textContent = item.textContent;
    updateHaulPreviewLocation();
    haulLocationMenu.classList.remove('open');
    haulLocationBtn.classList.remove('open');
  });

  function resetHaulDropzone() {
    haulMediaInput.value = '';
    haulDropzoneBody.innerHTML = `
      <div class="haul-dropzone-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 16V4M12 4l-4 4M12 4l4 4"/><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>
      </div>
      <p class="haul-dropzone-text">Click or drag a photo to upload<br><span>(PNG, JPG)</span></p>`;
  }

  function previewHaulFile(file) {
    if (!file) return;
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      haulDropzoneBody.innerHTML = `<img class="haul-dropzone-preview" src="${url}" alt="Selected haul photo"><span class="haul-dropzone-filename">${escapeHtml(file.name)}</span>`;
      setHaulPreviewImage(url);
    } else {
      haulDropzoneBody.innerHTML = `
        <div class="haul-dropzone-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
        </div>
        <span class="haul-dropzone-filename">${escapeHtml(file.name)}</span>`;
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
    selectedHaulStoreId = '';
    document.getElementById('haul-location-label').textContent = 'Select Location';
    haulLocationMenu.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active'));
    setHaulSizeFromValue('');
    setHaulUnit('in', false);
    haulDetailsPanel.classList.add('open');
    haulDetailsToggle.classList.add('open');
    editingHaulDraftId = null;
    editingHaulDraftImage = null;
    editingHaulId = null;
    setHaulEditMode(false);
    setHaulPreviewImage(null);
    updateHaulPreview();
    updateHaulPreviewLocation();
  }

  // Same form, two modes: posting a new haul, or editing a published one
  function setHaulEditMode(on) {
    document.getElementById('haul-save-draft').classList.toggle('hidden', on);
    postHaulForm.querySelector('.btn-haul-primary').textContent = on ? 'Save Changes' : 'Post Haul';
    document.getElementById('post-haul-title').textContent = on ? 'Edit your Haul' : 'Share your Ukay Haul';
  }

  /* ---- My Drafts list on the page (haul drafts only) ---- */
  const postDraftsList = document.getElementById('post-drafts-list');
  const postDraftsCount = document.getElementById('post-drafts-count');
  const postNoDrafts = document.getElementById('post-no-drafts');

  async function renderPostHaulDrafts() {
    try {
      const res = await apiFetch('api/drafts/list.php');
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to load drafts.');
      const drafts = (data.hauls || []).slice().sort((a, b) => b.created_at.localeCompare(a.created_at));

      postDraftsCount.textContent = drafts.length;
      postNoDrafts.classList.toggle('hidden', drafts.length > 0);
      postDraftsList.innerHTML = '';

      drafts.forEach(d => {
        const thumb = d.image_path
          ? `<img class="draft-thumb" src="${escapeHtml(d.image_path)}" alt="">`
          : `<div class="draft-thumb"></div>`;
        const card = document.createElement('div');
        card.className = 'draft-card';
        card.innerHTML = `
          ${thumb}
          <div class="draft-info">
            <span class="draft-type">Haul draft</span>
            <p class="draft-title${d.item_name ? '' : ' untitled'}">${d.item_name ? escapeHtml(d.item_name) : 'Untitled draft'}</p>
            <p class="draft-meta">Saved ${formatTimeAgo(d.created_at)}</p>
          </div>
          <div class="draft-actions">
            <button type="button" class="draft-btn primary" data-action="edit">Continue</button>
            <button type="button" class="draft-btn danger" data-action="delete">Delete</button>
          </div>`;
        card.querySelector('[data-action="edit"]').addEventListener('click', () => {
          openHaulDraft(d);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        card.querySelector('[data-action="delete"]').addEventListener('click', async () => {
          if (!(await confirmDialog('Delete this draft? This can\'t be undone.'))) return;
          try {
            const r = await apiFetch('api/drafts/delete.php', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ type: 'haul', id: d.id })
            });
            const out = await r.json();
            if (!out.success) { showToast(out.error || 'Could not delete that draft.', 'error'); return; }
            if (editingHaulDraftId === d.id) resetHaulForm();
            renderPostHaulDrafts();
            if (views['profile'].inited && views['profile'].refreshDrafts) views['profile'].refreshDrafts();
          } catch (err) {
            showToast('Could not reach the server. Try again.', 'error');
          }
        });
        postDraftsList.appendChild(card);
      });
    } catch (err) {
      postDraftsList.innerHTML = '<p class="no-results">Could not load your drafts.</p>';
    }
  }

  function openPostHaulModal() {
    // remember where we came from so Back / a successful post returns there
    if (currentViewName && currentViewName !== 'post-haul') postHaulReturnView = currentViewName;
    updateHaulPreview();   // shows the real @username as soon as it opens
    switchView('post-haul');
    renderPostHaulDrafts();
    // Refresh the spot list so a spot suggested a minute ago can be tagged
    loadSpotChoices().then(() => fillSpotMenu(haulLocationMenu, selectedHaulStoreId));
  }
  function closePostHaulModal() {
    // Don't leave a half-edited draft sitting in the "new haul" form
    if (editingHaulDraftId !== null || editingHaulId !== null) resetHaulForm();
    switchView(postHaulReturnView || 'community-feed');
  }

  document.getElementById('post-haul-close').addEventListener('click', closePostHaulModal);

  function openHaulDraft(d) {
    resetHaulForm();
    editingHaulDraftId = d.id;
    editingHaulDraftImage = d.image_path || null;
    document.getElementById('haul-caption').value = d.item_name || '';
    document.getElementById('haul-amount').value = d.price !== null && d.price !== undefined ? d.price : '';
    selectedHaulStoreId = d.store_id ? String(d.store_id) : '';
    selectedHaulLocation = d.store_name || '';
    document.getElementById('haul-location-label').textContent = d.store_name || 'Select Location';
    updateHaulPreviewLocation();

    if (d.image_path) {
      haulDropzoneBody.innerHTML = `<img class="haul-dropzone-preview" src="${escapeHtml(d.image_path)}" alt="Current photo"><span class="haul-dropzone-filename">Current photo (choose a file to replace it)</span>`;
    }
    setHaulPreviewImage(d.image_path || null);

    setHaulSizeFromValue(d.size || '');
    document.getElementById('haul-color').value = d.color || '';
    document.getElementById('haul-fabric').value = d.fabric || '';

    // measurements (the API returns these once create/update/list are updated)
    setHaulUnit(d.measure_unit === 'cm' ? 'cm' : 'in', false);
    measureEls.h.value = d.measure_h !== null && d.measure_h !== undefined ? d.measure_h : '';
    measureEls.w.value = d.measure_w !== null && d.measure_w !== undefined ? d.measure_w : '';
    measureEls.l.value = d.measure_l !== null && d.measure_l !== undefined ? d.measure_l : '';
    updateMeasureHint();

    updateHaulPreview();
    openPostHaulModal();
  }

  // Edit one of my published hauls: reuse the draft-filling code, then switch modes
  function openHaulEdit(h) {
    openHaulDraft(h);
    editingHaulDraftId = null;       // it's not a draft
    editingHaulId = h.id;
    setHaulEditMode(true);
  }

  async function submitHaul(status) {
    const isEdit = editingHaulId !== null;
    const isDraft = status === 'draft' && !isEdit;
    const caption = document.getElementById('haul-caption').value.trim();
    const hasImage = !!haulMediaInput.files[0] || !!editingHaulDraftImage;

    if (isDraft && !caption && !hasImage) {
      showToast('Add a photo or a caption to save a draft.', 'error');
      return;
    }
    if (!isDraft && !caption) {
      showAlert('Add a caption for your haul before posting.');
      return;
    }
    if (selectedHaulSize === '__other' && !haulSizeOther.value.trim()) {
      showToast('Type the size, or pick "Not specified".', 'error');
      haulSizeOther.focus();
      return;
    }
    for (const key of ['h', 'w', 'l']) {
      if (measureEls[key].value !== '' && readMeasure(measureEls[key]) === null) {
        showToast('Measurements must be positive numbers.', 'error');
        measureEls[key].focus();
        return;
      }
    }

    const amountInput = document.getElementById('haul-amount').value;
    const formData = new FormData();
    formData.append('status', isDraft ? 'draft' : 'published');
    formData.append('item_name', caption);
    if (amountInput) formData.append('price', amountInput);
    formData.append('store_id', selectedHaulStoreId || '');
    formData.append('size', currentHaulSize());
    formData.append('color', document.getElementById('haul-color').value.trim());
    formData.append('fabric', document.getElementById('haul-fabric').value.trim());
    // measurements: sent exactly as typed, with the unit they were typed in
    formData.append('measure_unit', haulUnit);
    formData.append('measure_h', measureEls.h.value);
    formData.append('measure_w', measureEls.w.value);
    formData.append('measure_l', measureEls.l.value);
    if (editingHaulDraftId !== null) formData.append('draft_id', editingHaulDraftId);
    if (isEdit) formData.append('haul_id', editingHaulId);
    if (haulMediaInput.files[0]) formData.append('image', haulMediaInput.files[0]);

    const actionBtns = postHaulForm.querySelectorAll('.haul-form-actions button');
    actionBtns.forEach(b => b.disabled = true);   // no double-submits

    try {
      const res = await apiFetch(isEdit ? 'api/hauls/update.php' : 'api/hauls/create.php', { method: 'POST', body: formData });
      const data = await res.json();

      if (!data.success) {
        showAlert(data.error || (isEdit ? 'Could not save your changes.' : (isDraft ? 'Could not save your draft.' : 'Could not post your haul.')), 'error');
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
      if (isDraft) {
        // Stay on the page so the new draft shows up in "My Drafts"
        renderPostHaulDrafts();
        showToast('Draft saved.');
      } else {
        closePostHaulModal();   // back to where the person came from
        showToast(isEdit ? 'Haul updated.' : 'Haul posted!');
      }
    } catch (err) {
      showAlert('Could not reach the server. Is your PHP backend running?');
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
          sharedCoords = userCoords;
          saveMyLocation(userCoords.lat, userCoords.lng);
          setUserMarker(userCoords.lat, userCoords.lng);
          map.flyTo([userCoords.lat, userCoords.lng], 15, { duration: 0.8 });
          loadStores();
        },
        () => {
          if (notifyOnFailure) {
            showAlert('Could not get your location. Check that location access is allowed for this site in your browser settings.');
          }
          loadStores();
        },
        { timeout: 8000 }
      );
    }

    document.getElementById('locate-btn').addEventListener('click', () => {
      if (!navigator.geolocation) {
        showAlert('Your browser does not support location services.');
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
            ${store.image_path ? `<img class="map-popup-photo" src="${escapeHtml(store.image_path)}" alt="Photo of ${escapeHtml(store.name)}" width="160" height="90">` : ''}
            <h3>${escapeHtml(store.name)}</h3>
            <p>${verifiedBadge(store)}</p>
            <p><span class="status-dot">&bull;</span> ${escapeHtml(store.status_text || '')}</p>
            <p><strong>${ratingLabel}</strong> | ${escapeHtml(store.price_range || '')}</p>
            <a data-view-details="${escapeHtml(store.id)}">View Store Details &rarr;</a>
            ${store.reviewed === 0 ? '<p><em>Stamps open once an admin verifies it</em></p>' : `<a data-stamp-store="${escapeHtml(store.id)}">I'm here &middot; get a stamp</a>`}
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

    // Track the in-flight load so showStore() can wait for it
    let loadingStores = null;
    function loadStores() {
      loadingStores = loadStoresNow();
      return loadingStores;
    }

    async function loadStoresNow() {
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
        const res = await apiFetch(`api/stores/list.php?${params.toString()}`);
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Failed to load stores.');

        currentStores = data.stores;
        document.getElementById('radius-note').classList.toggle('hidden', !data.radius_expanded);
        renderMarkers(currentStores);
        renderStoreCards(currentStores);
      } catch (err) {
        document.getElementById('store-cards-list').innerHTML =
          `<p class="no-results">Could not load stores — ${escapeHtml(err.message)}</p>`;
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
          ${store.image_path
            ? `<img class="store-img-placeholder store-img" src="${escapeHtml(store.image_path)}" alt="Photo of ${escapeHtml(store.name)}">`
            : `<div class="store-img-placeholder">${escapeHtml(store.name.charAt(0))}</div>`}
          <div class="store-info">
            <div class="store-header">
              <h4>${escapeHtml(store.name)} ${verifiedBadge(store)}</h4>
              <span class="rating clickable" title="Rate this spot">${ratingLabel}</span>
            </div>
            <p class="distance">${escapeHtml(store.distance_label)}</p>
            ${(stampedIds.has(Number(store.id)) || store.haul_count > 0) ? `<p class="card-meta">${stampedIds.has(Number(store.id)) ? '<span class="stamp-chip">\u2713 Stamped</span>' : ''}${store.haul_count > 0 ? `<span>${store.haul_count} haul${store.haul_count === 1 ? '' : 's'} tagged</span>` : ''}</p>` : ''}
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
            <button type="button" data-action="stamp">I'm here &middot; get a stamp</button>
            <button type="button" data-action="rate">Rate this spot</button>
          </div>`;

        card.querySelector('.directions-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          openStorePanel(store);
          showRoute(store);
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

        menu.querySelector('[data-action="stamp"]').addEventListener('click', (e) => {
          e.stopPropagation();
          menu.classList.remove('open');
          checkInAt(store);
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
            const res = await apiFetch('api/saved-spots/toggle.php', {
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
              showAlert(data.error || 'Could not update this spot.', 'error');
            }
          } catch (err) {
            showAlert('Could not reach the server. Is your PHP backend running?');
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

    /* ==========================================================================
       STALL DETAILS PANEL (5.9) + HAULS FROM THIS STALL (5.10) + ROUTE ON OUR MAP
       Opens in the left column when a stall is picked. api/stores/get.php sends
       the stall, its written reviews and the hauls tagged to it in one call.
       ========================================================================== */
    const detailEl = document.getElementById('store-detail');
    const sidebarEl = document.querySelector('.store-list-sidebar');
    let openStoreId = null;
    let routeLayer = null;
    let routeToken = 0;      // so a slow answer from an older click is ignored

    function starsText(n) { return '★'.repeat(n) + '☆'.repeat(5 - n); }

    function clearRoute() {
      routeToken++;
      if (routeLayer) { map.removeLayer(routeLayer); routeLayer = null; }
      const info = document.getElementById('route-info');
      if (info) { info.classList.add('hidden'); info.innerHTML = ''; }
    }

    function closeStorePanel() {
      clearRoute();
      openStoreId = null;
      detailEl.classList.add('hidden');
      detailEl.innerHTML = '';
      sidebarEl.classList.remove('detail-open');
      document.querySelectorAll('.store-card').forEach(c => c.classList.remove('active'));
    }

    function straightKm(a, b) {
      const R = 6371, rad = d => d * Math.PI / 180;
      const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
      const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
      return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
    }

    // Draw the road route from the visitor to the stall on this page's own map.
    // Uses the free OpenStreetMap routing service; if it is unreachable we draw
    // a straight dashed line and say so.
    async function showRoute(store) {
      const token = ++routeToken;
      // look the box up each time: the panel is redrawn when reviews and hauls arrive
      const say = (html) => { const info = document.getElementById('route-info'); if (info) { info.innerHTML = html; info.classList.remove('hidden'); } };
      say('<span>Finding your location…</span>');
      const me = userCoords || await getUserCoords(true);
      if (token !== routeToken) return;
      if (!me) {
        say('<span>We need your location to draw the route. Allow location for this site and try again.</span>');
        map.flyTo([store.latitude, store.longitude], 16, { duration: 0.6 });
        return;
      }
      userCoords = userCoords || me;
      setUserMarker(me.lat, me.lng);
      say('<span>Drawing the route…</span>');

      let line = null, km = null, mins = null, road = false;
      try {
        const url = 'https://router.project-osrm.org/route/v1/driving/' +
          me.lng + ',' + me.lat + ';' + store.longitude + ',' + store.latitude + '?overview=full&geometries=geojson';
        const res = await fetch(url);
        const data = await res.json();
        if (data.code === 'Ok' && data.routes && data.routes[0]) {
          const r = data.routes[0];
          line = L.geoJSON(r.geometry, { style: { color: '#C3291D', weight: 5, opacity: 0.9 } });
          km = r.distance / 1000; mins = Math.max(1, Math.round(r.duration / 60)); road = true;
        }
      } catch (err) { /* fall through to the straight line */ }
      if (token !== routeToken) return;
      if (!line) {
        line = L.polyline([[me.lat, me.lng], [store.latitude, store.longitude]], { color: '#C3291D', weight: 4, dashArray: '8 8' });
        km = straightKm(me, { lat: Number(store.latitude), lng: Number(store.longitude) });
      }
      if (routeLayer) map.removeLayer(routeLayer);
      routeLayer = line.addTo(map);
      try { map.fitBounds(routeLayer.getBounds(), { padding: [50, 50] }); } catch (err) {}
      const kmText = km < 1 ? Math.round(km * 1000) + ' m' : km.toFixed(1) + ' km';
      say(`<span><b>${kmText}</b>${road ? ' · about <b>' + mins + ' min</b> by road' : ' in a straight line (road route unavailable)'}</span>
           <button type="button" class="mini-btn" data-d="clear-route">Clear route</button>`);
    }

    function reviewHtml(r) {
      return `<li><div class="rv-top"><b>${escapeHtml(r.author)}</b><span class="rv-stars" aria-label="${r.stars} out of 5">${starsText(r.stars)}</span></div>
        <p>${escapeHtml(r.comment)}</p><small>${escapeHtml(String(r.created_at || '').slice(0, 10))}</small></li>`;
    }

    function haulThumbHtml(h) {
      return `<button type="button" class="sd-haul" data-haul-id="${Number(h.id)}" title="${escapeHtml(h.item_name || 'Haul')}">
        ${h.image_path ? `<img src="${escapeHtml(h.image_path)}" alt="${escapeHtml(h.item_name || 'Haul')}">` : '<span class="sd-haul-ph"></span>'}
        <span class="sd-haul-cap">@${escapeHtml(h.username)}${h.price ? ' · ₱' + Math.round(h.price) : ''}</span></button>`;
    }

    function renderStorePanel(store, extra) {
      const reviews = extra ? extra.reviews : null;
      const hauls = extra ? extra.hauls : null;
      const oldRoute = document.getElementById('route-info');
      const keepRoute = oldRoute && !oldRoute.classList.contains('hidden') ? oldRoute.innerHTML : null;
      const ratingText = store.rating_count > 0 ? `${Number(store.rating).toFixed(1)} ★ · ${store.rating_count} rating${store.rating_count === 1 ? '' : 's'}` : 'No ratings yet';
      detailEl.innerHTML = `
        <button type="button" class="detail-back" data-d="back">&larr; All stalls</button>
        ${store.image_path
          ? `<img class="detail-photo" src="${escapeHtml(store.image_path)}" alt="Photo of ${escapeHtml(store.name)}">`
          : `<div class="detail-photo ph">${escapeHtml(String(store.name || '?').charAt(0))}</div>`}
        <h3 class="detail-name">${escapeHtml(store.name)} ${verifiedBadge(store)}</h3>
        <p class="detail-rating">${ratingText}</p>
        <dl class="detail-facts">
          ${store.status_text ? `<div><dt>Hours</dt><dd>${escapeHtml(store.status_text)}</dd></div>` : ''}
          ${store.price_range ? `<div><dt>Prices</dt><dd>${escapeHtml(store.price_range)}</dd></div>` : ''}
          ${store.address ? `<div><dt>Address</dt><dd>${escapeHtml(store.address)}</dd></div>` : ''}
          ${store.distance_label ? `<div><dt>From you</dt><dd>${escapeHtml(store.distance_label)}</dd></div>` : ''}
        </dl>
        <div class="detail-actions">
          <button type="button" class="btn-primary" data-d="route">Get Directions</button>
          <button type="button" class="btn-secondary" data-d="stamp">I'm here &middot; stamp</button>
          <button type="button" class="btn-secondary" data-d="rate">Rate</button>
        </div>
        <div class="route-info hidden" id="route-info"></div>

        <h4 class="detail-h">What visitors say</h4>
        ${reviews === null ? '<p class="trail-hint">Loading…</p>'
          : reviews.length ? `<ul class="detail-reviews">${reviews.map(reviewHtml).join('')}</ul>`
          : '<p class="trail-hint">No written reviews yet. Be the first to rate this stall.</p>'}

        <h4 class="detail-h">Hauls from this stall${extra ? ' (' + extra.haul_count + ')' : ''}</h4>
        ${hauls === null ? '<p class="trail-hint">Loading…</p>'
          : hauls.length ? `<div class="sd-hauls">${hauls.map(haulThumbHtml).join('')}</div>`
          : '<p class="trail-hint">No hauls tagged to this stall yet. Tag it when you post yours.</p>'}`;
      if (keepRoute) { const box = document.getElementById('route-info'); box.innerHTML = keepRoute; box.classList.remove('hidden'); }
    }

    async function openStorePanel(store) {
      const keepRoute = openStoreId !== null && String(openStoreId) === String(store.id);
      if (!keepRoute) clearRoute();
      openStoreId = store.id;
      sidebarEl.classList.add('detail-open');
      detailEl.classList.remove('hidden');
      document.querySelectorAll('.store-card').forEach(c => c.classList.toggle('active', c.dataset.id === String(store.id)));
      renderStorePanel(store, null);
      detailEl.scrollTop = 0;
      try {
        const res = await apiFetch('api/stores/get.php?id=' + encodeURIComponent(store.id));
        const data = await res.json();
        if (String(openStoreId) !== String(store.id)) return;   // the person moved on
        if (!data.success) throw new Error(data.error || 'Could not load this stall.');
        renderStorePanel(Object.assign({}, store, data.store), data);
      } catch (err) {
        if (String(openStoreId) !== String(store.id)) return;
        const msg = document.createElement('p');
        msg.className = 'no-results';
        msg.textContent = 'Could not load reviews and hauls. ' + err.message;
        detailEl.appendChild(msg);
      }
    }

    detailEl.addEventListener('click', (e) => {
      const store = currentStores.find(s => String(s.id) === String(openStoreId));
      const haul = e.target.closest('[data-haul-id]');
      if (haul) { openHaulDetail(Number(haul.dataset.haulId)); return; }
      const btn = e.target.closest('[data-d]');
      if (!btn || !store) return;
      const act = btn.dataset.d;
      if (act === 'back') closeStorePanel();
      else if (act === 'route') showRoute(store);
      else if (act === 'clear-route') clearRoute();
      else if (act === 'stamp') checkInAt(store);
      else if (act === 'rate') openRateSpotModal(store.id);
    });

    // Used by openDirections() (Saved Stalls) and anything that wants "go to this stall"
    views['find-a-store'].directionsTo = async (place) => {
      if (loadingStores) await loadingStores;
      if (!currentStores.some(s => String(s.id) === String(place.id))) {
        activeSearch = place.name || '';
        document.getElementById('dashboard-search').value = activeSearch;
        await loadStores();
      }
      const store = currentStores.find(s => String(s.id) === String(place.id));
      if (!store) return;
      setTimeout(() => { map.invalidateSize(); focusStore(store.id); showRoute(store); }, 150);
    };

    function focusStore(id) {
      const store = currentStores.find(s => String(s.id) === String(id));
      if (!store) return;
      map.flyTo([store.latitude, store.longitude], 16, { duration: 0.6 });
      map.closePopup();          // the details panel replaces the little popup
      openStorePanel(store);

      document.querySelectorAll('.store-card').forEach(c => c.classList.remove('active'));
      const activeCard = document.querySelector(`.store-card[data-id="${id}"]`);
      if (activeCard) activeCard.classList.add('active');
    }

    document.getElementById('dashboard-map').addEventListener('click', (e) => {
      const link = e.target.closest('[data-view-details]');
      if (link) focusStore(link.dataset.viewDetails);
      const stampLink = e.target.closest('[data-stamp-store]');
      if (stampLink) {
        const st = currentStores.find(x => String(x.id) === String(stampLink.dataset.stampStore));
        if (st) checkInAt(st);
      }
    });

    let searchDebounce;
    document.getElementById('dashboard-search').addEventListener('input', (e) => {
      clearTimeout(searchDebounce);
      const val = e.target.value;
      searchDebounce = setTimeout(() => {
        closeStorePanel();
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
        closeStorePanel();
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
      spotDropzoneBody.innerHTML = `<img class="haul-dropzone-preview" src="${url}" alt="Selected spot photo"><span class="haul-dropzone-filename">${escapeHtml(file.name)}</span>`;
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
        showAlert('Give the spot a name first.');
        return;
      }
      const address = document.getElementById('spot-address').value.trim();
      const hours = document.getElementById('spot-hours').value.trim();
      const priceRange = document.getElementById('spot-price-range').value.trim();

      if (!spotPinCoords) {
        showAlert('Drop a pin on the map first. Click where the spot is, or use "Find on map".');
        return;
      }
      const latitude = spotPinCoords.lat;
      const longitude = spotPinCoords.lng;

      // multipart so the optional photo can travel with the text fields
      const formData = new FormData();
      formData.append('name', name);
      formData.append('address', address);
      formData.append('hours', hours);
      formData.append('price_range', priceRange);
      formData.append('latitude', latitude);
      formData.append('longitude', longitude);
      if (spotMediaInput.files[0]) formData.append('image', spotMediaInput.files[0]);

      try {
        const res = await apiFetch('api/stores/suggest.php', {
          method: 'POST',
          body: formData
        });
        const data = await res.json();

        if (!data.success) {
          showAlert(data.error || 'Could not submit that spot.', 'error');
          return;
        }
        resetSpotForm();
        closeSuggestSpotModal();
        await loadStores();
        showDialog({
          title: 'Spot added!', tone: 'success', confirmText: 'Got it',
          message: `Thanks! "${data.store.name}" is on the map for other thrifters to find. An admin will check it soon and give it a Verified badge.`
        });
      } catch (err) {
        showAlert('Could not reach the server. Is your PHP backend running?');
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
      const store = currentStores.find(s => String(s.id) === String(storeId));
      if (!store) return;
      ratingTargetStoreId = storeId;
      rateSpotNameEl.textContent = store.name;
      rateSpotForm.reset();
      const postAsEl = document.getElementById('rate-post-as-name');
      if (postAsEl) postAsEl.textContent = currentUser ? '@' + currentUser.username : '@username';
      setStarDisplay(store.my_rating || 0);
      if (store.my_rating) {
        rateSpotNameEl.textContent = store.name + ' · you rated ' + store.my_rating + '★ — submit to update';
      }
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
        showAlert('Pick at least one star before submitting.');
        return;
      }
      const comment = document.getElementById('rate-comment').value.trim();
      const visibility = document.querySelector('input[name="rating-visibility"]:checked').value;
      const isAnonymous = visibility === 'anonymous';

      try {
        const res = await apiFetch('api/stores/rate.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ store_id: ratingTargetStoreId, stars: selectedStars, comment, anonymous: isAnonymous })
        });
        const data = await res.json();

        if (!data.success) {
          showAlert(data.error || 'Could not submit your rating.', 'error');
          return;
        }

        closeRateSpotModal();
        await loadStores();
        showToast(data.updated ? 'Your rating was updated.' : 'Thanks for rating this spot!');
      } catch (err) {
        showAlert('Could not reach the server. Is your PHP backend running?');
      }
    });

    showLoadingState();
    initLocation();

    // Fix Leaflet's grey-tile bug: any time we re-show this view, make sure
    // the map recalculates its size (needed because it was first drawn
    // while a sibling view may have affected layout).
    views['find-a-store'].onShow = () => setTimeout(() => map.invalidateSize(), 100);
    views['find-a-store'].reload = () => loadStores();   // used by the admin dashboard after it changes a stall
    views['find-a-store'].refreshCards = () => renderStoreCards(currentStores);   // after a stamp, to show the "Stamped" chip
    views['find-a-store'].setSearch = (q) => {           // the Ukay Trail page: "Find stalls in Consolacion"
      closeStorePanel();
      activeSearch = q || '';
      document.getElementById('dashboard-search').value = activeSearch;
      return loadStores();
    };
    refreshStamps().then(() => { if (currentStores.length) renderStoreCards(currentStores); });

    // Used by the haul detail window: show one store on the map. If it isn't in
    // the current list (outside the ride radius, or filtered out by a search),
    // search for it by name first.
    views['find-a-store'].showStore = async (id, name) => {
      if (loadingStores) await loadingStores;
      if (!currentStores.some(s => String(s.id) === String(id))) {
        activeSearch = name || '';
        document.getElementById('dashboard-search').value = activeSearch;
        await loadStores();
      }
      setTimeout(() => { map.invalidateSize(); focusStore(id); }, 150);
    };
  }

  /* ==========================================================================
     6b. FRESH BALE — lazily initialized on first visit
     Cards come from BALE_POSTS below. There is no bale table yet, so this is
     sample data; when an API exists, replace BALE_POSTS with a fetch and keep
     renderBale() as it is.
     ========================================================================== */
  /* ==========================================================================
     6a. UKAY TRAIL (stamp card) — lazily initialized on first visit
       api/trail/mine.php      GET  -> every open trail with my stamps and reward code
       api/trail/checkin.php   POST -> "I'm here" (see checkInAt above)
     ========================================================================== */
  function initTrail() {
    const list = document.getElementById('trail-list');
    const emptyMsg = document.getElementById('no-trail');

    function circles(t) {
      let html = '';
      for (let i = 0; i < t.stamps_needed; i++) {
        const v = t.visited[i];
        html += v
          ? `<span class="stamp-dot filled" title="${escapeHtml(v.name)}">\u2713</span>`
          : `<span class="stamp-dot">${i + 1}</span>`;
      }
      return html;
    }

    function render() {
      emptyMsg.classList.toggle('hidden', trailData.length > 0);
      list.innerHTML = trailData.map(t => {
        const left = Math.max(0, t.stamps_needed - t.count);
        const visited = t.visited.length
          ? `<ul class="trail-visited">${t.visited.map(v => `<li><b>${escapeHtml(v.name)}</b><small>${escapeHtml(String(v.first_date || '').slice(0, 10))}</small></li>`).join('')}</ul>`
          : '<p class="trail-hint">No stamps yet. Go to a stall and tap "I\'m here".</p>';
        const reward = t.reward_code
          ? `<div class="reward-box"><small>Your reward code</small><b class="code">${escapeHtml(t.reward_code)}</b><p>${escapeHtml(t.reward_text)}</p></div>`
          : `<p class="trail-reward"><b>Reward:</b> ${escapeHtml(t.reward_text)}</p>`;
        return `<article class="trail-card${t.complete ? ' done' : ''}">
          <div class="trail-head">
            <div><span class="script">visit ${t.stamps_needed} stalls</span><h3>${escapeHtml(t.name)}</h3></div>
            <span class="bd ${t.complete ? 'bd-green' : 'bd-yellow'}">${Math.min(t.count, t.stamps_needed)} / ${t.stamps_needed}</span>
          </div>
          <div class="stamp-row">${circles(t)}</div>
          <p class="trail-hint">${t.complete ? 'Trail complete!' : left + ' more stamp' + (left === 1 ? '' : 's') + ' to go'}${t.stalls_on_trail ? ' \u00b7 ' + t.stalls_on_trail + ' stall' + (t.stalls_on_trail === 1 ? '' : 's') + ' on this trail' : ''}</p>
          ${visited}
          ${reward}
          <button type="button" class="btn-secondary" data-find-city="${escapeHtml(t.city)}">Find stalls${t.city ? ' in ' + escapeHtml(t.city) : ''}</button>
        </article>`;
      }).join('');
    }

    async function load() {
      list.innerHTML = '<p class="no-results">Loading your stamp card\u2026</p>';
      const d = await refreshStamps();
      if (!d || !d.success) {
        list.innerHTML = '<p class="no-results">Could not load the trail. Try again.</p>';
        return;
      }
      render();
    }

    list.addEventListener('click', (e) => {
      const b = e.target.closest('[data-find-city]');
      if (!b) return;
      switchView('find-a-store');
      const finder = views['find-a-store'];
      if (finder.setSearch) finder.setSearch(b.dataset.findCity);
    });

    views['trail'].reload = load;
    views['trail'].onShow = load;
    load();
  }

  const BALE_POSTS = [
    { store: 'Ukay-Ukay ni Aa',  city: 'Consolacion', line: 'Bale day Saturday, 7 AM', day: 'weekend',  color: '#A0B3D0', tags: [['new', 'New stock'], ['open', 'Open now']] },
    { store: 'Aling Rosa Ukay',  city: 'Liloan',      line: 'Bale day Sunday',         day: 'tomorrow', color: '#E8B7A8', tags: [['new', 'New stock'], ['later', 'Opens tomorrow']] },
    { store: 'Mang Ben Ukay',    city: 'Consolacion', line: '3 for \u20b1150 today',    day: 'today',    color: '#B7D3B5', tags: [['sale', 'Sale'], ['open', 'Open now']] },
    { store: 'Tindahan ni Nena', city: 'Liloan',      line: 'Kids bale Friday',        day: 'weekend',  color: '#F0E2C0', tags: [['new', 'New stock']] }
  ];
  const BALE_TAG_CLASS = { new: 'bd-yellow', open: 'bd-green', sale: 'bd-blue', later: 'bd-brown' };

  function initFreshBale() {
    const grid = document.getElementById('bale-grid');
    const emptyMsg = document.getElementById('no-bale');
    let city = 'all';
    let day = 'all';

    function renderBale() {
      const list = BALE_POSTS.filter(p =>
        (city === 'all' || p.city === city) && (day === 'all' || p.day === day));
      grid.innerHTML = list.map(p => `
        <article class="bale-card">
          <div class="bale-photo" style="background:${p.color}"></div>
          <div class="bale-body">
            <div class="bale-tags">${p.tags.map(t => `<span class="bd ${BALE_TAG_CLASS[t[0]]}">${escapeHtml(t[1])}</span>`).join('')}</div>
            <h3>${escapeHtml(p.store)}</h3>
            <p>${escapeHtml(p.city)} &middot; ${escapeHtml(p.line)}</p>
            <button type="button" class="bale-see" data-store-name="${escapeHtml(p.store)}">See this stall</button>
          </div>
        </article>`).join('');
      emptyMsg.classList.toggle('hidden', list.length > 0);
    }

    function wirePills(boxId, key, set) {
      document.getElementById(boxId).addEventListener('click', (e) => {
        const pill = e.target.closest('.pill');
        if (!pill) return;
        document.querySelectorAll('#' + boxId + ' .pill').forEach(p => p.classList.toggle('active', p === pill));
        set(pill.dataset[key]);
        renderBale();
      });
    }
    wirePills('bale-city-pills', 'city', v => { city = v; });
    wirePills('bale-day-pills',  'day',  v => { day = v; });

    // "See this stall": look the stall up by name to get its real id, then show it on the map
    grid.addEventListener('click', async (e) => {
      const btn = e.target.closest('.bale-see');
      if (!btn) return;
      const name = btn.dataset.storeName;
      let id = null;
      try {
        const res = await apiFetch('api/stores/list.php?search=' + encodeURIComponent(name));
        const data = await res.json();
        if (data.success && Array.isArray(data.stores)) {
          const hit = data.stores.find(s => s.name.toLowerCase() === name.toLowerCase()) || data.stores[0];
          if (hit) id = hit.id;
        }
      } catch (err) { /* fall through: open the finder and search by name */ }
      openStoreOnMap(id, name);
    });

    document.getElementById('join-trail-btn').addEventListener('click', () => switchView('trail'));
    renderBale();
  }

  /* ==========================================================================
     6c. STALL OWNER DASHBOARD — lazily initialized on first visit
     Layout only for now: the Home tab shows sample numbers. The other tabs
     (post bale, add a find, holds, my stall, QR poster) need their own
     panels and API endpoints before they can do anything.
     ========================================================================== */
  function initSeller() {
    const view = document.getElementById('seller-view');
    function setTab(tab) {
      view.querySelectorAll('.side-item').forEach(b => b.classList.toggle('active', b.dataset.sellerTab === tab));
      if (tab !== 'home') showToast('This part of the stall owner dashboard is not built yet.', 'error');
    }
    view.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-seller-tab]');
      if (btn) setTab(btn.dataset.sellerTab);
    });
    if (currentUser && (currentUser.stall_name || currentUser.display_name)) {
      const nameEl = document.getElementById('seller-stall-name');
      if (nameEl && currentUser.stall_name) nameEl.textContent = currentUser.stall_name;
    }
  }

  /* ==========================================================================
     6d. ADMIN DASHBOARD — lazily initialized on first visit
     Reached from the avatar menu; the link only shows for users whose role is
     "admin", and every api/admin/*.php file checks the role again on the server.
       overview.php  GET   -> everything on this page
       stall.php     POST  -> approve / remove / merge a stall
       report.php    POST  -> remove / dismiss a reported haul or comment
     ========================================================================== */
  function initAdmin() {
    if (!currentUser || currentUser.role !== 'admin') {
      showToast('Admins only.', 'error');
      switchView('find-a-store');
      return;
    }
    const view = document.getElementById('admin-view');
    const TITLES = {
      overview: ['this week', 'Admin overview'],
      stalls:   ['all stalls', 'Stalls'],
      reports:  ['moderation', 'Reports'],
      users:    ['everyone', 'Users']
    };
    const REASON_LABEL = { spam: 'Spam', photo: 'Photo', abuse: 'Rude', other: 'Other' };
    const REASON_CLASS = { spam: 'b-red', photo: 'b-brown', abuse: 'b-red', other: 'b-brown' };
    let data = null;
    let tab = 'overview';
    let stat = null;          // which number box is open: stalls | users | hauls | pending

    const empty = (text) => `<p class="list-empty">${escapeHtml(text)}</p>`;
    const thumb = (s) => s.image_path
      ? `<img class="thumb thumb-img" src="${escapeHtml(s.image_path)}" alt="">`
      : `<span class="thumb" style="background:#F0E2C0"></span>`;

    function stallRow(s, withStatus) {
      const where = [s.address, s.submitted_by_name ? 'suggested by @' + s.submitted_by_name : ''].filter(Boolean).join(' \u00b7 ');
      const dup = s.duplicate_of ? `<small class="dup">Possible duplicate of ${escapeHtml(s.duplicate_of.name)}</small>` : '';
      const status = withStatus
        ? `<span class="badge ${s.reviewed ? 'b-green' : 'b-red'}">${s.reviewed ? 'Approved' : 'Waiting'}</span>` : '';
      const approve = s.reviewed ? '' : `<button type="button" class="mini-btn mb-green" data-admin-act="approve" data-id="${s.id}">Approve</button>`;
      const merge = s.duplicate_of
        ? `<button type="button" class="mini-btn mb-blue" data-admin-act="merge" data-id="${s.id}" data-into="${s.duplicate_of.id}" data-name="${escapeHtml(s.name)}" data-into-name="${escapeHtml(s.duplicate_of.name)}">Merge</button>` : '';
      return `<div class="row">${thumb(s)}<span class="grow"><b>${escapeHtml(s.name)}</b><small>${escapeHtml(where)}</small>${dup}</span>${status}
        <span class="actions">${approve}${merge}<button type="button" class="mini-btn" data-admin-act="remove" data-id="${s.id}" data-name="${escapeHtml(s.name)}">Remove</button></span></div>`;
    }

    function reportRow(r, withActions) {
      const kind = r.target_type === 'comment' ? 'Comment' : 'Haul';
      const badges = r.reasons.map(x => `<span class="badge ${REASON_CLASS[x] || 'b-brown'}">${REASON_LABEL[x] || x}</span>`).join(' ');
      const times = `Reported ${r.count} time${r.count === 1 ? '' : 's'}`;
      const actions = withActions
        ? `<span class="actions"><button type="button" class="mini-btn mb-red" data-admin-act="report-remove" data-type="${r.target_type}" data-id="${r.target_id}">Remove ${kind.toLowerCase()}</button><button type="button" class="mini-btn" data-admin-act="report-dismiss" data-type="${r.target_type}" data-id="${r.target_id}">Dismiss</button></span>` : '';
      return `<div class="row"><span class="grow"><b>${kind} by @${escapeHtml(r.author)}</b><small>${escapeHtml(r.preview)}</small><small>${times}</small></span>${badges}${actions}</div>`;
    }

    function userRow(u) {
      return `<div class="row"><span class="grow"><b>${escapeHtml(u.display_name || u.username)}</b><small>@${escapeHtml(u.username)} \u00b7 ${u.hauls} haul${u.hauls === 1 ? '' : 's'} \u00b7 joined ${escapeHtml((u.created_at || '').slice(0, 10))}</small></span>
         <span class="badge ${u.role === 'admin' ? 'b-red' : 'b-brown'}">${u.role === 'admin' ? 'Admin' : 'Shopper'}</span></div>`;
    }

    function haulRow(h) {
      const bits = ['@' + h.username, h.store_name, h.price ? '\u20b1' + Math.round(h.price) : '', (h.created_at || '').slice(0, 10)].filter(Boolean).join(' \u00b7 ');
      return `<div class="row">${thumb(h)}<span class="grow"><b>${escapeHtml(h.item_name || 'Haul')}</b><small>${escapeHtml(bits)}</small></span></div>`;
    }

    // The list under the four number boxes (and what the boxes' numbers add up to)
    function renderDetail() {
      const box = document.getElementById('admin-detail');
      const cols = document.getElementById('admin-overview-cols');
      view.querySelectorAll('[data-admin-stat]').forEach(b => b.classList.toggle('selected', b.dataset.adminStat === stat));
      document.getElementById('admin-stat-hint').classList.toggle('hidden', !!stat);
      document.getElementById('admin-trail-line').classList.toggle('hidden', !!stat);
      box.classList.toggle('hidden', !stat || !data);
      cols.classList.toggle('hidden', !!stat);
      if (!stat || !data) return;
      let title, rows;
      if (stat === 'stalls') {
        title = data.stalls.length + ' stall' + (data.stalls.length === 1 ? '' : 's') + ' listed';
        rows = data.stalls.map(s => stallRow(s, true)).join('') || empty('No stalls yet.');
      } else if (stat === 'pending') {
        title = data.pending.length + ' waiting for review';
        rows = data.pending.map(s => stallRow(s, false)).join('') || empty('Nothing waiting. All suggested stalls are reviewed.');
      } else if (stat === 'users') {
        const shoppers = data.users.filter(u => u.role !== 'admin');
        title = shoppers.length + ' shopper' + (shoppers.length === 1 ? '' : 's');
        rows = shoppers.map(userRow).join('') || empty('No shoppers yet.');
      } else {
        const hauls = data.hauls || [];
        title = hauls.length + ' haul' + (hauls.length === 1 ? '' : 's') + ' posted';
        rows = hauls.map(haulRow).join('') || empty('No hauls posted yet.');
      }
      document.getElementById('admin-detail-title').textContent = title;
      document.getElementById('admin-detail-list').innerHTML = rows;
    }

    function render() {
      if (!data) return;
      const st = data.stats;
      document.getElementById('admin-stat-stalls').textContent = st.stalls;
      document.getElementById('admin-stat-users').textContent = st.users;
      document.getElementById('admin-stat-hauls').textContent = st.hauls;
      document.getElementById('admin-stat-pending').textContent = st.pending;
      const bs = document.getElementById('admin-badge-stalls');
      const br = document.getElementById('admin-badge-reports');
      bs.textContent = st.pending + ' new';  bs.classList.toggle('hidden', !st.pending);
      br.textContent = st.reports;           br.classList.toggle('hidden', !st.reports);

      document.getElementById('admin-suggested-list').innerHTML =
        data.pending.length ? data.pending.slice(0, 5).map(s => stallRow(s, false)).join('') : empty('Nothing waiting. All suggested stalls are reviewed.');
      document.getElementById('admin-reports-list').innerHTML =
        data.reports.length ? data.reports.slice(0, 3).map(r => reportRow(r, false)).join('') : empty('No reports right now.');
      document.getElementById('admin-stalls-list').innerHTML =
        data.stalls.length ? data.stalls.map(s => stallRow(s, true)).join('') : empty('No stalls yet.');
      document.getElementById('admin-reports-full').innerHTML =
        data.reports.length ? data.reports.map(r => reportRow(r, true)).join('') : empty('No open reports. Nice and quiet.');
      document.getElementById('admin-users-list').innerHTML = data.users.map(userRow).join('');
      const tl = data.trail;
      document.getElementById('admin-trail-line').textContent = tl
        ? 'Ukay Trail: ' + tl.stamps_today + ' stamp' + (tl.stamps_today === 1 ? '' : 's') + ' today \u00b7 ' + tl.stamps_total + ' in total \u00b7 ' + tl.rewards + ' reward' + (tl.rewards === 1 ? '' : 's') + ' earned' : '';
      renderDetail();
    }

    async function load() {
      try {
        const res = await apiFetch('api/admin/overview.php');
        const json = await res.json();
        if (!json.success) {
          showToast(json.error || 'Could not load the admin dashboard.', 'error');
          if (res.status === 403) switchView('find-a-store');
          return;
        }
        data = json;
        render();
      } catch (err) {
        showToast('Could not reach the server. Try again.', 'error');
      }
    }

    function setTab(name) {
      tab = name;
      view.querySelectorAll('.side-item').forEach(b => b.classList.toggle('active', b.dataset.adminTab === name));
      view.querySelectorAll('.admin-panel').forEach(p => p.classList.toggle('hidden', p.id !== 'admin-panel-' + name));
      document.getElementById('admin-kicker').textContent = TITLES[name][0];
      document.getElementById('admin-title').textContent = TITLES[name][1];
    }

    async function send(url, body, okText) {
      try {
        const res = await apiFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const json = await res.json();
        showToast(json.success ? (json.message || okText) : (json.error || 'That did not work.'), json.success ? 'success' : 'error');
        if (json.success) {
          await load();
          // the Find a Stall list and the feeds may now be out of date
          if (views['find-a-store'].inited && views['find-a-store'].reload) views['find-a-store'].reload();
          if (views['community-feed'].inited && views['community-feed'].refreshHauls) views['community-feed'].refreshHauls();
        }
      } catch (err) {
        showToast('Could not reach the server. Try again.', 'error');
      }
    }

    view.addEventListener('click', async (e) => {
      const statBtn = e.target.closest('[data-admin-stat]');
      if (statBtn) { stat = (stat === statBtn.dataset.adminStat) ? null : statBtn.dataset.adminStat; renderDetail(); return; }
      if (e.target.closest('[data-admin-stat-close]')) { stat = null; renderDetail(); return; }
      const tabBtn = e.target.closest('[data-admin-tab]');
      if (tabBtn) { setTab(tabBtn.dataset.adminTab); return; }
      const b = e.target.closest('[data-admin-act]');
      if (!b) return;
      const id = Number(b.dataset.id);
      switch (b.dataset.adminAct) {
        case 'approve':
          send('api/admin/stall.php', { id, action: 'approve' }, 'Stall approved.');
          break;
        case 'remove':
          if (await confirmDialog('Remove "' + b.dataset.name + '"? This also deletes its ratings and saves.'))
            send('api/admin/stall.php', { id, action: 'remove' }, 'Stall removed.');
          break;
        case 'merge':
          if (await confirmDialog('Merge "' + b.dataset.name + '" into "' + b.dataset.intoName + '"? Hauls, ratings and saves move over, then the duplicate is deleted.'))
            send('api/admin/stall.php', { id, action: 'merge', into: Number(b.dataset.into) }, 'Stalls merged.');
          break;
        case 'report-remove':
          if (await confirmDialog('Remove this ' + b.dataset.type + ' for good?'))
            send('api/admin/report.php', { target_type: b.dataset.type, target_id: id, action: 'remove' }, 'Removed.');
          break;
        case 'report-dismiss':
          send('api/admin/report.php', { target_type: b.dataset.type, target_id: id, action: 'dismiss' }, 'Reports dismissed.');
          break;
      }
    });

    views['admin'].onShow = load;
    setTab('overview');
    load();
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
    let searchText = '';      // text in the search box (captions, people, stores, color, fabric)
    let activeUser = '';      // set by picking a person: "Posts by @name"
    let feedReq = 0;          // ignore answers that arrive after a newer request
    const searchInput = document.getElementById('feed-search-input');
    const searchDd = document.getElementById('feed-search-dd');
    const chipRow = document.getElementById('feed-chip-row');

    async function fetchAndRenderHauls(showLoadingState = true) {
      if (showLoadingState) {
        grid.innerHTML = '<p class="no-results">Loading hauls…</p>';
      }
      try {
        const myReq = ++feedReq;
        const params = new URLSearchParams({ filter: activeFilter });
        if (searchText) params.set('q', searchText);
        if (activeUser) params.set('username', activeUser);
        if (activeFilter === 'near-me') {
          // Only the person clicking the pill (showLoadingState) may trigger the
          // browser's location prompt; background polls reuse what we know.
          const coords = await getUserCoords(showLoadingState);
          if (!coords) {
            currentHauls = [];
            grid.innerHTML = '<p class="no-results">Allow location access in your browser to see hauls near you.</p>';
            noHaulsMsg.classList.add('hidden');
            return;
          }
          params.set('lat', coords.lat);
          params.set('lng', coords.lng);
        }
        const res = await apiFetch(`api/hauls/list.php?${params.toString()}`);
        const data = await res.json();
        if (myReq !== feedReq) return; // a newer search already replaced this one
        const newHauls = data.hauls || [];

        // Skip the re-render entirely if nothing actually changed — avoids
        // wiping out hover states / scroll position every poll cycle for no reason.
        const sig = list => JSON.stringify(list.map(h => [h.id, h.like_count, h.liked_by_me]));
        const changed = sig(newHauls) !== sig(currentHauls);
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
        const mediaHtml = h.image_path
          ? `<img class="haul-fill" src="${escapeHtml(h.image_path)}" alt="${escapeHtml(h.item_name)}">`
          : `<div class="haul-fill"></div>`;
        const card = document.createElement('div');
        card.className = 'haul-card';
        card.innerHTML = `
          ${mediaHtml}
          <div class="haul-caption">
            <button type="button" class="user-link" data-username="${escapeHtml(h.username)}">@${escapeHtml(h.username)}</button> &middot; ${h.price !== null ? '₱' + h.price.toFixed(0) : 'Price N/A'}
            <span>${escapeHtml(h.item_name)}${h.store_id && h.store_name ? ' · <button type="button" class="haul-store-link" data-store-id="' + h.store_id + '" data-store-name="' + escapeHtml(h.store_name) + '">' + escapeHtml(h.store_name) + '</button>' : (h.store_name ? ' · ' + escapeHtml(h.store_name) : '')}</span>
            ${detailsHtml(h, false)}
          </div>
          <button type="button" class="haul-like${h.liked_by_me ? ' liked' : ''}" aria-pressed="${h.liked_by_me ? 'true' : 'false'}" aria-label="Like this haul">
            <span class="heart">${h.liked_by_me ? '&#9829;' : '&#9825;'}</span><span class="count">${h.like_count}</span>
          </button>`;
        const likeBtn = card.querySelector('.haul-like');
        likeBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          likeBtn.disabled = true;
          const result = await toggleHaulLike(h.id);
          likeBtn.disabled = false;
          if (!result) return;
          h.liked_by_me = result.liked;
          h.like_count = result.like_count;
          likeBtn.classList.toggle('liked', result.liked);
          likeBtn.setAttribute('aria-pressed', result.liked ? 'true' : 'false');
          likeBtn.querySelector('.heart').innerHTML = result.liked ? '&#9829;' : '&#9825;';
          likeBtn.querySelector('.count').textContent = h.like_count;
        });
        const storeLink = card.querySelector('.haul-store-link');
        if (storeLink) {
          storeLink.addEventListener('click', (e) => {
            e.stopPropagation();
            openStoreInFinder(storeLink.dataset.storeId, storeLink.dataset.storeName);
          });
        }
        card.appendChild(buildHaulMenu(h));
        card.addEventListener('click', () => openHaulDetail(h.id));
        grid.appendChild(card);
      });
      noHaulsMsg.textContent = (searchText || activeUser)
        ? 'No hauls match your search.'
        : 'No hauls match this filter yet \u2014 be the first to share one!';
      noHaulsMsg.classList.toggle('hidden', currentHauls.length > 0);
    }

    function openStoreInFinder(id, name) {
      switchView('find-a-store');
      const finder = views['find-a-store'];
      if (finder.showStore) finder.showStore(id, name);
    }

    /* ---- search box: 300 ms debounce, people + stores dropdown ---- */
    let searchTimer = null;
    let ddReq = 0;

    function hideDropdown() {
      searchDd.classList.add('hidden');
      searchDd.innerHTML = '';
    }

    function setActiveUser(name) {
      activeUser = name;
      document.getElementById('feed-chip-name').textContent = name;
      chipRow.classList.toggle('hidden', !name);
    }

    async function updateDropdown(text) {
      const myDd = ++ddReq;
      if (text.length < 2) { hideDropdown(); return; }
      try {
        const [uRes, sRes] = await Promise.all([
          apiFetch(`api/users/search.php?q=${encodeURIComponent(text)}`),
          fetch(`api/stores/list.php?search=${encodeURIComponent(text)}`)
        ]);
        const uData = await uRes.json();
        const sData = await sRes.json();
        if (myDd !== ddReq) return;
        const users = uData.users || [];
        const stores = (sData.stores || []).slice(0, 4);
        if (!users.length && !stores.length) { hideDropdown(); return; }
        let html = '';
        if (users.length) {
          html += '<div class="feed-dd-label">People</div>' + users.map(u =>
            `<button type="button" class="feed-dd-item" data-kind="user" data-username="${escapeHtml(u.username)}">
               <span>@${escapeHtml(u.username)}${u.display_name ? ' <em>' + escapeHtml(u.display_name) + '</em>' : ''}</span>
               <small>${u.haul_count} post${u.haul_count === 1 ? '' : 's'}</small></button>`).join('');
        }
        if (stores.length) {
          html += '<div class="feed-dd-label">Stores</div>' + stores.map(st =>
            `<button type="button" class="feed-dd-item" data-kind="store" data-store-id="${st.id}" data-store-name="${escapeHtml(st.name)}">
               <span>${escapeHtml(st.name)}</span><small>View on map</small></button>`).join('');
        }
        searchDd.innerHTML = html;
        searchDd.classList.remove('hidden');
      } catch (err) {
        hideDropdown(); // the search still filters the feed even if the dropdown fails
      }
    }

    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        searchText = searchInput.value.trim();
        fetchAndRenderHauls();
        updateDropdown(searchText);
      }, 300);
    });
    searchInput.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideDropdown(); });

    searchDd.addEventListener('click', (e) => {
      const item = e.target.closest('.feed-dd-item');
      if (!item) return;
      if (item.dataset.kind === 'user') {
        searchInput.value = '';
        searchText = '';
        setActiveUser(item.dataset.username);
        hideDropdown();
        fetchAndRenderHauls();
      } else {
        hideDropdown();
        openStoreInFinder(item.dataset.storeId, item.dataset.storeName);
      }
    });

    document.getElementById('feed-chip-clear').addEventListener('click', () => {
      setActiveUser('');
      fetchAndRenderHauls();
    });

    // click anywhere else closes the dropdown
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#feed-search')) hideDropdown();
    });

    function startPolling() {
      stopPolling();
      pollTimer = setInterval(() => { if (!document.hidden) fetchAndRenderHauls(false); }, 8000); // every 8s, skipped while the browser tab is hidden
    }
    function stopPolling() {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
    }


    loadSavedHaulIds().then(() => fetchAndRenderHauls());
    startPolling();

    views['community-feed'].refreshHauls = () => fetchAndRenderHauls(false);
    // Pause polling while this view isn't showing, resume when it's shown again
    views['community-feed'].onShow = () => { fetchAndRenderHauls(false); startPolling(); };
    views['community-feed'].onHide = stopPolling;

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
     7b. PUBLIC PROFILE — another person's page (read-only), lazily initialized
     ========================================================================== */
  function initUserProfile(opts) {
    const grid = document.getElementById('up-masonry');
    const spotsList = document.getElementById('up-spots-list');
    const emptyMsg = document.getElementById('up-empty');
    const tabs = document.getElementById('up-tabs');
    let activeTab = 'hauls';
    let data = null;
    let loadId = 0;

    function showTab(tab) {
      activeTab = tab;
      tabs.querySelectorAll('.pill').forEach(p => p.classList.toggle('active', p.dataset.tab === tab));
      grid.classList.toggle('hidden', tab !== 'hauls');
      spotsList.classList.toggle('hidden', tab !== 'spots');
      const list = data ? (tab === 'hauls' ? data.hauls : data.spots) : [];
      emptyMsg.textContent = tab === 'hauls' ? 'No hauls shared yet.' : 'No tagged spots yet.';
      emptyMsg.classList.toggle('hidden', !data || list.length > 0);
    }

    function render() {
      const u = data.user;
      const name = u.display_name || u.username;
      document.getElementById('up-name').textContent = name;
      document.getElementById('up-handle').textContent = '@' + u.username;
      document.getElementById('up-location').textContent = u.location || 'Location not set';
      document.getElementById('up-bio').textContent = u.bio || 'No bio yet.';
      document.getElementById('up-avatar').textContent = name.charAt(0).toUpperCase();
      document.getElementById('up-hauls').textContent = formatStatCount(data.hauls_count);
      document.getElementById('up-likes').textContent = formatStatCount(data.likes_count);
      document.getElementById('up-spots').textContent = formatStatCount(data.spots_count);
      const joined = new Date(String(u.created_at).replace(' ', 'T'));
      document.getElementById('up-joined').textContent = isNaN(joined)
        ? '–' : joined.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });

      grid.innerHTML = '';
      data.hauls.forEach(h => {
        const mediaHtml = h.image_path
          ? `<img class="item-fill" src="${escapeHtml(h.image_path)}" alt="${escapeHtml(h.item_name)}">`
          : `<div class="item-fill"></div>`;
        const card = document.createElement('div');
        card.className = 'profile-card-item';
        card.innerHTML = `
          ${mediaHtml}
          <div class="item-caption">
            ${escapeHtml(h.item_name)}
            <span>${h.price !== null ? '₱' + h.price.toFixed(0) : 'Price N/A'}</span>
            ${detailsHtml(h, true)}
          </div>`;
        card.addEventListener('click', () => openHaulDetail(h.id));
        grid.appendChild(card);
      });

      spotsList.innerHTML = data.spots.map(sp => `
        <button type="button" class="up-spot" data-store-id="${sp.id}" data-store-name="${escapeHtml(sp.name)}">
          <span class="up-spot-name">${escapeHtml(sp.name)}</span>
          <span class="up-spot-meta">${sp.haul_count} post${sp.haul_count === 1 ? '' : 's'}${sp.address ? ' &middot; ' + escapeHtml(sp.address) : ''}</span>
          <span class="up-spot-go">View on map &rarr;</span>
        </button>`).join('');
      showTab(activeTab);
    }

    async function load(username) {
      const myLoad = ++loadId;
      data = null;
      activeTab = 'hauls';
      grid.innerHTML = '<p class="no-results">Loading profile…</p>';
      spotsList.innerHTML = '';
      emptyMsg.classList.add('hidden');
      document.getElementById('up-name').textContent = '@' + username;
      document.getElementById('up-handle').textContent = '';
      document.getElementById('up-location').textContent = '';
      document.getElementById('up-bio').textContent = '';
      document.getElementById('up-avatar').textContent = (username || '?').charAt(0).toUpperCase();
      ['up-hauls', 'up-likes', 'up-spots', 'up-joined'].forEach(id => { document.getElementById(id).textContent = '–'; });
      showTab('hauls');
      try {
        const res = await apiFetch(`api/profile/get.php?username=${encodeURIComponent(username)}`);
        const body = await res.json();
        if (myLoad !== loadId) return;
        if (!body.success) {
          grid.innerHTML = `<p class="no-results">${escapeHtml(body.error || 'Could not load this profile.')}</p>`;
          return;
        }
        data = body;
        render();
      } catch (err) {
        if (myLoad === loadId) grid.innerHTML = '<p class="no-results">Could not reach the server. Try again.</p>';
      }
    }

    tabs.addEventListener('click', (e) => {
      const btn = e.target.closest('.pill');
      if (btn) showTab(btn.dataset.tab);
    });
    spotsList.addEventListener('click', (e) => {
      const btn = e.target.closest('.up-spot');
      if (btn) openStoreOnMap(btn.dataset.storeId, btn.dataset.storeName);
    });
    document.getElementById('up-back').addEventListener('click', () => {
      switchView(userProfileFrom || 'community-feed');
    });

    views['user-profile'].onShow = (o) => { if (o && o.username) load(o.username); };
    load(opts.username);
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
        const res = await apiFetch('api/notifications/list.php');
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Failed to load notifications.');

        const changed = JSON.stringify(data.notifications.map(n => [n.id, n.is_read])) !==
                         JSON.stringify(notifications.map(n => [n.id, n.is_read]));
        notifications = data.notifications;
        if (changed || showLoading) render();
      } catch (err) {
        if (showLoading) {
          listEl.innerHTML = `<p class="no-results">Could not load notifications — ${escapeHtml(err.message)}</p>`;
        }
      }
    }

    // 5.13: a notification opens what it is about
    function openNotificationTarget(n) {
      const id = Number(n.target_id);
      if (n.target_type === 'haul') {
        openHaulDetail(id);
      } else if (n.target_type === 'store') {
        switchView('find-a-store');
        const finder = views['find-a-store'];
        if (finder.showStore) finder.showStore(id, n.location_label || '');
      } else if (n.target_type === 'trail') {
        switchView('trail');
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
        const hasTarget = !!(n.target_type && n.target_id);
        const icon = n.target_type === 'trail' ? '\u2713' : ({ like: '\u2665', comment: '\u270E', rating: '\u2605', spot: '\u2316', system: '\u2605' }[n.type] || '\u2605');
        if (hasTarget) item.classList.add('has-target');
        item.innerHTML = `
          <span class="notif-dot"></span>
          <div class="notif-avatar${isSystem ? ' notif-avatar-system' : ''}">${isSystem ? '★' : escapeHtml(actor.charAt(0).toUpperCase())}</div>
          <div class="notif-body">
            <p class="notif-text">${isSystem ? '' : `<button type="button" class="user-link" data-username="${escapeHtml(actor)}">@${escapeHtml(actor)}</button> `}${escapeHtml(n.message)}</p>
            <p class="notif-location">${escapeHtml(n.location_label || '')}</p>
          </div>
          <div class="notif-right">
            <span class="notif-time">${timeAgo(n.created_at)}</span>
            <div class="notif-thumb notif-type notif-type-${escapeHtml(n.type)}" title="${escapeHtml(n.type)}">${icon}</div>
          </div>`;
        item.addEventListener('click', (e) => {
          markAsRead(n.id);
          if (e.target.closest('.user-link') || !hasTarget) return;   // names open that person's profile instead
          openNotificationTarget(n);
        });
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
        await apiFetch('api/notifications/mark_read.php', {
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
        await apiFetch('api/notifications/mark_read.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
      } catch (err) {}
    });

    function startPolling() {
      stopPolling();
      pollTimer = setInterval(() => { if (!document.hidden) fetchNotifications(false); }, 5000); // skipped while the browser tab is hidden
    }
    function stopPolling() {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
    }

    fetchNotifications();
    startPolling();
    views['notifications'].onShow = () => { fetchNotifications(false); startPolling(); };
    views['notifications'].onHide = stopPolling;

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
    const LOCATION_PLACEHOLDER = 'Location not set';
    const BIO_PLACEHOLDER = 'No bio yet.';
    function fillProfileCard() {
      if (!currentUser) return;
      const displayName = currentUser.display_name || currentUser.username;
      document.getElementById('profile-name').textContent = displayName;
      document.getElementById('profile-handle').textContent = '@' + currentUser.username;
      document.getElementById('profile-location').textContent = currentUser.location || LOCATION_PLACEHOLDER;
      document.getElementById('profile-bio').textContent = currentUser.bio || BIO_PLACEHOLDER;
      document.querySelector('.profile-avatar').textContent = displayName.charAt(0).toUpperCase();
    }
    fillProfileCard();

    // Fetch real stats (hauls posted, likes received, spots saved) instead
    // of the static placeholder numbers baked into the HTML.
    function loadStats() {
      apiFetch('api/profile/stats.php')
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

    let savedSpots = [];
    let savedSort = 'nearby';

    const grid = document.getElementById('profile-masonry');
    const savedPanel = document.getElementById('saved-spots-panel');
    const savedListEl = document.getElementById('saved-spots-list');
    const savedCountText = document.getElementById('saved-spots-count-text');
    const noItemsMsg = document.getElementById('no-items');
    const tabsContainer = document.getElementById('profile-tabs');

    const draftsPanel = document.getElementById('drafts-panel');
    const draftsListEl = document.getElementById('drafts-list');
    const noDraftsMsg = document.getElementById('no-drafts');

    let activeTab = 'hauls';

    function render() {
      grid.classList.toggle('hidden', activeTab !== 'hauls' && activeTab !== 'saved');
      savedPanel.classList.toggle('hidden', activeTab !== 'spots');
      draftsPanel.classList.toggle('hidden', activeTab !== 'drafts');
      // The generic "Nothing here yet" message only belongs to Hauls / Saved Spots
      if (activeTab === 'drafts') noItemsMsg.classList.add('hidden');

      if (activeTab === 'hauls') {
        renderHauls();
      } else if (activeTab === 'spots') {
        renderSavedSpots();
      } else if (activeTab === 'saved') {
        renderSavedHauls();
      } else {
        renderDrafts();
      }
    }

    async function renderHauls() {
      grid.innerHTML = '<p class="no-results">Loading your hauls…</p>';
      try {
        const res = await apiFetch('api/hauls/list.php?mine=1');
        const data = await res.json();
        const myHauls = data.hauls || [];

        grid.innerHTML = '';
        noItemsMsg.classList.toggle('hidden', myHauls.length > 0);

        myHauls.forEach(h => {
          const mediaHtml = h.image_path
            ? `<img class="item-fill" src="${escapeHtml(h.image_path)}" alt="${escapeHtml(h.item_name)}">`
            : `<div class="item-fill"></div>`;
          const card = document.createElement('div');
          card.className = 'profile-card-item';
          card.innerHTML = `
            ${mediaHtml}
            <div class="item-caption">
              ${escapeHtml(h.item_name)}
              <span>${h.price !== null ? '₱' + h.price.toFixed(0) : 'Price N/A'}</span>
              ${detailsHtml(h, true)}
            </div>
            <div class="item-actions">
              <button type="button" data-action="edit">Edit</button>
              <button type="button" data-action="delete" class="danger">Delete</button>
            </div>`;
          card.querySelector('[data-action="edit"]').addEventListener('click', (e) => { e.stopPropagation(); openHaulEdit(h); });
          card.querySelector('[data-action="delete"]').addEventListener('click', (e) => { e.stopPropagation(); deleteMyHaul(h); });
          card.addEventListener('click', () => openHaulDetail(h.id));
          grid.appendChild(card);
        });
      } catch (err) {
        grid.innerHTML = '<p class="no-results">Could not load your hauls.</p>';
      }
    }

    async function renderSavedHauls() {
      grid.innerHTML = '<p class="no-results">Loading saved items…</p>';
      try {
        const res = await apiFetch('api/saved-hauls/list.php');
        const data = await res.json();
        const items = data.hauls || [];
        grid.innerHTML = '';
        noItemsMsg.classList.toggle('hidden', items.length > 0);
        items.forEach(h => {
          const mediaHtml = h.image_path
            ? `<img class="item-fill" src="${escapeHtml(h.image_path)}" alt="${escapeHtml(h.item_name)}">`
            : `<div class="item-fill"></div>`;
          const card = document.createElement('div');
          card.className = 'profile-card-item';
          card.innerHTML = `
            ${mediaHtml}
            <div class="item-caption">
              ${escapeHtml(h.item_name)}
              <span>${h.price !== null ? '₱' + h.price.toFixed(0) : 'Price N/A'}</span>
              ${detailsHtml(h, true)}
            </div>
            <div class="item-actions"><button type="button" data-action="unsave">Unsave</button></div>`;
          card.querySelector('[data-action="unsave"]').addEventListener('click', async (e) => {
            e.stopPropagation();
            if (await toggleSavedHaul(h.id) === false) renderSavedHauls();
          });
          card.addEventListener('click', () => openHaulDetail(h.id));
          grid.appendChild(card);
        });
      } catch (err) {
        grid.innerHTML = '<p class="no-results">Could not load your saved items.</p>';
      }
    }

    async function deleteMyHaul(h) {
      if (!(await confirmDialog('Delete this haul? This can\'t be undone.'))) return;
      try {
        const res = await apiFetch('api/hauls/delete.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: h.id })
        });
        const data = await res.json();
        if (!data.success) { showToast(data.error || 'Could not delete that haul.', 'error'); return; }
        showToast('Haul deleted.');
        renderHauls();
        loadStats();
        if (views['community-feed'].inited && views['community-feed'].refreshHauls) views['community-feed'].refreshHauls();
      } catch (err) {
        showToast('Could not reach the server. Try again.', 'error');
      }
    }

    async function renderSavedSpots(askForLocation = false) {
      savedListEl.innerHTML = '<p class="no-results">Loading saved spots…</p>';
      try {
        // "Nearby" uses the visitor's position when we can get it without
        // nagging; picking Nearby from the dropdown is allowed to ask.
        const params = new URLSearchParams();
        if (savedSort === 'nearby') {
          const coords = await getUserCoords(askForLocation);
          if (coords) { params.set('lat', coords.lat); params.set('lng', coords.lng); }
        }
        const qs = params.toString();
        const res = await apiFetch('api/saved-spots/list.php' + (qs ? '?' + qs : ''));
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
            <div class="saved-spot-thumb">${escapeHtml(spot.name.charAt(0))}</div>
            <div class="saved-spot-info">
              <div class="saved-spot-top">
                <h4>${escapeHtml(spot.name)}</h4>
                <div class="rating-menu">
                  <span class="rating">${ratingLabel}</span>
                  <button type="button" class="card-menu-btn" aria-label="More options">&#8942;</button>
                </div>
              </div>
              <p class="distance">${escapeHtml(spot.distance_label || spot.address || '')}</p>
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
              </div>`;

          card.querySelector('.saved-directions-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            openDirections(spot);
          });
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
        await apiFetch('api/saved-spots/toggle.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ store_id: id })
        });
      } catch (err) { /* fall through to re-render anyway; next load will resync */ }
      renderSavedSpots();
    }

    async function renderDrafts() {
      draftsListEl.innerHTML = '<p class="no-results">Loading drafts…</p>';
      try {
        const res = await apiFetch('api/drafts/list.php');
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Failed to load drafts.');

        const drafts = (data.hauls || []).map(d => ({ ...d, type: 'haul' }))
          .sort((a, b) => b.created_at.localeCompare(a.created_at));

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
              <span class="draft-type">Haul draft</span>
              <p class="draft-title${d.item_name ? '' : ' untitled'}">${d.item_name ? escapeHtml(d.item_name) : 'Untitled draft'}</p>
              <p class="draft-meta">Saved ${formatTimeAgo(d.created_at)}</p>
            </div>
            <div class="draft-actions">
              <button type="button" class="draft-btn primary" data-action="edit">Continue</button>
              <button type="button" class="draft-btn danger" data-action="delete">Delete</button>
            </div>`;

          card.querySelector('[data-action="edit"]').addEventListener('click', () => {
            openHaulDraft(d);
          });
          card.querySelector('[data-action="delete"]').addEventListener('click', async () => {
            if (!(await confirmDialog('Delete this draft? This can\'t be undone.'))) return;
            try {
              const r = await apiFetch('api/drafts/delete.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: d.type, id: d.id })
              });
              const out = await r.json();
              if (!out.success) { showAlert(out.error || 'Could not delete that draft.', 'error'); return; }
              renderDrafts();
            } catch (err) {
              showAlert('Could not reach the server. Is your PHP backend running?');
            }
          });
          draftsListEl.appendChild(card);
        });
      } catch (err) {
        draftsListEl.innerHTML = `<p class="no-results">Could not load drafts: ${escapeHtml(err.message)}</p>`;
      }
    }

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
        renderSavedSpots(savedSort === 'nearby');
      });

    function setTab(tab) {
      activeTab = ['spots', 'drafts', 'saved'].includes(tab) ? tab : 'hauls';
      tabsContainer.querySelectorAll('.pill').forEach(p => p.classList.toggle('active', p.dataset.tab === activeTab));
      render();
    }

    render();

    tabsContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.pill');
      if (!btn) return;
      setTab(btn.dataset.tab);
    });

    // Edit profile: name, location and bio become editable; Save posts them to
    // the server. The @handle is the login name, so it stays read-only.
    const editBtn = document.getElementById('edit-profile-btn');
    const nameEl = document.getElementById('profile-name');
    const locationEl = document.getElementById('profile-location');
    const bioEl = document.getElementById('profile-bio');
    const editableFields = [nameEl, locationEl, bioEl];
    let editing = false;
    let savingProfile = false;

    function setEditing(on) {
      editing = on;
      editableFields.forEach(f => f.setAttribute('contenteditable', on));
      editBtn.textContent = on ? 'Save Profile' : 'Edit Profile';
      editBtn.classList.toggle('saving', on);
    }
    // contenteditable can hold pasted markup/newlines: read plain text, one line
    function fieldText(el, placeholder) {
      const t = el.textContent.replace(/\s+/g, ' ').trim();
      return t === placeholder ? '' : t;
    }

    editableFields.forEach(f => f.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); editBtn.click(); }
      if (e.key === 'Escape') { setEditing(false); fillProfileCard(); }   // cancel
    }));

    editBtn.addEventListener('click', async () => {
      if (savingProfile) return;
      if (!editing) {
        // empty the "not set" placeholders so there is nothing to delete first
        if (!currentUser.location) locationEl.textContent = '';
        if (!currentUser.bio) bioEl.textContent = '';
        setEditing(true);
        nameEl.focus();
        return;
      }

      const display_name = fieldText(nameEl, '');
      const location = fieldText(locationEl, LOCATION_PLACEHOLDER);
      const bio = fieldText(bioEl, BIO_PLACEHOLDER);
      if (!display_name) { showToast("Your name can't be empty.", 'error'); return; }
      if (display_name.length > 50) { showToast('Name must be 50 characters or fewer.', 'error'); return; }
      if (location.length > 60) { showToast('Location must be 60 characters or fewer.', 'error'); return; }
      if (bio.length > 160) { showToast('Bio must be 160 characters or fewer.', 'error'); return; }

      savingProfile = true;
      editBtn.disabled = true;
      try {
        const res = await apiFetch('api/profile/update.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ display_name, bio, location })
        });
        const data = await res.json();
        if (!data.success) {
          showToast(data.error || 'Could not save your profile.', 'error');
          return;   // stay in edit mode so nothing typed is lost
        }
        applyLoggedInUser(data.user);   // header avatar + dropdown name
        fillProfileCard();              // profile card from what the server saved
        setEditing(false);
        showToast('Profile saved.');
      } catch (err) {
        showToast('Could not reach the server. Try again.', 'error');
      } finally {
        savingProfile = false;
        editBtn.disabled = false;
      }
    });

    document.getElementById('add-item-btn').addEventListener('click', () => {
      openPostHaulModal();
    });

    // Only re-render the tab that's actually showing. They all share one
    // "Nothing here yet" message, so refreshing a hidden tab would flip it on.
    views['profile'].refreshHauls = () => { if (activeTab === 'hauls') renderHauls(); };
    views['profile'].refreshSavedSpots = () => { if (activeTab === 'spots') renderSavedSpots(); };
    views['profile'].refreshDrafts = () => { if (activeTab === 'drafts') renderDrafts(); };
    views['profile'].refreshSavedHauls = () => { if (activeTab === 'saved') renderSavedHauls(); };
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