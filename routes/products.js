const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const router = express.Router();

let USE_DEMO = true;

const CACHE_FILE = path.join(__dirname, '..', 'data', 'cache.json');
const REFRESH_INTERVAL = 15 * 60 * 1000;

const products = [
    { id: 'smartphones', name: 'Smartphones', store: 'Amazon', url: 'https://www.amazon.in/s?k=smartphones&ref=nb_sb_noss', target: 30000, pipeline: 'amazon_product_search' },
    { id: 'laptops', name: 'Laptops', store: 'Amazon', url: 'https://www.amazon.in/s?k=laptops&ref=nb_sb_noss', target: 60000, pipeline: 'amazon_product_search' },
    { id: 'headphones', name: 'Headphones', store: 'Amazon', url: 'https://www.amazon.in/s?k=wireless+headphones&ref=nb_sb_noss', target: 5000, pipeline: 'amazon_product_search' },
    { id: 'smartwatches', name: 'Smartwatches', store: 'Amazon', url: 'https://www.amazon.in/s?k=smartwatches&ref=nb_sb_noss', target: 15000, pipeline: 'amazon_product_search' },
    { id: 'tablets', name: 'Tablets', store: 'Amazon', url: 'https://www.amazon.in/s?k=tablets&ref=nb_sb_noss', target: 30000, pipeline: 'amazon_product_search' },
    { id: 'cameras', name: 'Cameras', store: 'Amazon', url: 'https://www.amazon.in/s?k=cameras&ref=nb_sb_noss', target: 40000, pipeline: 'amazon_product_search' },
    { id: 'gaming', name: 'Gaming Consoles', store: 'Amazon', url: 'https://www.amazon.in/s?k=gaming+consoles&ref=nb_sb_noss', target: 40000, pipeline: 'amazon_product_search' },
    { id: 'tvs', name: 'Televisions', store: 'Flipkart', url: 'https://www.flipkart.com/search?q=televisions', target: 35000, pipeline: 'google_shopping' },
    { id: 'ac', name: 'Air Conditioners', store: 'Flipkart', url: 'https://www.flipkart.com/search?q=air+conditioners', target: 30000, pipeline: 'google_shopping' },
    { id: 'washing-machines', name: 'Washing Machines', store: 'Flipkart', url: 'https://www.flipkart.com/search?q=washing+machines', target: 25000, pipeline: 'google_shopping' },
    { id: 'refrigerators', name: 'Refrigerators', store: 'Flipkart', url: 'https://www.flipkart.com/search?q=refrigerators', target: 30000, pipeline: 'google_shopping' },
    { id: 'speakers', name: 'Speakers', store: 'Croma', url: 'https://www.croma.com/searchB?q=bluetooth%20speakers', target: 5000, pipeline: 'google_shopping' },
    { id: 'earphones', name: 'Earphones', store: 'Croma', url: 'https://www.croma.com/searchB?q=earphones', target: 2000, pipeline: 'google_shopping' },
    { id: 'monitors', name: 'Monitors', store: 'Amazon', url: 'https://www.amazon.in/s?k=computer+monitors&ref=nb_sb_noss', target: 20000, pipeline: 'amazon_product_search' },
    { id: 'printers', name: 'Printers', store: 'Amazon', url: 'https://www.amazon.in/s?k=printers&ref=nb_sb_noss', target: 15000, pipeline: 'amazon_product_search' }
];

