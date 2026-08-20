const alerts = [
    { type: 'price', icon: '↓', title: 'Price drop detected', product: 'Smartphones', message: 'Average smartphone prices dropped across Amazon', amount: '₹3,500', time: '18 minutes ago' },
    { type: 'price', icon: '↓', title: 'Sale alert', product: 'Laptops', message: 'Big billion day deals active on Flipkart', amount: '₹12,000', time: '35 minutes ago' },
    { type: 'stock', icon: '!', title: 'Low stock warning', product: 'Gaming Consoles', message: 'Limited stock across multiple sellers', amount: '', time: '1 hour ago' },
    { type: 'price', icon: '↓', title: 'Target price hit', product: 'Headphones', message: 'Multiple headphones below target price', amount: '₹2,000', time: '2 hours ago' },
    { type: 'stock', icon: '!', title: 'Out of stock', product: 'Smartwatches', message: 'Popular models going out of stock', amount: '', time: '3 hours ago' },
    { type: 'price', icon: '↓', title: 'Price drop', product: 'Televisions', message: 'TV prices trending down this week', amount: '₹5,000', time: '5 hours ago' }
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
