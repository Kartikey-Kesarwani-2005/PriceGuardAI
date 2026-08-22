const scraperList = document.getElementById('scraperList');
const scraperCategoryTabs = document.getElementById('scraperCategoryTabs');
let allScraperProducts = [];
let activeScraperCategory = null;

/* ---------- store reliability (from /api/health) ---------- */

async function loadStoreHealth() {
    const box = document.getElementById('storeHealth');
    if (!box) return;
    try {
        const res = await fetch('/api/health');
        if (!res.ok) throw new Error('unavailable');
        const data = await res.json();

        const rows = Object.keys(data.stores || {}).map(name => ({
            name,
            ...data.stores[name]
        })).sort((a, b) => (b.successRate || 0) - (a.successRate || 0));

        if (!rows.length) {
            box.innerHTML = '<div class="state-card slim"><p>No store activity recorded yet.</p></div>';
            return;
        }

        box.innerHTML = rows.map(s => {
            const rate = typeof s.successRate === 'number' ? s.successRate : null;
            return `
            <div class="store-tile">
                <div class="st-top"><strong>${Intel.esc(s.name)}</strong><span class="st-count">${rate === null ? '—' : rate + '%'} success</span></div>
                <div class="st-bar"><i style="width:${rate === null ? 4 : Math.max(4, rate)}%" class="${rate !== null && rate < 60 ? 'low' : ''}"></i></div>
                <div class="st-meta">
                    <span>Checks <b>${s.attempts}</b></span>
                    <span>Self-heals <b>${s.heals}</b></span>
                    ${data.mode === 'demo' ? '<span class="muted-note">demo feed</span>' : ''}
                </div>
            </div>`;
        }).join('');
    } catch (err) {
        box.innerHTML = `
            <div class="state-card error-state">
                <p>Store health is unavailable right now.</p>
                <button class="mini-btn mb-primary" onclick="loadStoreHealth()">Try again</button>
            </div>`;
    }
}

/* ---------- simple freshness summary ---------- */

function renderFreshnessSummary() {
    const box = document.getElementById('dhSummary');
    if (!box) return;

    let live = 0, recent = 0, stale = 0, demo = 0;
    allScraperProducts.forEach(p => {
        const f = Intel.freshness(p);
        if (f.cls === 'live') live++;
        else if (f.cls === 'demo') demo++;
        else if (f.cls === 'recent') recent++;
        else stale++;
    });
    recent += demo;

    const tile = (tone, num, label, desc) => `
        <div class="dh-tile ${tone}">
            <i class="dh-dot"></i>
            <div><strong>${num} ${label}</strong><small>${desc}</small></div>
        </div>`;

    box.innerHTML = `
        <div class="dh-grid">
            ${tile('t-live', live, 'live', 'Synced within the last few minutes')}
            ${tile('t-recent', recent, 'recently updated', 'Fresh within the last day' + (demo ? ' (includes demo feed)' : ''))}
            ${tile('t-stale', stale, 'stale', 'Older data - treat prices with care')}
        </div>
        <p class="dh-note">PriceGuard marks every price with a freshness chip so you always know how much to trust it.</p>`;
}

function renderScraperRow(product) {
    const row = document.createElement('div');
    row.className = 'scraper-row';

    const healthStatus = getHealthStatus(product);
    const statusClass = healthStatus === 'Healthy' ? 'badge-success' :
                      healthStatus === 'Error' ? 'badge-danger' : 'badge-warning';
    const lastChecked = product.lastChecked ? new Date(product.lastChecked).toLocaleString() : 'Never';
    const stats = product.stats || {};
    const successRate = typeof stats.successRate === 'number' ? stats.successRate + '%' : (product._source === 'demo' ? 'demo' : '—');
    const sourceLabel = product.stale ? 'stale cache' : (product._source === 'live-healed' ? 'live (self-healed)' : product._source || '');
    const healBadge = stats.heals > 0 ? `<span title="Scraper Studio auto-repairs applied">Heals: <strong>${stats.heals}</strong></span>` : '';
    const stockStatus = getStockStatus(product.availability);
    const stockClass = stockStatus === 'In Stock' ? 'stock-good' :
                      stockStatus === 'Low Stock' ? 'stock-warning' : 'stock-danger';

    row.innerHTML = `
        <div class="scraper-info">
            <div class="scraper-icon">◉</div>
            <div>
                <strong>${product.name}</strong>
                <span>${product.category} · ${product.store} · Last checked: ${lastChecked}${sourceLabel ? ' · ' + sourceLabel : ''}</span>
            </div>
        </div>
        <div class="scraper-right">
            <span>Price: <strong>${formatPrice(product.price)}</strong></span>
            <span>Stock: <strong class="${stockClass}">${stockStatus}</strong></span>
            <span>Success: <strong>${successRate}</strong></span>
            ${healBadge}
            <span class="status-badge ${statusClass}">${healthStatus}</span>
        </div>`;

    return row;
}

function renderScraperList(products) {
    if (!scraperList) return;
    scraperList.innerHTML = '';

    if (products.length === 0) {
        scraperList.innerHTML = '<div class="loading">No products found</div>';
        return;
    }

    const grouped = {};
    products.forEach(p => {
        if (!grouped[p.category]) grouped[p.category] = [];
        grouped[p.category].push(p);
    });

    Object.keys(grouped).forEach(cat => {
        const header = document.createElement('div');
        header.className = 'scraper-category-header';
        header.innerHTML = `<strong>${cat}</strong><span>${grouped[cat].length} products</span>`;
        scraperList.appendChild(header);

        grouped[cat].forEach(product => {
            scraperList.appendChild(renderScraperRow(product));
        });
    });

    const healthy = products.filter(p => getHealthStatus(p) === 'Healthy').length;
    const attention = products.filter(p => getHealthStatus(p) !== 'Healthy').length;
    document.getElementById('healthyCount').textContent = healthy;
    document.getElementById('attentionCount').textContent = attention;
    document.getElementById('totalCount').textContent = products.length;

    renderFreshnessSummary();
}

async function loadScraperCategories() {
    const categories = await fetchCategories();
    if (!scraperCategoryTabs) return;

    scraperCategoryTabs.innerHTML = '';
    const allTab = document.createElement('button');
    allTab.className = 'cat-tab active';
    allTab.textContent = 'All';
    allTab.addEventListener('click', () => {
        activeScraperCategory = null;
        document.querySelectorAll('#scraperCategoryTabs .cat-tab').forEach(t => t.classList.remove('active'));
        allTab.classList.add('active');
        renderScraperList(allScraperProducts);
    });
    scraperCategoryTabs.appendChild(allTab);

    Object.keys(categories).forEach(cat => {
        const tab = document.createElement('button');
        tab.className = 'cat-tab';
        tab.textContent = `${cat} (${categories[cat].length})`;
        tab.addEventListener('click', () => {
            activeScraperCategory = cat;
            document.querySelectorAll('#scraperCategoryTabs .cat-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            renderScraperList(allScraperProducts.filter(p => p.category === cat));
        });
        scraperCategoryTabs.appendChild(tab);
    });
}

async function renderScrapers() {
    try {
        allScraperProducts = await fetchProducts();
        renderScraperList(allScraperProducts);
    } catch (err) {
        scraperList.innerHTML = `<div class="error">Error loading scraper data: ${err.message}</div>`;
    }
}

loadStoreHealth();
loadScraperCategories();
renderScrapers();
