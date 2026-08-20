const express = require('express');
const { exec } = require('child_process');
const router = express.Router();

const products = [
    { id: 'smartphones', name: 'Smartphones', store: 'Amazon', url: 'https://www.amazon.in/s?k=smartphones&ref=nb_sb_noss', target: 30000, pipeline: 'amazon_product_search' },
    { id: 'laptops', name: 'Laptops', store: 'Amazon', url: 'https://www.amazon.in/s?k=laptops&ref=nb_sb_noss', target: 60000, pipeline: 'amazon_product_search' },
    { id: 'headphones', name: 'Headphones', store: 'Amazon', url: 'https://www.amazon.in/s?k=wireless+headphones&ref=nb_sb_noss', target: 5000, pipeline: 'amazon_product_search' },
    { id: 'smartwatches', name: 'Smartwatches', store: 'Amazon', url: 'https://www.amazon.in/s?k=smartwatches&ref=nb_sb_noss', target: 15000, pipeline: 'amazon_product_search' },
    { id: 'tablets', name: 'Tablets', store: 'Amazon', url: 'https://www.amazon.in/s?k=tablets&ref=nb_sb_noss', target: 30000, pipeline: 'amazon_product_search' },
    { id: 'cameras', name: 'Cameras', store: 'Amazon', url: 'https://www.amazon.in/s?k=cameras&ref=nb_sb_noss', target: 40000, pipeline: 'amazon_product_search' },
    { id: 'gaming', name: 'Gaming Consoles', store: 'Amazon', url: 'https://www.amazon.in/s?k=gaming+consoles&ref=nb_sb_noss', target: 40000, pipeline: 'amazon_product_search' },
    { id: 'tvs', name: 'Televisions', store: 'Flipkart', url: 'https://www.flipkart.com/search?q=televisions', target: 35000, pipeline: 'google_shopping' },
    { id: 'ac', name: 'Air Conditioners', store: 'Flipkart', url: 'https://www.flipkart.com/search?q=air+conditioners', target: 30000, pipeline: 'google_shopping' },
    { id: 'washing-machines', name: 'Washing Machines', store: 'Flipkart', url: 'https://www.flipkart.com/search?q=washing+machines', target: 25000, pipeline: 'google_shopping' },
    { id: 'refrigerators', name: 'Refrigerators', store: 'Flipkart', url: 'https://www.flipkart.com/search?q=refrigerators', target: 30000, pipeline: 'google_shopping' },
    { id: 'speakers', name: 'Speakers', store: 'Croma', url: 'https://www.croma.com/searchB?q=bluetooth%20speakers', target: 5000, pipeline: 'google_shopping' },
    { id: 'earphones', name: 'Earphones', store: 'Croma', url: 'https://www.croma.com/searchB?q=earphones', target: 2000, pipeline: 'google_shopping' },
    { id: 'monitors', name: 'Monitors', store: 'Amazon', url: 'https://www.amazon.in/s?k=computer+monitors&ref=nb_sb_noss', target: 20000, pipeline: 'amazon_product_search' },
    { id: 'printers', name: 'Printers', store: 'Amazon', url: 'https://www.amazon.in/s?k=printers&ref=nb_sb_noss', target: 15000, pipeline: 'amazon_product_search' }
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
