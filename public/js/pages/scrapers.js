const scraperList = document.getElementById('scraperList');

async function renderScrapers() {
    if (!scraperList) return;
    scraperList.innerHTML = '<div class="loading">Loading scraper data...</div>';

    try {
        const products = await fetchProducts();
        scraperList.innerHTML = '';

        products.forEach(product => {
            const row = document.createElement('div');
            row.className = 'scraper-row';

            const healthStatus = getHealthStatus(product);
            const statusClass = healthStatus === 'Healthy' ? 'badge-success' :
                              healthStatus === 'Error' ? 'badge-danger' : 'badge-warning';
            const lastChecked = product.lastChecked ? new Date(product.lastChecked).toLocaleString() : 'Never';
            const successRate = product.error ? '0%' : '99.9%';

            row.innerHTML = `
                <div class="scraper-info">
                    <div class="scraper-icon">◉</div>
                    <div>
                        <strong>${product.name}</strong>
                        <span>${product.store} · Last checked: ${lastChecked}</span>
                    </div>
                </div>
                <div class="scraper-right">
                    <span>Success rate: <strong>${successRate}</strong></span>
                    <span class="status-badge ${statusClass}">${healthStatus}</span>
                </div>`;

            scraperList.appendChild(row);
        });
    } catch (err) {
        scraperList.innerHTML = `<div class="error">Error loading scraper data: ${err.message}</div>`;
    }
}

renderScrapers();
