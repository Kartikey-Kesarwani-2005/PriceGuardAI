const alerts = [
    { type: 'price', icon: '↓', title: 'Price dropped', product: 'Apple iPhone 15', message: 'Price dropped from ₹64,999 to ₹59,999', amount: '₹5,000', time: '18 minutes ago' },
    { type: 'price', icon: '↓', title: 'Price dropped', product: 'OnePlus 12', message: 'Price dropped from ₹69,999 to ₹64,999', amount: '₹5,000', time: '35 minutes ago' },
    { type: 'stock', icon: '!', title: 'Low stock detected', product: 'Dell XPS 15', message: 'Only limited stock appears to be available', amount: '', time: '1 hour ago' },
    { type: 'price', icon: '↓', title: 'Target price reached', product: 'Sony WH-1000XM5', message: 'Product is now closer to your target price', amount: '₹27,990', time: '2 hours ago' },
    { type: 'stock', icon: '!', title: 'Low stock detected', product: 'Samsung Galaxy Buds', message: 'Only 3 sellers left with stock', amount: '', time: '3 hours ago' },
    { type: 'price', icon: '↓', title: 'Big price drop', product: 'Google Pixel 8', message: 'Major sale price active on Flipkart', amount: '₹8,000', time: '5 hours ago' }
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
