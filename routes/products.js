const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const router = express.Router();

let USE_DEMO = true;

const CACHE_FILE = path.join(__dirname, '..', 'data', 'cache.json');
const REFRESH_INTERVAL = 15 * 60 * 1000;

const products = [
    // Smartphones
    { id: 'iphone15', name: 'Apple iPhone 15 (128GB)', category: 'Smartphones', store: 'Amazon', target: 65000, specs: { ram: '6 GB', storage: '128 GB', battery: '3349 mAh', display: '6.1" OLED', processor: 'A16 Bionic' } },
    { id: 'galaxy-s24', name: 'Samsung Galaxy S24 (8GB/256GB)', category: 'Smartphones', store: 'Amazon', target: 60000, specs: { ram: '8 GB', storage: '256 GB', battery: '4000 mAh', display: '6.2" AMOLED', processor: 'Snapdragon 8 Gen 3' } },
    { id: 'oneplus-12', name: 'OnePlus 12 (16GB/256GB)', category: 'Smartphones', store: 'Amazon', target: 55000, specs: { ram: '16 GB', storage: '256 GB', battery: '5400 mAh', display: '6.82" AMOLED', processor: 'Snapdragon 8 Gen 3' } },
    { id: 'pixel-8', name: 'Google Pixel 8 (128GB)', category: 'Smartphones', store: 'Flipkart', target: 50000, specs: { ram: '8 GB', storage: '128 GB', battery: '4575 mAh', display: '6.2" OLED', processor: 'Tensor G3' } },
    { id: 'redmi-note-13', name: 'Redmi Note 13 Pro+ (256GB)', category: 'Smartphones', store: 'Flipkart', target: 30000, specs: { ram: '8 GB', storage: '256 GB', battery: '5000 mAh', display: '6.67" AMOLED', processor: 'MediaTek 7200 Ultra' } },

    // Laptops
    { id: 'macbook-air-m3', name: 'Apple MacBook Air M3 (8GB/256GB)', category: 'Laptops', store: 'Amazon', target: 95000, specs: { ram: '8 GB', storage: '256 GB SSD', processor: 'Apple M3', display: '13.6" Liquid Retina', weight: '1.24 kg' } },
    { id: 'dell-xps-15', name: 'Dell XPS 15 (i7/16GB/512GB)', category: 'Laptops', store: 'Amazon', target: 120000, specs: { ram: '16 GB', storage: '512 GB SSD', processor: 'Intel Core i7-13700H', display: '15.6" OLED', weight: '1.86 kg' } },
    { id: 'asus-rog-strix', name: 'ASUS ROG Strix G16 (i9/16GB/1TB)', category: 'Laptops', store: 'Flipkart', target: 110000, specs: { ram: '16 GB', storage: '1 TB SSD', processor: 'Intel Core i9-13980HX', display: '16" QHD 165Hz', weight: '2.5 kg' } },
    { id: 'hp-pavilion', name: 'HP Pavilion 15 (Ryzen 7/16GB/512GB)', category: 'Laptops', store: 'Amazon', target: 65000, specs: { ram: '16 GB', storage: '512 GB SSD', processor: 'AMD Ryzen 7 7730U', display: '15.6" FHD IPS', weight: '1.74 kg' } },

    // Headphones
    { id: 'sony-wh1000xm5', name: 'Sony WH-1000XM5', category: 'Headphones', store: 'Amazon', target: 25000, specs: { type: 'Over-Ear', anc: 'Yes', battery: '30 hours', driver: '30mm', weight: '250 g' } },
    { id: 'airpods-max', name: 'Apple AirPods Max', category: 'Headphones', store: 'Amazon', target: 50000, specs: { type: 'Over-Ear', anc: 'Yes', battery: '20 hours', driver: '40mm', weight: '384 g' } },
    { id: 'jbl-tune-770', name: 'JBL Tune 770NC', category: 'Headphones', store: 'Croma', target: 8000, specs: { type: 'Over-Ear', anc: 'Yes', battery: '44 hours', driver: '40mm', weight: '252 g' } },
    { id: 'boat-rockerz', name: 'boAt Rockerz 551 ANC', category: 'Headphones', store: 'Amazon', target: 3000, specs: { type: 'Over-Ear', anc: 'Yes', battery: '20 hours', driver: '40mm', weight: '230 g' } },

    // Smartwatches
    { id: 'apple-watch-9', name: 'Apple Watch Series 9 (45mm)', category: 'Smartwatches', store: 'Amazon', target: 42000, specs: { display: '1.9" OLED', battery: '18 hours', water: '50m WR', sensors: 'SpO2, ECG, HR' } },
    { id: 'galaxy-watch-6', name: 'Samsung Galaxy Watch 6 Classic (47mm)', category: 'Smartwatches', store: 'Amazon', target: 30000, specs: { display: '1.47" AMOLED', battery: '40 hours', water: '50m WR', sensors: 'SpO2, ECG, HR' } },
    { id: 'garmin-venu-3', name: 'Garmin Venu 3', category: 'Smartwatches', store: 'Flipkart', target: 45000, specs: { display: '1.4" AMOLED', battery: '14 days', water: '50m WR', sensors: 'SpO2, HR, Sleep' } },
    { id: 'amazfit-gtr-4', name: 'Amazfit GTR 4', category: 'Smartwatches', store: 'Amazon', target: 15000, specs: { display: '1.43" AMOLED', battery: '14 days', water: '50m WR', sensors: 'SpO2, HR, Stress' } },

    // Tablets
    { id: 'ipad-air-m2', name: 'Apple iPad Air M2 (11"/64GB)', category: 'Tablets', store: 'Amazon', target: 55000, specs: { display: '11" Liquid Retina', storage: '64 GB', processor: 'Apple M2', battery: '10 hours', stylus: 'Apple Pencil Pro' } },
    { id: 'samsung-tab-s9', name: 'Samsung Galaxy Tab S9 (128GB)', category: 'Tablets', store: 'Flipkart', target: 60000, specs: { display: '11" AMOLED', storage: '128 GB', processor: 'Snapdragon 8 Gen 2', battery: '8400 mAh', stylus: 'S Pen included' } },
    { id: 'lenovo-tab-p12', name: 'Lenovo Tab P12 (128GB)', category: 'Tablets', store: 'Flipkart', target: 30000, specs: { display: '12.7" LCD', storage: '128 GB', processor: 'MediaTek Dimensity 7050', battery: '10200 mAh', stylus: 'Lenovo Precision Pen 3' } },

    // Televisions
    { id: 'lg-c3-55', name: 'LG OLED C3 55" (4K)', category: 'Televisions', store: 'Flipkart', target: 100000, specs: { resolution: '4K OLED', size: '55 inch', hdr: 'Dolby Vision, HDR10', smart: 'webOS 23', refresh: '120Hz' } },
    { id: 'samsung-crystal-55', name: 'Samsung Crystal 4K UHD 55"', category: 'Televisions', store: 'Flipkart', target: 40000, specs: { resolution: '4K UHD', size: '55 inch', hdr: 'HDR10+', smart: 'Tizen OS', refresh: '60Hz' } },
    { id: 'mi-55-pro', name: 'Xiaomi TV A Pro 55" (4K)', category: 'Televisions', store: 'Flipkart', target: 35000, specs: { resolution: '4K QLED', size: '55 inch', hdr: 'Dolby Vision, HDR10+', smart: 'Google TV', refresh: '60Hz' } },

    // Gaming Consoles
    { id: 'ps5-slim', name: 'PlayStation 5 Slim Digital', category: 'Gaming Consoles', store: 'Amazon', target: 40000, specs: { storage: '1 TB SSD', resolution: '4K/120fps', rayTracing: 'Yes', controller: 'DualSense' } },
    { id: 'xbox-series-x', name: 'Xbox Series X (1TB)', category: 'Gaming Consoles', store: 'Amazon', target: 45000, specs: { storage: '1 TB SSD', resolution: '4K/120fps', rayTracing: 'Yes', controller: 'Wireless Controller' } },
    { id: 'nintendo-switch', name: 'Nintendo Switch OLED', category: 'Gaming Consoles', store: 'Flipkart', target: 30000, specs: { storage: '64 GB', resolution: '1080p handheld', rayTracing: 'No', controller: 'Joy-Con' } },

    // Air Conditioners
    { id: 'daikin-1.5', name: 'Daikin 1.5 Ton 5 Star Inverter AC', category: 'Air Conditioners', store: 'Flipkart', target: 42000, specs: { capacity: '1.5 Ton', rating: '5 Star', type: 'Inverter', coolant: 'R-32', features: 'Wi-Fi, Dew Dry' } },
    { id: 'lg-1.5-dual', name: 'LG 1.5 Ton 3 Star Dual Inverter AC', category: 'Air Conditioners', store: 'Flipkart', target: 38000, specs: { capacity: '1.5 Ton', rating: '3 Star', type: 'Dual Inverter', coolant: 'R-32', features: 'AI Convertible 6-in-1' } },
    { id: 'voltas-1.5', name: 'Voltas 1.5 Ton 3 Star Inverter AC', category: 'Air Conditioners', store: 'Flipkart', target: 32000, specs: { capacity: '1.5 Ton', rating: '3 Star', type: 'Inverter', coolant: 'R-32', features: 'Copper Condenser' } },
];

