document.querySelectorAll('.toggle').forEach(toggle => {
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
