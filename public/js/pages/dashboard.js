const dashboardTable = document.getElementById('productTable');

async function renderDashboard() {
    if (!dashboardTable) return;
    dashboardTable.innerHTML = '';

    try {
        const products = await fetchProducts();
        products.forEach(product => {
            const row = document.createElement('tr');
            row.innerHTML = renderProductRow(product);
            dashboardTable.appendChild(row);
        });
        updateStats(products);
    } catch (err) {
        console.error('Error rendering dashboard:', err);
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
    if (btn) { btn.textContent = 'Refreshing...'; btn.disabled = true; }
    try {
        await fetch('/api/refresh', { method: 'POST' });
        setTimeout(() => { location.reload(); }, 2000);
    } catch (e) {
        if (btn) { btn.textContent = 'Refresh Data'; btn.disabled = false; }
    }
}

const refreshBtn = document.getElementById('refreshBtn');
if (refreshBtn) refreshBtn.addEventListener('click', manualRefresh);

loadLastRefresh();
renderDashboard();
