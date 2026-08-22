const API_BASE = '';

async function fetchProducts(category) {
    try {
        const url = category ? `${API_BASE}/api/products?category=${encodeURIComponent(category)}` : `${API_BASE}/api/products`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch products');
        return await response.json();
    } catch (err) {
        console.error('Error fetching products:', err);
        return [];
    }
}

async function fetchCategories() {
    try {
        const response = await fetch(`${API_BASE}/api/categories`);
        if (!response.ok) throw new Error('Failed to fetch categories');
        return await response.json();
    } catch (err) {
        console.error('Error fetching categories:', err);
        return {};
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

async function fetchCompare(ids) {
    try {
        const response = await fetch(`${API_BASE}/api/compare?ids=${ids.join(',')}`);
        if (!response.ok) throw new Error('Failed to compare products');
        return await response.json();
    } catch (err) {
        console.error('Error comparing products:', err);
        return null;
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
    if (product.stale) return 'Needs attention';
    if (!product.price || product.price === 0) return 'Needs attention';
    return 'Healthy';
}

function renderProductRow(product, showCheckbox) {
    const stockStatus = getStockStatus(product.availability);
    const stockClass = stockStatus === 'In Stock' ? 'stock-good' :
                      stockStatus === 'Low Stock' ? 'stock-warning' : 'stock-danger';

    const healthStatus = getHealthStatus(product);
    const statusClass = healthStatus === 'Healthy' ? 'badge-success' :
                      healthStatus === 'Error' ? 'badge-danger' : 'badge-warning';

    const price = formatPrice(product.price);
    const target = formatPrice(product.target);
    const checkbox = showCheckbox ? `<td><input type="checkbox" class="compare-check" data-id="${product.id}" data-category="${product.category}"></td>` : '';
    const discount = product.price && product.originalPrice && product.originalPrice > product.price
        ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
        : 0;

    return `
        ${checkbox}
        <td><a class="row-link" href="product-details.html?id=${encodeURIComponent(product.id)}"><strong>${product.name}</strong><span class="cell-sub">${product.category}</span></a></td>
        <td class="muted">${product.store}</td>
        <td><strong>${price}</strong>${discount > 0 ? `<span class="discount-tag">${discount}% off</span>` : ''}</td>
        <td class="muted">${target}</td>
        <td><span class="${stockClass}">${stockStatus}</span></td>
        <td><span class="status-badge ${statusClass}">${healthStatus}</span></td>`;
}
