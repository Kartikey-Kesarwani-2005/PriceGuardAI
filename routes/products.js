const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const { scrapeWithHealing, getStats, successRate, emptyStats } = require('../lib/healer');
const { STORE_CONFIG } = require('../lib/scraperEngine');

let USE_DEMO = true;

function canonicalStore(url) {
    try {
        const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
        for (const name of Object.keys(STORE_CONFIG)) {
            const cfg = STORE_CONFIG[name];
            if (cfg.searchUrl && new URL(cfg.searchUrl('x')).hostname.replace(/^www\./, '') === host) return name;
            if (host === name.toLowerCase() + '.com' || host === name.toLowerCase() + '.in') return name;
        }
        if (/amazon\./.test(host)) return 'Amazon';
        if (/flipkart\./.test(host)) return 'Flipkart';
        if (/croma\./.test(host)) return 'Croma';
        return host.charAt(0).toUpperCase() + host.slice(1);
    } catch (e) { return 'Custom'; }
}

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

    // Smartphones (expanded)
    { id: 'nothing-2a', name: 'Nothing Phone (2a) (8GB/128GB)', category: 'Smartphones', store: 'Amazon', target: 25000, specs: { ram: '8 GB', storage: '128 GB', battery: '5000 mAh', display: '6.7" AMOLED', processor: 'Dimensity 7200 Pro' } },
    { id: 'iqoo-neo-9', name: 'iQOO Neo 9 Pro (12GB/256GB)', category: 'Smartphones', store: 'Amazon', target: 35000, specs: { ram: '12 GB', storage: '256 GB', battery: '5160 mAh', display: '6.78" AMOLED', processor: 'Snapdragon 8 Gen 2' } },
    { id: 'vivo-v29e', name: 'Vivo V29e (8GB/256GB)', category: 'Smartphones', store: 'Flipkart', target: 27000, specs: { ram: '8 GB', storage: '256 GB', battery: '5000 mAh', display: '6.67" AMOLED', processor: 'Snapdragon 695' } },
    { id: 'oppo-reno-11', name: 'Oppo Reno 11 (8GB/256GB)', category: 'Smartphones', store: 'Flipkart', target: 30000, specs: { ram: '8 GB', storage: '256 GB', battery: '5000 mAh', display: '6.7" AMOLED', processor: 'MediaTek Dimensity 7050' } },
    { id: 'realme-gt-6t', name: 'realme GT 6T (8GB/256GB)', category: 'Smartphones', store: 'Amazon', target: 31000, specs: { ram: '8 GB', storage: '256 GB', battery: '5500 mAh', display: '6.78" AMOLED', processor: 'Snapdragon 7+ Gen 3' } },
    { id: 'poco-f6', name: 'POCO F6 (8GB/256GB)', category: 'Smartphones', store: 'Flipkart', target: 28000, specs: { ram: '8 GB', storage: '256 GB', battery: '5000 mAh', display: '6.67" AMOLED', processor: 'Snapdragon 8s Gen 3' } },
    { id: 'samsung-a55', name: 'Samsung Galaxy A55 5G (8GB/128GB)', category: 'Smartphones', store: 'Amazon', target: 32000, specs: { ram: '8 GB', storage: '128 GB', battery: '5000 mAh', display: '6.6" Super AMOLED', processor: 'Exynos 1480' } },
    { id: 'samsung-m35', name: 'Samsung Galaxy M35 5G (8GB/128GB)', category: 'Smartphones', store: 'Flipkart', target: 18000, specs: { ram: '8 GB', storage: '128 GB', battery: '6000 mAh', display: '6.6" Super AMOLED', processor: 'Exynos 1380' } },
    { id: 'moto-edge-50', name: 'Motorola Edge 50 Pro (8GB/256GB)', category: 'Smartphones', store: 'Amazon', target: 29000, specs: { ram: '8 GB', storage: '256 GB', battery: '4500 mAh', display: '6.7" pOLED', processor: 'Snapdragon 7 Gen 3' } },
    { id: 'vivo-t3-ultra', name: 'Vivo T3 Ultra (8GB/256GB)', category: 'Smartphones', store: 'Flipkart', target: 26000, specs: { ram: '8 GB', storage: '256 GB', battery: '5500 mAh', display: '6.78" AMOLED', processor: 'Dimensity 9200+' } },
    { id: 'iqoo-z9', name: 'iQOO Z9 5G (8GB/128GB)', category: 'Smartphones', store: 'Amazon', target: 17000, specs: { ram: '8 GB', storage: '128 GB', battery: '5000 mAh', display: '6.67" AMOLED', processor: 'Dimensity 7200' } },
    { id: 'narzo-70-pro', name: 'realme Narzo 70 Pro (8GB/128GB)', category: 'Smartphones', store: 'Flipkart', target: 17000, specs: { ram: '8 GB', storage: '128 GB', battery: '5000 mAh', display: '6.67" AMOLED', processor: 'Dimensity 7050' } },
    { id: 'honor-200', name: 'Honor 200 (8GB/256GB)', category: 'Smartphones', store: 'Amazon', target: 28000, specs: { ram: '8 GB', storage: '256 GB', battery: '5200 mAh', display: '6.7" OLED', processor: 'Snapdragon 7 Gen 3' } },
    { id: 'camon-30', name: 'Tecno Camon 30 (8GB/256GB)', category: 'Smartphones', store: 'Flipkart', target: 17000, specs: { ram: '8 GB', storage: '256 GB', battery: '5000 mAh', display: '6.78" AMOLED', processor: 'Helio G99 Ultimate' } },
    { id: 'moto-g84', name: 'Motorola Moto G84 5G (12GB/256GB)', category: 'Smartphones', store: 'Amazon', target: 19000, specs: { ram: '12 GB', storage: '256 GB', battery: '5000 mAh', display: '6.55" pOLED', processor: 'Snapdragon 695' } },

    // Laptops (expanded)
    { id: 'macbook-pro-14-m3', name: 'Apple MacBook Pro 14 M3 (512GB)', category: 'Laptops', store: 'Amazon', target: 165000, specs: { ram: '18 GB', storage: '512 GB SSD', processor: 'Apple M3 Pro', display: '14.2" Liquid Retina XDR', weight: '1.61 kg' } },
    { id: 'macbook-air-m2', name: 'Apple MacBook Air M2 (8GB/256GB)', category: 'Laptops', store: 'Flipkart', target: 79000, specs: { ram: '8 GB', storage: '256 GB SSD', processor: 'Apple M2', display: '13.6" Liquid Retina', weight: '1.24 kg' } },
    { id: 'thinkpad-e14', name: 'Lenovo ThinkPad E14 (i5/16GB/512GB)', category: 'Laptops', store: 'Amazon', target: 55000, specs: { ram: '16 GB', storage: '512 GB SSD', processor: 'Intel Core i5-1335U', display: '14" FHD IPS', weight: '1.59 kg' } },
    { id: 'ideapad-slim-5', name: 'Lenovo IdeaPad Slim 5 (Ryzen 7/16GB/512GB)', category: 'Laptops', store: 'Flipkart', target: 62000, specs: { ram: '16 GB', storage: '512 GB SSD', processor: 'AMD Ryzen 7 7735HS', display: '14" WUXGA OLED', weight: '1.46 kg' } },
    { id: 'vivobook-16', name: 'ASUS Vivobook 16 (i5/16GB/512GB)', category: 'Laptops', store: 'Amazon', target: 48000, specs: { ram: '16 GB', storage: '512 GB SSD', processor: 'Intel Core i5-13500H', display: '16" WUXGA', weight: '1.88 kg' } },
    { id: 'zenbook-14-oled', name: 'ASUS Zenbook 14 OLED (Ultra 7/16GB/1TB)', category: 'Laptops', store: 'Flipkart', target: 92000, specs: { ram: '16 GB', storage: '1 TB SSD', processor: 'Intel Core Ultra 7 155H', display: '14" 3K OLED', weight: '1.28 kg' } },
    { id: 'swift-go-14', name: 'Acer Swift Go 14 (i5/16GB/512GB)', category: 'Laptops', store: 'Amazon', target: 65000, specs: { ram: '16 GB', storage: '512 GB SSD', processor: 'Intel Core i5-13500H', display: '14" 2.8K OLED', weight: '1.32 kg' } },
    { id: 'nitro-v16', name: 'Acer Nitro V16 (Ryzen 7/16GB/1TB RTX 4050)', category: 'Laptops', store: 'Flipkart', target: 75000, specs: { ram: '16 GB', storage: '1 TB SSD', processor: 'AMD Ryzen 7 8845HS', display: '16" WUXGA 165Hz', weight: '2.4 kg' } },
    { id: 'victus-16', name: 'HP Victus 16 (i7/16GB/512GB RTX 4060)', category: 'Laptops', store: 'Amazon', target: 80000, specs: { ram: '16 GB', storage: '512 GB SSD', processor: 'Intel Core i7-13620H', display: '16.1" FHD 144Hz', weight: '2.3 kg' } },
    { id: 'omen-16', name: 'HP OMEN 16 (i7/16GB/1TB RTX 4070)', category: 'Laptops', store: 'Flipkart', target: 115000, specs: { ram: '16 GB', storage: '1 TB SSD', processor: 'Intel Core i7-14650HX', display: '16.1" QHD 165Hz', weight: '2.35 kg' } },
    { id: 'inspiron-14', name: 'Dell Inspiron 14 (i5/16GB/512GB)', category: 'Laptops', store: 'Amazon', target: 52000, specs: { ram: '16 GB', storage: '512 GB SSD', processor: 'Intel Core i5-1340P', display: '14" FHD+', weight: '1.66 kg' } },
    { id: 'galaxy-book4-pro', name: 'Samsung Galaxy Book4 Pro (Ultra 7/16GB/512GB)', category: 'Laptops', store: 'Flipkart', target: 118000, specs: { ram: '16 GB', storage: '512 GB SSD', processor: 'Intel Core Ultra 7 155H', display: '16" 3K AMOLED', weight: '1.55 kg' } },
    { id: 'msi-modern-14', name: 'MSI Modern 14 (i5/16GB/512GB)', category: 'Laptops', store: 'Amazon', target: 42000, specs: { ram: '16 GB', storage: '512 GB SSD', processor: 'Intel Core i5-12450H', display: '14" FHD IPS', weight: '1.4 kg' } },
    { id: 'msi-katana-15', name: 'MSI Katana 15 (i7/16GB/1TB RTX 4060)', category: 'Laptops', store: 'Flipkart', target: 85000, specs: { ram: '16 GB', storage: '1 TB SSD', processor: 'Intel Core i7-13620H', display: '15.6" FHD 144Hz', weight: '2.25 kg' } },
    { id: 'surface-laptop-5', name: 'Microsoft Surface Laptop 5 (i7/16GB/512GB)', category: 'Laptops', store: 'Amazon', target: 95000, specs: { ram: '16 GB', storage: '512 GB SSD', processor: 'Intel Core i7-1255U', display: '13.5" PixelSense Touch', weight: '1.29 kg' } },
    { id: 'lg-gram-14', name: 'LG Gram 14 (i7/16GB/512GB)', category: 'Laptops', store: 'Amazon', target: 105000, specs: { ram: '16 GB', storage: '512 GB SSD', processor: 'Intel Core i7-1360P', display: '14" WUXGA IPS', weight: '0.999 kg' } },

    // Headphones (expanded)
    { id: 'sony-ch720n', name: 'Sony WH-CH720N', category: 'Headphones', store: 'Amazon', target: 9000, specs: { type: 'Over-Ear', anc: 'Yes', battery: '35 hours', driver: '30mm', weight: '192 g' } },
    { id: 'wf-1000xm5', name: 'Sony WF-1000XM5', category: 'Headphones', store: 'Croma', target: 22000, specs: { type: 'In-Ear TWS', anc: 'Yes', battery: '8+16 hours', driver: '8.4mm', weight: '5.9 g/bud' } },
    { id: 'airpods-pro-2', name: 'Apple AirPods Pro (2nd gen, USB-C)', category: 'Headphones', store: 'Amazon', target: 21000, specs: { type: 'In-Ear TWS', anc: 'Yes', battery: '6+24 hours', driver: 'Custom', weight: '5.3 g/bud' } },
    { id: 'airpods-4', name: 'Apple AirPods (4th gen)', category: 'Headphones', store: 'Amazon', target: 12000, specs: { type: 'Open-Ear TWS', anc: 'No', battery: '5+24 hours', driver: 'Custom', weight: '4.3 g/bud' } },
    { id: 'galaxy-buds2-pro', name: 'Samsung Galaxy Buds2 Pro', category: 'Headphones', store: 'Croma', target: 15000, specs: { type: 'In-Ear TWS', anc: 'Yes', battery: '5+18 hours', driver: '10mm+8.5mm', weight: '5.5 g/bud' } },
    { id: 'oneplus-buds-3', name: 'OnePlus Buds 3', category: 'Headphones', store: 'Flipkart', target: 5500, specs: { type: 'In-Ear TWS', anc: 'Yes', battery: '6.5+39 hours', driver: '10.4mm', weight: '4.1 g/bud' } },
    { id: 'realme-buds-air-6', name: 'realme Buds Air 6', category: 'Headphones', store: 'Flipkart', target: 3500, specs: { type: 'In-Ear TWS', anc: 'Yes', battery: '7+43 hours', driver: '12.4mm', weight: '4.2 g/bud' } },
    { id: 'boat-airdopes-141', name: 'boAt Airdopes 141', category: 'Headphones', store: 'Amazon', target: 1300, specs: { type: 'In-Ear TWS', anc: 'No', battery: '6+36 hours', driver: '13mm', weight: '3.9 g/bud' } },
    { id: 'boat-immortal-121', name: 'boAt Immortal 121 TWS', category: 'Headphones', store: 'Amazon', target: 1500, specs: { type: 'In-Ear TWS', anc: 'No', battery: '8+32 hours', driver: '10mm', weight: '4 g/bud' } },
    { id: 'noise-buds-vs104', name: 'Noise Buds VS104 Max', category: 'Headphones', store: 'Amazon', target: 1200, specs: { type: 'In-Ear TWS', anc: 'No', battery: '7+45 hours', driver: '13mm', weight: '4 g/bud' } },
    { id: 'soundcore-life-q30', name: 'Soundcore Life Q30 (Anker)', category: 'Headphones', store: 'Amazon', target: 7000, specs: { type: 'Over-Ear', anc: 'Yes', battery: '50 hours', driver: '40mm', weight: '260 g' } },
    { id: 'sennheiser-accentum', name: 'Sennheiser Accentum Wireless', category: 'Headphones', store: 'Croma', target: 11000, specs: { type: 'Over-Ear', anc: 'Yes', battery: '50 hours', driver: 'Closed-back', weight: '222 g' } },
    { id: 'jbl-live-660nc', name: 'JBL Live 660NC', category: 'Headphones', store: 'Amazon', target: 8000, specs: { type: 'Over-Ear', anc: 'Yes', battery: '50 hours', driver: '40mm', weight: '220 g' } },
    { id: 'sony-ult-wear', name: 'Sony ULT WEAR', category: 'Headphones', store: 'Croma', target: 14000, specs: { type: 'Over-Ear', anc: 'Yes', battery: '30 hours', driver: '30mm', weight: '254 g' } },
    { id: 'oppo-enco-air3-pro', name: 'Oppo Enco Air3 Pro', category: 'Headphones', store: 'Flipkart', target: 3000, specs: { type: 'In-Ear TWS', anc: 'Yes', battery: '6+25 hours', driver: '12.4mm', weight: '4.3 g/bud' } },
    { id: 'boat-rockerz-450', name: 'boAt Rockerz 450', category: 'Headphones', store: 'Amazon', target: 1500, specs: { type: 'Over-Ear', anc: 'No', battery: '15 hours', driver: '40mm', weight: '228 g' } },

    // Smartwatches (expanded)
    { id: 'apple-watch-se-2', name: 'Apple Watch SE 2 (40mm)', category: 'Smartwatches', store: 'Amazon', target: 24000, specs: { display: '1.57" Retina LTPO', battery: '18 hours', water: '50m WR', sensors: 'HR, Crash Detection' } },
    { id: 'apple-watch-ultra-2', name: 'Apple Watch Ultra 2 (49mm)', category: 'Smartwatches', store: 'Amazon', target: 75000, specs: { display: '1.92" Retina LTPO', battery: '36 hours', water: '100m WR', sensors: 'SpO2, ECG, Depth' } },
    { id: 'galaxy-watch-7', name: 'Samsung Galaxy Watch7 (44mm)', category: 'Smartwatches', store: 'Amazon', target: 33000, specs: { display: '1.5" Super AMOLED', battery: '40 hours', water: '50m WR + IP68', sensors: 'BioActive, ECG, AGEs' } },
    { id: 'galaxy-watch-fe', name: 'Samsung Galaxy Watch FE (40mm)', category: 'Smartwatches', store: 'Flipkart', target: 17000, specs: { display: '1.2" Super AMOLED', battery: '30 hours', water: '50m WR + IP68', sensors: 'BioActive, SpO2' } },
    { id: 'oneplus-watch-2', name: 'OnePlus Watch 2', category: 'Smartwatches', store: 'Amazon', target: 23000, specs: { display: '1.43" AMOLED', battery: '100 hours', water: '5ATM + IP68', sensors: 'SpO2, HR, Dual GPS' } },
    { id: 'xiaomi-band-8', name: 'Xiaomi Smart Band 8', category: 'Smartwatches', store: 'Amazon', target: 2800, specs: { display: '1.62" AMOLED', battery: '16 days', water: '5ATM', sensors: 'SpO2, HR, Sleep' } },
    { id: 'amazfit-bip-5', name: 'Amazfit Bip 5', category: 'Smartwatches', store: 'Amazon', target: 5000, specs: { display: '1.91" Ultra HD AMOLED', battery: '10 days', water: 'IP68', sensors: 'SpO2, HR, GPS' } },
    { id: 'amazfit-gts-4-mini', name: 'Amazfit GTS 4 Mini', category: 'Smartwatches', store: 'Flipkart', target: 7000, specs: { display: '1.65" AMOLED', battery: '15 days', water: '5ATM', sensors: 'SpO2, HR, GPS' } },
    { id: 'fitbit-charge-6', name: 'Fitbit Charge 6', category: 'Smartwatches', store: 'Amazon', target: 13000, specs: { display: '1.04" AMOLED', battery: '7 days', water: '50m WR', sensors: 'SpO2, EDA, ECG' } },
    { id: 'fitbit-versa-4', name: 'Fitbit Versa 4', category: 'Smartwatches', store: 'Amazon', target: 16000, specs: { display: '1.58" AMOLED', battery: '6 days', water: '50m WR', sensors: 'SpO2, HR, GPS' } },
    { id: 'garmin-forerunner-165', name: 'Garmin Forerunner 165', category: 'Smartwatches', store: 'Croma', target: 24000, specs: { display: '1.2" AMOLED', battery: '11 days', water: '5ATM', sensors: 'HR, GPS, Sleep Coach' } },
    { id: 'noise-colorfit-pro-5', name: 'Noise ColorFit Pro 5', category: 'Smartwatches', store: 'Amazon', target: 3500, specs: { display: '1.85" AMOLED', battery: '7 days', water: 'IP68', sensors: 'SpO2, HR, Stress' } },
    { id: 'fire-boltt-quantum', name: 'Fire-Boltt Quantum', category: 'Smartwatches', store: 'Flipkart', target: 1800, specs: { display: '1.3" AMOLED', battery: '7 days', water: 'IP67', sensors: 'SpO2, HR' } },
    { id: 'boat-wave-neo-3', name: 'boAt Wave Neo 3', category: 'Smartwatches', store: 'Flipkart', target: 1600, specs: { display: '1.83" HD', battery: '10 days', water: 'IP68', sensors: 'SpO2, HR' } },
    { id: 'huawei-watch-fit-3', name: 'Huawei Watch Fit 3', category: 'Smartwatches', store: 'Amazon', target: 11000, specs: { display: '1.82" AMOLED', battery: '10 days', water: '5ATM', sensors: 'SpO2, HR, GPS' } },
    { id: 'realme-watch-3-pro', name: 'realme Watch 3 Pro', category: 'Smartwatches', store: 'Flipkart', target: 4000, specs: { display: '1.75" AMOLED', battery: '10 days', water: 'IP68', sensors: 'SpO2, HR, GPS' } },

    // Tablets (expanded)
    { id: 'ipad-10th-gen', name: 'Apple iPad 10th Gen (64GB Wi-Fi)', category: 'Tablets', store: 'Amazon', target: 30000, specs: { display: '10.9" Liquid Retina', storage: '64 GB', processor: 'A14 Bionic', battery: '10 hours', stylus: 'Apple Pencil (USB-C)' } },
    { id: 'ipad-pro-m4', name: 'Apple iPad Pro M4 (11"/256GB)', category: 'Tablets', store: 'Amazon', target: 95000, specs: { display: '11" Ultra Retina Tandem OLED', storage: '256 GB', processor: 'Apple M4', battery: '10 hours', stylus: 'Apple Pencil Pro' } },
    { id: 'ipad-mini-7', name: 'Apple iPad mini (A17 Pro, 128GB)', category: 'Tablets', store: 'Amazon', target: 48000, specs: { display: '8.3" Liquid Retina', storage: '128 GB', processor: 'A17 Pro', battery: '10 hours', stylus: 'Apple Pencil Pro' } },
    { id: 'xiaomi-pad-6', name: 'Xiaomi Pad 6 (8GB/256GB)', category: 'Tablets', store: 'Flipkart', target: 25000, specs: { display: '11" 2.8K LCD 144Hz', storage: '256 GB', processor: 'Snapdragon 870', battery: '8840 mAh', stylus: 'Smart Pen (2nd gen)' } },
    { id: 'redmi-pad-pro', name: 'Redmi Pad Pro (8GB/256GB)', category: 'Tablets', store: 'Flipkart', target: 21000, specs: { display: '12.1" 2.5K LCD 120Hz', storage: '256 GB', processor: 'Snapdragon 7s Gen 2', battery: '10000 mAh', stylus: 'Redmi Smart Pen' } },
    { id: 'redmi-pad-se', name: 'Redmi Pad SE (8GB/128GB)', category: 'Tablets', store: 'Amazon', target: 13000, specs: { display: '11" FHD+ LCD 90Hz', storage: '128 GB', processor: 'Helio G99', battery: '8000 mAh', stylus: 'No' } },
    { id: 'oneplus-pad', name: 'OnePlus Pad (12GB/256GB)', category: 'Tablets', store: 'Amazon', target: 35000, specs: { display: '11.61" 2.8K LCD 144Hz', storage: '256 GB', processor: 'Dimensity 9000', battery: '9510 mAh', stylus: 'OnePlus Stylo' } },
    { id: 'oppo-pad-air', name: 'Oppo Pad Air (4GB/128GB)', category: 'Tablets', store: 'Flipkart', target: 16000, specs: { display: '10.36" 2K LCD', storage: '128 GB', processor: 'Snapdragon 680', battery: '7100 mAh', stylus: 'Oppo Pencil' } },
    { id: 'realme-pad-2', name: 'realme Pad 2 (6GB/128GB)', category: 'Tablets', store: 'Flipkart', target: 17000, specs: { display: '11.5" 2K LCD 120Hz', storage: '128 GB', processor: 'Helio G99', battery: '8360 mAh', stylus: 'realme Pencil' } },
    { id: 'lenovo-tab-m11', name: 'Lenovo Tab M11 (8GB/128GB)', category: 'Tablets', store: 'Amazon', target: 15000, specs: { display: '11" FHD+ LCD 90Hz', storage: '128 GB', processor: 'Helio G88', battery: '7040 mAh', stylus: 'Tab Pen Plus included' } },
    { id: 'lenovo-tab-plus', name: 'Lenovo Tab Plus (8GB/256GB)', category: 'Tablets', store: 'Flipkart', target: 25000, specs: { display: '11.2" 2K LCD 120Hz', storage: '256 GB', processor: 'Helio G99', battery: '10200 mAh', stylus: 'Precision Pen 3 support' } },
    { id: 'tab-a9-plus', name: 'Samsung Galaxy Tab A9+ (8GB/128GB)', category: 'Tablets', store: 'Amazon', target: 18000, specs: { display: '11" FHD+ LCD 90Hz', storage: '128 GB', processor: 'Snapdragon 695', battery: '7040 mAh', stylus: 'No' } },
    { id: 'tab-s6-lite-2024', name: 'Samsung Galaxy Tab S6 Lite (2024, 128GB)', category: 'Tablets', store: 'Flipkart', target: 24000, specs: { display: '10.4" TFT LCD', storage: '128 GB', processor: 'Exynos 1280', battery: '7040 mAh', stylus: 'S Pen included' } },
    { id: 'tab-s9-fe', name: 'Samsung Galaxy Tab S9 FE (128GB)', category: 'Tablets', store: 'Amazon', target: 33000, specs: { display: '10.9" LCD 90Hz', storage: '128 GB', processor: 'Exynos 1380', battery: '8000 mAh', stylus: 'S Pen included' } },
    { id: 'honor-pad-9', name: 'Honor Pad 9 (8GB/256GB)', category: 'Tablets', store: 'Amazon', target: 19000, specs: { display: '12.1" 2.5K LCD 120Hz', storage: '256 GB', processor: 'Snapdragon 6 Gen 2', battery: '8300 mAh', stylus: 'Honor Choice Pad Pencil' } },
    { id: 'nokia-t21', name: 'Nokia T21 (4GB/128GB)', category: 'Tablets', store: 'Flipkart', target: 14000, specs: { display: '10.36" 2K LCD', storage: '128 GB', processor: 'Unisoc T612', battery: '8200 mAh', stylus: 'No' } },
    { id: 'yoga-tab-13', name: 'Lenovo Yoga Tab 13 (8GB/128GB)', category: 'Tablets', store: 'Amazon', target: 45000, specs: { display: '13" 2K LTPS', storage: '128 GB', processor: 'Snapdragon 870', battery: '10200 mAh', stylus: 'No' } },

    // Televisions (expanded)
    { id: 'sony-bravia-3-55', name: 'Sony Bravia 3 55" 4K Google TV', category: 'Televisions', store: 'Amazon', target: 60000, specs: { resolution: '4K LED', size: '55 inch', hdr: 'HDR10/HLG', smart: 'Google TV', refresh: '60Hz' } },
    { id: 'sony-x80l-50', name: 'Sony Bravia X80L 50" 4K', category: 'Televisions', store: 'Croma', target: 65000, specs: { resolution: '4K LED', size: '50 inch', hdr: 'Dolby Vision, HDR10', smart: 'Google TV', refresh: '60Hz' } },
    { id: 'lg-ur7500-50', name: 'LG UR7500 50" 4K UHD', category: 'Televisions', store: 'Amazon', target: 38000, specs: { resolution: '4K LED', size: '50 inch', hdr: 'HDR10 Pro', smart: 'webOS 23', refresh: '60Hz' } },
    { id: 'lg-nano75-43', name: 'LG NanoCell 75 43" 4K', category: 'Televisions', store: 'Flipkart', target: 34000, specs: { resolution: '4K NanoCell', size: '43 inch', hdr: 'HDR10 Pro', smart: 'webOS 23', refresh: '60Hz' } },
    { id: 'samsung-crystal-43', name: 'Samsung Crystal 4K UHD 43"', category: 'Televisions', store: 'Amazon', target: 28000, specs: { resolution: '4K UHD', size: '43 inch', hdr: 'HDR10+', smart: 'Tizen OS', refresh: '60Hz' } },
    { id: 'tcl-c655-55', name: 'TCL C655 55" QLED Google TV', category: 'Televisions', store: 'Flipkart', target: 40000, specs: { resolution: '4K QLED', size: '55 inch', hdr: 'Dolby Vision, HDR10+', smart: 'Google TV', refresh: '60Hz' } },
    { id: 'tcl-p635-43', name: 'TCL P635 43" 4K UHD', category: 'Televisions', store: 'Amazon', target: 25000, specs: { resolution: '4K HDR', size: '43 inch', hdr: 'HDR10, HLG', smart: 'Google TV', refresh: '60Hz' } },
    { id: 'hisense-e7k-pro-55', name: 'Hisense E7K Pro 55" QLED', category: 'Televisions', store: 'Amazon', target: 38000, specs: { resolution: '4K QLED', size: '55 inch', hdr: 'Dolby Vision IQ', smart: 'Google TV', refresh: '120Hz' } },
    { id: 'vu-master-glo-55', name: 'Vu Masterpiece Glo LED 55"', category: 'Televisions', store: 'Flipkart', target: 55000, specs: { resolution: '4K LED', size: '55 inch', hdr: 'Dolby Vision, HDR10+', smart: 'Google TV', refresh: '60Hz' } },
    { id: 'vu-premium-43', name: 'Vu Premium 4K 43"', category: 'Televisions', store: 'Amazon', target: 23000, specs: { resolution: '4K LED', size: '43 inch', hdr: 'HDR10+', smart: 'Android TV 11', refresh: '60Hz' } },
    { id: 'toshiba-c350mp-50', name: 'Toshiba C350MP 50" 4K Fire TV', category: 'Televisions', store: 'Croma', target: 33000, specs: { resolution: '4K LED', size: '50 inch', hdr: 'Dolby Vision, HDR10+', smart: 'Fire TV', refresh: '60Hz' } },
    { id: 'panasonic-vx650-43', name: 'Panasonic 43" 4K Google TV (VX650)', category: 'Televisions', store: 'Flipkart', target: 27000, specs: { resolution: '4K LED', size: '43 inch', hdr: 'Dolby Vision, HDR10+', smart: 'Google TV', refresh: '60Hz' } },
    { id: 'acer-v-pro-43', name: 'Acer V Pro 43" 4K QLED', category: 'Televisions', store: 'Flipkart', target: 22000, specs: { resolution: '4K QLED', size: '43 inch', hdr: 'Dolby Vision, HDR10+', smart: 'Google TV', refresh: '60Hz' } },
    { id: 'kodak-matrix-43', name: 'Kodak Matrix 43" QLED', category: 'Televisions', store: 'Flipkart', target: 20000, specs: { resolution: '4K QLED', size: '43 inch', hdr: 'Dolby Vision, HDR10+', smart: 'Google TV', refresh: '60Hz' } },
    { id: 'mi-x-pro-43', name: 'Xiaomi Smart TV X Pro 43"', category: 'Televisions', store: 'Amazon', target: 26000, specs: { resolution: '4K QLED', size: '43 inch', hdr: 'Dolby Vision, HDR10+', smart: 'Google TV', refresh: '60Hz' } },
    { id: 'realme-tv-4k-43', name: 'realme Smart TV 4K 43"', category: 'Televisions', store: 'Flipkart', target: 24000, specs: { resolution: '4K LED', size: '43 inch', hdr: 'Dolby Vision, HDR10+', smart: 'Google TV', refresh: '60Hz' } },
    { id: 'coocaa-4k-43', name: 'coocaa 43" 4K Google TV', category: 'Televisions', store: 'Flipkart', target: 19000, specs: { resolution: '4K LED', size: '43 inch', hdr: 'HDR10+, HLG', smart: 'Google TV', refresh: '60Hz' } },

    // Gaming Consoles (expanded)
    { id: 'ps5-pro', name: 'PlayStation 5 Pro (2TB)', category: 'Gaming Consoles', store: 'Amazon', target: 75000, specs: { storage: '2 TB SSD', resolution: '4K/120fps, 8K ready', rayTracing: 'Advanced', controller: 'DualSense' } },
    { id: 'ps5-slim-disc', name: 'PlayStation 5 Slim (Disc, 1TB)', category: 'Gaming Consoles', store: 'Amazon', target: 55000, specs: { storage: '1 TB SSD', resolution: '4K/120fps', rayTracing: 'Yes', controller: 'DualSense + Disc Drive' } },
    { id: 'xbox-series-s-512', name: 'Xbox Series S 512GB', category: 'Gaming Consoles', store: 'Flipkart', target: 32000, specs: { storage: '512 GB SSD', resolution: '1440p/120fps', rayTracing: 'Yes', controller: 'Wireless Controller' } },
    { id: 'xbox-series-s-carbon', name: 'Xbox Series S 1TB Carbon Black', category: 'Gaming Consoles', store: 'Amazon', target: 39000, specs: { storage: '1 TB SSD', resolution: '1440p/120fps', rayTracing: 'Yes', controller: 'Wireless Controller' } },
    { id: 'switch-lite', name: 'Nintendo Switch Lite (Coral)', category: 'Gaming Consoles', store: 'Croma', target: 15000, specs: { storage: '32 GB', resolution: '720p handheld', rayTracing: 'No', controller: 'Built-in D-Pad' } },
    { id: 'switch-oled-mario-red', name: 'Nintendo Switch OLED Mario Red Edition', category: 'Gaming Consoles', store: 'Amazon', target: 33000, specs: { storage: '64 GB', resolution: '1080p docked / 7" OLED', rayTracing: 'No', controller: 'Joy-Con Special Edition' } },
    { id: 'switch-standard', name: 'Nintendo Switch (Neon, 2019)', category: 'Gaming Consoles', store: 'Amazon', target: 25000, specs: { storage: '32 GB', resolution: '1080p docked', rayTracing: 'No', controller: 'Joy-Con' } },
    { id: 'playstation-portal', name: 'PlayStation Portal Remote Player', category: 'Gaming Consoles', store: 'Croma', target: 20000, specs: { storage: 'Streaming only', resolution: '1080p/60fps remote play', rayTracing: 'N/A', controller: 'Integrated DualSense' } },
    { id: 'ps-vr2', name: 'PlayStation VR2', category: 'Gaming Consoles', store: 'Amazon', target: 45000, specs: { storage: 'Requires PS5', resolution: '4K HDR OLED (per eye 2000x2040)', rayTracing: 'PS5-powered', controller: 'Sense Controllers' } },
    { id: 'rog-ally-z1e', name: 'ASUS ROG Ally (Z1 Extreme, 512GB)', category: 'Gaming Consoles', store: 'Flipkart', target: 70000, specs: { storage: '512 GB SSD', resolution: '1080p/120Hz handheld', rayTracing: 'RDNA3', controller: 'Integrated + Windows 11' } },
    { id: 'rog-ally-x', name: 'ASUS ROG Ally X (1TB)', category: 'Gaming Consoles', store: 'Amazon', target: 90000, specs: { storage: '1 TB SSD', resolution: '1080p/120Hz handheld', rayTracing: 'RDNA3', controller: 'Integrated + 80Wh battery' } },
    { id: 'legion-go', name: 'Lenovo Legion Go (512GB)', category: 'Gaming Consoles', store: 'Flipkart', target: 80000, specs: { storage: '512 GB SSD', resolution: '8.8" 144Hz QHD+', rayTracing: 'RDNA3', controller: 'Detachable TrueStrike' } },
    { id: 'legion-go-s', name: 'Lenovo Legion Go S (1TB)', category: 'Gaming Consoles', store: 'Amazon', target: 60000, specs: { storage: '1 TB SSD', resolution: '8" 120Hz IPS', rayTracing: 'RDNA3', controller: 'Integrated + SteamOS option' } },
    { id: 'steam-deck-oled', name: 'Valve Steam Deck OLED (512GB)', category: 'Gaming Consoles', store: 'Amazon', target: 65000, specs: { storage: '512 GB NVMe', resolution: '7.4" OLED 90Hz', rayTracing: 'No', controller: 'Integrated + SteamOS' } },
    { id: 'msi-claw-a1m', name: 'MSI Claw A1M (512GB)', category: 'Gaming Consoles', store: 'Amazon', target: 70000, specs: { storage: '512 GB SSD', resolution: '7" 120Hz IPS', rayTracing: 'Intel Arc', controller: 'Integrated + Windows 11' } },
    { id: 'logitech-g-cloud', name: 'Logitech G Cloud Handheld', category: 'Gaming Consoles', store: 'Amazon', target: 30000, specs: { storage: '64 GB', resolution: '7" 1080p/60Hz', rayTracing: 'Cloud streaming', controller: 'Integrated + Android' } },
    { id: 'nvidia-shield-tv', name: 'NVIDIA Shield TV Gaming Edition', category: 'Gaming Consoles', store: 'Amazon', target: 22000, specs: { storage: '16 GB + microSD', resolution: '4K HDR Android TV', rayTracing: 'No', controller: 'Shield Controller' } },

    // Air Conditioners (expanded)
    { id: 'daikin-1.0', name: 'Daikin 1 Ton 5 Star Inverter AC', category: 'Air Conditioners', store: 'Flipkart', target: 36000, specs: { capacity: '1 Ton', rating: '5 Star', type: 'Inverter', coolant: 'R-32', features: 'PM 2.5 Filter, Coanda' } },
    { id: 'daikin-2.0', name: 'Daikin 2 Ton 3 Star Inverter AC', category: 'Air Conditioners', store: 'Amazon', target: 52000, specs: { capacity: '2 Ton', rating: '3 Star', type: 'Inverter', coolant: 'R-32', features: 'Econo Mode, Self-Diagnosis' } },
    { id: 'lg-1.0-5star', name: 'LG 1 Ton 5 Star AI DUAL Inverter AC', category: 'Air Conditioners', store: 'Flipkart', target: 34000, specs: { capacity: '1 Ton', rating: '5 Star', type: 'AI DUAL Inverter', coolant: 'R-32', features: 'Wi-Fi, AI Convertible 6-in-1' } },
    { id: 'voltas-1.0', name: 'Voltas 1 Ton 3 Star Inverter AC', category: 'Air Conditioners', store: 'Amazon', target: 26000, specs: { capacity: '1 Ton', rating: '3 Star', type: 'Inverter', coolant: 'R-32', features: 'Turbo Cool, Anti-Dust Filter' } },
    { id: 'voltas-2.0-5star', name: 'Voltas 2 Ton 5 Star Inverter AC', category: 'Air Conditioners', store: 'Flipkart', target: 48000, specs: { capacity: '2 Ton', rating: '5 Star', type: 'Inverter', coolant: 'R-32', features: '4-in-1 Adjustable Mode' } },
    { id: 'samsung-windfree-1.5', name: 'Samsung 1.5 Ton 5 Star WindFree AC', category: 'Air Conditioners', store: 'Amazon', target: 48000, specs: { capacity: '1.5 Ton', rating: '5 Star', type: 'WindFree Inverter', coolant: 'R-32', features: 'Wi-Fi, WindFree Cooling, Easy Filter Plus' } },
    { id: 'bluestar-1.0', name: 'Blue Star 1 Ton 3 Star Inverter AC', category: 'Air Conditioners', store: 'Flipkart', target: 27000, specs: { capacity: '1 Ton', rating: '3 Star', type: 'Inverter', coolant: 'R-32', features: 'Self-Diagnosis, Comfort Sleep' } },
    { id: 'bluestar-1.5-5star', name: 'Blue Star 1.5 Ton 5 Star Inverter AC', category: 'Air Conditioners', store: 'Amazon', target: 44000, specs: { capacity: '1.5 Ton', rating: '5 Star', type: 'Inverter', coolant: 'R-32', features: 'Wi-Fi, Self-Clean, Hydrophilic Blue Fin' } },
    { id: 'hitachi-1.5-4star', name: 'Hitachi 1.5 Ton 4 Star Inverter AC', category: 'Air Conditioners', store: 'Flipkart', target: 42000, specs: { capacity: '1.5 Ton', rating: '4 Star', type: 'Inverter', coolant: 'R-32', features: 'Tropical Inverter, Copper Condenser' } },
    { id: 'panasonic-1.5-wifi', name: 'Panasonic 1.5 Ton 3 Star Wi-Fi Inverter AC', category: 'Air Conditioners', store: 'Amazon', target: 36000, specs: { capacity: '1.5 Ton', rating: '3 Star', type: 'Inverter', coolant: 'R-32', features: 'MirAie App, Alexa/Ok Google' } },
    { id: 'carrier-1.0-flexicool', name: 'Carrier 1 Ton 3 Star Flexicool Inverter AC', category: 'Air Conditioners', store: 'Flipkart', target: 25000, specs: { capacity: '1 Ton', rating: '3 Star', type: 'Flexicool Inverter', coolant: 'R-32', features: '6-in-1 Flexicool, PM 2.5 Filter' } },
    { id: 'godrej-1.5-3star', name: 'Godrej 1.5 Ton 3 Star Inverter AC', category: 'Air Conditioners', store: 'Amazon', target: 30000, specs: { capacity: '1.5 Ton', rating: '3 Star', type: 'Inverter', coolant: 'R-290', features: '5-in-1 Convertible, Anti-Corrosive' } },
    { id: 'whirlpool-1.5-5star', name: 'Whirlpool 1.5 Ton 5 Star 3D Cool AC', category: 'Air Conditioners', store: 'Flipkart', target: 40000, specs: { capacity: '1.5 Ton', rating: '5 Star', type: '3D Cool Inverter', coolant: 'R-32', features: 'IntelliConvert 6-in-1, Turbo Cool' } },
    { id: 'lloyd-1.5-5star', name: 'Lloyd 1.5 Ton 5 Star Inverter AC', category: 'Air Conditioners', store: 'Amazon', target: 33000, specs: { capacity: '1.5 Ton', rating: '5 Star', type: 'Inverter', coolant: 'R-32', features: 'Wi-Fi, 5-in-1 Convertible, Golden Fin' } },
    { id: 'onida-1.5-3star', name: 'Onida 1.5 Ton 3 Star Inverter AC', category: 'Air Conditioners', store: 'Flipkart', target: 28000, specs: { capacity: '1.5 Ton', rating: '3 Star', type: 'Inverter', coolant: 'R-32', features: 'Copper Condenser, Hidden Display' } },
    { id: 'haier-1.5-3star', name: 'Haier 1.5 Ton 3 Star Inverter AC', category: 'Air Conditioners', store: 'Amazon', target: 29000, specs: { capacity: '1.5 Ton', rating: '3 Star', type: 'Inverter', coolant: 'R-32', features: 'Supersonic Cooling in 10 Seconds, Self-Clean' } },
    { id: 'ogeneral-1.0', name: 'O General 1 Ton 3 Star Inverter AC', category: 'Air Conditioners', store: 'Croma', target: 45000, specs: { capacity: '1 Ton', rating: '3 Star', type: 'Inverter', coolant: 'R-32', features: 'Powerful Mode, Long Piping' } },
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
    const p = products.find(x => x.id === id);
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    /* anchor demo pricing to the product's real target so every category stays plausible */
    if (p && p.target > 0) {
        const price = Math.round(p.target * (0.84 + (h % 24) / 100) / 10) * 10;
        const stockRoll = (h >>> 9) % 11;
        return {
            price,
            originalPrice: Math.round(price * (1.18 + ((h >>> 4) % 24) / 100)),
            availability: stockRoll === 0 ? 'Out of Stock' : stockRoll === 1 ? 'Low Stock' : 'In Stock',
            rating: Math.round((86 + ((h >>> 3) % 14)) / 2) / 10,
            reviews: 400 + (h % 24000)
        };
    }
    const price = 2999 + (h % 76) * 999;
    return {
        price,
        originalPrice: Math.round(price * 1.28),
        availability: 'In Stock',
        rating: Math.round((86 + ((h >>> 3) % 14)) / 2) / 10,
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

const MAX_CONCURRENT_SCRAPES = 6;
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
    const store = canonicalStore(body.url);

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
