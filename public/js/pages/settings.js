const demoToggle = document.getElementById('toggleDemo');
const settingToggles = document.querySelectorAll('.toggle:not(#toggleDemo)');
const interval = document.getElementById('interval');

async function apiGet(url) {
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        return await res.json();
    } catch (e) {
        return null;
    }
}

async function apiPost(url, body) {
    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
    } catch (e) { /* keep UI state regardless */ }
}

function applyToggleState(toggle, enabled) {
    if (!toggle) return;
    toggle.classList.toggle('toggle-on', !!enabled);
}

async function hydrate() {
    const [mode, settings] = await Promise.all([apiGet('/api/mode'), apiGet('/api/settings')]);

    applyToggleState(demoToggle, mode && mode.demo);

    if (settings) {
        settingToggles.forEach(t => applyToggleState(t, settings[t.dataset.setting]));
        if (interval && settings.intervalMinutes) interval.value = String(settings.intervalMinutes);
    }
}

if (demoToggle) {
    demoToggle.addEventListener('click', () => {
        const enabled = !demoToggle.classList.contains('toggle-on');
        applyToggleState(demoToggle, enabled);
        apiPost('/api/mode', { demo: enabled });
    });
}

settingToggles.forEach(toggle => {
    toggle.addEventListener('click', () => {
        const enabled = !toggle.classList.contains('toggle-on');
        applyToggleState(toggle, enabled);
        apiPost('/api/settings', { [toggle.dataset.setting]: enabled });
    });
});

if (interval) {
    interval.addEventListener('change', () => {
        apiPost('/api/settings', { intervalMinutes: parseInt(interval.value, 10) });
    });
}

hydrate();
