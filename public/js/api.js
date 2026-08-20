const API_BASE = '';

async function fetchProducts() {
    try {
        const response = await fetch(`${API_BASE}/api/products`);
        if (!response.ok) throw new Error('Failed to fetch products');
        return await response.json();
    } catch (err) {
        console.error('Error fetching products:', err);
        return [];
    }
}

async function fetchAlerts() {
    try {
        const response = await fetch(`${API_BASE}/api/alerts`);
        if (!response.ok) throw new Error('Failed to fetch alerts');
        return await response.json();
    } catch (err) {
        console.error('Error fetching alerts:', err);
        return [];
    }
}

function formatPrice(price) {
    return price ? `₹${price.toLocaleString('en-IN')}` : '₹N/A';
}

function getStockStatus(availability) {
    if (!availability || availability === 'Unknown') return 'Unknown';
    if (availability.toLowerCase().includes('unavailable') || availability.toLowerCase().includes('out of stock')) {
        return 'Out of Stock';
    }
    if (availability.toLowerCase().includes('low stock')) {
        return 'Low Stock';
    }
    return 'In Stock';
}

function getHealthStatus(product) {
    if (product.error) return 'Error';
    if (!product.price || product.price === 0) return 'Needs attention';
    return 'Healthy';
}

function renderProductRow(product) {
    const stockStatus = getStockStatus(product.availability);
    const stockClass = stockStatus === 'In Stock' ? 'stock-good' :
                      stockStatus === 'Low Stock' ? 'stock-warning' : 'stock-danger';

    const healthStatus = getHealthStatus(product);
    const statusClass = healthStatus === 'Healthy' ? 'badge-success' :
                      healthStatus === 'Error' ? 'badge-danger' : 'badge-warning';

    const price = formatPrice(product.price);
    const target = formatPrice(product.target);

    return `
        <td><strong>${product.name}</strong></td>
        <td class="muted">${product.store}</td>
        <td><strong>${price}</strong></td>
        <td class="muted">${target}</td>
        <td><span class="${stockClass}">${stockStatus}</span></td>
        <td><span class="status-badge ${statusClass}">${healthStatus}</span></td>`;
}
