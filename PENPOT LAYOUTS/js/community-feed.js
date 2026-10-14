document.addEventListener('DOMContentLoaded', () => {

  /* ==========================================
     HAUL DATA
     Swap for a real API/feed later — height just
     controls the masonry card's visual proportions.
     tags drive the filter pills.
     ========================================== */
  const hauls = [
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

  const grid = document.getElementById('haul-masonry');
  const noHaulsMsg = document.getElementById('no-hauls');

  function renderHauls() {
    grid.innerHTML = '';
    hauls.forEach(h => {
      const card = document.createElement('div');
      card.className = 'haul-card';
      card.dataset.tags = h.tags.join(',');
      card.innerHTML = `
        <div class="haul-fill" style="height:${h.height}px;"></div>
        <div class="haul-caption">
          ${h.user} &middot; ${h.price}
          <span>${h.item}</span>
        </div>`;
      grid.appendChild(card);
    });
  }

  renderHauls();

  /* ==========================================
     FILTER PILLS
     ========================================== */
  document.getElementById('filter-pills').addEventListener('click', (e) => {
    const btn = e.target.closest('.pill');
    if (!btn) return;

    document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');

    const filter = btn.dataset.filter;
    const cards = document.querySelectorAll('.haul-card');
    let visibleCount = 0;

    cards.forEach(card => {
      const tags = card.dataset.tags.split(',');
      const matches = filter === 'all' || tags.includes(filter);
      card.classList.toggle('filtered-out', !matches);
      if (matches) visibleCount++;
    });

    noHaulsMsg.classList.toggle('hidden', visibleCount > 0);
  });

  /* ==========================================
     ADD HAUL — placeholder action
     ========================================== */
  document.getElementById('add-haul-btn').addEventListener('click', () => {
    alert('Share-a-haul upload flow goes here — hook this up to your submission form.');
  });

  /* ==========================================
     AVATAR DROPDOWN — same behavior as the dashboard
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