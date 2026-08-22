const { execCmd, loadCollectors, saveCollectors, collectorsFileFor, KEY_POOL, COLLECTORS_FILE } = require('../lib/scraperEngine');

const DESCRIPTION = 'Extract product listings from this e-commerce search results page. IMPORTANT: do NOT follow pagination links and do NOT navigate into product detail pages - process only the first results page in a single pass to avoid rate limits. For each visible listing capture: title/name of product, current selling price in INR, original MRP or list price, availability or stock status, rating out of 5, number of reviews, and the product URL.';

async function createStoreCollector(storeKey, label) {
    const cfg = STORE_CONFIG[label];
    const sampleUrl = cfg.searchUrl('iphone 15');
    console.log(`\n[setup] Creating ${storeKey} scraper via Bright Data Scraper Studio AI Agent...`);
    console.log(`[setup] Sample URL: ${sampleUrl}`);
    const stdout = await execCmd(
        `npx --yes --package @brightdata/cli bdata scraper create "${sampleUrl}" "${DESCRIPTION}" --name priceguard-${storeKey} --json`,
        900000
    );
    const envelope = JSON.parse(stdout.slice(stdout.indexOf('{')));
    if (!envelope.collector_id) {
        throw new Error(`No collector_id returned: ${JSON.stringify(envelope).slice(0, 300)}`);
    }
    console.log(`[setup] ${storeKey} collector created: ${envelope.collector_id}`);
    console.log(`[setup] View/edit in Studio: ${envelope.view_url || 'https://brightdata.com/cp/scrapers'}`);
    return envelope;
}

async function main() {
    const sel = (process.argv[2] || '').toLowerCase();
    const m = /^k(\d+)$/.exec(sel);
    const keyIdx = m ? parseInt(m[1], 10) - 1 : 0;
    if (m) {
        if (!KEY_POOL[keyIdx]) {
            throw new Error(`Key #${keyIdx + 1} not found. BRIGHTDATA_API_KEYS has ${KEY_POOL.length} key(s) in .env`);
        }
        process.env.BRIGHTDATA_API_KEY = KEY_POOL[keyIdx];
        console.log(`[setup] Using API key #${keyIdx + 1} from pool`);
    }
    const collectorsFile = collectorsFileFor(keyIdx);
    const collectors = loadCollectors(keyIdx);
    let created = 0;

    for (const [key, label] of [['flipkart', 'Flipkart'], ['croma', 'Croma']]) {
        if (collectors[key] && collectors[key].collector_id) {
            console.log(`[setup] ${key} collector already exists: ${collectors[key].collector_id} (skipping)`);
            continue;
        }
        try {
            const env = await createStoreCollector(key, label);
            collectors[key] = {
                collector_id: env.collector_id,
                name: env.name,
                view_url: env.view_url,
                created_at: new Date().toISOString()
            };
            saveCollectors(collectors, collectorsFile);
            created++;
        } catch (e) {
            console.error(`[setup] Failed to create ${key} collector:`, e.message);
            console.error('[setup] Make sure you are logged in first: npx -p @brightdata/cli bdata login');
        }
    }

    console.log(`\n[setup] Done. ${created} collector(s) created.`);
    console.log('[setup] Collectors file:', m ? collectorsFile : COLLECTORS_FILE);
}

main();
