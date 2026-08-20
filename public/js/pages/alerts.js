const alerts = [
    { type: 'price', icon: '↓', title: 'Price dropped', product: 'Apple iPhone 15', message: 'Price dropped from ₹64,999 to ₹59,999', amount: '₹5,000', time: '18 minutes ago' },
    { type: 'stock', icon: '!', title: 'Low stock detected', product: 'HP Pavilion 14', message: 'Only limited stock appears to be available', amount: '', time: '1 hour ago' },
    { type: 'price', icon: '↓', title: 'Target price reached', product: 'Sony WH-1000XM5', message: 'Product is now closer to your target price', amount: '₹29,990', time: '3 hours ago' }
];

const alertsList = document.getElementById('alertsList');

if (alertsList) {
    alerts.forEach(a => {
        const row = document.createElement('div');
        row.className = 'alert-row';
        row.innerHTML = `
            <div class="alert-icon">${a.icon}</div>
            <div class="alert-content">
                <div class="alert-top">
                    <div><h3>${a.title}</h3><strong>${a.product}</strong></div>
                    <span>${a.time}</span>
                </div>
                <p>${a.message}</p>
                ${a.amount ? `<b class="alert-amount">${a.amount}</b>` : ''}
            </div>`;
        alertsList.appendChild(row);
    });
}
