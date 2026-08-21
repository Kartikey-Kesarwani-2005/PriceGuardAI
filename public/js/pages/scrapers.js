const scraperList = document.getElementById('scraperList');
const scraperCategoryTabs = document.getElementById('scraperCategoryTabs');
let allScraperProducts = [];
let activeScraperCategory = null;

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

loadScraperCategories();
renderScrapers();