const demoPrices = {
    'iphone15':       { price: 62999, originalPrice: 79900, availability: 'In Stock', rating: 4.6, reviews: 15234 },
    'galaxy-s24':     { price: 59999, originalPrice: 74999, availability: 'In Stock', rating: 4.5, reviews: 8912 },
    'oneplus-12':     { price: 49999, originalPrice: 64999, availability: 'In Stock', rating: 4.4, reviews: 6723 },
    'pixel-8':        { price: 48999, originalPrice: 75999, availability: 'In Stock', rating: 4.5, reviews: 3421 },
    'redmi-note-13':  { price: 24999, originalPrice: 32999, availability: 'In Stock', rating: 4.3, reviews: 21453 },

    'macbook-air-m3': { price: 89990, originalPrice: 114900, availability: 'In Stock', rating: 4.8, reviews: 4521 },
    'dell-xps-15':    { price: 114990, originalPrice: 142999, availability: 'In Stock', rating: 4.5, reviews: 2134 },
    'asus-rog-strix': { price: 104990, originalPrice: 134999, availability: 'In Stock', rating: 4.6, reviews: 5632 },
    'hp-pavilion':    { price: 58990, originalPrice: 72999, availability: 'Low Stock', rating: 4.3, reviews: 8921 },

    'sony-wh1000xm5': { price: 22990, originalPrice: 34990, availability: 'In Stock', rating: 4.7, reviews: 12341 },
    'airpods-max':    { price: 49999, originalPrice: 59900, availability: 'In Stock', rating: 4.4, reviews: 6723 },
    'jbl-tune-770':   { price: 6499, originalPrice: 9999, availability: 'In Stock', rating: 4.2, reviews: 18923 },
    'boat-rockerz':   { price: 1799, originalPrice: 3990, availability: 'In Stock', rating: 4.0, reviews: 45231 },

    'apple-watch-9':  { price: 38999, originalPrice: 46900, availability: 'In Stock', rating: 4.6, reviews: 3421 },
    'galaxy-watch-6': { price: 27999, originalPrice: 37999, availability: 'In Stock', rating: 4.4, reviews: 5632 },
    'garmin-venu-3':  { price: 41999, originalPrice: 49999, availability: 'Out of Stock', rating: 4.5, reviews: 1234 },
    'amazfit-gtr-4':  { price: 13999, originalPrice: 18999, availability: 'In Stock', rating: 4.2, reviews: 8921 },

    'ipad-air-m2':    { price: 51999, originalPrice: 59900, availability: 'In Stock', rating: 4.7, reviews: 6723 },
    'samsung-tab-s9': { price: 54999, originalPrice: 74999, availability: 'In Stock', rating: 4.5, reviews: 3421 },
    'lenovo-tab-p12': { price: 26999, originalPrice: 34999, availability: 'In Stock', rating: 4.2, reviews: 4532 },

    'lg-c3-55':       { price: 94990, originalPrice: 134990, availability: 'In Stock', rating: 4.7, reviews: 2341 },
    'samsung-crystal-55': { price: 36999, originalPrice: 54990, availability: 'In Stock', rating: 4.3, reviews: 8921 },
    'mi-55-pro':      { price: 31999, originalPrice: 44999, availability: 'In Stock', rating: 4.2, reviews: 12341 },

    'ps5-slim':       { price: 39999, originalPrice: 49999, availability: 'In Stock', rating: 4.8, reviews: 9821 },
    'xbox-series-x':  { price: 42999, originalPrice: 54999, availability: 'Out of Stock', rating: 4.6, reviews: 5432 },
    'nintendo-switch': { price: 27999, originalPrice: 34999, availability: 'In Stock', rating: 4.5, reviews: 7654 },

    'daikin-1.5':     { price: 38999, originalPrice: 52000, availability: 'In Stock', rating: 4.4, reviews: 6723 },
    'lg-1.5-dual':    { price: 34999, originalPrice: 46999, availability: 'In Stock', rating: 4.3, reviews: 5432 },
    'voltas-1.5':     { price: 28999, originalPrice: 38999, availability: 'In Stock', rating: 4.1, reviews: 8921 },
};

