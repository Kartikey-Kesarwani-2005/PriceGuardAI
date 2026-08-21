const sidebar = document.getElementById('sidebar');
const openSidebar = document.getElementById('openSidebar');
const closeSidebar = document.getElementById('closeSidebar');

if (openSidebar) {
    openSidebar.addEventListener('click', () => {
        sidebar.classList.add('sidebar-open');
    });
}

if (closeSidebar) {
    closeSidebar.addEventListener('click', () => {
        sidebar.classList.remove('sidebar-open');
    });
}

const notificationBtn = document.getElementById('notificationBtn');
if (notificationBtn) {
    notificationBtn.addEventListener('click', () => {
        window.location.href = 'alerts.html';
    });
    if (typeof fetchAlerts === 'function') {
        fetchAlerts().then(alerts => {
            const dot = notificationBtn.querySelector('.notification-dot');
            if (dot && (!alerts || !alerts.length)) dot.style.display = 'none';
        }).catch(() => {});
    }
}

const globalSearch = document.getElementById('globalSearch');
const pageSearch = document.getElementById('productSearch');

function applyGlobalSearch(value) {
    const query = value.trim();
    if (pageSearch) {
        pageSearch.value = query;
        pageSearch.dispatchEvent(new Event('input'));
    } else if (query) {
        window.location.href = 'products.html?search=' + encodeURIComponent(query);
    }
}

if (globalSearch) {
    globalSearch.addEventListener('keydown', e => {
        if (e.key === 'Enter') applyGlobalSearch(globalSearch.value);
    });
    if (pageSearch) {
        let debounce;
        globalSearch.addEventListener('input', () => {
            clearTimeout(debounce);
            debounce = setTimeout(() => applyGlobalSearch(globalSearch.value), 300);
        });
    }
}
