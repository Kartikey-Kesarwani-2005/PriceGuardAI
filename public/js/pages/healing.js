const healingList = document.getElementById('healingList');

async function renderHealing() {
    if (!healingList) return;
    healingList.innerHTML = '<div class="loading">Loading healing events...</div>';

    try {
        const events = await fetchHealing();
        healingList.innerHTML = '';

        if (events.length === 0) {
            healingList.innerHTML = '<div class="loading">No healing events</div>';
            return;
        }

        events.forEach(ev => {
            const card = document.createElement('div');
            card.className = 'healing-card';
            const timeAgo = getTimeAgo(ev.time);
            const statusIcon = ev.status === 'repaired' ? '✓' : '✗';
            const statusClass = ev.status === 'repaired' ? 'success-icon' : 'error-icon';
            card.innerHTML = `
                <div class="healing-info">
                    <div class="healing-title">
                        <span class="${statusClass}">${statusIcon}</span>
                        <h3>${ev.site} · ${ev.product}</h3>
                    </div>
                    <span>Repaired ${timeAgo}</span>
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
    } catch (err) {
        healingList.innerHTML = '<div class="error">Error loading healing events</div>';
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

renderHealing();
