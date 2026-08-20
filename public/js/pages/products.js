const table = document.getElementById('productsTable');
let allProducts = [];

async function renderProducts(productList = allProducts) {
    if (!table) return;
    table.innerHTML = '';
    productList.forEach(product => {
        const row = document.createElement('tr');
        row.innerHTML = renderProductRow(product, true);
        table.appendChild(row);
    });
    bindCheckboxes();
}

function bindCheckboxes() {
    const checks = document.querySelectorAll('.compare-check');
    const btn = document.getElementById('compareBtn');
    checks.forEach(c => c.addEventListener('change', () => {
        const selected = document.querySelectorAll('.compare-check:checked');
        if (btn) btn.disabled = selected.length < 2;
        if (btn) btn.textContent = selected.length >= 2 ? `Compare (${selected.length})` : 'Compare Selected';
    }));
}

async function loadProducts() {
    try {
        allProducts = await fetchProducts();
        renderProducts();
    } catch (err) {
        console.error('Error loading products:', err);
    }
}

loadProducts();

const search = document.getElementById('productSearch');
if (search) {
    search.addEventListener('input', () => {
        const value = search.value.toLowerCase().trim();
        renderProducts(allProducts.filter(p =>
            p.name.toLowerCase().includes(value) || p.store.toLowerCase().includes(value)
        ));
    });
}

const showForm = document.getElementById('showProductForm');
const form = document.getElementById('productForm');
const cancel = document.getElementById('cancelProduct');
const startMonitoring = document.getElementById('startMonitoring');

if (showForm) {
    showForm.addEventListener('click', () => form.classList.toggle('hidden'));
}

if (cancel) {
    cancel.addEventListener('click', () => form.classList.add('hidden'));
}

if (startMonitoring) {
    startMonitoring.addEventListener('click', () => {
        const name = document.getElementById('productName').value;
        const target = Number(document.getElementById('targetPrice').value);

        if (!name || !target) {
            alert('Please enter product name and target price.');
            return;
        }

        allProducts.push({
            id: 'custom_' + Date.now(),
            name,
            store: 'Custom',
            target,
            price: 0,
            availability: 'Unknown',
            rating: 0,
            reviews: 0,
            lastChecked: new Date().toISOString()
        });

        renderProducts();
        form.classList.add('hidden');
        document.getElementById('productName').value = '';
        document.getElementById('targetPrice').value = '';
        alert('Product added to monitoring!');
    });
}

const compareBtn = document.getElementById('compareBtn');
const compareModal = document.getElementById('compareModal');
const compareOverlay = document.getElementById('compareOverlay');
const closeCompare = document.getElementById('closeCompare');
const compareBody = document.getElementById('compareBody');

if (compareBtn) {
    compareBtn.addEventListener('click', async () => {
        const checked = document.querySelectorAll('.compare-check:checked');
        const ids = Array.from(checked).map(c => c.dataset.id);
        if (ids.length < 2) return;

        compareModal.classList.remove('hidden');
        compareBody.innerHTML = '<div class="loading">Loading comparison...</div>';

        const data = await fetchCompare(ids);
        if (!data.length) {
            compareBody.innerHTML = '<div class="error">Failed to load comparison data</div>';
            return;
        }

        let html = '<table class="compare-table"><thead><tr><th></th>';
        data.forEach(p => { html += `<th>${p.name}</th>`; });
        html += '</tr></thead><tbody>';

        const fields = [
            { label: 'Store', key: 'store' },
            { label: 'Current Price', key: 'price', format: formatPrice },
            { label: 'Original Price', key: 'originalPrice', format: formatPrice },
            { label: 'Target Price', key: 'target', format: formatPrice },
            { label: 'Rating', key: 'rating', format: v => v ? `${v} / 5` : 'N/A' },
            { label: 'Reviews', key: 'reviews', format: v => v ? v.toLocaleString('en-IN') : '0' },
            { label: 'Stock', key: 'availability', format: v => getStockStatus(v) },
            { label: 'Status', key: null, format: (_, p) => getHealthStatus(p) },
        ];

        fields.forEach(f => {
            html += `<tr><td class="compare-label">${f.label}</td>`;
            data.forEach(p => {
                let val = f.key ? p[f.key] : p;
                let display = f.format ? f.format(val, p) : (val || 'N/A');
                let cls = '';
                if (f.label === 'Current Price' && p.price && p.target && p.price <= p.target) cls = 'compare-good';
                if (f.label === 'Stock' && getStockStatus(p.availability) === 'Out of Stock') cls = 'compare-bad';
                if (f.label === 'Status' && getHealthStatus(p) === 'Healthy') cls = 'compare-good';
                if (f.label === 'Status' && getHealthStatus(p) === 'Error') cls = 'compare-bad';
                html += `<td class="${cls}">${display}</td>`;
            });
            html += '</tr>';
        });

        html += '</tbody></table>';
        compareBody.innerHTML = html;
    });
}

if (closeCompare) {
    closeCompare.addEventListener('click', () => compareModal.classList.add('hidden'));
}

if (compareOverlay) {
    compareOverlay.addEventListener('click', () => compareModal.classList.add('hidden'));
}
