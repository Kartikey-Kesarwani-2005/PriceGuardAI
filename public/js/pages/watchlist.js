/* Watchlist — device-local starred products with live deal intelligence.
   Reuses PGWatch storage, /api/products data and the /history endpoint
   that powers Price History. No synthetic prices are created client-side. */

const watchGrid = document.getElementById('watchGrid');
const watchSummary = document.getElementById('watchSummary');
const HIST_RANGE = '90d';

function fmtDay(iso) {
    const d = new Date(String(iso || '').slice(0, 10) + 'T00:00:00');
    if (isNaN(d)) return '';
    return d.getDate() + ' ' + d.toLocaleString('en', { month: 'short' });
}

/* Baseline for "movement since added": prefer the price actually captured at
   star time, then the first tracked point on/after that day, then the oldest
   point we have (legacy entries starred before this feature). */
function sinceBaseline(meta, hist) {
    if (meta && Number(meta.priceAtAdd) > 0) {
        const lbl = fmtDay(meta.addedAt);
        return { base: Number(meta.priceAtAdd), sinceLabel: lbl ? 'Since ' + lbl : 'Since added' };
    }
    if (!hist || !hist.points || !hist.points.length) return null;
    if (meta && meta.addedAt) {
        const t = new Date(meta.addedAt).getTime();
        if (!isNaN(t)) {
            const pt = hist.points.find(x => new Date(x.date + 'T00:00:00').getTime() >= t);
            if (pt && pt.price > 0) return { base: pt.price, sinceLabel: 'Since ' + fmtDay(pt.date) };
        }
    }
    const first = hist.points[0];
    return first && first.price > 0 ? { base: first.price, sinceLabel: 'Since ' + fmtDay(first.date) } : null;
}

/* most recent tracked price that differs from the current one */
function prevTrackedPrice(p, hist) {
    if (!hist || !hist.points || hist.points.length < 2 || !p.price) return null;
    for (let i = hist.points.length - 1; i >= 0; i--) {
        const pt = hist.points[i];
        if (pt.price > 0 && Math.abs(pt.price - p.price) >= 1) return pt.price;
    }
    return null;
}

async function loadHistory(id) {
    const res = await fetch('/api/products/' + encodeURIComponent(id) + '/history?range=' + HIST_RANGE);
    if (!res.ok) throw new Error('history failed');
    return res.json();
}

async function renderWatchlist() {
    if (!watchGrid) return;
    const entries = PGWatch.get().map(id => ({ id, meta: PGWatch.meta(id) }));

    if (!entries.length) {
        if (watchSummary) watchSummary.innerHTML = '';
        watchGrid.innerHTML = `
            <div class="state-card wide">
                <h4>Your watchlist is empty</h4>
                <p>Tap the star on any product card and it will wait for you here — with deal scores and price movement.</p>
                <a class="mini-btn mb-primary" href="products.html">Browse products</a>
            </div>`;
        return;
    }

    const products = await fetchProducts();
    const byId = {};
    products.forEach(p => { byId[p.id] = p; });

    let items = [];
    entries.forEach(e => {
        if (byId[e.id]) items.push({ p: byId[e.id], meta: e.meta });
        else PGWatch.remove(e.id);   /* product no longer tracked — clean id + meta */
    });

    if (!items.length) {
        if (watchSummary) watchSummary.innerHTML = '';
        watchGrid.innerHTML = `
            <div class="state-card wide">
                <h4>Your starred products are gone</h4>
                <p>The products you watched were removed from tracking. Star a few new ones.</p>
                <a class="mini-btn mb-primary" href="products.html">Browse products</a>
            </div>`;
        return;
    }

    /* newest stars first; legacy entries (no timestamp) go last */
    items.sort((a, b) => String((b.meta && b.meta.addedAt) || '').localeCompare(String((a.meta && a.meta.addedAt) || '')));

    /* live tracked history per product, fetched in parallel */
    const results = await Promise.allSettled(items.map(it => loadHistory(it.p.id)));
    items.forEach((it, i) => {
        it.hist = results[i].status === 'fulfilled' ? results[i].value : null;
        it.baseline = sinceBaseline(it.meta, it.hist);
        it.prev = prevTrackedPrice(it.p, it.hist);
        it.vd = Intel.verdict(it.p, it.hist);
        it.dropped = it.baseline && it.p.price > 0 && it.p.price < it.baseline.base;
    });

    const buyNow = items.filter(it => it.vd.buy).length;
    const dropped = items.filter(it => it.dropped).length;

    if (watchSummary) {
        watchSummary.innerHTML = `
            <div class="stat-card"><div class="stat-top"><div><p class="stat-title">On your watchlist</p><h2 class="stat-value">${items.length}</h2></div><div class="stat-icon">${Layout.icons.watchlist}</div></div></div>
            <div class="stat-card"><div class="stat-top"><div><p class="stat-title">Buy-now signals</p><h2 class="stat-value">${buyNow}</h2></div><div class="stat-icon">${Layout.icons.shield}</div></div></div>
            <div class="stat-card"><div class="stat-top"><div><p class="stat-title">Dropped since starring</p><h2 class="stat-value">${dropped}</h2></div><div class="stat-icon">${Layout.icons.insights}</div></div></div>
            <div class="stat-card"><div class="stat-top"><div><p class="stat-title">Active alerts</p><h2 class="stat-value">${items.filter(it => PGAlerts.has(it.p.id)).length}</h2></div><div class="stat-icon">${Layout.icons.bell}</div></div></div>`;
    }

    const head = document.getElementById('pageSub');
    if (head) head.textContent = `${items.length} tracked on this device`;

    watchGrid.innerHTML = items.map(it => buildProductCard(it.p, {
        history: it.hist,
        watch: it.baseline ? { base: it.baseline.base, sinceLabel: it.baseline.sinceLabel, prev: it.prev } : null,
        removeBtn: true
    })).join('');
}

/* Remove quick-action: collapse the card, unstar, refresh */
document.addEventListener('click', e => {
    const btn = e.target.closest('.pcard-drop');
    if (!btn) return;
    const card = btn.closest('.pcard');
    if (card) card.classList.add('wl-out');
    setTimeout(() => {
        PGWatch.remove(btn.dataset.dropId);
        pgToast('Removed from watchlist');
        renderWatchlist();
    }, card ? 230 : 0);
});

/* keep the view in sync when the star itself is used from this page */
document.addEventListener('click', e => {
    if (!e.target.closest('.pcard-watch')) return;
    setTimeout(renderWatchlist, 60);
});

renderWatchlist();
