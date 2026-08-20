const express = require('express');
const { exec } = require('child_process');
const router = express.Router();

const products = [
    { id: 'iphone', name: 'Apple iPhone 15', store: 'Amazon', url: 'https://www.amazon.in/dp/B0D875WP7X', target: 55000, pipeline: 'amazon_product' },
    { id: 'galaxy-s', name: 'Samsung Galaxy S24', store: 'Flipkart', url: 'https://www.flipkart.com/samsung-galaxy-s24-5g-marble-gray-256-gb/p/itm6d6498db3c82c', target: 60000, pipeline: 'google_shopping' },
    { id: 'oneplus', name: 'OnePlus 12', store: 'Amazon', url: 'https://www.amazon.in/dp/B0CSV2GFPV', target: 55000, pipeline: 'amazon_product' },
    { id: 'pixel', name: 'Google Pixel 8', store: 'Flipkart', url: 'https://www.flipkart.com/google-pixel-8-bay-128-gb/p/itm7c7188325efef', target: 50000, pipeline: 'google_shopping' },
    { id: 'macbook', name: 'Apple MacBook Air', store: 'Amazon', url: 'https://www.amazon.in/dp/B0CX23V2ZK', target: 90000, pipeline: 'amazon_product' },
    { id: 'dell-laptop', name: 'Dell XPS 15', store: 'Amazon', url: 'https://www.amazon.in/dp/B0CX28V2ZK', target: 110000, pipeline: 'amazon_product' },
    { id: 'asus-laptop', name: 'ASUS ROG Strix', store: 'Flipkart', url: 'https://www.flipkart.com/asus-rog-strix-g16-2024-core-i7-14th-gen-16-gb-1-tb-ssd-rtx-4060-win11-home-16-gaming-laptop/p/itm6b15dbc2cebd2', target: 100000, pipeline: 'google_shopping' },
    { id: 'sony-headphones', name: 'Sony WH-1000XM5', store: 'Croma', url: 'https://www.croma.com/sony-wh-1000xm5-wireless-noise-cancelling-headphones-black/p/273745', target: 27000, pipeline: 'google_shopping' },
    { id: 'airpods', name: 'Apple AirPods Pro', store: 'Amazon', url: 'https://www.amazon.in/dp/B0D1XD1ZV3', target: 20000, pipeline: 'amazon_product' },
    { id: 'galaxy-buds', name: 'Samsung Galaxy Buds', store: 'Amazon', url: 'https://www.amazon.in/dp/B0D63MFLS1', target: 15000, pipeline: 'amazon_product' },
    { id: 'apple-watch', name: 'Apple Watch SE', store: 'Amazon', url: 'https://www.amazon.in/dp/B0CHX6BM37', target: 25000, pipeline: 'amazon_product' },
    { id: 'galaxy-watch', name: 'Samsung Galaxy Watch', store: 'Flipkart', url: 'https://www.flipkart.com/samsung-galaxy-watch6-graphite-44-mm/p/itm9e89afdbe8cdb6', target: 20000, pipeline: 'google_shopping' },
    { id: 'ipad', name: 'Apple iPad Air', store: 'Amazon', url: 'https://www.amazon.in/dp/B0B3C5RSMK', target: 48000, pipeline: 'amazon_product' },
    { id: 'realme-phone', name: 'Realme GT 6', store: 'Flipkart', url: 'https://www.flipkart.com/realme-gt-6-titanium-256-gb/p/itm6f5f5f5f5f5f5', target: 30000, pipeline: 'google_shopping' },
    { id: 'jbl-speaker', name: 'JBL Charge 5', store: 'Amazon', url: 'https://www.amazon.in/dp/B08X4YZLXS', target: 15000, pipeline: 'amazon_product' }
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
