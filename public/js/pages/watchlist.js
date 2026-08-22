/* Watchlist — device-local starred products (uses existing APIs only) */

const watchGrid = document.getElementById('watchGrid');

async function renderWatchlist() {
    if (!watchGrid) return;
    const ids = PGWatch.get();

    if (!ids.length) {
        watchGrid.innerHTML = `
            <div class="state-card wide">
                <h4>Your watchlist is empty</h4>
                <p>Tap the star on any product card and it will wait for you here.</p>
                <a class="mini-btn mb-primary" href="products.html">Browse products</a>
            </div>`;
        return;
    }

    let products = [];
    try {
        products = await fetchProducts();
    } catch (err) {
        watchGrid.innerHTML = `
            <div class="state-card error-state">
                <h4>Couldn't load your watchlist</h4>
                <p>The tracking engine may be offline. Check your connection and retry.</p>
                <button class="mini-btn mb-primary" onclick="renderWatchlist()">Try again</button>
            </div>`;
        return;
    }

    const byId = {};
    products.forEach(p => { byId[p.id] = p; });

    const items = ids.map(id => byId[id]).filter(Boolean);
    const missing = ids.length - items.length;

    /* drop entries whose product no longer exists */
    if (missing > 0) {
        try { localStorage.setItem(PGWatch.KEY, JSON.stringify(items.map(p => p.id))); } catch (e) { /* ignore */ }
    }

    if (!items.length) {
        watchGrid.innerHTML = `
            <div class="state-card wide">
                <h4>Your starred products are gone</h4>
                <p>The products you watched were removed from tracking. Star a few new ones.</p>
                <a class="mini-btn mb-primary" href="products.html">Browse products</a>
            </div>`;
        return;
    }

    const head = document.getElementById('pageSub');
    if (head) head.textContent = `${items.length} tracked on this device`;

    watchGrid.innerHTML = items.map(p => buildProductCard(p, {})).join('');
}

/* keep the view fresh when stars are toggled from this page */
document.addEventListener('click', e => {
    if (!e.target.closest('.pcard-watch')) return;
    setTimeout(() => {
        if (!PGWatch.get().length) renderWatchlist();
    }, 60);
});

renderWatchlist();
