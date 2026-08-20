const healingEvents = [
    { site: 'Amazon', product: 'Apple iPhone 15 (128GB)', oldSelector: '.price', newSelector: '.current-price', confidence: 96, time: '12 minutes ago' },
    { site: 'Flipkart', product: 'Samsung Galaxy S24 5G', oldSelector: '.price-box', newSelector: "[data-testid='price']", confidence: 93, time: '48 minutes ago' },
    { site: 'Amazon', product: 'OnePlus 12 (256GB)', oldSelector: '.a-price-whole', newSelector: '#priceblock_ourprice', confidence: 91, time: '1 hour ago' },
    { site: 'Croma', product: 'Sony WH-1000XM5', oldSelector: '.availability', newSelector: '.stock-status', confidence: 98, time: '2 hours ago' },
    { site: 'Amazon', product: 'AirPods Pro 2nd Gen', oldSelector: '#priceblock_dealprice', newSelector: '.a-price .a-offscreen', confidence: 95, time: '3 hours ago' },
    { site: 'Flipkart', product: 'Google Pixel 8 (128GB)', oldSelector: '._16Jk6D', newSelector: '._30jeq3', confidence: 89, time: '4 hours ago' }
];

const healingList = document.getElementById('healingList');

if (healingList) {
    healingEvents.forEach(ev => {
        const card = document.createElement('div');
        card.className = 'healing-card';
        card.innerHTML = `
            <div class="healing-info">
                <div class="healing-title">
                    <span class="success-icon">✓</span>
                    <h3>${ev.site} · ${ev.product}</h3>
                </div>
                <span>Repaired ${ev.time}</span>
            </div>
            <div class="selector-flow">
                <code>${ev.oldSelector}</code>
                <span>→</span>
                <code class="selector-new">${ev.newSelector}</code>
            </div>
            <div class="confidence">
                <span>AI confidence</span>
                <strong>${ev.confidence}%</strong>
            </div>`;
        healingList.appendChild(card);
    });
}
