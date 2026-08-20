const express = require('express');
const { exec } = require('child_process');
const router = express.Router();

const products = [
    { id: 'iphone15', name: 'Apple iPhone 15', store: 'Amazon', url: 'https://www.amazon.in/dp/B0D875WP7X', target: 55000, pipeline: 'amazon_product' },
    { id: 'galaxys24', name: 'Samsung Galaxy S24', store: 'Flipkart', url: 'https://www.flipkart.com/samsung-galaxy-s24-5g-marble-gray-256-gb/p/itm6d6498db3c82c', target: 60000, pipeline: 'google_shopping' },
    { id: 'hppavilion', name: 'HP Pavilion 14', store: 'Amazon', url: 'https://www.amazon.in/dp/B0CVRD9RPZ', target: 48000, pipeline: 'amazon_product' },
    { id: 'sonywh1000', name: 'Sony WH-1000XM5', store: 'Croma', url: 'https://www.croma.com/sony-wh-1000xm5-wireless-noise-cancelling-headphones-black/p/273745', target: 27000, pipeline: 'google_shopping' }
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
