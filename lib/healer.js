const { scrapeProduct, STORE_CONFIG, execCmd, loadCollectors, BDATA, activeKeyIndex } = require('./scraperEngine');

const HEAL_COOLDOWN_MS = 60 * 60 * 1000;
const RETRY_DELAY_MS = 3000;

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

function emptyStats() {
    return {
        attempts: 0,
        successes: 0,
        failures: 0,
        heals: 0,
        lastError: null,
        lastSuccessAt: null,
        lastHealAt: null
    };
}

function getStats(cache, productId) {
    if (!cache.stats[productId]) cache.stats[productId] = emptyStats();
    return cache.stats[productId];
}

function successRate(stats) {
    if (!stats.attempts) return null;
    return Math.round((stats.successes / stats.attempts) * 1000) / 10;
}

function buildHealPrompt(product, reason) {
    const cfg = STORE_CONFIG[product.store];
    const site = cfg && cfg.searchUrl ? new URL(cfg.searchUrl('x')).hostname : product.store.toLowerCase();
    return `Validation failed on ${site} search results: ${reason}. Re-extract the listing that matches "${product.name}" and return for it: title/name, current selling price in INR, original MRP or list price, availability/stock status, rating, review count, product URL.`.slice(0, 1000);
}

async function attemptHeal(product, reason) {
    const cfg = STORE_CONFIG[product.store];
    if (!cfg || cfg.type !== 'collector') return 'skipped';
    const collectors = loadCollectors(activeKeyIndex());
    const col = collectors[cfg.key];
    if (!col || !col.collector_id) return 'skipped';

    console.log(`[healer] Triggering Scraper Studio self-heal for ${product.store} (${col.collector_id})...`);
    const prompt = buildHealPrompt(product, reason);
    try {
        await execCmd(`${BDATA} scraper heal ${col.collector_id} "${prompt.replace(/"/g, "'")}" --auto-approve --json`, 600000);
        console.log(`[healer] Heal committed for ${product.store}, re-running scraper...`);
        return 'ran';
    } catch (e) {
        console.error(`[healer] Heal failed for ${product.store}:`, e.message);
        return 'failed';
    }
}

async function commitSuccess(product, match, cache, source) {
    const stats = getStats(cache, product.id);
    stats.successes++;
    stats.lastError = null;
    stats.lastSuccessAt = new Date().toISOString();
    return {
        ...product,
        price: match.price,
        originalPrice: match.originalPrice,
        availability: match.availability,
        rating: match.rating,
        reviews: match.reviews,
        lastChecked: new Date().toISOString(),
        _source: source
    };
}

function failureRecord(product, message) {
    return {
        ...product,
        price: 0,
        originalPrice: 0,
        availability: 'Error',
        rating: 0,
        reviews: 0,
        lastChecked: new Date().toISOString(),
        error: message,
        _source: 'error'
    };
}

async function scrapeWithHealing(product, cache) {
    const stats = getStats(cache, product.id);
    stats.attempts++;

    let lastErr = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            const match = await scrapeProduct(product);
            return await commitSuccess(product, match, cache, 'live');
        } catch (err) {
            lastErr = err;
            stats.lastError = err.message.slice(0, 300);
            console.error(`[scrape] Attempt ${attempt}/2 failed for "${product.name}": ${err.message}`);
            if (attempt < 2) await sleep(RETRY_DELAY_MS);
        }
    }

    const cfg = STORE_CONFIG[product.store];
    const isCollector = cfg && cfg.type === 'collector';
    const cooldownOver = !stats.lastHealAt || (Date.now() - new Date(stats.lastHealAt).getTime()) > HEAL_COOLDOWN_MS;

    if (isCollector && cooldownOver) {
        const healResult = await attemptHeal(product, lastErr ? lastErr.message : 'unknown extraction failure');
        if (healResult !== 'skipped') {
            stats.heals++;
            stats.lastHealAt = new Date().toISOString();
        }
        if (healResult === 'ran') {
            try {
                const match = await scrapeProduct(product);
                console.log(`[healer] Self-heal successful for "${product.name}"`);
                return await commitSuccess(product, match, cache, 'live-healed');
            } catch (err) {
                stats.lastError = err.message.slice(0, 300);
                console.error(`[scrape] Post-heal run still failing for "${product.name}": ${err.message}`);
            }
        }
    }

    stats.failures++;
    const cached = cache.products[product.id];
    if (cached && !cached.error && cached.price) {
        console.warn(`[fallback] Serving stale cached data for "${product.name}"`);
        return { ...cached, stale: true, _source: 'stale', lastChecked: cached.lastChecked };
    }
    return failureRecord(product, lastErr ? lastErr.message : 'Unknown scraping failure');
}

module.exports = { scrapeWithHealing, getStats, successRate, emptyStats };
