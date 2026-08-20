const express = require('express');
const { exec } = require('child_process');
const router = express.Router();

const products = [
    { id: 'iphone15', name: 'Apple iPhone 15 (128GB)', store: 'Amazon', url: 'https://www.amazon.in/dp/B0D875WP7X', target: 55000, pipeline: 'amazon_product' },
    { id: 'iphone15pro', name: 'Apple iPhone 15 Pro (128GB)', store: 'Amazon', url: 'https://www.amazon.in/dp/B0D878JP7W', target: 100000, pipeline: 'amazon_product' },
    { id: 'galaxys24', name: 'Samsung Galaxy S24 5G (256GB)', store: 'Flipkart', url: 'https://www.flipkart.com/samsung-galaxy-s24-5g-marble-gray-256-gb/p/itm6d6498db3c82c', target: 60000, pipeline: 'google_shopping' },
    { id: 'galaxys24ultra', name: 'Samsung Galaxy S24 Ultra (256GB)', store: 'Amazon', url: 'https://www.amazon.in/dp/B0CMDL6WP5', target: 110000, pipeline: 'amazon_product' },
    { id: 'oneplus12', name: 'OnePlus 12 (256GB)', store: 'Amazon', url: 'https://www.amazon.in/dp/B0CSV2GFPV', target: 55000, pipeline: 'amazon_product' },
    { id: 'pixel8', name: 'Google Pixel 8 (128GB)', store: 'Flipkart', url: 'https://www.flipkart.com/google-pixel-8-bay-128-gb/p/itm7c7188325efef', target: 50000, pipeline: 'google_shopping' },
    { id: 'macbookair', name: 'Apple MacBook Air M3 (8GB/256GB)', store: 'Amazon', url: 'https://www.amazon.in/dp/B0CX23V2ZK', target: 90000, pipeline: 'amazon_product' },
    { id: 'dellxps', name: 'Dell XPS 15 (i7/16GB/512GB)', store: 'Amazon', url: 'https://www.amazon.in/dp/B0CX28V2ZK', target: 110000, pipeline: 'amazon_product' },
    { id: 'asusrog', name: 'ASUS ROG Strix G16 (i7/RTX 4060)', store: 'Flipkart', url: 'https://www.flipkart.com/asus-rog-strix-g16-2024-core-i7-14th-gen-16-gb-1-tb-ssd-rtx-4060-win11-home-16-gaming-laptop/p/itm6b15dbc2cebd2', target: 100000, pipeline: 'google_shopping' },
    { id: 'sonywh1000', name: 'Sony WH-1000XM5', store: 'Croma', url: 'https://www.croma.com/sony-wh-1000xm5-wireless-noise-cancelling-headphones-black/p/273745', target: 27000, pipeline: 'google_shopping' },
    { id: 'airpodspro', name: 'Apple AirPods Pro 2nd Gen', store: 'Amazon', url: 'https://www.amazon.in/dp/B0D1XD1ZV3', target: 20000, pipeline: 'amazon_product' },
    { id: 'samsungbuds', name: 'Samsung Galaxy Buds3 Pro', store: 'Amazon', url: 'https://www.amazon.in/dp/B0D63MFLS1', target: 15000, pipeline: 'amazon_product' },
    { id: 'applewatch', name: 'Apple Watch SE 2nd Gen (40mm)', store: 'Amazon', url: 'https://www.amazon.in/dp/B0CHX6BM37', target: 25000, pipeline: 'amazon_product' },
    { id: 'samsungwatch', name: 'Samsung Galaxy Watch6 (44mm)', store: 'Flipkart', url: 'https://www.flipkart.com/samsung-galaxy-watch6-graphite-44-mm/p/itm9e89afdbe8cdb6', target: 20000, pipeline: 'google_shopping' },
    { id: 'ipadair', name: 'Apple iPad Air M1 (64GB)', store: 'Amazon', url: 'https://www.amazon.in/dp/B0B3C5RSMK', target: 48000, pipeline: 'amazon_product' }
];

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
        lastChecked: new Date().toISOString()
    };
}

router.get('/products', async (req, res) => {
    try {
        const results = await Promise.all(products.map(async (product) => {
            try {
                const data = await fetchProductData(product);
                return mapProductData(product, data);
            } catch (err) {
                console.error(`Error fetching ${product.name}:`, err.message);
                return { ...product, price: 0, originalPrice: 0, availability: 'Error fetching data', rating: 0, reviews: 0, image: '', lastChecked: new Date().toISOString(), error: err.message };
            }
        }));
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/products/:id', async (req, res) => {
    const product = products.find(p => p.id === req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    try {
        const data = await fetchProductData(product);
        res.json(mapProductData(product, data));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
