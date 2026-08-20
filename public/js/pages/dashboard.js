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

    const sh = el('selfHealed');
    if (sh) sh.textContent = '0';

    const pd = el('priceDrops');
    if (pd) pd.textContent = products.filter(p => p.price && p.target && p.price <= p.target).length;
}

renderDashboard();
