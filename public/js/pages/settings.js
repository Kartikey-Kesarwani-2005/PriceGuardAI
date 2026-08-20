async function loadDemoMode() {
    try {
        const res = await fetch('/api/mode');
        const data = await res.json();
        const toggle = document.getElementById('toggleDemo');
        if (toggle) {
            if (data.demo) {
                toggle.classList.add('toggle-on');
            } else {
                toggle.classList.remove('toggle-on');
            }
        }
    } catch (e) {}
}

loadDemoMode();

document.querySelectorAll('.toggle').forEach(toggle => {
    if (toggle.id === 'toggleDemo') {
        toggle.addEventListener('click', async () => {
            toggle.classList.toggle('toggle-on');
            const enabled = toggle.classList.contains('toggle-on');
            localStorage.setItem('pg_demo', enabled);
            try {
                await fetch('/api/mode', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ demo: enabled })
                });
            } catch (e) {}
        });
        return;
    }

    toggle.addEventListener('click', () => {
        toggle.classList.toggle('toggle-on');
        const setting = toggle.dataset.setting;
        const enabled = toggle.classList.contains('toggle-on');
        localStorage.setItem(`pg_${setting}`, enabled);
    });

    const setting = toggle.dataset.setting;
    if (localStorage.getItem(`pg_${setting}`) === 'false') {
        toggle.classList.remove('toggle-on');
    }
});

const interval = document.getElementById('interval');
if (interval) {
    const saved = localStorage.getItem('pg_interval');
    if (saved) interval.value = saved;

    interval.addEventListener('change', () => {
        localStorage.setItem('pg_interval', interval.value);
    });
}
