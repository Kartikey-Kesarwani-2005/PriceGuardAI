const table = document.getElementById('productsTable');
let allProducts = [];

async function renderProducts(productList = allProducts) {
    if (!table) return;
    table.innerHTML = '';
    productList.forEach(product => {
        const row = document.createElement('tr');
        row.innerHTML = renderProductRow(product);
        table.appendChild(row);
    });
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
