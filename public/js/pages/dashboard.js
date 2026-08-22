const dashboardTable = document.getElementById('productTable');

async function renderDashboard() {
    if (!dashboardTable) return;
    dashboardTable.innerHTML = '';

    try {
        const products = await fetchProducts();

        if (products.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = '<td colspan="6" class="empty-cell">No products are being monitored yet. Add one from the Products page.</td>';
            dashboardTable.appendChild(row);
        }

        products.forEach(product => {
            const row = document.createElement('tr');
            row.innerHTML = renderProductRow(product);
            dashboardTable.appendChild(row);
        });
        updateStats(products);
    } catch (err) {
        console.error('Error rendering dashboard:', err);
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="6" class="empty-cell error-text">Could not load products. Is the server running?</td>';
        dashboardTable.appendChild(row);
    }
}

function updateStats(products) {
    const el = (id) => document.getElementById(id);

    const pm = el('productsMonitored');
    if (pm) pm.textContent = products.length;

    const hs = el('healthyScrapers');
    if (hs) hs.textContent = products.filter(p => getHealthStatus(p) === 'Healthy').length;

    const pd = el('priceDrops');
    if (pd) pd.textContent = products.filter(p => p.price && p.target && p.price <= p.target).length;

    const cats = new Set(products.map(p => p.category));
    const st = el('storesTracked');
    if (st) st.textContent = cats.size;
}

async function loadLastRefresh() {
    try {
        const res = await fetch('/api/mode');
        const data = await res.json();
        const el = document.getElementById('lastRefresh');
        if (el && data.lastRefresh) {
            el.textContent = 'Last updated: ' + new Date(data.lastRefresh).toLocaleString();
        } else if (el) {
            el.textContent = 'Last updated: Just now';
        }
    } catch (e) {}
}

async function manualRefresh() {
    const btn = document.getElementById('refreshBtn');
    const originalHtml = btn ? btn.innerHTML : '';
    if (btn) { btn.innerHTML = 'Refreshing...'; btn.disabled = true; }
    try {
        await fetch('/api/refresh', { method: 'POST' });
        const poll = setInterval(async () => {
            try {
                const res = await fetch('/api/mode');
                const data = await res.json();
                if (!data.refreshing) {
                    clearInterval(poll);
                    location.reload();
                }
            } catch (e) {}
        }, 3000);
        setTimeout(() => { clearInterval(poll); location.reload(); }, 180000);
    } catch (e) {
        if (btn) { btn.innerHTML = originalHtml; btn.disabled = false; }
    }
}

const refreshBtn = document.getElementById('refreshBtn');
if (refreshBtn) refreshBtn.addEventListener('click', manualRefresh);

loadLastRefresh();
renderDashboard();
