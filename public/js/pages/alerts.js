const alertsList = document.getElementById('alertsList');
const caughtUp = document.querySelector('.caught-up');

function showCaughtUp(show) {
    if (caughtUp) caughtUp.classList.toggle('hidden', !show);
}

async function renderAlerts() {
    if (!alertsList) return;
    alertsList.innerHTML = '<div class="loading">Loading alerts...</div>';
    showCaughtUp(false);

    try {
        const alerts = await fetchAlerts();
        showCaughtUp(alerts.length === 0);
        alertsList.classList.toggle('hidden', alerts.length === 0);

        if (alerts.length === 0) return;

        alertsList.innerHTML = '';

        alerts.forEach(a => {
            const row = document.createElement('div');
            row.className = 'alert-row';
            const iconClass = a.type === 'error' ? 'alert-icon-error' : a.type === 'stock' ? 'alert-icon-warning' : 'alert-icon';
            const timeAgo = getTimeAgo(a.time);
            row.innerHTML = `
                <div class="${iconClass}">${a.icon}</div>
                <div class="alert-content">
                    <div class="alert-top">
                        <div><h3>${a.title}</h3><strong>${a.product}</strong></div>
                        <span>${timeAgo}</span>
                    </div>
                    <p>${a.message}</p>
                    ${a.amount ? '<b class="alert-amount">' + a.amount + '</b>' : ''}
                </div>`;
            alertsList.appendChild(row);
        });
    } catch (err) {
        showCaughtUp(false);
        alertsList.innerHTML = '<div class="error">Error loading alerts</div>';
    }
}

function getTimeAgo(timestamp) {
    const diff = Date.now() - new Date(timestamp).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return mins + ' minutes ago';
    const hours = Math.floor(mins / 60);
    if (hours < 24) return hours + ' hours ago';
    return Math.floor(hours / 24) + ' days ago';
}

/* ---------- user-set price alerts (device-local targets, live prices) ---------- */

async function renderMyAlerts() {
    const box = document.getElementById('myAlerts');
    if (!box) return;

    const entries = Object.entries(PGAlerts.all()).filter(([, a]) => a && Number(a.target) > 0);

    if (!entries.length) {
        box.innerHTML = `
            <div class="state-card wide">
                <h4>No price alerts yet</h4>
                <p>Tap the bell on any product card, set the price you'd love to pay, and PriceGuard will track it for you.</p>
                <a class="mini-btn mb-primary" href="products.html">Browse products ${typeof Layout !== 'undefined' ? Layout.icons.arrowRight : ''}</a>
            </div>`;
        const sub = document.getElementById('pageSub');
        if (sub) sub.textContent = 'Price, inventory and monitoring notifications.';
        return;
    }

    box.innerHTML = '<div class="skel pcard-skel"></div><div class="skel pcard-skel"></div>';

    let products = [];
    try {
        products = await fetchProducts();
    } catch (err) { /* fall through to empty grid */ }

    const byId = {};
    products.forEach(p => { byId[p.id] = p; });

    const tiles = entries.map(([id]) => byId[id] ? buildProductCard(byId[id], {}) : '').filter(Boolean);

    /* clean up alerts whose product no longer exists */
    if (tiles.length !== entries.length) {
        const alive = entries.filter(([id]) => byId[id]);
        try { localStorage.setItem(PGAlerts.KEY, JSON.stringify(Object.fromEntries(alive))); } catch (e) { /* ignore */ }
    }

    if (!tiles.length) {
        box.innerHTML = `
            <div class="state-card wide">
                <h4>Your alerted products are gone</h4>
                <p>They were removed from tracking. Set new ones from any product card.</p>
                <a class="mini-btn mb-primary" href="products.html">Browse products</a>
            </div>`;
        return;
    }

    box.innerHTML = tiles.join('');
    const sub = document.getElementById('pageSub');
    if (sub) sub.textContent = `${tiles.length} active target${tiles.length === 1 ? '' : 's'} · notifications update live.`;
}

renderMyAlerts();
renderAlerts();

/* removing an alert from its tile should pull the tile out of this grid */
document.addEventListener('click', e => {
    if (!e.target.closest('.tp-del')) return;
    setTimeout(() => {
        if (!document.getElementById('myAlerts')) return;
        const remaining = Object.keys(PGAlerts.all()).filter(id => PGAlerts.get(id));
        if (remaining.length === 0 || !remaining.length) renderMyAlerts();
    }, 60);
});
