const { test } = require('node:test');
const assert = require('node:assert');
const {
    extractJson,
    normalizeRecord,
    titleScore,
    selectBestRecord,
    validateExtraction
} = require('../lib/scraperEngine');

test('extractJson parses JSON embedded in CLI noise', () => {
    const noisy = 'Scraping...\nTriggered (response_id: abc)\n[{"title":"Pixel 8","price":55999}]\nDone.';
    const parsed = extractJson(noisy);
    assert.strictEqual(parsed[0].price, 55999);
});

test('extractJson handles nested braces inside strings', () => {
    const text = '{"title":"Phone {special}","current_price":{"value":100}}';
    const parsed = extractJson('prefix ' + text + ' suffix');
    assert.strictEqual(parsed.current_price.value, 100);
});

test('extractJson throws on non-JSON output', () => {
    assert.throws(() => extractJson('no json here at all'));
});

test('normalizeRecord unwraps nested price objects', () => {
    const rec = normalizeRecord({
        product_title: 'JBL Tune 770NC',
        current_price: { value: 5799, currency: 'INR' },
        original_price: { value: 9999, currency: 'INR' },
        seller_rating: 4,
        review_count: 4
    });
    assert.strictEqual(rec.price, 5799);
    assert.strictEqual(rec.originalPrice, 9999);
    assert.strictEqual(rec.rating, 4);
    assert.strictEqual(rec.reviews, 4);
});

test('normalizeRecord parses rupee-formatted price strings', () => {
    const rec = normalizeRecord({ title: 'Phone', price: '₹62,999' });
    assert.strictEqual(rec.price, 62999);
});

test('normalizeRecord collapses 1000x-inflated collector prices', () => {
    const rec = normalizeRecord({
        product_title: 'Apple iPhone 15 (Blue, 128 GB)',
        current_price: { value: 57900000 },
        original_price: { value: 59900000 }
    });
    assert.strictEqual(rec.price, 57900);
    assert.strictEqual(rec.originalPrice, 59900);
});

test('normalizeRecord keeps legitimate sub-5-lakh prices untouched', () => {
    const rec = normalizeRecord({ title: 'MacBook Air M4', current_price: { value: 114900 } });
    assert.strictEqual(rec.price, 114900);
});

test('normalizeRecord returns null when no price exists', () => {
    assert.strictEqual(normalizeRecord({ title: 'No price item' }), null);
});

test('normalizeRecord maps boolean availability', () => {
    assert.strictEqual(normalizeRecord({ title: 'X', price: 5, in_stock: true }).availability, undefined || 'Unknown');
    const rec = normalizeRecord({ title: 'X', price: 5, availability: false });
    assert.strictEqual(rec.availability, 'Out of Stock');
});

test('titleScore ranks exact model higher than sibling variant', () => {
    const product = { name: 'Google Pixel 8 (128GB)' };
    const exact = titleScore('Google Pixel 8 (128 GB) Unlocked', product);
    const variant = titleScore('Google Pixel 11 Pro (256 GB)', product);
    assert.ok(exact > variant, `exact ${exact} should beat variant ${variant}`);
});

test('titleScore uses word boundaries for short numeric tokens', () => {
    const product = { name: 'Google Pixel 8 (128GB)' };
    assert.ok(titleScore('Google Pixel 11 (128 GB)', product) < 1);
    assert.ok(titleScore('Google Pixel 8', product) > titleScore('Google Pixel 9', product));
});

test('selectBestRecord prefers matching title and near-target price', () => {
    const product = { name: 'Google Pixel 8 (128GB)', target: 50000 };
    const records = [
        { product_title: 'Google Pixel 11 Pro', current_price: { value: 149999 } },
        { product_title: 'Google Pixel 8 (128 GB)', current_price: { value: 55999 } },
        { product_title: 'Random accessory', current_price: { value: 439 } }
    ];
    const best = selectBestRecord(records, product);
    assert.strictEqual(best.price, 55999);
});

test('validateExtraction rejects implausibly low prices', () => {
    const product = { name: 'Sony WH-1000XM5', target: 25000 };
    const result = validateExtraction({ title: 'Sony WH-1000XM5', price: 1797, matchScore: 1 }, product);
    assert.strictEqual(result.ok, false);
    assert.match(result.reason, /implausibly low/);
});

test('validateExtraction rejects mismatched titles', () => {
    const product = { name: 'Sony WH-1000XM5', target: 25000 };
    const result = validateExtraction({ title: 'Boat Wired Earphone', price: 5000, matchScore: 0 }, product);
    assert.strictEqual(result.ok, false);
});

test('validateExtraction accepts valid record', () => {
    const product = { name: 'Apple iPhone 15 (128GB)', target: 65000 };
    const result = validateExtraction({ title: 'Apple iPhone 15 128GB Black', price: 59900, matchScore: 0.8 }, product);
    assert.strictEqual(result.ok, true);
});
