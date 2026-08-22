const alertsList = document.getElementById('alertsList');
const caughtUp = document.querySelector('.caught-up');

function showCaughtUp(show) {
    if (caughtUp) caughtUp.classList.toggle('hidden', !show);
}

async function renderAlerts() {
    if (!alertsList) return;
    alertsList.innerHTML = '<div class="loading">Loading alerts...</div>';
    showCaughtUp(false);

    try {
        const alerts = await fetchAlerts();
        showCaughtUp(alerts.length === 0);
        alertsList.classList.toggle('hidden', alerts.length === 0);

        if (alerts.length === 0) return;

        alertsList.innerHTML = '';

        alerts.forEach(a => {
            const row = document.createElement('div');
            row.className = 'alert-row';
            const iconClass = a.type === 'error' ? 'alert-icon-error' : a.type === 'stock' ? 'alert-icon-warning' : 'alert-icon';
            const timeAgo = getTimeAgo(a.time);
            row.innerHTML = `
                <div class="${iconClass}">${a.icon}</div>
                <div class="alert-content">
                    <div class="alert-top">
                        <div><h3>${a.title}</h3><strong>${a.product}</strong></div>
                        <span>${timeAgo}</span>
                    </div>
                    <p>${a.message}</p>
                    ${a.amount ? '<b class="alert-amount">' + a.amount + '</b>' : ''}
                </div>`;
            alertsList.appendChild(row);
        });
    } catch (err) {
        showCaughtUp(false);
        alertsList.innerHTML = '<div class="error">Error loading alerts</div>';
    }
}

function getTimeAgo(timestamp) {
    const diff = Date.now() - new Date(timestamp).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return mins + ' minutes ago';
    const hours = Math.floor(mins / 60);
    if (hours < 24) return hours + ' hours ago';
    return Math.floor(hours / 24) + ' days ago';
}

renderAlerts();
