const express = require('express');
const fs = require('fs');
const path = require('path');
const productRoutes = require('./routes/products');

let INDEX_HTML = null;
try {
    INDEX_HTML = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf-8');
} catch (e) { /* not available in some environments */ }

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', productRoutes);

app.get('/{*splat}', (req, res) => {
    if (INDEX_HTML) return res.send(INDEX_HTML);
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`PriceGuard AI running at http://localhost:${PORT}`);
    });
}

module.exports = app;