const demoData = {
    smartphones:   { price: 24999, originalPrice: 31999, availability: 'In Stock', rating: 4.3, reviews: 12453 },
    laptops:       { price: 54990, originalPrice: 69990, availability: 'In Stock', rating: 4.5, reviews: 8721 },
    headphones:    { price: 3999, originalPrice: 5999, availability: 'In Stock', rating: 4.1, reviews: 23410 },
    smartwatches:  { price: 12999, originalPrice: 17999, availability: 'Low Stock', rating: 4.0, reviews: 5632 },
    tablets:       { price: 27999, originalPrice: 35000, availability: 'In Stock', rating: 4.2, reviews: 3421 },
    cameras:       { price: 42999, originalPrice: 52000, availability: 'In Stock', rating: 4.6, reviews: 1892 },
    gaming:        { price: 49990, originalPrice: 54990, availability: 'Out of Stock', rating: 4.8, reviews: 7654 },
    tvs:           { price: 32999, originalPrice: 44999, availability: 'In Stock', rating: 4.3, reviews: 9821 },
    ac:            { price: 28999, originalPrice: 38000, availability: 'In Stock', rating: 4.1, reviews: 4321 },
    'washing-machines': { price: 22499, originalPrice: 29000, availability: 'In Stock', rating: 4.2, reviews: 6123 },
    refrigerators: { price: 26999, originalPrice: 34000, availability: 'In Stock', rating: 4.4, reviews: 3891 },
    speakers:      { price: 3499, originalPrice: 5499, availability: 'In Stock', rating: 4.0, reviews: 15234 },
    earphones:     { price: 1499, originalPrice: 2499, availability: 'Low Stock', rating: 3.9, reviews: 28910 },
    monitors:      { price: 18999, originalPrice: 24000, availability: 'In Stock', rating: 4.3, reviews: 7654 },
    printers:      { price: 13499, originalPrice: 18000, availability: 'In Stock', rating: 4.1, reviews: 2341 }
};

function loadCache() {
    try {
        if (fs.existsSync(CACHE_FILE)) {
            const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
            return JSON.parse(raw);
        }
    } catch (e) {
        console.error('Failed to load cache:', e.message);
    }
    return { products: {}, lastRefresh: null };
}

