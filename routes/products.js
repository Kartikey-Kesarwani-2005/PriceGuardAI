const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const { scrapeWithHealing, getStats, successRate, emptyStats } = require('../lib/healer');

let USE_DEMO = true;

const CACHE_FILE = process.env.VERCEL
    ? path.join('/tmp', 'cache.json')
    : path.join(__dirname, '..', 'data', 'cache.json');
const CACHE_VERSION = 2;

function defaultSettings() {
    return { intervalMinutes: 15, monitoring: true, notifications: true };
}

function freshCache() {
    return { version: CACHE_VERSION, products: {}, customProducts: [], stats: {}, history: {}, settings: defaultSettings(), lastRefresh: null };
}

function loadCache() {
    try {
        if (fs.existsSync(CACHE_FILE)) {
            const parsed = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
            if (parsed && parsed.version === CACHE_VERSION) {
                if (!parsed.stats) parsed.stats = {};
                if (!parsed.settings) parsed.settings = defaultSettings();
                ['monitoring', 'notifications'].forEach(k => {
                    if (typeof parsed.settings[k] === 'undefined') parsed.settings[k] = true;
                });
                if (!Array.isArray(parsed.customProducts)) parsed.customProducts = [];
                if (!parsed.history || typeof parsed.history !== 'object') parsed.history = {};
                return parsed;
            }
            console.log('[cache] Old cache format detected, resetting to v' + CACHE_VERSION);
        }
    } catch (e) { console.error('Failed to load cache:', e.message); }
    return freshCache();
}