function loadCache() {
    try {
        if (fs.existsSync(CACHE_FILE)) {
            return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
        }
    } catch (e) { console.error('Failed to load cache:', e.message); }
    return { products: {}, lastRefresh: null };
}

function saveCache(cache) {
    try {
        const dir = path.dirname(CACHE_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
    } catch (e) { console.error('Failed to save cache:', e.message); }
}

let fileCache = loadCache();
let refreshing = false;

function getDemoProduct(product) {
    const d = demoPrices[product.id] || { price: 0, originalPrice: 0, availability: 'Unknown', rating: 0, reviews: 0 };
    return {
        ...product,
        price: d.price,
        originalPrice: d.originalPrice,
        availability: d.availability,
        rating: d.rating,
        reviews: d.reviews,
        lastChecked: new Date().toISOString()
    };
}

function fetchProductData(product) {
    return new Promise((resolve, reject) => {
        const url = `https://www.amazon.in/s?k=${encodeURIComponent(product.name)}`;
        const cmd = `npx -p @brightdata/cli bdata pipelines amazon_product_search "${url}" --pretty`;
        exec(cmd, { timeout: 120000 }, (error, stdout) => {
            if (error) return reject(error);
            try { resolve((JSON.parse(stdout))[0] || JSON.parse(stdout)); }
            catch (e) { reject(e); }
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
        const fallback = { ...product, price: 0, originalPrice: 0, availability: 'Error', rating: 0, reviews: 0, lastChecked: new Date().toISOString(), error: err.message, _source: 'error' };
        fileCache.products[product.id] = fallback;
        saveCache(fileCache);
        return fallback;
    }
}

async function fetchAllProducts() {
    return Promise.all(products.map(p => fetchSingleProduct(p)));
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

setInterval(() => { if (!USE_DEMO) refreshAllProducts(); }, REFRESH_INTERVAL);

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

router.get('/categories', async (req, res) => {
    const cats = {};
    products.forEach(p => {
        if (!cats[p.category]) cats[p.category] = [];
        cats[p.category].push(p.id);
    });
    res.json(cats);
});

router.get('/products', async (req, res) => {
    try {
        const category = req.query.category;
        let list = products;
        if (category) list = products.filter(p => p.category === category);
        const results = await Promise.all(list.map(p => fetchSingleProduct(p)));
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/products/:id', async (req, res) => {
    const product = products.find(p => p.id === req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    try {
        res.json(await fetchSingleProduct(product));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/compare', async (req, res) => {
    const ids = (req.query.ids || '').split(',').filter(Boolean);
    if (ids.length < 2) return res.status(400).json({ error: 'Select at least 2 products to compare' });

    const matched = ids.map(id => products.find(p => p.id === id)).filter(Boolean);
    if (matched.length < 2) return res.status(400).json({ error: 'Products not found' });

    const categories = [...new Set(matched.map(p => p.category))];
    if (categories.length > 1) return res.status(400).json({ error: 'Can only compare products within the same category' });

    try {
        const results = await Promise.all(matched.map(p => fetchSingleProduct(p)));
        res.json({ category: categories[0], products: results });
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
