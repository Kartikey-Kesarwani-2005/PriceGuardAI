const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const COLLECTORS_FILE = path.join(DATA_DIR, 'collectors.json');

const EXEC_TIMEOUT_MS = 150000;
const COLLECTOR_TIMEOUT_MS = 480000;
const BDATA = 'npx --yes --package @brightdata/cli bdata';

const STORE_CONFIG = {
    Amazon: { type: 'pipeline' },
    Flipkart: {
        type: 'collector',
        key: 'flipkart',
        searchUrl: q => `https://www.flipkart.com/search?q=${encodeURIComponent(q)}`
    },
    Croma: {
        type: 'collector',
        key: 'croma',
        searchUrl: q => `https://www.croma.com/search?q=${encodeURIComponent(q)}`
    }
};

function loadCollectors() {
    try {
        if (fs.existsSync(COLLECTORS_FILE)) {
            return JSON.parse(fs.readFileSync(COLLECTORS_FILE, 'utf-8'));
        }
    } catch (e) { console.error('Failed to load collectors:', e.message); }
    return {};
}

function saveCollectors(data) {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(COLLECTORS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function execCmd(cmd, timeoutMs = EXEC_TIMEOUT_MS) {
    return new Promise((resolve, reject) => {
        exec(cmd, { timeout: timeoutMs, windowsHide: true, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
            if (!stdout || !stdout.trim()) {
                const msg = stderr && stderr.trim() ? stderr.trim().slice(0, 300) : (error ? error.message : 'Empty scraper output');
                return reject(new Error(msg));
            }
            resolve(stdout);
        });
    });
}

function extractJson(text) {
    let start = -1;
    for (let i = 0; i < text.length; i++) {
        if (text[i] === '[' || text[i] === '{') { start = i; break; }
    }
    if (start === -1) throw new Error('No JSON found in scraper output');
    const open = text[start];
    const close = open === '[' ? ']' : '}';
    let depth = 0, inStr = false, esc = false, end = -1;
    for (let i = start; i < text.length; i++) {
        const c = text[i];
        if (inStr) {
            if (esc) esc = false;
            else if (c === '\\') esc = true;
            else if (c === '"') inStr = false;
            continue;
        }
        if (c === '"') inStr = true;
        else if (c === open) depth++;
        else if (c === close) {
            depth--;
            if (depth === 0) { end = i + 1; break; }
        }
    }
    if (end === -1) throw new Error('Malformed JSON in scraper output');
    return JSON.parse(text.slice(start, end));
}

function unwrap(v) {
    if (v && typeof v === 'object' && !Array.isArray(v) && v.value !== undefined) return v.value;
    return v;
}

function toNumber(v) {
    v = unwrap(v);
    if (typeof v === 'number' && isFinite(v)) return v;
    if (typeof v === 'string') {
        const m = v.replace(/[₹$,\s]/g, '').match(/[\d.]+/);
        if (m) {
            const n = parseFloat(m[0]);
            if (isFinite(n)) return n;
        }
    }
    return null;
}

function normalizeRecord(rec) {
    if (!rec || typeof rec !== 'object') return null;
    const pick = (...keys) => {
        for (const k of keys) {
            const v = rec[k];
            if (v !== undefined && v !== null && v !== '') return v;
        }
        return null;
    };
    let price = toNumber(pick('current_price', 'price', 'final_price', 'sale_price', 'discounted_price', 'offer_price'));
    let originalPrice = toNumber(pick('list_price', 'original_price', 'mrp', 'was_price', 'strikethrough_price', 'market_price', 'initial_price'));
    let title = pick('title', 'name', 'product_name', 'product_title');
    if (title !== null && typeof title !== 'string') title = String(title);
    let availability = pick('availability', 'stock_status', 'stock_availability', 'availability_status');
    if (availability === true || availability === 'true' || availability === 1) availability = 'In Stock';
    else if (availability === false || availability === 'false' || availability === 0) availability = 'Out of Stock';
    else if (typeof availability === 'string') availability = availability.trim();
    else availability = 'Unknown';
    const rating = toNumber(pick('rating', 'average_rating', 'star_rating', 'stars', 'seller_rating'));
    const reviews = toNumber(pick('reviews_count', 'num_reviews', 'review_count', 'ratings_count', 'reviews'));
    const url = pick('url', 'link', 'product_url', 'product_page_url');
    if (!price && originalPrice) { price = originalPrice; originalPrice = null; }
    if (!price) return null;
    return {
        title: title || '',
        price,
        originalPrice: originalPrice && originalPrice > price ? originalPrice : (originalPrice || 0),
        availability,
        rating: rating || 0,
        reviews: Math.round(reviews || 0),
        url: url || ''
    };
}

function containsToken(cand, t) {
    if (t.length <= 2) {
        const esc = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp('(^|[^a-z0-9])' + esc + '([^a-z0-9]|$)').test(cand);
    }
    return cand.includes(t);
}

function titleScore(candidateTitle, product) {
    if (!candidateTitle) return 0.5;
    const stop = new Set(['with', 'for', 'and', 'the', 'inch']);
    const tokens = product.name.toLowerCase().replace(/[^a-z0-9+.\s]/g, ' ').split(/\s+/).filter(t => t.length > 0 && !stop.has(t));
    if (!tokens.length) return 0.5;
    const cand = candidateTitle.toLowerCase();
    let hits = 0, total = 0;
    tokens.forEach(t => {
        const w = Math.max(t.length, 2);
        total += w;
        if (containsToken(cand, t)) hits += w;
    });
    return hits / total;
}

function selectBestRecord(payload, product) {
    const arr = Array.isArray(payload) ? payload : [payload];
    let best = null, bestScore = -1;
    for (const rec of arr) {
        const n = normalizeRecord(rec);
        if (!n) continue;
        let score = titleScore(n.title, product);
        if (product.target && score > 0.3) {
            const proximity = 1 - Math.min(1, Math.abs(n.price - product.target) / product.target);
            score += proximity * 0.15;
        }
        if (score > bestScore) { bestScore = score; best = n; }
    }
    return best ? { ...best, matchScore: bestScore } : null;
}

function validateExtraction(match, product) {
    if (!match) return { ok: false, reason: 'no record with a valid price found in scraper output' };
    if (!match.price || match.price <= 0) return { ok: false, reason: 'price missing or zero in extracted data' };
    if (product.target && match.price > product.target * 6) {
        return { ok: false, reason: `extracted price ${match.price} is implausibly high vs target ${product.target}` };
    }
    if (product.target && match.price < product.target * 0.15) {
        return { ok: false, reason: `extracted price ${match.price} is implausibly low vs target ${product.target} - likely a wrong listing or accessory` };
    }
    if (match.title && match.matchScore < 0.25) {
        return { ok: false, reason: `extracted title "${match.title.slice(0, 60)}" does not match requested product` };
    }
    return { ok: true };
}

async function scrapeProduct(product) {
    const cfg = STORE_CONFIG[product.store];
    if (!cfg) throw new Error(`Unsupported store: ${product.store}`);

    let cmd, kind, timeoutMs;
    if (cfg.type === 'pipeline') {
        cmd = `${BDATA} pipelines amazon_product_search "${product.name}" "https://www.amazon.in" --json`;
        kind = 'pipeline';
        timeoutMs = EXEC_TIMEOUT_MS;
    } else {
        const collectors = loadCollectors();
        const col = collectors[cfg.key];
        if (col && col.collector_id) {
            cmd = `${BDATA} scraper run ${col.collector_id} "${cfg.searchUrl(product.name)}" --timeout 420 --json`;
            kind = 'collector';
            timeoutMs = COLLECTOR_TIMEOUT_MS;
        } else {
            throw new Error(`No Scraper Studio collector configured for ${product.store}. Run: npm run setup:scrapers`);
        }
    }

    const stdout = await execCmd(cmd, timeoutMs);
    let payload;
    try {
        payload = extractJson(stdout);
    } catch (e) {
        throw new Error(`[${kind}] ${e.message}`);
    }
    const match = selectBestRecord(payload, product);
    const validation = validateExtraction(match, product);
    if (!validation.ok) {
        const err = new Error(`[${kind}] Validation failed: ${validation.reason}`);
        err.validation = true;
        err.match = match;
        throw err;
    }
    return match;
}

module.exports = {
    STORE_CONFIG,
    COLLECTORS_FILE,
    BDATA,
    loadCollectors,
    saveCollectors,
    execCmd,
    extractJson,
    scrapeProduct
};
