const healingEvents = [
    { site: 'Amazon', product: 'Smartphones', oldSelector: '.s-result-item', newSelector: '[data-component-type="s-search-result"]', confidence: 96, time: '12 minutes ago' },
    { site: 'Flipkart', product: 'Laptops', oldSelector: '._1AtVbE', newSelector: '._13oc-S', confidence: 93, time: '48 minutes ago' },
    { site: 'Amazon', product: 'Headphones', oldSelector: '.a-price', newSelector: '.a-price .a-offscreen', confidence: 91, time: '1 hour ago' },
    { site: 'Croma', product: 'Smartwatches', oldSelector: '.product-price', newSelector: '.selling-price', confidence: 98, time: '2 hours ago' },
    { site: 'Amazon', product: 'Televisions', oldSelector: '#priceblock_ourprice', newSelector: '.a-price-whole', confidence: 95, time: '3 hours ago' },
    { site: 'Flipkart', product: 'Speakers', oldSelector: '._1V2m46', newSelector: '._30jeq3._16Jk6D', confidence: 89, time: '4 hours ago' }
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
