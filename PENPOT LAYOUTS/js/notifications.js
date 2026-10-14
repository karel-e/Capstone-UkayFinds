document.addEventListener('DOMContentLoaded', () => {

  /* ==========================================
     NOTIFICATION DATA
     Swap for a real API later — everything below
     just reads/writes this array.
     ========================================== */
  let notifications = [
    { id: 1, type: "comment", user: "@vintage_kim", text: 'commented on your haul: "Nice find!"', location: "Consolacion Public Market", time: "10m ago", unread: true },
    { id: 2, type: "like",    user: "@fitbymitz",   text: "liked your haul post",              location: "Consolacion Public Market", time: "22m ago", unread: true },
    { id: 3, type: "spot",    user: "@ukayqueen",   text: "added a new spot near you: ThriftLift Consolacion", location: "Consolacion, Cebu", time: "1h ago", unread: false },
    { id: 4, type: "comment", user: "@rack.raider",  text: 'commented on your haul: "Where\'d you get this?!"', location: "Consolacion Public Market", time: "3h ago", unread: false },
    { id: 5, type: "like",    user: "@outfitoftheday", text: "liked your haul post", location: "Consolacion Public Market", time: "5h ago", unread: false },
    { id: 6, type: "spot",    user: "@secondstoryco", text: "added a new spot near you: Rack & Roll Thrift", location: "Consolacion, Cebu", time: "1d ago", unread: false }
  ];

  const listEl = document.getElementById('notif-list');
  const noNotifsMsg = document.getElementById('no-notifs');
  const markAllBtn = document.getElementById('mark-all-read-btn');

  let activeFilter = 'all';

  function render() {
    listEl.innerHTML = '';
    const filtered = notifications.filter(n => activeFilter === 'all' || n.type === activeFilter);

    noNotifsMsg.classList.toggle('hidden', filtered.length > 0);

    filtered.forEach(n => {
      const item = document.createElement('div');
      item.className = 'notif-item' + (n.unread ? ' unread' : '');
      item.dataset.id = n.id;
      item.innerHTML = `
        <span class="notif-dot"></span>
        <div class="notif-avatar">${n.user.charAt(1).toUpperCase()}</div>
        <div class="notif-body">
          <p class="notif-text"><strong>${n.user}</strong> ${n.text}</p>
          <p class="notif-location">${n.location}</p>
        </div>
        <div class="notif-right">
          <span class="notif-time">${n.time}</span>
          <div class="notif-thumb"></div>
        </div>`;
      item.addEventListener('click', () => markAsRead(n.id));
      listEl.appendChild(item);
    });

    updateMarkAllState();
  }

  function markAsRead(id) {
    const n = notifications.find(n => n.id === id);
    if (n && n.unread) {
      n.unread = false;
      render();
    }
  }

  function updateMarkAllState() {
    const hasUnread = notifications.some(n => n.unread);
    markAllBtn.disabled = !hasUnread;
  }

  markAllBtn.addEventListener('click', () => {
    notifications.forEach(n => n.unread = false);
    render();
  });

  render();

  /* ==========================================
     FILTER PILLS ("All" + the dropdown options)
     ========================================== */
  const allPill = document.querySelector('.pill[data-filter="all"]');
  const dropdownBtn = document.getElementById('filter-dropdown-btn');
  const dropdownMenu = document.getElementById('filter-dropdown-menu');

  allPill.addEventListener('click', () => {
    activeFilter = 'all';
    allPill.classList.add('active');
    dropdownMenu.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    dropdownBtn.classList.remove('active');
    render();
  });

  dropdownBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdownMenu.classList.toggle('open');
  });

  dropdownMenu.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      activeFilter = btn.dataset.filter;
      allPill.classList.remove('active');
      dropdownMenu.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      dropdownBtn.classList.add('active');
      dropdownMenu.classList.remove('open');
      render();
    });
  });

  document.addEventListener('click', (e) => {
    if (!dropdownMenu.contains(e.target) && e.target !== dropdownBtn) {
      dropdownMenu.classList.remove('open');
    }
  });

  /* ==========================================
     AVATAR DROPDOWN — same behavior as the other pages
     ========================================== */
  const avatarBtn = document.getElementById('user-avatar-btn');
  const userDropdown = document.getElementById('user-dropdown');

  avatarBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    userDropdown.classList.toggle('open');
    avatarBtn.setAttribute('aria-expanded', userDropdown.classList.contains('open'));
  });

  document.addEventListener('click', (e) => {
    if (!userDropdown.contains(e.target) && e.target !== avatarBtn) userDropdown.classList.remove('open');
  });

});