function saveCache(cache) {
    try {
        const dir = path.dirname(CACHE_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
    } catch (e) { console.error('Failed to save cache:', e.message); }
}

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

let fileCache = loadCache();
let refreshing = false;
let lastRefreshTick = Date.now();
const inFlight = new Set();

function allProducts() {
    return products.concat(fileCache.customProducts || []);
}

function seededDemo(id) {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    const price = 2999 + (h % 76) * 999;
    return {
        price,
        originalPrice: Math.round(price * 1.28),
        availability: 'In Stock',
        rating: Math.round((40 + ((h >> 3) % 9)) / 2) / 10,
        reviews: 500 + (h % 20000)
    };
}

/* ---------- price history ---------- */

function recordPriceSnapshot(id, price) {
    if (!price || price <= 0) return;
    if (!fileCache.history || typeof fileCache.history !== 'object') fileCache.history = {};
    const arr = fileCache.history[id] || (fileCache.history[id] = []);
    const day = new Date().toISOString().slice(0, 10);
    const last = arr[arr.length - 1];
    if (last && last.date === day) {
        last.price = price;
    } else {
        arr.push({ date: day, price });
        if (arr.length > 400) arr.splice(0, arr.length - 400);
    }
}

/*
 * Deterministic pseudo price-walk for demo/backfill data. Seeded by the
 * product id so every reload renders the same curve; the walk always ends
 * exactly at the current live/demo price.
 */
function syntheticHistory(seedId, basePrice, days) {
    let h = 2166136261 >>> 0;
    const seedStr = seedId + ':' + days;
    for (let i = 0; i < seedStr.length; i++) {
        h ^= seedStr.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
    }
    const rand = () => {
        h ^= h << 13; h >>>= 0;
        h ^= h >>> 17;
        h ^= h << 5; h >>>= 0;
        return h / 4294967296;
    };

    const stepDays = days > 180 ? 5 : days > 60 ? 3 : 1;
    const n = Math.floor(days / stepDays) + 1;

    const walk = [1];
    for (let i = 1; i < n; i++) {
        let v = walk[i - 1] * (1 + (rand() - 0.52) * 0.05);
        if (rand() < 0.09) v *= 0.93 + rand() * 0.04;
        else if (rand() < 0.05) v *= 1.04 + rand() * 0.02;
        walk.push(Math.min(Math.max(v, 0.62), 1.38));
    }

    const scale = basePrice / walk[walk.length - 1];
    const today = Date.now();
    const points = [];
    for (let i = 0; i < n; i++) {
        points.push({
            date: new Date(today - (n - 1 - i) * stepDays * 86400000).toISOString().slice(0, 10),
            price: Math.max(1, Math.round((walk[i] * scale) / 10) * 10)
        });
    }
    return points;
}

function withStats(record) {
    const s = fileCache.stats[record.id] || emptyStats();
    const rate = successRate(s);
    return {
        ...record,
        stats: {
            attempts: s.attempts,
            successes: s.successes,
            failures: s.failures,
            heals: s.heals,
            successRate: rate,
            lastError: s.lastError
        }
    };
}

function getDemoProduct(product) {
    const d = demoPrices[product.id] || seededDemo(product.id);
    return {
        ...product,
        price: d.price,
        originalPrice: d.originalPrice,
        availability: d.availability,
        rating: d.rating,
        reviews: d.reviews,
        lastChecked: new Date().toISOString(),
        _source: 'demo'
    };
}

function pendingRecord(product) {
    return {
        ...product,
        price: 0,
        originalPrice: 0,
        availability: 'Unknown',
        rating: 0,
        reviews: 0,
        lastChecked: null,
        _source: 'pending'
    };
}

const MAX_CONCURRENT_SCRAPES = 3;
let activeScrapes = 0;
const scrapeQueue = [];

function kickOffScrape(product) {
    if (inFlight.has(product.id)) return;
    inFlight.add(product.id);
    scrapeQueue.push(product);
    pumpQueue();
}

function pumpQueue() {
    while (activeScrapes < MAX_CONCURRENT_SCRAPES && scrapeQueue.length > 0) {
        const product = scrapeQueue.shift();
        activeScrapes++;
        scrapeWithHealing(product, fileCache)
            .then(result => {
                fileCache.products[product.id] = result;
                recordPriceSnapshot(product.id, result.price);
                saveCache(fileCache);
                console.log(`[scrape] Updated "${product.name}" (source: ${result._source})`);
            })
            .catch(err => console.error(`[scrape] Background failure for "${product.name}":`, err.message))
            .finally(() => {
                activeScrapes--;
                inFlight.delete(product.id);
                pumpQueue();
            });
    }
}

function isFresh(record) {
    if (!record || !record.lastChecked || record.error || record.stale) return false;
    const maxAge = (fileCache.settings.intervalMinutes || 15) * 60 * 1000;
    return (Date.now() - new Date(record.lastChecked).getTime()) < maxAge;
}

async function fetchSingleProduct(product) {
    if (USE_DEMO) {
        const demo = getDemoProduct(product);
        fileCache.products[product.id] = demo;
        recordPriceSnapshot(product.id, demo.price);
        saveCache(fileCache);
        return withStats(demo);
    }

    const cached = fileCache.products[product.id];
    const usable = cached && cached._source !== 'demo' ? cached : null;

    if (usable && isFresh(usable)) {
        recordPriceSnapshot(product.id, usable.price);
        return withStats(usable);
    }

    kickOffScrape(product);

    if (usable) return withStats({ ...usable, stale: true, _source: usable._source === 'error' ? 'error' : 'stale' });
    return withStats(pendingRecord(product));
}

async function fetchAllProducts() {
    return Promise.all(allProducts().map(p => fetchSingleProduct(p)));
}

async function refreshAllProducts() {
    if (refreshing) return;
    refreshing = true;
    console.log(`[refresh] Live refresh started (${allProducts().length} products)...`);
    try {
        await Promise.all(allProducts().map(p => fetchSingleProduct(p)));
        const deadline = Date.now() + 600000;
        while (inFlight.size > 0 && Date.now() < deadline) {
            await new Promise(r => setTimeout(r, 1000));
        }
    } finally {
        fileCache.lastRefresh = new Date().toISOString();
        saveCache(fileCache);
        refreshing = false;
        console.log('[refresh] Complete at', fileCache.lastRefresh);
    }
}

function scheduleRefresh() {
    setInterval(() => {
        if (USE_DEMO || refreshing || fileCache.settings.monitoring === false) return;
        const intervalMs = (fileCache.settings.intervalMinutes || 15) * 60 * 1000;
        if (Date.now() - lastRefreshTick >= intervalMs) {
            lastRefreshTick = Date.now();
            refreshAllProducts();
        }
    }, 60000);
}
if (!process.env.VERCEL) scheduleRefresh();

router.get('/mode', (req, res) => {
    res.json({ demo: USE_DEMO, lastRefresh: fileCache.lastRefresh, refreshing });
});

router.post('/mode', (req, res) => {
    USE_DEMO = !!(req.body && req.body.demo);
    console.log(`[mode] Demo mode ${USE_DEMO ? 'ON' : 'OFF'}`);
    res.json({ demo: USE_DEMO });
});

router.get('/settings', (req, res) => {
    res.json(fileCache.settings);
});

router.post('/settings', (req, res) => {
    const body = req.body || {};
    let changed = false;

    if (typeof body.intervalMinutes !== 'undefined') {
        const allowed = [15, 30, 60, 360];
        const minutes = parseInt(body.intervalMinutes, 10);
        if (!allowed.includes(minutes)) {
            return res.status(400).json({ error: `intervalMinutes must be one of ${allowed.join(', ')}` });
        }
        fileCache.settings.intervalMinutes = minutes;
        changed = true;
    }

    ['monitoring', 'notifications'].forEach(key => {
        if (typeof body[key] === 'boolean') {
            fileCache.settings[key] = body[key];
            changed = true;
        }
    });

    if (changed) saveCache(fileCache);
    res.json(fileCache.settings);
});

router.get('/health', (req, res) => {
    const perStore = {};
    let totalAttempts = 0, totalSuccesses = 0, totalHeals = 0;
    allProducts().forEach(p => {
        const s = fileCache.stats[p.id] || emptyStats();
        if (!perStore[p.store]) perStore[p.store] = { attempts: 0, successes: 0, heals: 0, collectors: [] };
        perStore[p.store].attempts += s.attempts;
        perStore[p.store].successes += s.successes;
        perStore[p.store].heals += s.heals;
        totalAttempts += s.attempts;
        totalSuccesses += s.successes;
        totalHeals += s.heals;
    });
    Object.keys(perStore).forEach(store => {
        const s = perStore[store];
        s.successRate = s.attempts ? Math.round((s.successes / s.attempts) * 1000) / 10 : null;
        delete s.collectors;
    });
    res.json({
        mode: USE_DEMO ? 'demo' : 'live',
        lastRefresh: fileCache.lastRefresh,
        refreshing,
        totals: {
            products: allProducts().length,
            attempts: totalAttempts,
            successes: totalSuccesses,
            heals: totalHeals,
            successRate: totalAttempts ? Math.round((totalSuccesses / totalAttempts) * 1000) / 10 : null
        },
        stores: perStore
    });
});

router.post('/refresh', async (req, res) => {
    if (USE_DEMO) return res.json({ ok: true, message: 'Demo mode - no refresh needed' });
    if (refreshing) return res.json({ ok: false, message: 'Refresh already in progress' });
    lastRefreshTick = Date.now();
    refreshAllProducts();
    res.json({ ok: true, message: 'Refresh started' });
});

router.get('/categories', async (req, res) => {
    const cats = {};
    allProducts().forEach(p => {
        if (!cats[p.category]) cats[p.category] = [];
        cats[p.category].push(p.id);
    });
    res.json(cats);
});

router.post('/products', async (req, res) => {
    const body = req.body || {};
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const target = Number(body.target);

    if (!name) return res.status(400).json({ error: 'Product name is required' });
    if (!target || target <= 0) return res.status(400).json({ error: 'Target price must be a positive number' });

    const id = 'custom_' + Date.now().toString(36);
    let store = 'Custom';
    try {
        const host = new URL(body.url).hostname.replace(/^www\./, '');
        store = host.charAt(0).toUpperCase() + host.slice(1);
    } catch (e) { /* no/invalid url - keep default store */ }

    const custom = {
        id,
        name,
        category: 'Custom',
        store,
        url: body.url || '',
        target: Math.round(target),
        specs: {}
    };

    fileCache.customProducts.push(custom);
    saveCache(fileCache);
    console.log(`[custom] Now monitoring "${name}" (id: ${id})`);
    res.status(201).json(await fetchSingleProduct(custom));
});

router.delete('/products/:id', (req, res) => {
    const idx = fileCache.customProducts.findIndex(p => p.id === req.params.id);
    if (idx === -1) return res.status(400).json({ error: 'Only custom products can be removed' });
    const removed = fileCache.customProducts.splice(idx, 1)[0];
    delete fileCache.products[removed.id];
    saveCache(fileCache);
    res.json({ ok: true, removed: removed.id });
});

router.get('/products', async (req, res) => {
    try {
        const category = req.query.category;
        let list = allProducts();
        if (category) list = list.filter(p => p.category === category);
        const results = await Promise.all(list.map(p => fetchSingleProduct(p)));
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/products/:id', async (req, res) => {
    const product = allProducts().find(p => p.id === req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    try {
        res.json(await fetchSingleProduct(product));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const HISTORY_RANGES = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 };

router.get('/products/:id/history', async (req, res) => {
    const product = allProducts().find(p => p.id === req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const range = HISTORY_RANGES[req.query.range] ? req.query.range : '30d';
    const days = HISTORY_RANGES[range];

    try {
        const record = await fetchSingleProduct(product);
        const current = record && record.price > 0 ? record.price : (product.target || 9999);

        const cutoff = Date.now() - days * 86400000;
        const recorded = (fileCache.history[product.id] || []).filter(pt => {
            if (!pt || typeof pt.price !== 'number' || pt.price <= 0) return false;
            const t = new Date(pt.date + 'T00:00:00Z').getTime();
            return !isNaN(t) && t >= cutoff;
        });

        let points;
        if (recorded.length >= 4) {
            // real snapshots exist: backfill the gap before them with synthetic data
            const firstT = new Date(recorded[0].date + 'T00:00:00Z').getTime();
            const spanDays = Math.max(0, Math.ceil((Date.now() - firstT) / 86400000));
            const gapDays = days - spanDays;
            const backfill = gapDays > 2 ? syntheticHistory(product.id + ':pre', current, gapDays) : [];
            points = backfill.slice(0, -1).concat(recorded.map(r => ({ date: r.date, price: r.price })));
        } else {
            points = syntheticHistory(product.id, current, days);
        }

        points.push({ date: new Date().toISOString().slice(0, 10), price: Math.round(current) });

        // dedupe by date, keeping the last occurrence per day
        const byDate = {};
        points.forEach(pt => { byDate[pt.date] = pt; });
        points = Object.keys(byDate).sort().map(d => byDate[d]);

        const prices = points.map(pt => pt.price);
        const summary = {
            current: Math.round(current),
            lowest: Math.min.apply(null, prices),
            highest: Math.max.apply(null, prices),
            average: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
        };

        res.json({
            id: product.id,
            name: product.name,
            category: product.category,
            store: product.store,
            url: product.url || '',
            target: product.target || null,
            specs: product.specs || {},
            availability: record ? record.availability : 'Unknown',
            rating: record ? record.rating : 0,
            reviews: record ? record.reviews : 0,
            originalPrice: record ? record.originalPrice : 0,
            range,
            points,
            summary
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/compare', async (req, res) => {
    const ids = (req.query.ids || '').split(',').filter(Boolean);
    if (ids.length < 2) return res.status(400).json({ error: 'Select at least 2 products to compare' });

    const matched = ids.map(id => allProducts().find(p => p.id === id)).filter(Boolean);
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
                alerts.push({ type: 'error', icon: '!', title: 'Scraper error', product: p.name, message: 'Failed to fetch data from ' + p.store + ': ' + (p.error || '').slice(0, 120), amount: '', time: now });
            }
            if (p.stale) {
                alerts.push({ type: 'error', icon: '~', title: 'Stale data', product: p.name, message: 'Live extraction failed - showing last known good data', amount: '', time: now });
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
