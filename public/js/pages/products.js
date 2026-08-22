const table = document.getElementById('productsTable');
const categoryTabs = document.getElementById('categoryTabs');
let allProducts = [];
let activeCategory = null;
let categories = {};

async function renderProducts(productList) {
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
    const hint = document.getElementById('compareHint');

    checks.forEach(c => c.addEventListener('change', () => {
        const selected = document.querySelectorAll('.compare-check:checked');
        if (selected.length < 2) {
            if (btn) { btn.disabled = true; btn.textContent = 'Compare Selected'; }
            if (hint) hint.textContent = 'Select 2+ products from same category';
            return;
        }

        const cats = new Set();
        selected.forEach(s => cats.add(s.dataset.category));

        if (cats.size > 1) {
            if (btn) { btn.disabled = true; btn.textContent = 'Compare Selected'; }
            if (hint) hint.textContent = 'Select products from the same category only';
        } else {
            if (btn) { btn.disabled = false; btn.textContent = `Compare (${selected.length})`; }
            if (hint) hint.textContent = `Comparing ${cats.values().next().value} products`;
        }
    }));
}

async function loadProducts(category) {
    try {
        allProducts = await fetchProducts(category);
        renderProducts(allProducts);
    } catch (err) {
        console.error('Error loading products:', err);
    }
}

async function loadCategories() {
    categories = await fetchCategories();
    if (!categoryTabs) return;

    categoryTabs.innerHTML = '';
    const allTab = document.createElement('button');
    allTab.className = 'cat-tab active';
    allTab.textContent = 'All';
    allTab.addEventListener('click', () => {
        activeCategory = null;
        document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
        allTab.classList.add('active');
        loadProducts();
    });
    categoryTabs.appendChild(allTab);

    Object.keys(categories).forEach(cat => {
        const tab = document.createElement('button');
        tab.className = 'cat-tab';
        tab.textContent = `${cat} (${categories[cat].length})`;
        tab.addEventListener('click', () => {
            activeCategory = cat;
            document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            loadProducts(cat);
        });
        categoryTabs.appendChild(tab);
    });
}

loadCategories();
loadProducts();

const search = document.getElementById('productSearch');
function filterProducts() {
    const value = search.value.toLowerCase().trim();
    renderProducts(allProducts.filter(p =>
        p.name.toLowerCase().includes(value) || p.category.toLowerCase().includes(value) || p.store.toLowerCase().includes(value)
    ));
}
if (search) {
    search.addEventListener('input', filterProducts);
    const urlSearch = new URLSearchParams(window.location.search).get('search');
    if (urlSearch) {
        search.value = urlSearch;
        const applyWhenReady = setInterval(() => {
            if (allProducts.length) { clearInterval(applyWhenReady); filterProducts(); }
        }, 100);
        setTimeout(() => clearInterval(applyWhenReady), 5000);
    }
}

const showForm = document.getElementById('showProductForm');
const form = document.getElementById('productForm');
const cancel = document.getElementById('cancelProduct');
const startMonitoring = document.getElementById('startMonitoring');

if (showForm) showForm.addEventListener('click', () => form.classList.toggle('hidden'));
if (cancel) cancel.addEventListener('click', () => form.classList.add('hidden'));

if (startMonitoring) {
    startMonitoring.addEventListener('click', async () => {
        const name = document.getElementById('productName').value;
        const url = document.getElementById('productUrl').value.trim();
        const target = Number(document.getElementById('targetPrice').value);
        if (!name || !target) { alert('Please enter product name and target price.'); return; }

        const originalText = startMonitoring.textContent;
        startMonitoring.disabled = true;
        startMonitoring.textContent = 'Adding...';

        try {
            const res = await fetch('/api/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, target, url })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to add product');

            allProducts.push(data);
            renderProducts(allProducts);
            loadCategories();

            form.classList.add('hidden');
            ['productName', 'targetPrice', 'productUrl'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
        } catch (err) {
            alert(err.message);
        } finally {
            startMonitoring.disabled = false;
            startMonitoring.textContent = originalText;
        }
    });
}

const compareBtn = document.getElementById('compareBtn');
const compareModal = document.getElementById('compareModal');
const compareOverlay = document.getElementById('compareOverlay');
const closeCompare = document.getElementById('closeCompare');
const compareBody = document.getElementById('compareBody');
const compareTitle = document.getElementById('compareTitle');

if (compareBtn) {
    compareBtn.addEventListener('click', async () => {
        const checked = document.querySelectorAll('.compare-check:checked');
        const ids = Array.from(checked).map(c => c.dataset.id);
        if (ids.length < 2) return;

        compareModal.classList.remove('hidden');
        compareBody.innerHTML = '<div class="loading">Loading comparison...</div>';

        const data = await fetchCompare(ids);
        if (!data || !data.products || !data.products.length) {
            compareBody.innerHTML = '<div class="error">Failed to load comparison data</div>';
            return;
        }

        const { category, products: prods } = data;
        compareTitle.textContent = `${category} Comparison`;

        const allSpecs = {};
        prods.forEach(p => {
            if (p.specs) Object.keys(p.specs).forEach(k => { allSpecs[k] = true; });
        });

        let html = '<table class="compare-table"><thead><tr><th></th>';
        prods.forEach(p => { html += `<th>${p.name}</th>`; });
        html += '</tr></thead><tbody>';

        const fields = [
            { label: 'Store', key: 'store' },
            { label: 'Current Price', key: 'price', format: formatPrice },
            { label: 'Original Price', key: 'originalPrice', format: formatPrice },
            { label: 'Target Price', key: 'target', format: formatPrice },
            { label: 'Discount', key: null, format: (_, p) => {
                if (!p.price || !p.originalPrice || p.originalPrice <= p.price) return '-';
                const d = Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100);
                return d > 0 ? `${d}% off` : '-';
            }},
            { label: 'Rating', key: 'rating', format: v => v ? `${v} / 5` : 'N/A' },
            { label: 'Reviews', key: 'reviews', format: v => v ? v.toLocaleString('en-IN') : '0' },
            { label: 'Stock', key: 'availability', format: v => getStockStatus(v) },
        ];

        Object.keys(allSpecs).forEach(key => {
            fields.push({
                label: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1'),
                key: 'specs',
                format: (specs) => (specs && specs[key]) || '-'
            });
        });

        fields.forEach(f => {
            html += `<tr><td class="compare-label">${f.label}</td>`;
            prods.forEach(p => {
                let val = f.key ? p[f.key] : p;
                let display = f.format ? f.format(val, p) : (val || 'N/A');
                let cls = '';
                if (f.label === 'Current Price' && p.price && p.target && p.price <= p.target) cls = 'compare-good';
                if (f.label === 'Stock' && getStockStatus(p.availability) === 'Out of Stock') cls = 'compare-bad';
                if (f.label === 'Stock' && getStockStatus(p.availability) === 'In Stock') cls = 'compare-good';
                html += `<td class="${cls}">${display}</td>`;
            });
            html += '</tr>';
        });

        html += '</tbody></table>';
        compareBody.innerHTML = html;
    });
}

if (closeCompare) closeCompare.addEventListener('click', () => compareModal.classList.add('hidden'));
if (compareOverlay) compareOverlay.addEventListener('click', () => compareModal.classList.add('hidden'));