function saveCache(cache) {
    try {
        const dir = path.dirname(CACHE_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
    } catch (e) {
        console.error('Failed to save cache:', e.message);
    }
}

let fileCache = loadCache();
let refreshing = false;

function getDemoProduct(product) {
    const d = demoData[product.id] || { price: 0, originalPrice: 0, availability: 'Unknown', rating: 0, reviews: 0 };
    return {
        ...product,
        price: d.price,
        originalPrice: d.originalPrice,
        availability: d.availability,
        rating: d.rating,
        reviews: d.reviews,
        image: '',
        items: [],
        lastChecked: new Date().toISOString()
    };
}

function fetchProductData(product) {
    return new Promise((resolve, reject) => {
        const cmd = `npx -p @brightdata/cli bdata pipelines ${product.pipeline} "${product.url}" --pretty`;
        exec(cmd, { timeout: 120000 }, (error, stdout) => {
            if (error) return reject(error);
            try {
                const data = JSON.parse(stdout);
                resolve(data[0] || data);
            } catch (e) {
                reject(e);
            }
        });
    });
}

function mapProductData(product, data) {
    return {
        ...product,
        price: data.current_price || data.price || data.sale_price || 0,
        originalPrice: data.list_price || data.original_price || 0,
        availability: data.availability || 'Unknown',
        rating: data.rating || 0,
        reviews: data.reviews_count || 0,
        image: data.image || data.image_url || '',
        items: data.items || data.products || [],
        lastChecked: new Date().toISOString()
    };
}

async function fetchSingleProduct(product) {
    if (USE_DEMO) {
        const cached = fileCache.products[product.id];
        if (cached && cached._source === 'demo') return cached;
        const demo = getDemoProduct(product);
        demo._source = 'demo';
        fileCache.products[product.id] = demo;
        saveCache(fileCache);
        return demo;
    }

    const cached = fileCache.products[product.id];
    if (cached && !cached.error) return cached;

    try {
        const data = await fetchProductData(product);
        const mapped = mapProductData(product, data);
        mapped._source = 'live';
        fileCache.products[product.id] = mapped;
        saveCache(fileCache);
        return mapped;
    } catch (err) {
        console.error(`Error fetching ${product.name}:`, err.message);
        const fallback = { ...product, price: 0, originalPrice: 0, availability: 'Error', rating: 0, reviews: 0, image: '', items: [], lastChecked: new Date().toISOString(), error: err.message, _source: 'error' };
        fileCache.products[product.id] = fallback;
        saveCache(fileCache);
        return fallback;
    }
}

async function refreshAllProducts() {
    if (refreshing) return;
    refreshing = true;
    console.log('Refreshing all products...');

    for (const product of products) {
        try {
            const data = await fetchProductData(product);
            const mapped = mapProductData(product, data);
            mapped._source = 'live';
            fileCache.products[product.id] = mapped;
        } catch (err) {
            console.error(`Refresh failed for ${product.name}:`, err.message);
        }
    }

    fileCache.lastRefresh = new Date().toISOString();
    saveCache(fileCache);
    refreshing = false;
    console.log('Refresh complete at', fileCache.lastRefresh);
}

async function fetchAllProducts() {
    return Promise.all(products.map(p => fetchSingleProduct(p)));
}

setInterval(() => {
    if (!USE_DEMO) refreshAllProducts();
}, REFRESH_INTERVAL);

router.get('/mode', (req, res) => {
    res.json({ demo: USE_DEMO, lastRefresh: fileCache.lastRefresh, refreshing });
});

router.post('/mode', (req, res) => {
    USE_DEMO = !!req.body.demo;
    res.json({ demo: USE_DEMO });
});

router.post('/refresh', async (req, res) => {
    if (USE_DEMO) return res.json({ ok: true, message: 'Demo mode - no refresh needed' });
    if (refreshing) return res.json({ ok: false, message: 'Refresh already in progress' });
    refreshAllProducts();
    res.json({ ok: true, message: 'Refresh started' });
});

router.get('/products', async (req, res) => {
    try {
        const results = await fetchAllProducts();
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/products/:id', async (req, res) => {
    const product = products.find(p => p.id === req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    try {
        const data = await fetchSingleProduct(product);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/compare', async (req, res) => {
    const ids = (req.query.ids || '').split(',').filter(Boolean);
    if (ids.length < 2) return res.status(400).json({ error: 'Provide at least 2 product ids' });

    const matched = ids.map(id => products.find(p => p.id === id)).filter(Boolean);
    if (matched.length < 2) return res.status(400).json({ error: 'Could not find enough products to compare' });

    try {
        const results = await Promise.all(matched.map(p => fetchSingleProduct(p)));
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/alerts', async (req, res) => {
    try {
        const allProducts = await fetchAllProducts();
        const alerts = [];

        allProducts.forEach(p => {
            const now = new Date().toISOString();
            if (p.error) {
                alerts.push({ type: 'error', icon: '!', title: 'Scraper error', product: p.name, message: 'Failed to fetch data from ' + p.store, amount: '', time: now });
            }
            if (p.price && p.target && p.price <= p.target) {
                alerts.push({ type: 'price', icon: '↓', title: 'Target price reached', product: p.name, message: 'Current price ₹' + p.price.toLocaleString('en-IN') + ' is at or below target', amount: '₹' + p.target.toLocaleString('en-IN'), time: now });
            }
            if (p.availability && (p.availability.toLowerCase().includes('unavailable') || p.availability.toLowerCase().includes('out of stock'))) {
                alerts.push({ type: 'stock', icon: '!', title: 'Out of stock', product: p.name, message: p.availability, amount: '', time: now });
            }
            if (p.price && p.originalPrice && p.originalPrice > p.price) {
                const discount = Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100);
                if (discount >= 20) {
                    alerts.push({ type: 'price', icon: '↓', title: discount + '% discount available', product: p.name, message: 'Price dropped from ₹' + p.originalPrice.toLocaleString('en-IN') + ' to ₹' + p.price.toLocaleString('en-IN'), amount: '₹' + (p.originalPrice - p.price).toLocaleString('en-IN') + ' off', time: now });
                }
            }
        });

        res.json(alerts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
